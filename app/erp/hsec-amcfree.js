// Free maintenance months on AMC contracts (hassan, 2026-11-04: "while creating the AMC project there are some months
// that are free maintenance; how can we tackle it, and same in reporting as well").
//  * The AMC form gets "Free maintenance months" (e.g. "Jul 2026 to Dec 2026, Mar 2027"), with a line under it saying
//    which months it understood. Stored on the project as amcFree (text).
//  * A free month is never due: the app's own AMC billing, the Home reminder, "Create AMC invoices" and the
//    billing-by-month grid all skip it (the grid shows "Free").
//  * The contract value worked out from the fee leaves the free months out; the AMC contract page, the AMC reports'
//    month matrix and the customer ledger show them.
// window.FS_AMCFREE = { parse(text) -> {months:["YYYY-MM"], bad:[...]}, months(p), is(p, m), label(list) }
(function () {
  /* global amcDue, S */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var MN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  var SH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var addM = function (m, k) { var d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1); return d.getFullYear() + "-" + pad(d.getMonth() + 1); };
  // one month: 2026-07, 2026/7, 07/2026, 7-2026, Jul 2026, July 2026, Jul-26, Jul 26
  function one(t) {
    t = String(t || "").trim().toLowerCase().replace(/[,.]/g, " ").replace(/\s+/g, " "); if (!t) return "";
    var m = /^(\d{4})[-/ ](\d{1,2})$/.exec(t); if (m && +m[2] >= 1 && +m[2] <= 12) return m[1] + "-" + pad(m[2]);
    m = /^(\d{1,2})[-/ ](\d{4})$/.exec(t); if (m && +m[1] >= 1 && +m[1] <= 12) return m[2] + "-" + pad(m[1]);
    m = /^([a-z]{3})[a-z]*[-/ ]?'?(\d{2}|\d{4})$/.exec(t);
    if (m && MN.indexOf(m[1]) >= 0) { var y = m[2].length === 2 ? "20" + m[2] : m[2]; return y + "-" + pad(MN.indexOf(m[1]) + 1); }
    return "";
  }
  function parse(text) {
    var out = [], bad = [];
    String(text || "").split(/[;\n,]+/).forEach(function (part) {
      part = part.trim(); if (!part) return;
      var r = part.split(/\s+to\s+|\s*[–—]\s*|\s+-\s+/i);
      if (r.length === 1 && !one(part)) { // "Jul 2026-Dec 2026": try each "-" as the range mark
        for (var k = part.indexOf("-"); k > 0; k = part.indexOf("-", k + 1)) if (one(part.slice(0, k)) && one(part.slice(k + 1))) { r = [part.slice(0, k), part.slice(k + 1)]; break; }
      }
      if (r.length === 2) {
        var a = one(r[0]), b = one(r[1]);
        if (!a || !b) { bad.push(part); return; }
        if (b < a) { var t = a; a = b; b = t; }
        for (var m = a, i = 0; m <= b && i < 120; m = addM(m, 1), i++) if (out.indexOf(m) < 0) out.push(m);
        return;
      }
      var x = one(part); if (x) { if (out.indexOf(x) < 0) out.push(x); } else bad.push(part);
    });
    return { months: out.sort(), bad: bad };
  }
  var cache = {};
  function months(p) {
    var t = String((p && p.amcFree) || ""); if (!t.trim()) return [];
    if (!cache[t]) cache[t] = parse(t).months;
    return cache[t];
  }
  var is = function (p, m) { return months(p).indexOf(m) >= 0; };
  // "Jul 2026 to Dec 2026, Mar 2027"
  function label(L) {
    L = (L || []).slice().sort(); var out = [], i = 0;
    var nm = function (m) { return SH[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); };
    while (i < L.length) {
      var j = i; while (j + 1 < L.length && L[j + 1] === addM(L[j], 1)) j++;
      out.push(j > i ? nm(L[i]) + " to " + nm(L[j]) : nm(L[i])); i = j + 1;
    }
    return out.join(", ");
  }
  window.FS_AMCFREE = { parse: parse, months: months, is: is, label: label };

  // the form: field after the AMC end date, and a line saying what was understood
  function note() {
    var i = document.getElementById("f_amcFree"); if (!i) return;
    var n = i.parentNode.querySelector(".fs-free-n");
    if (!n) { n = document.createElement("small"); n.className = "fs-free-n"; i.insertAdjacentElement("afterend", n); }
    var r = parse(i.value);
    n.textContent = !i.value.trim() ? "No free months: every month of the AMC period is billed." :
      (r.months.length ? r.months.length + " free month" + (r.months.length === 1 ? "" : "s") + ": " + label(r.months) + "." : "") +
      (r.bad.length ? " Not understood: " + r.bad.join(", ") + " (write months like Jul 2026)." : "");
    n.classList.toggle("bad", !!r.bad.length);
  }
  document.addEventListener("input", function (e) { if (e.target && e.target.id === "f_amcFree") safe(note, null); });
  (function watch() {
    if (!document.body) return setTimeout(watch, 300);
    new MutationObserver(function () { var i = document.getElementById("f_amcFree"); if (i && !i.parentNode.querySelector(".fs-free-n")) safe(note, null); }).observe(document.body, { childList: true, subtree: true });
  })();

  var hooked = false;
  function hook() {
    if (hooked) return true;
    if (typeof amcDue !== "function" || typeof S === "undefined" || !S.projects) return false;
    hooked = true;
    var old = amcDue;
    amcDue = function (p, m) { return p && is(p, m) ? false : old.apply(this, arguments); }; // eslint-disable-line no-global-assign
    safe(function () {
      var f = S.projects.fields; if (f.some(function (x) { return x.k === "amcFree"; })) return;
      var at = f.findIndex(function (x) { return x.k === "amcEnd"; });
      f.splice(at < 0 ? f.length : at + 1, 0, { k: "amcFree", l: "Free maintenance months", hint: "Months not billed, e.g. Jul 2026 to Dec 2026, Mar 2027. Leave blank if none." });
    }, null);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-free-n{display:block;font-size:12px;color:#2e6b3a;margin-top:3px}.fs-free-n.bad{color:#b0412e}" +
    ".fs-g-pill.free{background:#e3f4e6;color:#2e6b3a}.fs-amcr-t td.free{color:#2e6b3a;font-style:italic;text-align:center}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
