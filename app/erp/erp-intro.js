// Opening screen for the client apps (window.FS_INTRO, set by the page): shown straight away, kept for at least
// 5 seconds and until the app is ready, then zooms into it.
//   HSEC is ready when it puts "booted" on <html>; TAJ when its own sign-in screen (#login) is hidden.
(function () {
  var C = window.FS_INTRO || {}, MIN_MS = C.min || 5000, MAX_MS = 30000, start = Date.now();
  // HSEC (hassan, 2026-10-31): behind the name, a lift being assembled part by part: rails, traction machine, car
  // frame, cabin panels, doors, ropes and counterweight, then the finished car runs up and down the shaft. In the
  // colours of both companies, with HSEC's emblem and the Shanghai Mitsubishi Elevator emblem on the doors and a
  // hall indicator counting the floors, no captions.
  function liftScene(side) {
    var g = "fslg" + side, hs = esc(C.logo || ""), sm = esc((C.partner && C.partner.img) || "");
    var logo = function (href, x, y, w, h) { return href ? '<image href="' + href + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid meet"/>' : ""; };
    return '<svg class="fsl fsl-' + side + '" viewBox="0 0 330 480" aria-hidden="true"><defs>'
      + '<radialGradient id="' + g + 'glow"><stop offset="0" stop-color="' + (side === "l" ? "#1E9E3A" : "#E60012") + '" stop-opacity=".22"/><stop offset=".6" stop-color="' + (side === "l" ? "#2563EB" : "#F59E0B") + '" stop-opacity=".08"/><stop offset="1" stop-opacity="0"/></radialGradient>'
      + '<linearGradient id="' + g + 'cab" x1="0" x2="1"><stop offset="0" stop-color="#1D346C"/><stop offset=".5" stop-color="#2563EB"/><stop offset="1" stop-color="#1E9E3A"/></linearGradient>'
      + '<linearGradient id="' + g + 'door" x1="0" x2="1"><stop offset="0" stop-color="#E2E8F0"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#CBD5E1"/></linearGradient>'
      + '<linearGradient id="' + g + 'red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F43F5E"/><stop offset="1" stop-color="#B91C1C"/></linearGradient></defs>'
      + '<circle class="fsl-glow" cx="130" cy="260" r="210" fill="url(#' + g + 'glow)"/>'
      + '<rect class="fsl-shaft" x="20" y="40" width="200" height="432" rx="2"/>'
      + [150, 250, 350, 450].map(function (y, i) { return '<path class="fsl-floor" style="--d:' + i + '" d="M20 ' + y + 'h16M204 ' + y + 'h16"/>'; }).join("")
      + '<g class="fsl-rails"><rect x="48" y="40" width="4" height="432"/><rect x="148" y="40" width="4" height="432"/><rect x="170" y="40" width="2" height="432"/><rect x="204" y="40" width="2" height="432"/></g>'
      + '<g class="fsl-mach"><rect x="64" y="10" width="112" height="26" rx="3" fill="#1D346C"/><rect x="74" y="14" width="34" height="18" rx="2" fill="url(#' + g + 'red)"/>'
      + '<g class="fsl-sheave"><circle cx="150" cy="22" r="13"/><path d="M150 9v26M137 22h26M141 13l18 18M159 13l-18 18"/></g></g>'
      + '<g class="fsl-cw"><g class="fsl-cwi"><rect x="174" y="120" width="28" height="74" rx="2" fill="url(#' + g + 'red)"/><path d="M174 138h28M174 156h28M174 174h28"/></g></g>'
      + '<g class="fsl-car">'
      + '<rect class="fsl-rope fsl-rope1" x="135" y="35" width="1.6" height="277"/>'
      + '<rect class="fsl-frame" x="56" y="312" width="88" height="134" rx="2"/>'
      + '<rect class="fsl-roof" x="54" y="306" width="92" height="8" rx="2" fill="url(#' + g + 'red)"/>'
      + '<rect class="fsl-pl" x="60" y="318" width="38" height="120" fill="url(#' + g + 'cab)"/><rect class="fsl-pr" x="102" y="318" width="38" height="120" fill="url(#' + g + 'cab)"/>'
      + '<g class="fsl-dl"><rect x="64" y="324" width="35" height="112" fill="url(#' + g + 'door)"/><rect x="64" y="324" width="35" height="4" fill="#1E9E3A"/>' + logo(hs, 69, 362, 25, 25) + '</g>'
      + '<g class="fsl-dr"><rect x="101" y="324" width="35" height="112" fill="url(#' + g + 'door)"/><rect x="101" y="324" width="35" height="4" fill="#E60012"/>' + logo(sm, 104, 364, 29, 18) + '</g>'
      + '<rect class="fsl-base" x="50" y="440" width="100" height="8" rx="2"/></g>'
      + '<g class="fsl-cwrope"><rect class="fsl-rope fsl-rope2" x="187" y="35" width="1.6" height="85"/></g>'
      // Hall indicator: brand emblem on top, the floor number and the direction arrow follow the car.
      + '<g class="fsl-ind"><rect x="236" y="60" width="78" height="118" rx="10" fill="#0F172A"/><rect x="240" y="64" width="70" height="38" rx="7" fill="#fff"/>'
      + logo(side === "l" ? hs : sm, 246, 67, 58, 32)
      + '<g class="fsl-num"><text x="275" y="160" class="n1">1</text><text x="275" y="160" class="n2">2</text><text x="275" y="160" class="n3">3</text></g>'
      + '<path class="fsl-up" d="M268 122l7-9 7 9z"/><path class="fsl-dn" d="M268 113l7 9 7-9z"/></g>'
      // Sparks where each part locks into place.
      + [[100, 40], [120, 24], [100, 312], [100, 440], [188, 120], [100, 380]].map(function (p, i) { return '<circle class="fsl-spark" style="--d:' + i + '" cx="' + p[0] + '" cy="' + p[1] + '" r="6"/>'; }).join("")
      + "</svg>";
  }
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
