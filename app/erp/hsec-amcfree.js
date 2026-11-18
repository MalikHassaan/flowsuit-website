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
  // Free months after handover (hassan, 2026-11-18: "the free period should start after the handing over ... if it's not
  // handed over then it should ask months, so once the project is handed over the free period starts accordingly").
  // The project keeps amcFreeN (how many free months) and amcHandover (the handover date). Until the date is known the
  // free months are not placed; once it is (typed here, or the Business cycle's Handover step marked done), they run
  // from the handover month for amcFreeN months, on top of any months picked by hand.
  function handover(p) {
    if (!p) return "";
    if (/^\d{4}-\d{2}/.test(String(p.amcHandover || ""))) return String(p.amcHandover);
    var k = safe(function () { return pwSteps().findIndex(function (s) { return /^handover/i.test(s.t || ""); }); }, 13); // eslint-disable-line no-undef
    var d = p.pw && p.pw.done && p.pw.done[k < 0 ? 13 : k];
    return /^\d{4}-\d{2}/.test(String(d || "")) ? String(d) : "";
  }
  function afterList(N, hd) {
    var out = [], c = Math.min(120, Math.floor(+N || 0)); if (!c || !hd) return out;
    for (var i = 0, m = String(hd).slice(0, 7); i < c; i++, m = addM(m, 1)) out.push(m);
    return out;
  }
  var cache = {};
  function months(p) {
    var t = String((p && p.amcFree) || ""), N = +(p && p.amcFreeN) || 0, hd = N ? handover(p) : "", key = t + "|" + N + "|" + hd;
    if (!t.trim() && !(N && hd)) return [];
    if (!cache[key]) {
      var L = t.trim() ? parse(t).months.slice() : [];
      afterList(N, hd).forEach(function (m) { if (L.indexOf(m) < 0) L.push(m); });
      cache[key] = L.sort();
    }
    return cache[key];
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
  window.FS_AMCFREE = { parse: parse, months: months, is: is, label: label, handover: handover };

  // the form: calendar month pickers (hassan, 2026-11-04: "in free maintenance month there should be month range by
  // calendar"): one row per free period, From month and To month, "+ Add free period" and ✕. The rows write the
  // stored text (amcFree, e.g. "Jun 2026 to Aug 2026, Dec 2026") into the hidden field the form saves.
  function ranges(L) {
    L = (L || []).slice().sort(); var out = [], i = 0;
    while (i < L.length) { var j = i; while (j + 1 < L.length && L[j + 1] === addM(L[j], 1)) j++; out.push([L[i], L[j]]); i = j + 1; }
    return out;
  }
  function rowHtml(a, b) {
    return "<div class=\"fs-fr-row\"><label>From month<input type=\"month\" data-fr=\"a\" value=\"" + (a || "") + "\"></label>" +
      "<label>To month<input type=\"month\" data-fr=\"b\" value=\"" + (b || "") + "\"></label><button type=\"button\" class=\"btn sm\" data-frdel=\"1\" title=\"Remove this period\">✕</button></div>";
  }
  function note() {
    var i = document.getElementById("f_amcFree"), box = document.getElementById("fsFrBox"); if (!i || !box) return;
    var n = box.querySelector(".fs-free-n"), r = parse(i.value);
    var N = +((document.getElementById("f_amcFreeN") || {}).value || 0), hd = String((document.getElementById("f_amcHandover") || {}).value || "");
    if (!hd) hd = safe(function () { return handover(F.rec); }, ""); // eslint-disable-line no-undef
    var wait = N > 0 && !hd;
    n.textContent = (!r.months.length ? (wait ? "" : "No free months: every month of the AMC period is billed.") :
      r.months.length + " free month" + (r.months.length === 1 ? "" : "s") + ": " + label(r.months) + ".") +
      (wait ? (r.months.length ? " " : "") + N + " free month" + (N === 1 ? "" : "s") + " will start from the handover date. Enter the Handover date when the project is handed over, or mark Handover done in Business cycle." : "");
  }
  function sync() {
    var i = document.getElementById("f_amcFree"), box = document.getElementById("fsFrBox"); if (!i || !box) return;
    var L = [];
    box.querySelectorAll(".fs-fr-row").forEach(function (row) {
      var a = row.querySelector("[data-fr=a]").value, b = row.querySelector("[data-fr=b]").value || a;
      if (!a) return; if (b < a) { var t = a; a = b; b = t; }
      for (var m = a, k = 0; m <= b && k < 120; m = addM(m, 1), k++) if (L.indexOf(m) < 0) L.push(m);
    });
    i.value = label(L);
    i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true }));
    note();
  }
  // Free months after handover: with both boxes filled, the period appears as its own row (marked "after handover")
  function afterSync() {
    var box = document.getElementById("fsFrBox"); if (!box) return;
    var N = +((document.getElementById("f_amcFreeN") || {}).value || 0), hdI = document.getElementById("f_amcHandover"), hd = String((hdI || {}).value || "");
    var L = afterList(N, hd), rows = box.querySelector(".fs-fr-rows"), old = rows.querySelector(".fs-fr-auto");
    if (old) old.remove();
    if (L.length) {
      rows.insertAdjacentHTML("afterbegin", rowHtml(L[0], L[L.length - 1]));
      var r0 = rows.firstElementChild; r0.classList.add("fs-fr-auto"); r0.title = "From the handover date, for " + N + " month" + (N === 1 ? "" : "s");
      r0.insertAdjacentHTML("beforeend", "<small class=\"fs-fr-tag\">after handover</small>");
      var st = document.getElementById("f_amcStart");
      if (st && !st.value) { st.value = hd.slice(0, 10); st.dispatchEvent(new Event("input", { bubbles: true })); st.dispatchEvent(new Event("change", { bubbles: true })); }
    }
    sync();
  }
  function build() {
    var i = document.getElementById("f_amcFree"); if (!i || document.getElementById("fsFrBox")) return;
    var r = parse(i.value), R = ranges(r.months);
    if (r.bad.length) setTimeout(function () { i.value = label(r.months); }, 0); // e.g. a bare "6" typed before the pickers existed
    i.type = "hidden"; i.style.display = "none";
    var w = i.closest(".f") || i.parentNode; w.classList.add("fs-fr-w");
    var box = document.createElement("div"); box.id = "fsFrBox";
    box.innerHTML = "<div class=\"fs-fr-rows\">" + R.map(function (x) { return rowHtml(x[0], x[1]); }).join("") + "</div>" +
      "<button type=\"button\" class=\"btn sm\" data-fradd=\"1\">+ Add free period</button><small class=\"fs-free-n\"></small>";
    i.insertAdjacentElement("afterend", box);
    // the row that comes from "after handover" is marked as such
    var N0 = +((document.getElementById("f_amcFreeN") || {}).value || 0), hd0 = String((document.getElementById("f_amcHandover") || {}).value || "");
    var A = afterList(N0, hd0);
    if (A.length) box.querySelectorAll(".fs-fr-row").forEach(function (row) {
      var a = row.querySelector("[data-fr=a]").value, b = row.querySelector("[data-fr=b]").value;
      if (a <= A[0] && b >= A[A.length - 1] && !box.querySelector(".fs-fr-auto")) { row.classList.add("fs-fr-auto"); row.insertAdjacentHTML("beforeend", "<small class=\"fs-fr-tag\">after handover</small>"); }
    });
    note();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#fsFrBox [data-fradd], #fsFrBox [data-frdel]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var box = document.getElementById("fsFrBox");
    if (b.hasAttribute("data-fradd")) {
      var s = String((document.getElementById("f_amcStart") || {}).value || "").slice(0, 7);
      box.querySelector(".fs-fr-rows").insertAdjacentHTML("beforeend", rowHtml(s, s));
      sync(); var last = box.querySelector(".fs-fr-row:last-child [data-fr=a]"); if (last) last.focus();
    } else { b.closest(".fs-fr-row").remove(); sync(); }
  }, true);
  document.addEventListener("change", function (e) {
    if (e.target && e.target.closest && e.target.closest("#fsFrBox") && e.target.hasAttribute("data-fr")) { var rw = e.target.closest(".fs-fr-auto"); if (rw) { rw.classList.remove("fs-fr-auto"); var tg = rw.querySelector(".fs-fr-tag"); if (tg) tg.remove(); } safe(sync, null); }
    if (e.target && (e.target.id === "f_amcFreeN" || e.target.id === "f_amcHandover")) safe(afterSync, null);
  });
  document.addEventListener("input", function (e) { if (e.target && (e.target.id === "f_amcFreeN" || e.target.id === "f_amcHandover")) safe(note, null); });
  (function watch() {
    if (!document.body) return setTimeout(watch, 300);
    new MutationObserver(function () { if (document.getElementById("f_amcFree") && !document.getElementById("fsFrBox")) safe(build, null); }).observe(document.body, { childList: true, subtree: true });
  })();

  var hooked = false;
  function hook() {
    if (hooked) return true;
    if (typeof amcDue !== "function" || typeof S === "undefined" || !S.projects) return false;
    hooked = true;
    var old = amcDue;
    // with free months after handover, nothing is billed before the handover month, nor at all until it is known
    amcDue = function (p, m) { // eslint-disable-line no-global-assign
      if (p && is(p, m)) return false;
      if (p && +p.amcFreeN > 0) { var hd = handover(p); if (!hd || String(m) < hd.slice(0, 7)) return false; }
      return old.apply(this, arguments);
    };
    safe(function () {
      var f = S.projects.fields; if (f.some(function (x) { return x.k === "amcFree"; })) return;
      var at = f.findIndex(function (x) { return x.k === "amcEnd"; });
      f.splice(at < 0 ? f.length : at + 1, 0, { k: "amcFree", l: "Free maintenance months", hint: "Months not billed: pick the first and last free month of each free period. Leave empty if none." });
    }, null);
    safe(function () {
      var f = S.projects.fields; if (f.some(function (x) { return x.k === "amcFreeN"; })) return;
      var at = f.findIndex(function (x) { return x.k === "amcFree"; });
      f.splice(at < 0 ? f.length : at, 0,
        { k: "amcFreeN", l: "Free maintenance after handover (months)", t: "number", hint: "e.g. 12. The free months start on the handover date. Leave empty if none." },
        { k: "amcHandover", l: "Handover date", t: "date", hint: "Leave empty until the project is handed over. Marking Handover done in Business cycle fills the free months too." });
    }, null);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-free-n{display:block;font-size:12px;color:#2e6b3a;margin-top:3px}.fs-free-n.bad{color:#b0412e}.fs-fr-row{display:flex;gap:8px;align-items:flex-end;margin:0 0 6px}.fs-fr-row label{display:flex;flex-direction:column;font-size:12px;gap:3px;flex:1;min-width:0}.fs-fr-row input{width:100%;min-width:0;box-sizing:border-box}.fs-fr-row [data-frdel]{flex:none}#fsFrBox{min-width:0;max-width:100%}#fsFrBox [data-fradd]{margin-top:2px}.fs-fr-auto input{background:#f0fdf4}.fs-fr-tag{flex:none;align-self:center;font-size:11px;color:#2e6b3a;font-weight:600}" +
    ".fs-g-pill.free{background:#e3f4e6;color:#2e6b3a}.fs-amcr-t td.free{color:#2e6b3a;font-style:italic;text-align:center}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
