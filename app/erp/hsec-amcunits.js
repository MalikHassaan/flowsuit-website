// AMC units billed in steps (hassan, 2026-11-11: "in AMC invoices it was invoiced unit wise; for example if a project is
// created on 36 units but out of which 25 units should be invoiced and later the rest will be invoiced later, make it
// that way").
//  * The AMC form gets "Units billed in steps" (2026-11-11: starts filled with all the units; says how many are still to
//    be invoiced when a step bills fewer): rows of From month + Units billed, e.g. 25 units from Jul 2026 and 36
//    from Jan 2027. Stored on the project as amcPhase text ("25 from Jul 2026; 36 from Jan 2027"). Empty = every unit
//    is billed from the start, as before.
//  * Months before the first step bill the first step's units; a step stays in force until the next one. Units are
//    never more than the contract's Units (lifts).
//  * The monthly charge for a month = units billed that month × Rate per unit (or the monthly fee × units / all units
//    when there is no rate). AMC billing (hsec-amcbill.js) invoices that; quarterly and other multi-month invoices add
//    up each month. The rest of the units are billed from their step's month onward, not back-dated.
//  * The contract value worked out on the form follows the steps.
// window.FS_AMCU = { steps(p), unitsAt(p, m), feeAt(p, m), termAt(p, m), phased(p), label(p) }
// termAt(p, m): the fee, rate and units in force in month m once a contract has been renewed at a revised rate.
(function () {
  /* global S, toast, Store, amcDue, V, todayStr, byEnt */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var num = function (v) { return parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0; };
  var SH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var nm = function (m) { return SH[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); };
  var month = function (t) { return safe(function () { return window.FS_AMCFREE.parse(t).months[0]; }, "") || (/^\d{4}-\d{2}$/.test(String(t).trim()) ? String(t).trim() : ""); };

  // "25 from Jul 2026; 36 from Jan 2027" -> [{from:"2026-07", units:25}, {from:"2027-01", units:36}]
  function parse(text) {
    var out = [];
    String(text || "").split(/[;\n]+/).forEach(function (part) {
      var r = /^\s*(\d+(?:\.\d+)?)\s*(?:units?|lifts?)?\s*(?:from|wef|w\.e\.f\.?)\s+(.+?)\s*$/i.exec(part); if (!r) return;
      var m = month(r[2]); if (m && +r[1] > 0) out.push({ from: m, units: +r[1] });
    });
    out.sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
    return out.filter(function (x, i) { return !out[i + 1] || out[i + 1].from !== x.from; });
  }
  var text = function (L) { return L.map(function (x) { return x.units + " from " + nm(x.from); }).join("; "); };
  var cache = {};
  function steps(p) { var t = String((p && p.amcPhase) || ""); if (!t.trim()) return []; if (!cache[t]) cache[t] = parse(t); return cache[t]; }
  var phased = function (p) { return steps(p).length > 0; };
  // contract renewals (hsec-amcrenew.js): months before a renewal's start keep the rate, fee and units in force then
  var MO = function (d) { return String(d || "").slice(0, 7); };
  function termAt(p, m) {
    var R = (p && Array.isArray(p.amcRenewals) ? p.amcRenewals : []).slice().sort(function (a, b) { return MO(a.from) < MO(b.from) ? -1 : 1; });
    for (var i = 0; i < R.length; i++) if (m && m < MO(R[i].from)) return { fee: num(R[i].prevFee), rate: num(R[i].prevRate), units: num(R[i].prevUnits) || num(p.amcUnits), renewal: null, next: R[i] };
    return { fee: num(p && p.amcFee), rate: num(p && p.amcRate), units: num(p && p.amcUnits), renewal: R.length ? R[R.length - 1] : null, next: null };
  }
  function unitsAt(p, m) {
    var U = termAt(p, m).units, L = steps(p); if (!L.length) return U;
    var u = L[0].units; L.forEach(function (x) { if (x.from <= m) u = x.units; });
    return U > 0 ? Math.min(u, U) : u;
  }
  function feeAt(p, m) {
    var t = termAt(p, m), fee = t.fee; if (!phased(p)) return fee;
    var U = t.units, u = unitsAt(p, m), rt = t.rate;
    if (U && u >= U) return fee;
    return rt ? u * rt : U ? fee * u / U : fee;
  }
  // the amcPhase text after billing u units from month m onward (the units box on AMC billing): earlier months keep the
  // units they had; later steps stay as they are
  function withUnits(p, m, u) {
    var U = termAt(p, m).units, L = steps(p).slice(), start = String((p && p.amcStart) || "").slice(0, 7);
    if (!L.some(function (x) { return x.from < m; }) && start && start < m) L.unshift({ from: start, units: L.length ? L[0].units : U });
    L = L.filter(function (x) { return x.from !== m; }); L.push({ from: m, units: Math.round(u) });
    L.sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    return U && L.every(function (x) { return x.units >= U; }) ? "" : text(L);
  }
  function label(p) {
    var L = steps(p), U = num(p && p.amcUnits); if (!L.length) return "";
    return L.map(function (x) { return (U && x.units >= U ? "all " + U : x.units + (U ? " of " + U : "")) + " units from " + nm(x.from); }).join(", ");
  }
  window.FS_AMCU = { steps: steps, unitsAt: unitsAt, feeAt: feeAt, termAt: termAt, withUnits: withUnits, phased: phased, label: label, parse: parse };

  // ---- the form: From month + Units rows writing the hidden amcPhase text.
  // A new or unstepped AMC shows one row already filled in: the AMC start month and all of the project's units. It follows
  // the Units and Start fields until someone edits it. While every step bills all the units nothing is stored (billing is
  // as before); once a step bills fewer, the note says how many units are still to be invoiced.
  function rowHtml(m, u, auto) {
    return "<div class=\"fs-up-row\"" + (auto ? " data-auto=\"1\"" : "") + "><label>From month<input type=\"month\" data-up=\"m\" value=\"" + (m || "") + "\"></label>" +
      "<label>Units billed<input type=\"number\" min=\"1\" step=\"1\" data-up=\"u\" value=\"" + (u || "") + "\"></label>" +
      "<button type=\"button\" class=\"btn sm\" data-updel=\"1\" title=\"Remove this step\">✕</button></div>";
  }
  var fv = function (id) { return String((document.getElementById(id) || {}).value || ""); };
  function rows() {
    var L = [], box = document.getElementById("fsUpBox"); if (!box) return L;
    box.querySelectorAll(".fs-up-row").forEach(function (row) {
      var m = row.querySelector("[data-up=m]").value, u = num(row.querySelector("[data-up=u]").value);
      if (/^\d{4}-\d{2}$/.test(m) && u > 0) L.push({ from: m, units: Math.round(u) });
    });
    L.sort(function (a, b) { return a.from < b.from ? -1 : 1; });
    return L;
  }
  function note() {
    var box = document.getElementById("fsUpBox"); if (!box) return;
    var U = num(fv("f_amcUnits")), L = rows(), n = box.querySelector(".fs-up-n");
    var over = U && L.some(function (x) { return x.units > U; });
    var last = L.length ? Math.min(L[L.length - 1].units, U || Infinity) : U, left = U ? U - last : 0;
    n.className = "fs-up-n" + (over ? " bad" : left > 0 ? " warn" : "");
    var all = !L.length || L.every(function (x) { return U && x.units >= U; });
    n.textContent = all ? (U ? "All " + U + " units are invoiced from the start of the AMC." : "Every unit is invoiced from the start of the AMC.") :
      label({ amcPhase: text(L), amcUnits: U }) + "." +
      (left > 0 ? " " + left + " of " + U + " units still need to be invoiced: add a step with the month they start." : "") +
      (over ? " A step has more units than the contract's " + U + "; it bills " + U + "." : "");
  }
  function sync() {
    var i = document.getElementById("f_amcPhase"); if (!i) return;
    var L = rows(), U = num(fv("f_amcUnits"));
    var v = !L.length || (U && L.every(function (x) { return x.units >= U; })) ? "" : text(L);
    if (i.value !== v) {
      i.value = v;
      i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true }));
    }
    note();
  }
  // the filled-in row (data-auto) keeps up with Units and Start; an empty box gets one once Units is typed
  function follow() {
    var box = document.getElementById("fsUpBox"); if (!box) return;
    var U = num(fv("f_amcUnits")), m = fv("f_amcStart").slice(0, 7), R = box.querySelectorAll(".fs-up-row");
    if (!R.length && U > 0) box.querySelector(".fs-up-rows").insertAdjacentHTML("beforeend", rowHtml(m, U, true));
    else if (R.length === 1 && R[0].hasAttribute("data-auto")) {
      if (U > 0) R[0].querySelector("[data-up=u]").value = U;
      if (/^\d{4}-\d{2}$/.test(m)) R[0].querySelector("[data-up=m]").value = m;
    }
    sync();
  }
  function build() {
    var i = document.getElementById("f_amcPhase"); if (!i || document.getElementById("fsUpBox")) return;
    var L = parse(i.value), U = num(fv("f_amcUnits")), m = fv("f_amcStart").slice(0, 7);
    i.type = "hidden"; i.style.display = "none";
    var box = document.createElement("div"); box.id = "fsUpBox";
    box.innerHTML = "<div class=\"fs-up-rows\">" + (L.length ? L.map(function (x) { return rowHtml(x.from, x.units); }).join("") :
      U > 0 ? rowHtml(m, U, true) : "") + "</div>" +
      "<button type=\"button\" class=\"btn sm\" data-upadd=\"1\">+ Add step</button><small class=\"fs-up-n\"></small>";
    i.insertAdjacentElement("afterend", box);
    note();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#fsUpBox [data-upadd], #fsUpBox [data-updel]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var box = document.getElementById("fsUpBox");
    if (b.hasAttribute("data-upadd")) {
      var R = box.querySelectorAll(".fs-up-row"), U = num(fv("f_amcUnits"));
      R.forEach(function (r) { r.removeAttribute("data-auto"); });
      var s = R.length ? "" : fv("f_amcStart").slice(0, 7);
      box.querySelector(".fs-up-rows").insertAdjacentHTML("beforeend", rowHtml(s, U || ""));
      sync(); var last = box.querySelector(".fs-up-row:last-child [data-up=" + (R.length ? "m" : "u") + "]"); if (last) last.focus();
    } else { b.closest(".fs-up-row").remove(); sync(); }
  }, true);
  document.addEventListener("change", function (e) {
    if (!e.target) return;
    if (e.target.closest && e.target.closest("#fsUpBox") && e.target.hasAttribute("data-up")) safe(sync, null);
    if (e.target.id === "f_amcUnits" || e.target.id === "f_amcStart") safe(follow, null);
  });
  document.addEventListener("input", function (e) {
    var t = e.target; if (!t) return;
    if (t.closest && t.closest("#fsUpBox") && t.hasAttribute("data-up")) {
      var r = t.closest(".fs-up-row"); if (r) r.removeAttribute("data-auto");
      if (t.getAttribute("data-up") === "u") safe(sync, null);
    }
    if (t.id === "f_amcUnits") safe(follow, null);
  });
  (function watch() {
    if (!document.body) return setTimeout(watch, 300);
    new MutationObserver(function () { if (document.getElementById("f_amcPhase") && !document.getElementById("fsUpBox")) safe(build, null); }).observe(document.body, { childList: true, subtree: true });
  })();

  // the app's older one-month AMC billing (Receivables › AMC billing) bills the whole current fee: stop it for stepped
  // contracts and for months before a renewal's revised rate starts
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("#amcGo"); if (!t) return;
    var m = safe(function () { return V.amcM; }, "") || safe(function () { return todayStr().slice(0, 7); }, "");
    var hit = safe(function () { return byEnt(Store.data.projects).filter(function (p) { return (phased(p) || termAt(p, m).next) && amcDue(p, m); }); }, []);
    if (!hit.length) return;
    e.preventDefault(); e.stopImmediatePropagation();
    safe(function () { toast(hit.map(function (p) { return p.name; }).join(", ") + (hit.length === 1 ? " bills" : " bill") + " units in steps or a renewed rate: make these invoices in AMC (maintenance contracts) › AMC billing."); }, null);
  }, true);

  var hooked = false;
  function hook() {
    if (hooked) return true;
    if (typeof S === "undefined" || !S.projects) return false;
    hooked = true;
    safe(function () {
      var f = S.projects.fields; if (f.some(function (x) { return x.k === "amcPhase"; })) return;
      var at = f.findIndex(function (x) { return x.k === "amcFee"; });
      f.splice(at < 0 ? f.length : at + 1, 0, { k: "amcPhase", l: "Units billed in steps", hint: "Starts with all of the project's units from the AMC start. Only some billed at first? Lower the units, then add a step for the month the rest start (e.g. 25 from Jul 2026, then 36 from Jan 2027)." });
    }, null);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-up-row{display:flex;gap:8px;align-items:flex-end;margin:0 0 6px}.fs-up-row label{display:flex;flex-direction:column;font-size:12px;gap:3px;flex:1 1 0;min-width:0}.fs-up-row input{width:100%;min-width:0;box-sizing:border-box}.fs-up-row .btn{flex:none}" +
    ".fs-up-n{display:block;font-size:12px;color:#2e6b3a;margin-top:3px}.fs-up-n.warn{color:#9a5b00;font-weight:600}.fs-up-n.bad{color:#b0412e}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
