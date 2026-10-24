// HSEC opening screen: shown straight away, kept for at least 5 seconds and until the app has loaded the
// books (the app marks that by putting "booted" on <html>), then zooms into the ERP.
(function () {
  var MIN_MS = 5000, MAX_MS = 30000, start = Date.now();
  var intro = document.createElement("div");
  intro.id = "fs-intro";
  intro.setAttribute("role", "status");
  intro.innerHTML = '<span class="fsb-corner c1"></span><span class="fsb-corner c2"></span><span class="fsb-corner c3"></span><span class="fsb-corner c4"></span>'
    + '<span class="fsb-tag">FLOWSUIT ERP</span><div class="fsb-stage">'
    + '<div class="fsb-core"><i class="r1"><b></b><b></b></i><i class="r2"><b></b></i><i class="r3"><b></b></i><span class="fsb-logo"><img src="/erp/hsec-logo" alt="HSEC"></span></div>'
    + '<h1 class="fsb-name">' + "HSEC".split("").map(function (c, i) { return '<span style="--i:' + i + '">' + c + "</span>"; }).join("") + "</h1>"
    + '<div class="fsb-sub"></div><div class="fsb-bar"><i></i></div><div class="fsb-msg"></div></div>';
  document.documentElement.appendChild(intro);   // before <body> exists, so nothing else shows first

  // The subtitle types itself after the letters are in.
  var sub = intro.querySelector(".fsb-sub"), text = "Finance & Accounting ERP", k = 0;
  setTimeout(function type() {
    sub.textContent = text.slice(0, ++k);
    if (k < text.length) setTimeout(type, 45); else sub.classList.add("is-done");
  }, 2100);

  // Status lines and the progress line move along the 5 seconds; the last step waits for the books.
  var steps = ["Securing connection", "Verifying your access", "Loading your books", "Preparing your dashboard"];
  var msg = intro.querySelector(".fsb-msg"), bar = intro.querySelector(".fsb-bar i"), step = -1;
  function say(s) { msg.textContent = s; msg.classList.remove("is-new"); void msg.offsetWidth; msg.classList.add("is-new"); }
  var ticker = setInterval(function () {
    var t = Math.min(1, (Date.now() - start) / MIN_MS);
    bar.style.width = Math.round(8 + t * 82) + "%";
    var s = Math.min(steps.length - 1, Math.floor(t * steps.length));
    if (s !== step) { step = s; say(steps[s] + "…"); }
  }, 200);

  var leaving = false;
  function ready() { return document.documentElement.classList.contains("booted") || !document.getElementById("boot") && document.body; }
  function leave() {
    if (leaving) return;
    leaving = true;
    clearInterval(ticker);
    bar.style.width = "100%";
    say("Welcome");
    setTimeout(function () {
      intro.classList.add("is-leaving");
      document.documentElement.classList.add("fs-zoom");
      setTimeout(function () { intro.remove(); document.documentElement.classList.remove("fs-zoom"); }, 1100);
    }, 450);
  }
  var check = setInterval(function () {
    var waited = Date.now() - start;
    if ((waited >= MIN_MS && ready()) || waited >= MAX_MS) { clearInterval(check); leave(); }
  }, 150);
})();
