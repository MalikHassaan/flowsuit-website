// Attendance button (window.FS_ATT): sits above the chat button on every ERP page.
// One press checks in or out; the device's location and the IP address are saved with the time.
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
      + '<p class="fsa-muted">' + (S.office ? "You are on the office internet." : "You are away from the office: your location is saved with the time.") + "</p>"
      + '<p class="fsa-err" hidden></p>'
      + '<div class="fsa-go"><button type="button" class="fsa-btn' + (doing === "out" ? " is-out" : "") + '" data-a="' + doing + '">' + (doing === "in" ? "Check in" : "Check out") + "</button>"
      + '<a href="' + C.page + '" target="_top">My attendance</a></div>';
    card.hidden = false;
    root.classList.add("is-open");
  }
  function closeCard() { card.hidden = true; root.classList.remove("is-open"); }
  function err(m) { var e = card.querySelector(".fsa-err"); if (e) { e.textContent = m || ""; e.hidden = !m; } }
  function busy(on, label) {
    var b = card.querySelector(".fsa-go .fsa-btn");
    card.querySelectorAll("button.fsa-btn").forEach(function (x) { x.disabled = on; });
    if (b && label) b.textContent = label;
  }

  // ---- Checking in ----
  // Every check-in asks for the device's location; the server also saves the IP address. On the office internet a
  // blocked location is fine (the IP proves where they are); anywhere else the location is required.
  var pending = null;

  function check(kind) {
    err("");
    pending = kind;
    var label = kind === "in" ? "Check in" : "Check out";
    var withoutLocation = function (why) {
      if (S.office) return submit(new FormData());
      busy(false, label);
      err(why);
    };
    if (!navigator.geolocation) return withoutLocation("This browser cannot share its location. Use Chrome or Safari on your phone.");
    busy(true, "Finding your location…");
    navigator.geolocation.getCurrentPosition(function (pos) {
      var fd = new FormData();
      fd.append("lat", pos.coords.latitude);
      fd.append("lng", pos.coords.longitude);
      fd.append("acc", pos.coords.accuracy);
      submit(fd);
    }, function (x) {
      withoutLocation(x.code === 1 ? "Location is blocked. Allow location for flowsuit.net in your browser settings, then try again." : "Your location could not be found. Turn on GPS and try again.");
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
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
