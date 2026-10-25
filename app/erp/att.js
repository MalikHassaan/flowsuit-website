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
    if (gateEl) { err(note); return; }   // while the check-in screen is up, messages go there
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
  function err(m) {
    [card.querySelector(".fsa-err"), gateEl && gateEl.querySelector(".fsg-err")].forEach(function (e) { if (e) { e.textContent = m || ""; e.hidden = !m; } });
  }
  function busy(on, label) {
    var g = gateEl && gateEl.querySelector(".fsg-btn");
    if (g) { g.disabled = on; g.textContent = on ? (label || "Saving…") : "Check in now"; }
    var b = card.querySelector(".fsa-go .fsa-btn");
    card.querySelectorAll("button.fsa-btn").forEach(function (x) { x.disabled = on; });
    if (b && label) b.textContent = label;
  }

  // ---- Checking in ----
  // Every check-in asks for the device's location; the server also saves the IP address. On the office internet a
  // blocked location is fine (the IP proves where they are); anywhere else the location is required.
  var pending = null;

  // auto: the first time the ERP is opened on a working day, check in without a press.
  function check(kind, auto) {
    err("");
    pending = kind;
    var label = kind === "in" ? "Check in" : "Check out";
    var withoutLocation = function (why) {
      if (S.office) return submit(new FormData(), auto);
      if (auto) { busy(false, label); openCard("Your attendance was not marked yet. " + why); return; }
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
      submit(fd, auto);
    }, function (x) {
      withoutLocation(x.code === 1 ? "Location is blocked. Allow location for flowsuit.net in your browser settings, then try again." : "Your location could not be found. Turn on GPS and try again.");
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  function submit(fd, auto) {
    fd.append("kind", pending);
    if (auto) fd.append("auto", "1");
    busy(true, "Saving…");
    api("/check", fd).then(function (j) {
      take(j);
      warned = j.state !== "in";
      closeCard();
      pill.classList.add("is-done");
      setTimeout(function () { pill.classList.remove("is-done"); }, 1500);
    }).catch(function (x) {
      if (auto) { busy(false, "Check in"); if (!/already/.test(x.message)) openCard("Your attendance was not marked yet. " + x.message); load(); return; }
      busy(false, pending === "in" ? "Check in" : "Check out");
      err(x.message);
    });
  }

  var autoTried = false;
  function take(j) {
    S = j;
    skew = j.now * 1000 - Date.now();
    paint();
    gateSync();
    if (!autoTried && S.state === "none" && S.workday) { autoTried = true; check("in", true); }
  }

  // ---- Check-in screen ----
  // On a working day nobody uses the ERP until they have checked in: everything behind is blurred and a large
  // check-in card sits on top. The Attendance page itself stays open so people can ask for a correction.
  var gateEl = null, gateClock = null;
  function skipped() { try { return sessionStorage.getItem("fs-att-skip") === new Date().toDateString(); } catch (x) { return false; } }
  function gateNeeded() {
    return C.gate && S && S.state === "none" && S.workday && hm(pkNow()) < (S.cutoff || "23:59")
      && location.pathname.indexOf(C.page) !== 0 && !skipped();
  }
  function gateSync() {
    if (gateNeeded()) { if (!gateEl) gateOpen(); return; }
    if (gateEl) gateClose(S && S.state === "in");
  }
  function gateOpen() {
    var h = pkNow().getHours(), hello = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    gateEl = document.createElement("div");
    gateEl.id = "fs-gate";
    gateEl.setAttribute("role", "dialog");
    gateEl.setAttribute("aria-modal", "true");
    gateEl.innerHTML = '<div class="fsg-card"><div class="fsg-ring"><i></i><i></i><i></i><span><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span></div>'
      + '<p class="fsg-hello">' + esc(hello) + (C.name ? ", " + esc(C.name) : "") + "</p>"
      + "<h2>Check in to start your day</h2>"
      + '<p class="fsg-time"></p>'
      + '<p class="fsg-sub">The ERP opens as soon as you check in. ' + (S.office ? "You are on the office internet." : "You are away from the office, so your location is saved with the time.") + "</p>"
      + '<p class="fsg-late"></p>'
      + '<button type="button" class="fsg-btn">Check in now</button>'
      + '<p class="fsg-err" hidden></p>'
      + '<p class="fsg-help"><a href="' + C.page + '">Can\'t check in? Ask HR for a correction</a>' + (C.admin ? ' · <button type="button" class="fsg-skip">Skip for today (admin)</button>' : "") + "</p></div>";
    document.body.appendChild(gateEl);
    document.documentElement.classList.add("fs-gated");
    gateEl.querySelector(".fsg-btn").addEventListener("click", function () { check("in", false); });
    var sk = gateEl.querySelector(".fsg-skip");
    if (sk) sk.addEventListener("click", function () { try { sessionStorage.setItem("fs-att-skip", new Date().toDateString()); } catch (x) {} gateClose(false); });
    ["keydown", "keyup", "keypress"].forEach(function (t) { gateEl.addEventListener(t, function (e) { e.stopPropagation(); }); });
    var tick = function () {
      var n = pkNow(), t = gateEl && gateEl.querySelector(".fsg-time"), l = gateEl && gateEl.querySelector(".fsg-late");
      if (!t) return;
      t.textContent = n.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
      if (l && S.lateAfter) {
        var isLate = hm(n) > S.lateAfter;
        l.textContent = isLate ? "It is after " + S.lateAfter + ", so today counts as late." : "On time until " + S.lateAfter + ".";
        l.className = "fsg-late" + (isLate ? " is-late" : "");
      }
    };
    tick();
    gateClock = setInterval(tick, 1000);
    setTimeout(function () { var b = gateEl && gateEl.querySelector(".fsg-btn"); if (b) b.focus(); }, 300);
  }
  function gateClose(done) {
    var g = gateEl;
    gateEl = null;
    clearInterval(gateClock);
    if (!g) return;
    if (done) {
      var c = g.querySelector(".fsg-card");
      c.innerHTML = '<div class="fsg-ok">✓</div><h2>You are checked in</h2><p class="fsg-sub">' + esc(firstIn()) + " · Have a good day" + (C.name ? ", " + esc(C.name) : "") + ".</p>";
    }
    setTimeout(function () {
      g.classList.add("is-leaving");
      document.documentElement.classList.remove("fs-gated");
      setTimeout(function () { g.remove(); }, 600);
    }, done ? 1300 : 0);
  }
  function load() {
    return api("/state").then(take).catch(function (x) { if (/Signed out/.test(x.message)) { root.hidden = true; clearInterval(timer); } });
  }
  var timer;
  function start() {
    if (!document.body) return setTimeout(start, 50);
    build();
    load();
    timer = setInterval(function () { if (!document.hidden) { paint(); gateSync(); } }, 30000);
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
