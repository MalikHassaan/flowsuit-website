// Petty cash on the imprest system (hassan, 2026-10-30, chose "Full imprest"). Under Treasury › Advances:
//  * Petty cash funds: one per custodian, with its petty cash account, the float and the bank that tops it up.
//    Its float voucher (Dr petty cash, Cr bank) goes to voucher approval like any payment.
//  * Petty cash expenses: one slip per spend, paid from a fund. Refused when the fund has not that much cash left.
//  * Replenishment claims: gathers the fund's unclaimed slips up to the claim date into one bank payment voucher
//    (Dr each expense, Cr bank), which goes through the voucher approval chain (Senior Manager, Group GM Finance)
//    and brings the cash back up to the float. Slips show Reimbursed once that voucher is posted.
// Also: an advance paid in cash, and the cash side of its settlement, now go to the entity's petty cash account
// instead of the bank account (they used to credit 121004 whatever the payment method).
(function () {
  /* global S, MODS, TAB_HOME, POSTERS, DOCNAME, LABEL, COLLS, Store, F, V, LEDGER, openForm, submitForm, readForm,
     advJournal, accByCode, nextNo, fmt, n, esc, fdate, pill, mono, ledgerTag, liveJv, scheduleRender, todayStr, ENTS */
  var FUNDS = "pcfunds", SLIPS = "pcslips", CLAIMS = "pcclaims";
  var D = function (c) { return Store.data[c] || []; };
  var byId = function (c, id) { return D(c).find(function (r) { return r.id === id; }) || null; };
  var accName = function (id) { var a = byId("accounts", id); return a ? a.code + " " + a.name : ""; };

  // where a slip stands: not yet claimed, in a claim whose voucher is waiting, or reimbursed
  function slipState(s) {
    var c = s.claim && byId(CLAIMS, s.claim), j = c && liveJv(CLAIMS, c.id, "reimburse");
    if (!c) return { k: "open" };
    if (j && j.status === "Posted") return { k: "paid", c: c, j: j };
    return { k: "claim", c: c, j: j };
  }
  function fundFig(f) {
    var open = 0, wait = 0;
    D(SLIPS).forEach(function (s) {
      if (s.fund !== f.id) return;
      var k = slipState(s).k;
      if (k === "open") open += n(s.amount); else if (k === "claim") wait += n(s.amount);
    });
    var fl = n(f.float);
    return { float: fl, open: open, wait: wait, cash: fl - open - wait };
  }
  // the active fund's petty cash account for an entity, for cash-paid advances
  function pettyAcc(ent) {
    var f = D(FUNDS).find(function (x) { return x.status !== "Closed" && x.entity === ent && x.account; });
    return f ? f.account : "";
  }
  function claimSlips(r) {
    return D(SLIPS).filter(function (s) { return s.fund === r.fund && s.claim === r.id; });
  }

  function defs() {
    var fundRef = { k: "fund", l: "Petty cash fund", t: "ref", ref: FUNDS, req: 1, rf: function (f) { return f.status !== "Closed"; } };
    S[FUNDS] = { title: "Petty cash fund", fields: [
      { k: "name", l: "Fund name", req: 1, hint: "For example: Head office petty cash." },
      { k: "entity", l: "Entity", t: "entity", req: 1 },
      { k: "custodian", l: "Custodian", req: 1, hint: "The person who holds the cash and signs the slips." },
      { k: "account", l: "Petty cash account", t: "acc", req: 1, af: "petty", hint: "The petty cash / cash in hand account in the chart." },
      { k: "float", l: "Float (imprest amount, PKR)", t: "money", req: 1, hint: "The cash the custodian holds when fully topped up." },
      { k: "bankAccount", l: "Topped up from (bank account)", t: "acc", req: 1, af: "bank" },
      { k: "status", l: "Status", t: "select", o: ["Active", "Closed"] },
      { k: "notes", l: "Notes", t: "textarea" }],
      cols: [["name", "Fund", function (r) { return esc(r.name) + "<br><span class=\"muted\">" + esc(r.custodian || "") + "</span>"; }], ["entity", "Entity"],
        ["account", "Account", function (r) { return esc(accName(r.account)); }], ["float", "Float", null, "num"],
        ["open", "Spent, not claimed", function (r) { return fmt(fundFig(r).open); }, "num"], ["wait", "In claims", function (r) { return fmt(fundFig(r).wait); }, "num"],
        ["cash", "Cash that should be in hand", function (r) { var x = fundFig(r); return fmt(x.cash) + (x.float && x.cash < x.float * 0.2 ? " " + pill("Top up", "warn") : ""); }, "num"],
        ["gl", "Float voucher", function (r) { return ledgerTag(FUNDS, r); }], ["status", "Status", function (r) { return pill(r.status || "Active"); }]],
      sort: function (a, b) { return String(a.name).localeCompare(String(b.name)); } };
    S[SLIPS] = { title: "Petty cash expense", fields: [
      { k: "slipNo", l: "Slip no.", req: 1 }, { k: "date", l: "Date", t: "date", req: 1 }, fundRef,
      { k: "payee", l: "Paid to", req: 1 }, { k: "description", l: "What it was for", req: 1 },
      { k: "glAccount", l: "Expense account", t: "acc", req: 1, af: "expense" },
      { k: "project", l: "Project (if for a project)", t: "ref", ref: "projects", opt: 1 },
      { k: "dept", l: "Department", t: "dept" },
      { k: "amount", l: "Amount (PKR)", t: "money", req: 1 },
      { k: "receipt", l: "Receipt kept", t: "select", o: ["Yes", "No"], hint: "Keep the receipt with the custodian until the claim is approved." }],
      cols: [["slipNo", "Slip", function (r) { return mono(r.slipNo); }], ["date", "Date", function (r) { return fdate(r.date); }],
        ["fund", "Fund", function (r) { var f = byId(FUNDS, r.fund); return esc(f ? f.name : ""); }], ["payee", "Paid to"], ["description", "For"],
        ["glAccount", "Account", function (r) { return esc(accName(r.glAccount)); }], ["amount", "Amount", null, "num"],
        ["st", "Status", function (r) { var x = slipState(r); return x.k === "open" ? pill("Not claimed yet", "warn") : x.k === "paid" ? pill("Reimbursed", "good") + " " + esc(x.c.claimNo) : pill("In claim", "acc") + " " + esc(x.c.claimNo); }]],
      sort: function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.slipNo).localeCompare(String(a.slipNo)); } };
    S[CLAIMS] = { title: "Petty cash replenishment claim", fields: [
      { k: "claimNo", l: "Claim no.", req: 1 }, { k: "date", l: "Date", t: "date", req: 1, hint: "Takes in every unclaimed expense of the fund up to this date." }, fundRef,
      { k: "notes", l: "Notes", t: "textarea" }],
      cols: [["claimNo", "Claim", function (r) { return mono(r.claimNo); }], ["date", "Date", function (r) { return fdate(r.date); }],
        ["fund", "Fund", function (r) { var f = byId(FUNDS, r.fund); return esc(f ? f.name : ""); }],
        ["slips", "Expenses", function (r) { return String(claimSlips(r).length); }, "num"], ["total", "Amount", null, "num"],
        ["gl", "Replenishment voucher", function (r) { return ledgerTag(CLAIMS, r); }]],
      sort: function (a, b) { return String(b.date).localeCompare(String(a.date)); } };

    POSTERS[FUNDS] = { open: { label: "petty cash float voucher", keys: ["float", "account", "bankAccount", "entity"],
      ready: function (r) { return !r.account ? "choose the petty cash account" : !r.bankAccount ? "choose the bank it is topped up from" : n(r.float) > 0 ? true : "enter the float"; },
      build: function (r) { var a = Math.round(n(r.float));
        return { vtype: "Bank payment voucher", date: r.date || todayStr(), entity: r.entity, payee: r.custodian || "", narration: "Petty cash float for " + r.name + " (custodian " + (r.custodian || "") + ")",
          lines: [{ account: r.account, debit: a, credit: 0, desc: "Petty cash float" }, { account: r.bankAccount, debit: 0, credit: a }] }; } } };
    POSTERS[CLAIMS] = { reimburse: { label: "replenishment voucher", keys: ["total", "fund", "date"],
      ready: function (r) { var f = byId(FUNDS, r.fund); return !f ? "choose the fund" : !f.bankAccount ? "set the fund's bank account" : n(r.total) > 0 ? true : "no unclaimed expenses up to this date"; },
      build: function (r) {
        var f = byId(FUNDS, r.fund), sl = claimSlips(r), g = {}, lines = [];
        sl.forEach(function (s) {
          var k = s.glAccount + "|" + (s.project || "") + "|" + (s.dept || "");
          var x = g[k] = g[k] || { account: s.glAccount, debit: 0, credit: 0, desc: [], project: s.project || "", dept: s.dept || "" };
          x.debit += n(s.amount); x.desc.push(s.slipNo + " " + s.description);
        });
        Object.keys(g).forEach(function (k) {
          var x = g[k], l = { account: x.account, debit: Math.round(x.debit), credit: 0, desc: x.desc.join("; ").slice(0, 200) };
          if (x.project) l.project = x.project; if (x.dept) l.dept = x.dept;
          lines.push(l);
        });
        var tot = lines.reduce(function (s, l) { return s + l.debit; }, 0);
        lines.push({ account: f.bankAccount, debit: 0, credit: tot });
        return { vtype: "Bank payment voucher", date: r.date, entity: f.entity, payee: f.custodian || "", ref: "",
          narration: "Petty cash replenishment " + r.claimNo + " for " + f.name + ": " + sl.length + " expense" + (sl.length === 1 ? "" : "s") + " (" + sl.map(function (s) { return s.slipNo; }).join(", ") + ")",
          lines: lines };
      } } };
    Object.assign(DOCNAME, { pcfunds: "petty cash fund", pcclaims: "replenishment claim" });
    LABEL[FUNDS] = "name"; LABEL[CLAIMS] = "claimNo"; LABEL[SLIPS] = "slipNo";
    var m = MODS.e_adv;
    if (m && !m.tabs.some(function (t) { return t[0] === FUNDS; })) {
      m.tabs.push([SLIPS, "Petty cash expenses"], [CLAIMS, "Replenishment claims"], [FUNDS, "Petty cash funds"]);
      m.sub = "Cash advances, and petty cash on the imprest system: spend from the float, then claim it back through voucher approval.";
    }
    [FUNDS, SLIPS, CLAIMS].forEach(function (c) { TAB_HOME[c] = "e_adv"; });
  }

  // the three collections are loaded like the app's own, after it has started
  function subscribe() {
    [FUNDS, SLIPS, CLAIMS].forEach(function (c) {
      if (COLLS.indexOf(c) < 0) COLLS.push(c);
      if (!Array.isArray(Store.data[c])) Store.data[c] = [];
      if (Store.db) Store.db.collection(c).onSnapshot(function (s) {
        Store.data[c] = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        LEDGER = null; scheduleRender(); // eslint-disable-line no-global-assign
      });
    });
  }

  function err(m) { var e = document.getElementById("ferr"); if (e) e.textContent = m; return false; }
  function check() {
    var r = F.rec;
    if (F.c === SLIPS) {
      var f = byId(FUNDS, r.fund), prev = r.id ? byId(SLIPS, r.id) : null;
      if (!f) return err("Choose the petty cash fund.");
      if (f.status === "Closed") return err(f.name + " is closed.");
      if (!(n(r.amount) > 0)) return err("Enter the amount.");
      if (prev && slipState(prev).k !== "open") return err("This expense is in claim " + slipState(prev).c.claimNo + ", so it can no longer change. Reject that claim's voucher first if it is wrong.");
      var left = fundFig(f).cash + (prev && prev.fund === f.id ? n(prev.amount) : 0);
      if (n(r.amount) > left + 0.5) return err("Only Rs " + fmt(Math.max(0, left)) + " cash is left in " + f.name + ". Make a replenishment claim first.");
      r.entity = f.entity;
    }
    if (F.c === CLAIMS) {
      var fc = byId(FUNDS, r.fund);
      if (!fc) return err("Choose the petty cash fund.");
      var mine = r.id && liveJv(CLAIMS, r.id, "reimburse");
      if (!mine && !D(SLIPS).some(function (s) { return s.fund === r.fund && s.date <= r.date && (slipState(s).k === "open" || s.claim === r.id); }))
        return err("There are no unclaimed expenses in " + fc.name + " up to " + fdate(r.date) + ".");
    }
    if (F.c === FUNDS && D(FUNDS).some(function (x) { return x.id !== r.id && x.status !== "Closed" && r.status !== "Closed" && x.account === r.account; }))
      return err("Another active fund already uses that petty cash account.");
    return true;
  }

  function hook() {
    if (typeof S === "undefined" || !S.advances || typeof POSTERS === "undefined" || typeof Store === "undefined" || !Store.ready ||
      typeof submitForm !== "function" || typeof openForm !== "function" || typeof advJournal !== "function") return false;
    defs();
    subscribe();

    openForm = (function (old) { // eslint-disable-line no-global-assign
      return function (c, id, pre) {
        if (!id && (c === SLIPS || c === CLAIMS)) {
          var act = D(FUNDS).filter(function (f) { return f.status !== "Closed" && (V.ent === "All" || !V.ent || f.entity === V.ent); });
          pre = Object.assign(c === SLIPS ? { slipNo: nextNo(SLIPS, "slipNo", "PCV-"), receipt: "Yes" } : { claimNo: nextNo(CLAIMS, "claimNo", "PCR-") },
            act.length === 1 ? { fund: act[0].id } : {}, pre || {});
        }
        if (!id && c === FUNDS) pre = Object.assign({ status: "Active" }, pre || {});
        return old.call(this, c, id, pre);
      };
    })(openForm);

    submitForm = (function (old) { // eslint-disable-line no-global-assign
      return async function () {
        var mine = F && [FUNDS, SLIPS, CLAIMS].indexOf(F.c) >= 0;
        if (!mine) return old.apply(this, arguments);
        readForm(); if (check() !== true) return false;
        // the app's own message hides why a save failed; show the real reason for these forms
        var save = Store.save, why = null;
        Store.save = function () { return save.apply(this, arguments).catch(function (e) { why = e; throw e; }); };
        try {
          var ok = await old.apply(this, arguments);
          if (ok === false && why) err("Could not save: " + (why.message || why.code || why) + ".");
          return ok;
        } finally { Store.save = save; }
      };
    })(submitForm);

    // a claim takes in the fund's unclaimed expenses up to its date when it is saved, while its voucher is not made yet
    Store.save = (function (old) {
      return async function (c, rec) {
        if (c !== CLAIMS || !rec || !rec.fund) return old.apply(this, arguments);
        var f = byId(FUNDS, rec.fund), live = rec.id && liveJv(CLAIMS, rec.id, "reimburse");
        if (live) return old.apply(this, arguments);
        var take = D(SLIPS).filter(function (s) { return s.fund === rec.fund && s.date <= rec.date && (slipState(s).k === "open" || (rec.id && s.claim === rec.id)); });
        rec.entity = f ? f.entity : rec.entity;
        rec.total = Math.round(take.reduce(function (s, x) { return s + n(x.amount); }, 0));
        var id = await old.call(this, c, rec);
        for (var i = 0; i < take.length; i++) if (take[i].claim !== id) await old.call(this, SLIPS, Object.assign({}, take[i], { claim: id }));
        // slips dated after the claim that an earlier save took in go back to unclaimed
        var ids = take.map(function (s) { return s.id; });
        var drop = D(SLIPS).filter(function (s) { return s.claim === id && ids.indexOf(s.id) < 0; });
        for (var k = 0; k < drop.length; k++) await old.call(this, SLIPS, Object.assign({}, drop[k], { claim: "" }));
        return id;
      };
    })(Store.save);

    // cash-paid advances: the cash side goes to petty cash, not the bank
    advJournal = (function (old) { // eslint-disable-line no-global-assign
      return function (r, ev) {
        var j = old.apply(this, arguments), bank = (accByCode()["121004"] || {}).id, pc = r && r.payMethod === "Cash" ? pettyAcc(r.entity) : "";
        if (j && bank && pc) j.lines = (j.lines || []).map(function (l) { return l.account === bank ? Object.assign({}, l, { account: pc }) : l; });
        return j;
      };
    })(advJournal);

    // the slips a claim takes in, on the claim form
    var last = "";
    new MutationObserver(function () {
      if (typeof F === "undefined" || !F || F.c !== CLAIMS || !F.rec) return;
      var calc = document.querySelector("#frm .calc"); if (!calc) return;
      var r = F.rec, sl = r.id ? claimSlips(r) : D(SLIPS).filter(function (s) { return s.fund === r.fund && s.date <= (r.date || "") && slipState(s).k === "open"; });
      var tot = sl.reduce(function (s, x) { return s + n(x.amount); }, 0), f = byId(FUNDS, r.fund);
      var h = "<div id=\"fsPcSlips\"><h4 style=\"margin:0 0 6px\">" + (r.id ? "Expenses in this claim" : "Expenses this claim will take in when saved") + "</h4>" +
        (sl.length ? "<div class=\"tw\"><table><thead><tr><th>Slip</th><th>Date</th><th>Paid to</th><th>For</th><th>Account</th><th class=\"num\">Amount</th></tr></thead><tbody>" +
          sl.map(function (s) { return "<tr><td>" + esc(s.slipNo) + "</td><td>" + fdate(s.date) + "</td><td>" + esc(s.payee) + "</td><td>" + esc(s.description) + "</td><td>" + esc(accName(s.glAccount)) + "</td><td class=\"num\">" + fmt(s.amount) + "</td></tr>"; }).join("") +
          "</tbody><tfoot><tr><th colspan=\"5\">Total</th><th class=\"num\">" + fmt(tot) + "</th></tr></tfoot></table></div>" : "<p class=\"muted\" style=\"margin:0\">None yet.</p>") +
        (f ? "<p class=\"muted\" style=\"margin:6px 0 0\">" + esc(f.name) + ": float Rs " + fmt(f.float) + ", cash that should be in hand Rs " + fmt(fundFig(f).cash) + ".</p>" : "") + "</div>";
      var cur = document.getElementById("fsPcSlips");
      if (cur && cur.parentNode === calc && h === last) return;
      last = h; if (cur) cur.remove();
      calc.insertAdjacentHTML("afterbegin", h);
    }).observe(document.body, { childList: true, subtree: true });

    scheduleRender();
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
