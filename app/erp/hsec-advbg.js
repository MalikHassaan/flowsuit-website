// Project advance as a % of the contract, and advances backed by a bank guarantee (hassan, 2026-10-29: "in project creation
// advance amount should be the percentage of the project amount and if it's backed with BG then the amount which is received
// in advance will be treated as BG").
// The project form gets "Advance % of contract" (blank = the advance milestones in its payment terms table), the advance
// amount worked out from the contract value, and "Advance backed by bank guarantee". When it is backed, saving the project
// keeps an Advance payment guarantee for exactly that amount in Trade finance › Bank guarantees (created as Requested; its
// vouchers post when it is Issued, as for any guarantee), and the advance milestones are linked to the guarantee step, so
// they show "Ready to invoice" once the guarantee is issued. An issued guarantee is never changed from here.
(function () {
  /* global S, F, Store, fmt, n, esc, toast, readForm */
  var advRows = function (p) { return (p.billing || []).filter(function (r) { var ev = r.ev === undefined || r.ev === null || r.ev === "" ? (window.FS_MS ? FS_MS.guess(r.m) : "") : r.ev; return (ev === 1 || ev === 2) && /advance|guarantee|\bbg\b|confirmation|signing/i.test(r.m || ""); }); };
  var pctOf = function (p) { return String(p.advPct ?? "").trim() !== "" ? n(p.advPct) : advRows(p).reduce(function (s, r) { return s + n(r.pct); }, 0); };
  var amtOf = function (p) { return Math.round(n(p.contractValue) * pctOf(p) / 100); };
  var apgOf = function (p) { return p.id ? Store.data.bgs.find(function (g) { return g.project === p.id && g.gtype === "Advance payment guarantee" && g.status !== "Cancelled"; }) : null; };
  function hint() {
    var el = document.getElementById("fsAdvAmt"); if (!el || !F || F.c !== "projects") return;
    var g = function (id) { var x = document.getElementById(id); return x ? x.value : ""; };
    var p = Object.assign({}, F.rec, { contractValue: n(String(g("f_contractValue")).replace(/,/g, "")), advPct: g("f_advPct") }), a = amtOf(p), bg = g("f_advBg") === "Yes";
    el.innerHTML = a ? "Advance: <b>Rs " + fmt(a) + "</b> (" + fmt(pctOf(p)) + "% of the contract)" + (bg ? ". Backed by an advance payment guarantee for the same amount." : ".") : "No advance.";
  }
  async function syncBg(p) {
    if (!p || !p.id || p.advBg !== "Yes") return;
    var a = amtOf(p), g = apgOf(p); if (!a) return;
    if (!g) {
      await Store.save("bgs", { entity: p.entity, gtype: "Advance payment guarantee", project: p.id, beneficiary: p.customer || p.name, contractRef: p.code || "",
        currency: "PKR", amount: a, bank: p.advBgBank || "", status: "Requested", notes: "Made from project " + (p.code || p.name) + ": advance " + fmt(pctOf(p)) + "% of the contract." });
      toast("Advance payment guarantee of Rs " + fmt(a) + " added for " + p.name + " under Trade finance › Bank guarantees (Requested). Enter the guarantee number and issue date when the bank issues it.");
    } else if (n(g.amount) !== a) {
      if (g.status === "Requested") { await Store.save("bgs", Object.assign({}, g, { amount: a })); toast("Advance payment guarantee " + (g.ref || "") + " changed to Rs " + fmt(a) + "."); }
      else toast("The advance is now Rs " + fmt(a) + " but guarantee " + (g.bgNo || g.ref || "") + " is " + g.status + " for Rs " + fmt(g.amount) + ". Extend or amend it with the bank.");
    }
  }
  function hook() {
    if (typeof S === "undefined" || !S.projects || typeof Store === "undefined" || typeof readForm !== "function") return false;
    var f = S.projects.fields, at = f.findIndex(function (x) { return x.k === "budgetCost"; });
    f.splice(at < 0 ? f.length : at + 1, 0,
      { k: "advPct", l: "Advance % of contract", t: "number", hint: "Blank = the advance milestones in the payment terms table." },
      { k: "advBg", l: "Advance backed by bank guarantee", t: "select", o: ["No", "Yes"], hint: "Yes keeps an Advance payment guarantee for the advance amount in Bank guarantees." },
      { k: "advBgBank", l: "Guarantee bank (if backed)", hint: "Same bank name as in Banks & facilities." });
    // show the amount under the % as it is typed
    document.addEventListener("input", function (e) { if (F && F.c === "projects" && /^f_(advPct|contractValue|advBg)$/.test(e.target.id)) hint(); });
    document.addEventListener("change", function (e) { if (F && F.c === "projects" && /^f_(advPct|advBg)$/.test(e.target.id)) hint(); });
    new MutationObserver(function () {
      var el = document.getElementById("f_advPct");
      if (el && F && F.c === "projects" && !document.getElementById("fsAdvAmt")) { var s = document.createElement("div"); s.id = "fsAdvAmt"; s.className = "hint"; s.style.marginTop = "4px"; s.setAttribute("aria-live", "polite"); el.parentNode.appendChild(s); hint(); }
    }).observe(document.body, { childList: true, subtree: true });
    // advance milestones of a guarantee-backed project wait for the guarantee step
    Store.save = (function (old) {
      return async function (c, rec) {
        if (c === "projects" && rec && rec.advBg === "Yes" && Array.isArray(rec.billing)) {
          var keep = advRows(rec); rec.billing = rec.billing.map(function (r) { return keep.indexOf(r) >= 0 ? Object.assign({}, r, { ev: 2 }) : r; });
        }
        var id = await old.apply(this, arguments);
        if (c === "projects" && rec && rec.advBg === "Yes") { try { await syncBg(Object.assign({}, rec, { id: id })); } catch (e) { toast("Project saved, but the guarantee was not made: " + (e.message || e)); } }
        return id;
      };
    })(Store.save);
    // customer advance receipt: "Advance % of contract" next to the amount, each one fills the other
    // (hassan, 2026-10-29: "there should be a percentage as well"). Inserted before the amount so fields[3] stays advType.
    if (S.custadv && !S.custadv.fields.some(function (x) { return x.k === "advPct"; })) {
      var cf = S.custadv.fields, ai = cf.findIndex(function (x) { return x.k === "amount"; });
      cf.splice(ai < 0 ? cf.length : ai, 0, { k: "advPct", l: "Advance % of contract", t: "number", hint: "Fills the amount from the project's contract value." });
    }
    var cproj = function () { var x = document.getElementById("f_projectId"); return x && x.value ? Store.data.projects.find(function (p) { return p.id === x.value; }) : null; };
    var cv = function (id) { var x = document.getElementById(id); return x ? x.value : ""; };
    var cset = function (id, v) { var x = document.getElementById(id); if (x) { x.value = v; x.dispatchEvent(new Event("input", { bubbles: true })); } };
    function chint() {
      var el = document.getElementById("fsCadvPct"), p = cproj(); if (!el) return;
      if (!p) { el.textContent = "Choose the project first."; return; }
      var c = n(p.contractValue), g = apgOf(p), due = amtOf(p);
      el.innerHTML = c ? "Contract Rs " + fmt(c) + (due ? ". Agreed advance Rs " + fmt(due) + " (" + fmt(pctOf(p)) + "%)" : "") +
        (p.advBg === "Yes" ? ". Backed by advance payment guarantee " + esc((g && (g.bgNo || g.ref)) || "(not made yet)") + (g ? " for Rs " + fmt(g.amount) + ", " + esc(g.status) : "") : "") + "."
        : "This project has no contract value, so the % cannot work out the amount.";
    }
    var busy = false;
    document.addEventListener("input", function (e) {
      if (busy || !F || F.c !== "custadv") return;
      var p = cproj(), c = p ? n(p.contractValue) : 0; if (!c) return;
      busy = true;
      try {
        if (e.target.id === "f_advPct") cset("f_amount", String(e.target.value).trim() === "" ? "" : fmt(c * n(e.target.value) / 100));
        else if (e.target.id === "f_amount") { var a = n(String(e.target.value).replace(/,/g, "")); cset("f_advPct", a ? String(Math.round(a / c * 10000) / 100) : ""); }
      } finally { busy = false; }
    }, true);
    document.addEventListener("change", function (e) {
      if (!F || F.c !== "custadv" || e.target.id !== "f_projectId") return;
      var p = cproj(); chint();
      if (p && !n(String(cv("f_amount")).replace(/,/g, "")) && pctOf(p)) { busy = true; try { cset("f_advPct", String(pctOf(p))); cset("f_amount", fmt(amtOf(p))); } finally { busy = false; } }
    });
    new MutationObserver(function () {
      var el = document.getElementById("f_advPct");
      if (el && F && F.c === "custadv" && !document.getElementById("fsCadvPct")) { var s = document.createElement("div"); s.id = "fsCadvPct"; s.className = "hint"; s.style.marginTop = "4px"; s.setAttribute("aria-live", "polite"); el.parentNode.appendChild(s); chint(); }
    }).observe(document.body, { childList: true, subtree: true });
    window.FS_ADV = { pct: pctOf, amount: amtOf };
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
