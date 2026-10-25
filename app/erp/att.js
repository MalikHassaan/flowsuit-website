// Attendance button (window.FS_ATT): sits above the chat button on every ERP page.
// On the office internet one press checks in or out. Anywhere else it takes the exact location and a selfie first.
// After the end of the working day it turns red while the person is still checked in.
(function () {
  var C = window.FS_ATT;
  if (!C || window.__fsAtt) return;
  window.__fsAtt = true;
  var S = null, skew = 0, root, pill, card, warned = false;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function api(path, body) {
    var o = { credentials: "same-origin", headers: { "X-CSRF-Token": C.csrf } };
    if (body) { o.method = "POST"; o.body = body; }
    return fetch(C.api + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
        return j;
      });
    });
  }
  function serverNow() { return new Date(Date.now() + skew); }
  function hm(d) { return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  // Server time in Pakistan, whatever the device's own clock or time zone says.
  function pkNow() { return new Date(serverNow().getTime() + (serverNow().getTimezoneOffset() + 300) * 60000); }
  function late() { return S && S.state === "in" && hm(pkNow()) >= S.end; }

  function build() {
    root = document.createElement("div");
    root.id = "fs-att";
    root.innerHTML = '<button type="button" class="fsa-pill"></button><section class="fsa-card" hidden></section>';
    document.body.appendChild(root);
    pill = root.querySelector(".fsa-pill");
    card = root.querySelector(".fsa-card");
    ["keydown", "keyup", "keypress"].forEach(function (t) { root.addEventListener(t, function (e) { e.stopPropagation(); }); });
    pill.addEventListener("click", function () { card.hidden ? openCard() : closeCard(); });
    card.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]");
      if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "close") closeCard();
      if (a === "in" || a === "out") check(a);
      if (a === "snap") snap();
      if (a === "retake") retake();
      if (a === "send") send();
    });
  }

  function paint() {
    if (!S) return;
    var p = S.punches, last = p[p.length - 1];
    root.classList.toggle("is-in", S.state === "in");
    root.classList.toggle("is-late", late());
    pill.innerHTML = S.state === "in"
      ? '<i></i><span>' + (late() ? "Check out now" : "In since " + esc(firstIn())) + "</span>"
      : S.state === "out" ? "<i></i><span>Out at " + esc(last.at) + "</span>" : "<i></i><span>Check in</span>";
    pill.title = S.state === "in" ? "You are checked in. Press to check out." : "Press to check in";
    if (late() && !warned) {
      warned = true;
      if (card.hidden) openCard("It is " + S.end + ", the end of the working day. Remember to check out.");
    }
  }
  function firstIn() { for (var i = S.punches.length - 1; i >= 0; i--) if (S.punches[i].kind === "in") return S.punches[i].at; return ""; }

  function openCard(note) {
    var rows = S.punches.map(function (x) {
      return "<li><b>" + (x.kind === "in" ? "In" : "Out") + " " + esc(x.at) + "</b> " + (x.method === "office" ? "Office" : x.method === "corrected" ? "Corrected" : x.site ? "At " + esc(x.site) : "Not at a known site") + "</li>";
    }).join("");
    var doing = S.state === "in" ? "out" : "in";
    card.innerHTML = '<header><b>Attendance</b><button type="button" data-a="close" aria-label="Close">&#215;</button></header>'
      + (note ? '<p class="fsa-warn">' + esc(note) + "</p>" : "")
      + (rows ? '<ul class="fsa-list">' + rows + "</ul>" : '<p class="fsa-muted">' + (S.workday ? "You have not checked in today." : "Today is a day off.") + "</p>")
      + '<p class="fsa-muted">' + (S.office ? "You are on the office internet." : "You are away from the office: your location and a selfie are saved with the time.") + "</p>"
      + '<p class="fsa-err" hidden></p><div class="fsa-cam" hidden></div>'
      + '<div class="fsa-go"><button type="button" class="fsa-btn' + (doing === "out" ? " is-out" : "") + '" data-a="' + doing + '">' + (doing === "in" ? "Check in" : "Check out") + "</button>"
      + '<a href="' + C.page + '" target="_top">My attendance</a></div>';
    card.hidden = false;
    root.classList.add("is-open");
  }
  function closeCard() { stopCam(); card.hidden = true; root.classList.remove("is-open"); }
  function err(m) { var e = card.querySelector(".fsa-err"); if (e) { e.textContent = m || ""; e.hidden = !m; } }
  function busy(on, label) {
    var b = card.querySelector(".fsa-go .fsa-btn, .fsa-cam [data-a=send]");
    card.querySelectorAll("button.fsa-btn").forEach(function (x) { x.disabled = on; });
    if (b && label) b.textContent = label;
  }

  // ---- Checking in ----
  var pending = null, stream = null, shot = null, where = null;

  function check(kind) {
    err("");
    pending = kind;
    if (S.office) return submit(new FormData());
    // Away from the office: location and selfie, both taken now.
    where = null;
    shot = null;
    busy(true, "Finding your location…");
    navigator.geolocation ? navigator.geolocation.getCurrentPosition(function (pos) {
      where = pos.coords;
      busy(false);
      camera();
    }, function (x) {
      busy(false, kind === "in" ? "Check in" : "Check out");
      err(x.code === 1 ? "Location is blocked. Allow location for flowsuit.net in your browser settings, then try again." : "Your location could not be found. Turn on GPS and try again.");
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }) : err("This browser cannot share its location. Use Chrome or Safari on your phone.");
  }

  function camera() {
    var cam = card.querySelector(".fsa-cam");
    card.querySelector(".fsa-go").hidden = true;
    cam.hidden = false;
    cam.innerHTML = '<p class="fsa-muted">Location found (±' + Math.round(where.accuracy) + ' m). Now take a selfie.</p><video playsinline muted autoplay></video><canvas hidden></canvas><img hidden alt="Your selfie">'
      + '<div class="fsa-go"><button type="button" class="fsa-btn" data-a="snap">Take photo</button></div>'
      + '<div class="fsa-go" hidden><button type="button" class="fsa-btn" data-a="send">' + (pending === "in" ? "Check in" : "Check out") + '</button><button type="button" class="fsa-link" data-a="retake">Retake</button></div>'
      + '<label class="fsa-file" hidden>Your camera did not open. <input type="file" accept="image/*" capture="user"></label>';
    var video = cam.querySelector("video");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false }).then(function (s) {
        stream = s;
        video.srcObject = s;
      }).catch(fallback);
    } else fallback();
  }
  // No live camera (blocked, or an old browser): the phone's own camera app through a file input.
  function fallback() {
    var cam = card.querySelector(".fsa-cam");
    cam.querySelector("video").hidden = true;
    cam.querySelector(".fsa-go").hidden = true;
    var f = cam.querySelector(".fsa-file");
    f.hidden = false;
    f.querySelector("input").onchange = function () {
      var file = this.files[0];
      if (!file) return;
      var img = new Image();
      img.onload = function () { draw(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
      img.src = URL.createObjectURL(file);
    };
  }
  function draw(src, w, h) {
    var cam = card.querySelector(".fsa-cam"), cv = cam.querySelector("canvas"), k = Math.min(1, 640 / Math.max(w, h));
    cv.width = Math.round(w * k);
    cv.height = Math.round(h * k);
    cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
    cv.toBlob(function (b) {
      shot = b;
      var img = cam.querySelector("img");
      img.src = cv.toDataURL("image/jpeg", 0.6);
      img.hidden = false;
      cam.querySelector("video").hidden = true;
      cam.querySelector(".fsa-file").hidden = true;
      var gos = cam.querySelectorAll(".fsa-go");
      gos[0].hidden = true;
      gos[1].hidden = false;
      stopCam();
    }, "image/jpeg", 0.75);
  }
  function snap() {
    var v = card.querySelector(".fsa-cam video");
    if (!v.videoWidth) return err("The camera is still starting. Try again in a second.");
    draw(v, v.videoWidth, v.videoHeight);
  }
  function retake() { shot = null; camera(); }
  function stopCam() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
  function send() {
    if (!shot || !where) return;
    var fd = new FormData();
    fd.append("lat", where.latitude);
    fd.append("lng", where.longitude);
    fd.append("acc", where.accuracy);
    fd.append("photo", shot, "selfie.jpg");
    submit(fd);
  }
  function submit(fd) {
    fd.append("kind", pending);
    busy(true, "Saving…");
    api("/check", fd).then(function (j) {
      take(j);
      warned = j.state !== "in";
      closeCard();
      pill.classList.add("is-done");
      setTimeout(function () { pill.classList.remove("is-done"); }, 1500);
    }).catch(function (x) { busy(false, pending === "in" ? "Check in" : "Check out"); err(x.message); });
  }

  function take(j) { S = j; skew = j.now * 1000 - Date.now(); paint(); }
  function load() {
    return api("/state").then(take).catch(function (x) { if (/Signed out/.test(x.message)) { root.hidden = true; clearInterval(timer); } });
  }
  var timer;
  function start() {
    if (!document.body) return setTimeout(start, 50);
    build();
    load();
    timer = setInterval(function () { document.hidden ? null : paint(); }, 30000);
    setInterval(function () { if (!document.hidden && card.hidden) load(); }, 300000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
    page();
  }

  // ---- Helpers for the Attendance page itself ----
  function page() {
    var req = document.querySelector("[data-att-req]");
    if (req) {
      var sync = function () {
        var t = req.querySelector("input[name=type]:checked").value;
        req.querySelectorAll("[data-for]").forEach(function (g) { g.hidden = g.getAttribute("data-for") !== t; });
      };
      req.addEventListener("change", sync);
      sync();
    }
    var add = document.querySelector("[data-att-addip]");
    if (add) add.addEventListener("click", function () {
      var t = document.querySelector("[data-att-ips]"), v = add.getAttribute("data-att-addip");
      if (t.value.split(/\s+/).indexOf(v) < 0) t.value = (t.value.trim() ? t.value.trim() + "\n" : "") + v;
      add.textContent = "added, now press Save settings";
    });
    var here = document.querySelector("[data-att-here]");
    if (here) here.addEventListener("click", function () {
      var f = document.querySelector("[data-att-site]");
      here.textContent = "finding you…";
      navigator.geolocation.getCurrentPosition(function (p) {
        f.lat.value = p.coords.latitude.toFixed(6);
        f.lng.value = p.coords.longitude.toFixed(6);
        here.textContent = "Use my location (±" + Math.round(p.coords.accuracy) + " m)";
      }, function () { here.textContent = "Location blocked; type it instead"; }, { enableHighAccuracy: true, timeout: 20000 });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
