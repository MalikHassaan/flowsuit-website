// Opening screen for the client apps (window.FS_INTRO, set by the page): shown straight away, kept for at least
// 5 seconds and until the app is ready, then zooms into it.
//   HSEC is ready when it puts "booted" on <html>; TAJ when its own sign-in screen (#login) is hidden.
(function () {
  var C = window.FS_INTRO || {}, MIN_MS = C.min || 5000, MAX_MS = 30000, start = Date.now();
  // HSEC (hassan, 2026-10-31): a film of a lift being built (shaft, frame, traction machine, ropes, cabin panels,
  // doors) plays across the whole screen, with both companies' emblems on a card at the bottom. The film ends on the
  // finished lift with its doors open, and the screen then moves into the lift and on into the ERP.
  var vid = null, vidDone = !C.video;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var intro = document.createElement("div");
  intro.id = "fs-intro";
  intro.className = C.theme ? "is-" + C.theme : "";
  intro.setAttribute("role", "status");
  intro.innerHTML = '<span class="fsb-corner c1"></span><span class="fsb-corner c2"></span><span class="fsb-corner c3"></span><span class="fsb-corner c4"></span>'
    + '<span class="fsb-tag">FLOWSUIT ERP</span><div class="fsb-stage">'
    + '<div class="fsb-core"><i class="r1"><b></b><b></b></i><i class="r2"><b></b></i><i class="r3"><b></b></i><span class="fsb-logo"><img src="' + C.logo + '" alt=""></span></div>'
    + '<h1 class="fsb-name">' + String(C.name).split("").map(function (c, i) { return '<span style="--i:' + i + '">' + c + "</span>"; }).join("") + "</h1>"
    + '<div class="fsb-sub"></div><div class="fsb-bar"><i></i></div><div class="fsb-msg"></div>'
    + (C.partner ? '<div class="fsb-partner"><span class="fsb-pimg"><img src="' + C.partner.img + '" alt=""></span><div class="fsb-pline">'
      + String(C.partner.line || "").split("").map(function (c, i) { return '<span style="--i:' + i + '">' + (c === " " ? "&nbsp;" : c) + "</span>"; }).join("") + "</div></div>" : "")
    + "</div>";
  if (C.video) {
    intro.classList.add("is-video");
    vid = document.createElement("video");
    vid.className = "fsv"; vid.muted = true; vid.autoplay = true; vid.playsInline = true; vid.preload = "auto";
    vid.setAttribute("muted", ""); vid.setAttribute("playsinline", ""); vid.setAttribute("aria-hidden", "true");
    var done = function () { vidDone = true; };
    vid.addEventListener("ended", done); vid.addEventListener("error", done);
    [].concat(C.video).forEach(function (u) {   // WebM first, MP4 for browsers without it
      var so = document.createElement("source"); so.src = u; so.type = /\.webm/.test(u) ? "video/webm" : "video/mp4"; vid.appendChild(so);
    });
    var srcs = vid.querySelectorAll("source"); if (srcs.length) srcs[srcs.length - 1].addEventListener("error", done);
    intro.insertBefore(vid, intro.firstChild);
    var p = vid.play(); if (p && p.catch) p.catch(done);   // autoplay refused: carry on without waiting for it
    setTimeout(function () { if (!vid.currentTime) done(); }, 4000);   // not started after 4 s (slow line): don't hold the ERP
  }
  document.documentElement.appendChild(intro);   // before <body> exists, so nothing else shows first

  // The subtitle types itself after the letters are in.
  var sub = intro.querySelector(".fsb-sub"), text = C.sub || "", k = 0;
  setTimeout(function type() {
    sub.textContent = text.slice(0, ++k);
    if (k < text.length) setTimeout(type, 45); else sub.classList.add("is-done");
  }, 900 + String(C.name).length * 280 + 300);

  // The partner's name slides in letter by letter once the subtitle is typed.
  var pl = intro.querySelector(".fsb-partner");
  if (pl) setTimeout(function () { pl.classList.add("is-on"); }, 900 + String(C.name).length * 280 + 300 + text.length * 45 + 250);

  // Status lines and the progress line move along the 5 seconds; the last step waits for the app.
  var steps = C.steps || ["Securing connection", "Verifying your access", "Loading your data", "Preparing your dashboard"];
  var msg = intro.querySelector(".fsb-msg"), bar = intro.querySelector(".fsb-bar i"), step = -1;
  function say(s) { msg.textContent = s; msg.classList.remove("is-new"); void msg.offsetWidth; msg.classList.add("is-new"); }
  var ticker = setInterval(function () {
    var t = Math.min(1, (Date.now() - start) / MIN_MS);
    bar.style.width = Math.round(8 + t * 82) + "%";
    var s = Math.min(steps.length - 1, Math.floor(t * steps.length));
    if (s !== step) { step = s; say(steps[s] + "…"); }
  }, 200);

  function ready() {
    if (!document.body) return false;
    if (C.wait === "login") { var g = document.getElementById("login"); return !g || g.hidden; }
    return document.documentElement.classList.contains("booted") || !document.getElementById("boot");
  }
  var leaving = false;
  function leave() {
    if (leaving) return;
    leaving = true;
    clearInterval(ticker);
    bar.style.width = "100%";
    say("Welcome");
    var gate = document.getElementById("fs-hide-gate");   // TAJ: its own sign-in card may show again (only if loading failed)
    if (gate) gate.remove();
    setTimeout(function () {
      var target = C.zoom && document.querySelector(C.zoom);
      if (target) target.setAttribute("data-fs-zoom", "");
      intro.classList.add("is-leaving");
      document.documentElement.classList.add("fs-zoom");
      setTimeout(function () {
        intro.remove();
        document.documentElement.classList.remove("fs-zoom");
        if (target) target.removeAttribute("data-fs-zoom");
      }, 1100);
    }, 450);
  }
  var check = setInterval(function () {
    var waited = Date.now() - start;
    if ((waited >= MIN_MS && vidDone && ready()) || waited >= MAX_MS) { clearInterval(check); leave(); }
  }, 150);
})();
