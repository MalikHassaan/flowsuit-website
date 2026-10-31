// Opening screen for the client apps (window.FS_INTRO, set by the page): shown straight away, kept for at least
// 5 seconds and until the app is ready, then zooms into it.
//   HSEC is ready when it puts "booted" on <html>; TAJ when its own sign-in screen (#login) is hidden.
(function () {
  var C = window.FS_INTRO || {}, MIN_MS = C.min || 5000, MAX_MS = 30000, start = Date.now();
  // HSEC (hassan, 2026-10-31): behind the name, a lift being assembled part by part: rails, traction machine, car
  // frame, cabin panels, doors, ropes and counterweight, then the finished car runs up and down the shaft.
  function liftScene(side) {
    var t = function (x, y, s, i) { return '<text class="fsl-t" x="' + x + '" y="' + y + '" style="--d:' + i + '">' + s + "</text>"; };
    return '<svg class="fsl fsl-' + side + '" viewBox="0 0 330 480" aria-hidden="true">'
      + '<rect class="fsl-shaft" x="20" y="40" width="200" height="432" rx="2"/>'
      + [150, 250, 350, 450].map(function (y, i) { return '<path class="fsl-floor" style="--d:' + i + '" d="M20 ' + y + 'h16M204 ' + y + 'h16"/>'; }).join("")
      + '<g class="fsl-rails"><rect x="48" y="40" width="4" height="432"/><rect x="148" y="40" width="4" height="432"/><rect x="170" y="40" width="2" height="432"/><rect x="204" y="40" width="2" height="432"/></g>'
      + '<g class="fsl-mach"><rect x="64" y="10" width="112" height="26" rx="3"/><rect class="fsl-motor" x="74" y="14" width="34" height="18" rx="2"/>'
      + '<g class="fsl-sheave"><circle cx="150" cy="22" r="13"/><path d="M150 9v26M137 22h26M141 13l18 18M159 13l-18 18"/></g></g>'
      + '<g class="fsl-cw"><g class="fsl-cwi"><rect x="174" y="120" width="28" height="74" rx="2"/><path d="M174 138h28M174 156h28M174 174h28"/></g></g>'
      + '<g class="fsl-car">'
      + '<rect class="fsl-rope fsl-rope1" x="135" y="35" width="1.6" height="277"/>'
      + '<rect class="fsl-frame" x="56" y="312" width="88" height="134" rx="2"/>'
      + '<rect class="fsl-roof" x="54" y="306" width="92" height="8" rx="2"/>'
      + '<rect class="fsl-pl" x="60" y="318" width="38" height="120"/><rect class="fsl-pr" x="102" y="318" width="38" height="120"/>'
      + '<rect class="fsl-dl" x="64" y="324" width="35" height="112"/><rect class="fsl-dr" x="101" y="324" width="35" height="112"/>'
      + '<rect class="fsl-base" x="50" y="440" width="100" height="8" rx="2"/></g>'
      + '<g class="fsl-cwrope"><rect class="fsl-rope fsl-rope2" x="187" y="35" width="1.6" height="85"/></g>'
      + t(228, 46, "Guide rails", 0) + t(228, 24, "Traction machine", 1) + t(228, 380, "Car frame", 2) + t(228, 396, "Cabin panels", 3)
      + t(228, 412, "Landing doors", 4) + t(228, 160, "Counterweight", 5) + t(228, 300, "Hoist ropes", 6)
      + "</svg>";
  }
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
  if (C.scene === "lift") intro.insertAdjacentHTML("afterbegin", liftScene("l") + liftScene("r"));
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
    if ((waited >= MIN_MS && ready()) || waited >= MAX_MS) { clearInterval(check); leave(); }
  }, 150);
})();
