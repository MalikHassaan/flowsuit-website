// HSEC presentation mode: a Present button in the top bar opens a slide show of the management reports for
// one company or the whole group. It drives the app's own pages (location.hash = "#module/tab") and company
// switch (setCompany), so every figure is the app's own; it only hides the menus and fits each page on screen.
(function () {
  var SLIDES = [
    ["dashboard", "", "Home dashboard"],
    ["r_fs", "pl", "Profit or loss"],
    ["r_fs", "sofp", "Financial position"],
    ["r_fs", "cfs", "Cash flows"],
    ["r_plan", "bva", "Budget vs actual"],
    ["r_party", "araging", "Receivables aging"],
    ["r_party", "apaging", "Payables aging"],
    ["r_cash", "cf13", "13-week cash forecast"],
    ["r_cash", "lclim", "LC limits & FX"],
    ["r_gl", "tb", "Trial balance"]
  ];
  var DEFAULT_OFF = { r_gl: 1, r_cash_lclim: 1 };
  var P = null;   // the running show: {list, i, prevEnt, prevHash}
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  function ents() { try { return ENTS(); } catch (e) { return []; } }
  function name(e) { try { return coName(e); } catch (x) { return e === "All" ? "Whole group" : e; } }
  function current() { try { return V.ent; } catch (e) { return "All"; } }
  function main() { return document.querySelector("main"); }

  function putButton() {
    var top = document.getElementById("topbar");
    if (!top || top.querySelector(".fs-present-btn")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "fs-present-btn";
    b.title = "Present reports to management, full screen";
    b.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>Present';
    var acct = top.querySelector(".fs-acct");
    if (acct && acct.parentNode) acct.parentNode.insertBefore(b, acct); else top.appendChild(b);
  }

  function chooser() {
    var cos = ents().concat(["All"]), cur = current();
    var d = document.createElement("div");
    d.className = "fsp-dlg";
    d.innerHTML = '<div class="fsp-box" role="dialog" aria-label="Present"><h2>Present to management</h2>'
      + "<p>Full screen, one report per slide. Use the arrow keys or the bar at the bottom; Esc ends the show. You can switch company during the show.</p>"
      + "<h3>Company</h3><div class=\"fsp-cos\">" + cos.map(function (e) {
        return '<label><input type="radio" name="fsp-co" value="' + esc(e) + '"' + (e === cur ? " checked" : "") + "> " + esc(e === "All" ? name(e) + " (consolidated)" : name(e)) + "</label>";
      }).join("") + "</div>"
      + "<h3>Slides</h3><div class=\"fsp-slides\">" + SLIDES.map(function (s, i) {
        return '<label><input type="checkbox" value="' + i + '"' + (DEFAULT_OFF[s[0]] || DEFAULT_OFF[s[0] + "_" + s[1]] ? "" : " checked") + "> " + esc(s[2]) + "</label>";
      }).join("") + "</div>"
      + '<div class="fsp-acts"><button type="button" data-fsp="cancel">Cancel</button><button type="button" class="go" data-fsp="go">Start presenting</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener("click", function (e) {
      var a = e.target.closest("[data-fsp]");
      if (e.target === d || (a && a.dataset.fsp === "cancel")) { d.remove(); return; }
      if (a && a.dataset.fsp === "go") {
        var co = d.querySelector("input[name=fsp-co]:checked");
        var list = Array.prototype.map.call(d.querySelectorAll(".fsp-slides input:checked"), function (x) { return SLIDES[+x.value]; });
        d.remove();
        if (list.length) start(co ? co.value : "All", list);
      }
    });
  }

  function start(ent, list) {
    P = { list: list, i: 0, prevEnt: current(), prevHash: location.hash || "#dashboard" };
    document.body.classList.add("fs-present");
    var bar = document.createElement("div");
    bar.className = "fsp-bar";
    bar.innerHTML = '<b data-t></b><span class="co" data-c></span><button type="button" data-go="-1" aria-label="Previous slide">&#9664;</button><span class="n" data-n></span>'
      + '<button type="button" data-go="1" aria-label="Next slide">&#9654;</button><select data-co aria-label="Company">'
      + ents().concat(["All"]).map(function (e) { return '<option value="' + esc(e) + '">' + esc(name(e)) + "</option>"; }).join("")
      + '</select><button type="button" class="x" data-x>End</button>';
    document.body.appendChild(bar);
    var prog = document.createElement("div");
    prog.className = "fsp-prog";
    document.body.appendChild(prog);
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-x")) stop(); else go(P.i + (+b.dataset.go));
    });
    bar.querySelector("[data-co]").addEventListener("change", function (e) { company(e.target.value); });
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {}); } catch (e) {}
    company(ent);
    go(0);
  }

  function company(ent) {
    if (ent !== current()) { try { setCompany(ent); } catch (e) {} }
    if (P) { var s = document.querySelector(".fsp-bar [data-co]"); if (s) s.value = ent; label(); fitSoon(); }
  }

  function go(i) {
    if (!P) return;
    P.i = Math.max(0, Math.min(P.list.length - 1, i));
    var s = P.list[P.i], want = "#" + s[0] + (s[1] ? "/" + s[1] : "");
    if (location.hash === want || location.hash === "#" + s[0] && !s[1]) { try { render(); } catch (e) {} } else location.hash = want;
    window.scrollTo(0, 0);
    var m = main();
    if (m) { m.classList.remove("fsp-in"); void m.offsetWidth; m.classList.add("fsp-in"); }
    label();
    fitSoon();
  }

  function label() {
    if (!P) return;
    var s = P.list[P.i], bar = document.querySelector(".fsp-bar");
    if (!bar) return;
    bar.querySelector("[data-t]").textContent = s[2];
    bar.querySelector("[data-c]").textContent = name(current());
    bar.querySelector("[data-n]").textContent = (P.i + 1) + " / " + P.list.length;
    var prog = document.querySelector(".fsp-prog");
    if (prog) prog.style.width = ((P.i + 1) / P.list.length * 100) + "%";
  }

  // Shrinks a tall report so it fits above the slide bar, and lets a short one grow a little on big screens.
  var timer;
  function fitSoon() { clearTimeout(timer); timer = setTimeout(fit, 120); }
  function fit() {
    var m = main();
    if (!P || !m) return;
    m.style.zoom = 1;
    var room = window.innerHeight - 70, h = m.scrollHeight;
    var z = Math.max(0.55, Math.min(1.2, room / Math.max(1, h)));
    if (window.innerWidth < 900) z = Math.min(z, 1);
    m.style.zoom = z.toFixed(3);
  }

  function stop() {
    if (!P) return;
    var p = P;
    P = null;
    document.body.classList.remove("fs-present");
    ["fsp-bar", "fsp-prog"].forEach(function (c) { var x = document.querySelector("." + c); if (x) x.remove(); });
    var m = main();
    if (m) { m.style.zoom = ""; m.classList.remove("fsp-in"); }
    if (p.prevEnt !== current()) { try { setCompany(p.prevEnt); } catch (e) {} }
    location.hash = p.prevHash;
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  }

  addEventListener("DOMContentLoaded", function () {
    putButton();
    new MutationObserver(function () {
      putButton();
      if (P) fitSoon();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".fs-present-btn")) { e.preventDefault(); e.stopPropagation(); chooser(); }
    }, true);
    document.addEventListener("keydown", function (e) {
      if (!P) return;
      var t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
      if (e.key === "Escape") { e.preventDefault(); stop(); return; }
      if (typing) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(P.i + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(P.i - 1); }
      else if (e.key === "Home") { e.preventDefault(); go(0); }
      else if (e.key === "End") { e.preventDefault(); go(P.list.length - 1); }
    }, true);
    document.addEventListener("fullscreenchange", function () { if (P && !document.fullscreenElement) stop(); });
    addEventListener("resize", function () { if (P) fitSoon(); });
  });
})();
