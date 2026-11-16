// Monthly expenses: the accounts follow the Type (hassan, 2026-11-16: "if we select rent ... the expense account
// suggestion should also be given and accrued liability head as well"). The app already falls back to the type's
// accounts when the two boxes are left blank, but the boxes showed "Choose…", so nobody could see which heads would be
// used. Now choosing a Type fills Expense account and Accrued liability account with that type's heads (Rent: 610201
// rent expense / 220213 accrued rent), with a note under each. A head someone picked by hand is never overwritten; one
// the type filled in changes again when the Type changes.
(function () {
  /* global REC_CAT, idc, Store */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var e$ = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
  var auto = { exp: "", pay: "" }; // what the type last filled in

  var DEF = [["Rent", "610201", "220213"], ["CAM / building service charges", "610208", "220214"], ["Electricity, gas and water", "610202", "220202"],
    ["Telephone and internet", "610302", "220204"], ["Security services", "610204", "220204"], ["Cleaning and janitorial", "610207", "220204"],
    ["Generator fuel", "610206", "220204"], ["IT and software subscriptions", "610304", "220204"], ["Insurance", "610701", "220204"],
    ["Professional retainer (legal, tax, audit)", "610502", "220203"], ["Vehicle running", "610402", "220204"], ["Other", "", "220204"]];
  var byCode = function (c) { return c ? safe(function () { return idc(c); }, "") || safe(function () { return (Store.data.accounts.find(function (a) { return String(a.code) === c && a.posting !== "Header"; }) || {}).id; }, "") || "" : ""; };
  function catOf(name) {
    var L = safe(function () { return REC_CAT; }, null), hit = Array.isArray(L) ? L.find(function (c) { return Array.isArray(c) && c[0] === name && /^\d*$/.test(c[1] || "") && /^\d*$/.test(c[2] || ""); }) : null;
    return hit || DEF.find(function (c) { return c[0] === name; }) || DEF[DEF.length - 1];
  }

  var acc = function (id) { return id ? safe(function () { return Store.data.accounts.find(function (a) { return a.id === id; }); }, null) : null; };
  function note(sel, text) {
    var w = sel.closest(".ssw") || sel, box = sel.closest(".f") || w.parentNode; if (!box) return;
    var n = box.querySelector(".fs-recsug");
    if (!n) { n = document.createElement("span"); n.className = "hint fs-recsug"; box.appendChild(n); }
    n.innerHTML = text;
  }
  function put(sel, id) {
    if (!sel || sel.value === id) return;
    if (id && ![].slice.call(sel.options).some(function (o) { return o.value === id; })) {
      // a filtered list (company / kind of account) can leave the type's head out: add it back
      var a = acc(id); if (!a) return;
      var o = document.createElement("option"); o.value = id; o.textContent = a.code + " " + a.name; sel.appendChild(o);
    }
    sel.value = id;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  // the monthly expense form: a Type box beside both account boxes (found by the boxes, not by the app's internals)
  var isForm = function () { return !!(document.getElementById("f_category") && document.getElementById("f_expAccount") && document.getElementById("f_payAccount")); };
  function fill(first) {
    if (!isForm()) return;
    var cat = document.getElementById("f_category"), es = document.getElementById("f_expAccount"), ps = document.getElementById("f_payAccount");
    if (!cat || !es || !ps) return;
    var c = catOf(cat.value), ex = byCode(c[1]), py = byCode(c[2]) || byCode("220204");
    // on opening a saved record, a head equal to the type's counts as filled by the type
    if (first) { auto.exp = !es.value || es.value === ex ? ex : ""; auto.pay = !ps.value || ps.value === py ? py : ""; }
    if (!es.value || es.value === auto.exp) { put(es, ex); auto.exp = ex; }
    if (!ps.value || ps.value === auto.pay) { put(ps, py); auto.pay = py; }
    var label = function (id) { var a = acc(id); return a ? e$(a.code + " " + a.name) : ""; };
    note(es, ex ? (es.value === ex ? "Suggested for " + e$(cat.value) + "." : "Suggested for " + e$(cat.value) + ": " + label(ex) + ". You chose another head.")
      : c[1] ? "No account " + e$(c[1]) + " in the chart yet: choose the expense head." : "Choose the expense head for this type.");
    note(ps, py ? (ps.value === py ? "Suggested for " + e$(cat.value) + "." : "Suggested for " + e$(cat.value) + ": " + label(py) + ". You chose another head.")
      : "Choose the accrued liability head.");
  }
  document.addEventListener("change", function (e) {
    var t = e.target; if (!t || !isForm()) return;
    if (t.id === "f_category") safe(function () { fill(false); }, null);
    else if (t.id === "f_expAccount" || t.id === "f_payAccount") safe(function () { if (!t.dataset.fsRecBusy) { t.dataset.fsRecBusy = "1"; fill(false); delete t.dataset.fsRecBusy; } }, null);
  });
  // a newly drawn monthly expense form
  var seen = null;
  function watch() {
    if (!document.body) return setTimeout(watch, 300);
    new MutationObserver(function () {
      var f = document.getElementById("frm"), cat = document.getElementById("f_category");
      if (!f || !cat || !isForm()) { seen = null; return; }
      if (seen === f) return;
      seen = f; safe(function () { fill(true); }, null);
    }).observe(document.body, { childList: true, subtree: true });
  }
  watch();
})();
