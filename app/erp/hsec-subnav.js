// Section pages in the blue side menu (hassan, 2026-11-23: "instead of showing the bar above, what is under Payables
// should show in the blue ribbon and be selected from there, and upon selection the selection should be highlighted").
// When the side menu is the narrow icon strip, a second navy column opens right beside it with the pages of the open
// work area (Payment demands, Invoices, Monthly expenses ...). The page open now is highlighted; clicking another opens
// it. The tab bar above the page is hidden while this column shows (it is still there underneath, so every page and its
// red count badge work as before). When the side menu is wide it already lists the pages under each area, so only the
// tab bar is hidden. "‹" folds the column away (remembered in this browser) and the tab bar comes back. Phones keep the
// tab bar.
(function () {
  var KEY = "fs-subnav-off", W = 224, last = "";
  var mem = null; // used when the browser keeps no storage (private window)
  var off = function () { if (mem !== null) return mem; try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
  var setOff = function (v) { mem = v; try { localStorage.setItem(KEY, v ? "1" : "0"); } catch (e) { /* private window */ } };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };

  function bar() { // the page's own tab bar (the visible one, in the main area)
    var all = document.querySelectorAll(".tabs[role=tablist]");
    for (var i = 0; i < all.length; i++) if (!all[i].closest("#rail, #fsSubNav, .overlay, #frm") && all[i].querySelector("button[data-tab]")) return all[i];
    return null;
  }
  function title() {
    var h = document.querySelector("main h1, #main h1, .page-head h1, h1"); return h ? h.textContent.replace(/☆\s*Pin|Pin$/g, "").trim() : "";
  }
  function sync() {
    var rail = document.getElementById("rail"), tb = bar(), nav = document.getElementById("fsSubNav"), main = rail && rail.nextElementSibling;
    var r = rail ? rail.getBoundingClientRect() : null;
    var phone = window.innerWidth < 900, narrow = r && r.width > 0 && r.width < 140;
    var want = !!(tb && rail && !phone && narrow && !off());
    document.documentElement.classList.toggle("fs-subnav-on", want);
    document.documentElement.classList.toggle("fs-subnav-wide", !!(tb && rail && !phone && !narrow && rail.querySelector(".ntabs")));
    if (!want) {
      if (nav) nav.remove();
      if (main && main.getAttribute("data-fssub")) { main.style.marginLeft = ""; main.removeAttribute("data-fssub"); }
      showOpen(!!(tb && !phone && narrow && off()));
      last = ""; return;
    }
    showOpen(false);
    var bs = [].slice.call(tb.querySelectorAll("button[data-tab]"));
    var html = "<div class=\"fs-snhd\"><b>" + esc(title()) + "</b><button type=\"button\" class=\"fs-snx\" id=\"fsSubX\" title=\"Hide this list (the tabs come back above the page)\" aria-label=\"Hide page list\">‹</button></div>" +
      bs.map(function (b) { var on = b.classList.contains("on"); return "<button type=\"button\" class=\"fs-sni" + (on ? " on" : "") + "\" data-fssn=\"" + esc(b.getAttribute("data-tab")) + "\"" + (on ? " aria-current=\"page\"" : "") + ">" + b.innerHTML + "</button>"; }).join("");
    if (!nav) { nav = document.createElement("nav"); nav.id = "fsSubNav"; nav.setAttribute("aria-label", "Pages"); document.body.appendChild(nav); }
    var top = Math.max(0, r.top), h = window.innerHeight - top;
    var pos = "left:" + Math.round(r.right) + "px;top:" + Math.round(top) + "px;height:" + Math.round(h) + "px;width:" + W + "px;background:" + getComputedStyle(rail).backgroundColor;
    if (nav.getAttribute("data-pos") !== pos) { nav.style.cssText = pos; nav.setAttribute("data-pos", pos); }
    if (last !== html) { nav.innerHTML = html; last = html; var o = nav.querySelector(".on"); if (o && o.scrollIntoView) o.scrollIntoView({ block: "nearest" }); }
    if (main && main.style.marginLeft !== W + "px") { main.style.marginLeft = W + "px"; main.setAttribute("data-fssub", "1"); }
  }
  function showOpen(on) { // a small "›" tab to bring the column back after it was folded away
    var b = document.getElementById("fsSubOpen"), rail = document.getElementById("rail");
    if (!on || !rail) { if (b) b.remove(); return; }
    var r = rail.getBoundingClientRect();
    if (!b) { b = document.createElement("button"); b.type = "button"; b.id = "fsSubOpen"; b.title = "Show the pages in the side menu"; b.setAttribute("aria-label", "Show page list"); b.textContent = "›"; document.body.appendChild(b); }
    b.style.left = Math.round(r.right) + "px"; b.style.top = Math.round(Math.max(0, r.top) + 12) + "px";
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-fssn], #fsSubX, #fsSubOpen") : null; if (!t) return;
    e.preventDefault(); e.stopPropagation();
    if (t.id === "fsSubX") { setOff(true); sync(); return; }
    if (t.id === "fsSubOpen") { setOff(false); sync(); return; }
    var tb = bar(), b = tb && tb.querySelector("button[data-tab=\"" + (window.CSS && CSS.escape ? CSS.escape(t.getAttribute("data-fssn")) : t.getAttribute("data-fssn")) + "\"]");
    if (b) b.click();
    var nav = document.getElementById("fsSubNav");
    if (nav) nav.querySelectorAll(".fs-sni").forEach(function (x) { x.classList.toggle("on", x === t); });
  }, true);

  var queued = false;
  function soon() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; try { sync(); } catch (x) { /* never break the page */ } }); }
  function start() {
    if (!document.body) return setTimeout(start, 50);
    var css = document.createElement("style");
    css.textContent =
      "html.fs-subnav-on .tabs[role=tablist],html.fs-subnav-wide .tabs[role=tablist]{display:none!important}" +
      "#fsSubNav{position:fixed;z-index:30;overflow-y:auto;padding:12px 10px 20px;box-sizing:border-box;color:#e2e8f0;border-left:1px solid rgba(255,255,255,.08);box-shadow:4px 0 14px rgba(15,23,42,.12)}" +
      "#fsSubNav .fs-snhd{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 6px 10px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,.12)}" +
      "#fsSubNav .fs-snhd b{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1}" +
      "#fsSubNav .fs-snx{border:0;background:rgba(255,255,255,.08);color:#e2e8f0;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:16px;line-height:1}#fsSubNav .fs-snx:hover{background:rgba(255,255,255,.18)}" +
      "#fsSubNav .fs-sni{display:flex;align-items:center;justify-content:space-between;width:100%;text-align:left;border:0;background:none;color:#cbd5e1;font:inherit;font-size:13.5px;font-weight:500;padding:9px 10px 9px 12px;margin:1px 0;border-radius:8px;cursor:pointer;border-left:3px solid transparent}" +
      "#fsSubNav .fs-sni:hover{background:rgba(255,255,255,.18);color:#fff;box-shadow:inset 3px 0 0 #38bdf8}" +
      // the pages under each area in the wide side menu: a clear highlight under the mouse (hassan, 2026-11-23: "while
      // scrolling the mouse it shows blank it should be highlighted"); the app's own hover was a faint box on navy
      "html body #rail .ntabs a.ntab:not(.on):hover{background:rgba(255,255,255,.18)!important;color:#fff!important;box-shadow:inset 3px 0 0 #38bdf8!important}" +
      "html body #rail .ntabs a.ntab:not(.on):hover::before{opacity:1}" +
      "#fsSubNav .fs-sni.on{background:#fff;color:#13304f;font-weight:700;border-left-color:#22c55e;box-shadow:0 2px 8px rgba(0,0,0,.18)}" +
      "#fsSubNav .tcount{display:inline-block;margin-left:6px;min-width:18px;padding:1px 6px;border-radius:9px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;line-height:16px;text-align:center}" +
      "#fsSubOpen{position:fixed;z-index:30;width:20px;height:44px;border:0;border-radius:0 8px 8px 0;background:#1B3A5C;color:#fff;font-size:16px;cursor:pointer;box-shadow:2px 0 8px rgba(15,23,42,.2)}" +
      "@media print{#fsSubNav,#fsSubOpen{display:none!important}}";
    document.head.appendChild(css);
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", soon); window.addEventListener("scroll", soon, { passive: true });
    soon();
  }
  start();
})();
