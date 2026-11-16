// Monthly expenses: "+ Add a type…" at the end of the Type list (hassan, 2026-11-16: "in this add type button if not
// available", on the Type list while booking lift maintenance material). A new type has a name, its expense account and
// its accrued liability account; choosing it later fills both boxes (hsec-recsug.js). Types are shared with everyone
// (collection fsrectypes) and sit above "Other", which stays last because the app falls back to the last type.
(function () {
  /* global S, REC_CAT, Store, COLLS, approverName, toast */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var C = "fsrectypes", ADD = "__fsaddtype";
  var say = function (m) { if (typeof toast === "function") toast(m); };
  var accs = function () { return safe(function () { return Store.data.accounts; }, []) || []; };
  var codeOf = function (id) { var a = accs().find(function (x) { return x.id === id; }); return a ? String(a.code) : ""; };

  // the Type field of the monthly expense form, wherever the app defines it
  function typeField() {
    if (typeof S === "undefined") return null;
    for (var k in S) {
      var f = S[k] && Array.isArray(S[k].fields) && S[k].fields.find(function (x) { return x.k === "category" && Array.isArray(x.o) && x.o.indexOf("Rent") >= 0 && x.o.indexOf("Other") >= 0; });
      if (f) return f;
    }
    return null;
  }
  var list = function () { return safe(function () { return REC_CAT; }, null); };
  // put a saved type into the app's list (before Other) and into the Type field
  function register(t) {
    var L = list(); if (!Array.isArray(L) || !t || !t.name) return;
    var row = [t.name, String(t.exp || ""), String(t.pay || "220204"), t.wht || ""], at = L.findIndex(function (c) { return c[0] === t.name; });
    if (at >= 0) { L[at] = row; } else { var o = L.findIndex(function (c) { return c[0] === "Other"; }); L.splice(o < 0 ? L.length : o, 0, row); }
    var f = typeField();
    if (f && f.o.indexOf(t.name) < 0) { var j = f.o.indexOf("Other"); f.o.splice(j < 0 ? f.o.length : j, 0, t.name); }
  }
  function subscribe() {
    if (typeof Store === "undefined" || !Store.ready || !Store.data || typeof COLLS === "undefined" || !typeField()) return false;
    if (COLLS.indexOf(C) < 0) COLLS.push(C);
    if (!Array.isArray(Store.data[C])) Store.data[C] = [];
    if (Store.db) Store.db.collection(C).onSnapshot(function (s) {
      Store.data[C] = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      Store.data[C].forEach(register); options();
    });
    return true;
  }

  // the form: our types and the Add option in the select
  var sel = function () { return document.getElementById("f_category"); };
  var isForm = function () { return !!(sel() && document.getElementById("f_expAccount") && document.getElementById("f_payAccount")); };
  function options() {
    var s = sel(); if (!s || !isForm()) return;
    var have = [].slice.call(s.options).map(function (o) { return o.value; }), other = [].slice.call(s.options).find(function (o) { return o.value === "Other"; });
    (Store.data[C] || []).forEach(function (t) {
      if (!t.name || have.indexOf(t.name) >= 0) return;
      var o = document.createElement("option"); o.value = o.textContent = t.name; s.insertBefore(o, other || null);
    });
    if (have.indexOf(ADD) < 0) { var a = document.createElement("option"); a.value = ADD; a.textContent = "+ Add a type…"; s.appendChild(a); }
    if (!s.dataset.fsPrev) s.dataset.fsPrev = s.value === ADD ? "" : s.value;
  }

  function box(s) {
    var f = s.closest(".f") || s.parentNode, old = document.getElementById("fsRtBox"); if (old) old.remove();
    var opt = function (id) { var src = document.getElementById(id); return src ? src.innerHTML.replace(/ selected(="[^"]*")?/g, "") : ""; };
    var d = document.createElement("div"); d.id = "fsRtBox"; d.className = "fs-rtbox";
    d.innerHTML = "<b>New type of monthly expense</b>" +
      "<label>Name <input id=\"fsRtName\" maxlength=\"60\" placeholder=\"e.g. Lift maintenance material\" autocomplete=\"off\"></label>" +
      "<label>Expense account <select id=\"fsRtExp\">" + opt("f_expAccount") + "</select></label>" +
      "<label>Accrued liability account <select id=\"fsRtPay\">" + opt("f_payAccount") + "</select></label>" +
      "<span class=\"hint\">Saved for everyone. Choosing this type fills these two accounts.</span>" +
      "<div class=\"fs-rtbtn\"><button type=\"button\" class=\"btn pri\" id=\"fsRtOk\">Add type</button><button type=\"button\" class=\"btn\" id=\"fsRtNo\">Cancel</button></div>";
    f.appendChild(d);
    var pay = d.querySelector("#fsRtPay"), id220 = (accs().find(function (a) { return String(a.code) === "220204" && a.posting !== "Header"; }) || {}).id;
    if (id220 && [].slice.call(pay.options).some(function (o) { return o.value === id220; })) pay.value = id220;
    d.querySelector("#fsRtExp").value = "";
    d.querySelector("#fsRtName").focus();
  }
  function setType(s, v) {
    s.value = v; s.dataset.fsPrev = v;
    s.dispatchEvent(new Event("change", { bubbles: true }));
  }
  async function add() {
    var s = sel(), nm = (document.getElementById("fsRtName").value || "").replace(/\s+/g, " ").trim().slice(0, 60);
    var ex = codeOf(document.getElementById("fsRtExp").value), py = codeOf(document.getElementById("fsRtPay").value);
    if (!nm) { say("Type a name for the new type."); return document.getElementById("fsRtName").focus(); }
    if (!ex) { say("Choose the expense account."); return; }
    if (!py) { say("Choose the accrued liability account."); return; }
    var L = list() || [], dup = L.find(function (c) { return String(c[0]).toLowerCase() === nm.toLowerCase(); });
    if (dup && !(Store.data[C] || []).some(function (t) { return t.name === dup[0]; })) { say("\"" + dup[0] + "\" is already in the list."); return; }
    var id = nm.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || ("t" + Date.now());
    var t = { id: id, name: nm, exp: ex, pay: py, by: safe(function () { return approverName(); }, "") || "", at: new Date().toISOString() };
    var ok = document.getElementById("fsRtOk"); if (ok) ok.disabled = true;
    try { await Store.save(C, t); } catch (x) { if (ok) ok.disabled = false; say("Could not save the type: " + ((x && x.message) || x)); return; }
    if (!(Store.data[C] || []).some(function (r) { return r.id === id; })) (Store.data[C] = Store.data[C] || []).push(t);
    register(t); options();
    var b = document.getElementById("fsRtBox"); if (b) b.remove();
    if (s) { s.value = nm; delete s.dataset.fsPrev; setType(s, nm); }
    say(nm + " added to the types for everyone.");
  }

  document.addEventListener("change", function (e) {
    var s = e.target; if (!s || s.id !== "f_category" || !isForm()) return;
    if (s.value === ADD) {
      e.stopImmediatePropagation();
      var prev = s.dataset.fsPrev || "";
      s.value = prev; s.dispatchEvent(new Event("change", { bubbles: true })); // puts the box back to what it was
      box(s); return;
    }
    s.dataset.fsPrev = s.value;
  }, true);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#fsRtOk, #fsRtNo"); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (b.id === "fsRtOk") add(); else { var x = document.getElementById("fsRtBox"); if (x) x.remove(); }
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.target && e.target.id === "fsRtName" && (e.key === "Enter" || e.key === "Escape")) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === "Enter") add(); else { var x = document.getElementById("fsRtBox"); if (x) x.remove(); }
    }
  }, true);

  function start() {
    if (!document.body || !subscribe()) return setTimeout(start, 300);
    new MutationObserver(function () { if (isForm()) options(); }).observe(document.body, { childList: true, subtree: true });
    var css = document.createElement("style");
    css.textContent = ".fs-rtbox{display:flex;flex-direction:column;gap:8px;margin-top:8px;padding:10px 12px;border:1px solid #16a34a;border-radius:10px;background:#f0fdf4}" +
      ".fs-rtbox label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}.fs-rtbox select,.fs-rtbox input{width:100%}.fs-rtbtn{display:flex;gap:8px}";
    document.head.appendChild(css);
  }
  start();
})();
