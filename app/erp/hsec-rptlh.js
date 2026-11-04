// Letterhead on printed reports (hassan, 2026-11-04: "do it" to adding the letterhead / plain choice to report printing).
// Every report or statement that opens in the print sheet (AMC reports, statements, payslips, schedules...) gets a
// "Print on" choice in its bar:
//  * Letterhead: the company's letterhead at the top and its footer at the end (the same one its invoices use: the
//    built-in HSEC / JPL letterheads, or one imported under Sales › Quotations › Templates);
//  * Pre-printed paper: the letterhead space is left blank, for paper that already carries it;
//  * Plain paper: no letterhead and no space.
// The company is the one chosen at the top right (HSEC for "All"). Vouchers, invoices and quotations keep their own.
(function () {
  /* global IV_LH, V */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var KEY = "fs-rptlh";
  var mode = function () { var m = safe(function () { return localStorage.getItem(KEY); }, null); return m === "space" || m === "plain" ? m : "lh"; };
  function lhOf() {
    if (typeof IV_LH === "undefined") return null;
    var e = safe(function () { return V.ent; }, "") || "";
    if (!e || e === "All") e = "HSEC";   // a company without a letterhead prints none
    var L = IV_LH[e];
    if (!L || typeof L.head !== "function") return null;
    return { head: safe(function () { return L.head(); }, ""), foot: safe(function () { return typeof L.foot === "function" ? L.foot() : ""; }, "") };
  }
  function apply(sh) {
    var m = mode();
    sh.classList.toggle("fs-rlh-space", m === "space");
    sh.classList.toggle("fs-rlh-plain", m === "plain");
    var s = sh.querySelector(".fs-rlh-sel"); if (s) s.value = m;
  }
  function dress() {
    var pl = document.getElementById("printLayer"); if (!pl) return;
    var sh = pl.querySelector(".sheet");
    if (!sh || sh.getAttribute("data-fsrlh")) return;
    sh.setAttribute("data-fsrlh", "1");
    // documents that already carry their own letterhead
    if (sh.classList.contains("qsheet") || sh.querySelector(".iv-lh, .pvch, .fs-colh, .qsheet")) return;
    var bar = sh.querySelector(".bar"), L = lhOf();
    if (!bar || !L || !L.head) return;
    bar.insertAdjacentHTML("beforeend", "<label class=\"fs-rlh-pick\">Print on <select class=\"fs-rlh-sel\"><option value=\"lh\">Letterhead</option><option value=\"space\">Pre-printed paper (space left)</option><option value=\"plain\">Plain paper</option></select></label>");
    bar.insertAdjacentHTML("afterend", "<div class=\"fs-rlh-h\">" + L.head + "</div>");
    if (L.foot) sh.insertAdjacentHTML("beforeend", "<div class=\"fs-rlh-f\">" + L.foot + "</div>");
    apply(sh);
  }
  document.addEventListener("change", function (e) {
    if (!e.target || !e.target.classList || !e.target.classList.contains("fs-rlh-sel")) return;
    safe(function () { localStorage.setItem(KEY, e.target.value); }, null);
    var sh = e.target.closest(".sheet"); if (sh) apply(sh);
  });
  function start() {
    if (!document.body) return setTimeout(start, 300);
    new MutationObserver(function () { safe(dress, null); }).observe(document.body, { childList: true, subtree: true });
  }
  var css = document.createElement("style");
  css.textContent = ".fs-rlh-pick{display:inline-flex;align-items:center;gap:6px;margin-left:12px;font-size:13px}.fs-rlh-pick select{padding:3px 6px}" +
    ".fs-rlh-h{margin:0 0 12px}.fs-rlh-f{margin-top:18px}.fs-rlh-h img,.fs-rlh-f img{max-width:100%}" +
    ".sheet.fs-rlh-space .fs-rlh-h,.sheet.fs-rlh-space .fs-rlh-f{visibility:hidden}.sheet.fs-rlh-plain .fs-rlh-h,.sheet.fs-rlh-plain .fs-rlh-f{display:none}" +
    "@media print{.fs-rlh-pick{display:none!important}}";
  (document.head || document.documentElement).appendChild(css);
  start();
})();
