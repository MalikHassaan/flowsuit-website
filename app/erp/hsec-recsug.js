// Monthly expenses: the accounts follow the Type (hassan, 2026-11-16: "if we select rent ... the expense account
// suggestion should also be given and accrued liability head as well"). The app already falls back to the type's
// accounts when the two boxes are left blank, but the boxes showed "Choose…", so nobody could see which heads would be
// used. Now choosing a Type fills Expense account and Accrued liability account with that type's heads (Rent: 610201
// rent expense / 220213 accrued rent), with a note under each. A head someone picked by hand is never overwritten; one
// the type filled in changes again when the Type changes.
(function () {
  /* global F, REC_CAT, idc, Store */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var e$ = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
  var auto = { exp: "", pay: "" }; // what the type last filled in

  function catOf(name) {
    var L = safe(function () { return REC_CAT; }, []);
    return L.find(function (c) { return c[0] === name; }) || L[L.length - 1] || ["", "", "220204", ""];
  }
  var acc = function (id) { return id ? safe(function () { return Store.data.accounts.find(function (a) { return a.id === id; }); }, null) : null; };
  function note(sel, text) {
    var box = sel.closest(".f"); if (!box) return;
    var n = box.querySelector(".fs-recsug");
    if (!n) { n = document.createElement("span"); n.className = "hint fs-recsug"; box.appendChild(n); }
    n.innerHTML = text;
  }
  function put(sel, id) {
    if (!sel || sel.value === id) return;
    if (id && ![].slice.call(sel.options).some(function (o) { return o.value === id; })) return;
    sel.value = id;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function fill(first) {
    if (!F || F.c !== "recexp") return;
    var cat = document.getElementById("f_category"), es = document.getElementById("f_expAccount"), ps = document.getElementById("f_payAccount");
    if (!cat || !es || !ps) return;
    var c = catOf(cat.value), ex = c[1] ? safe(function () { return idc(c[1]); }, "") : "", py = (c[2] ? safe(function () { return idc(c[2]); }, "") : "") || safe(function () { return idc("220204"); }, "");
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
    var t = e.target; if (!t || !F || F.c !== "recexp") return;
    if (t.id === "f_category") safe(function () { fill(false); }, null);
    else if (t.id === "f_expAccount" || t.id === "f_payAccount") safe(function () { if (!t.dataset.fsRecBusy) { t.dataset.fsRecBusy = "1"; fill(false); delete t.dataset.fsRecBusy; } }, null);
  });
  // a newly drawn monthly expense form
  var seen = null;
  function watch() {
    if (!document.body) return setTimeout(watch, 300);
    new MutationObserver(function () {
      var f = document.getElementById("frm"), cat = document.getElementById("f_category");
      if (!f || !cat || safe(function () { return F.c; }, "") !== "recexp") { seen = null; return; }
      if (seen === f) return;
      seen = f; safe(function () { fill(true); }, null);
    }).observe(document.body, { childList: true, subtree: true });
  }
  watch();
})();
