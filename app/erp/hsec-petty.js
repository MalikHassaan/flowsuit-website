// Petty cash on the imprest system (hassan, 2026-10-30, chose "Full imprest"). Under Treasury › Advances:
//  * Petty cash funds: one per custodian, with its petty cash account, the float and the bank that tops it up.
//    Its float voucher (Dr petty cash, Cr bank) goes to voucher approval like any payment.
//  * Petty cash expenses: one slip per payment, paid from a fund, with one or more lines (expense account, what for,
//    project, department, amount). The form shows the cash left in the fund, and a slip is refused when the fund has
//    not that much. Each slip posts its own cash payment voucher (Dr each expense, Cr petty cash) (hassan, 2026-10-30).
//  * Replenishment claims: gathers the fund's unclaimed slips up to the claim date into one bank payment voucher
//    (Dr petty cash, Cr bank), which goes through the voucher approval chain (Senior Manager, Group GM Finance)
//    and brings the cash back up to the float. Slips show Reimbursed once that voucher is posted. Slips saved before
//    slips had their own voucher are claimed the old way (Dr each expense instead of petty cash).
// Also: an advance paid in cash, and the cash side of its settlement, now go to the entity's petty cash account
// instead of the bank account (they used to credit 121004 whatever the payment method).
(function () {
  /* global S, MODS, TAB_HOME, POSTERS, DOCNAME, LABEL, COLLS, Store, F, V, LEDGER, openForm, submitForm, readForm,
     advJournal, accByCode, nextNo, fmt, n, esc, fdate, pill, mono, ledgerTag, liveJv, scheduleRender, todayStr, ENTS,
     fieldHtml, accOptsGrouped, refName, DEPTS, ssEnhance, ledger */
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
    var open = 0, wait = 0, paid = 0;
    D(SLIPS).forEach(function (s) {
      if (s.fund !== f.id) return;
      var k = slipState(s).k;
      if (k === "open") open += n(s.amount); else if (k === "claim") wait += n(s.amount); else paid += n(s.amount);
    });
    var fl = n(f.float);
    return { float: fl, open: open, wait: wait, paid: paid, spent: open + wait + paid, cash: fl - open - wait };
  }
  // the active fund's petty cash account for an entity, for cash-paid advances
  function pettyAcc(ent) {
    var f = D(FUNDS).find(function (x) { return x.status !== "Closed" && x.entity === ent && x.account; });
    return f ? f.account : "";
  }
  // a slip's lines; slips saved before lines existed had one account and amount
  function slipLines(s) {
    if (Array.isArray(s.items) && s.items.length) return s.items;
    return s.glAccount ? [{ account: s.glAccount, desc: s.description || "", project: s.project || "", dept: s.dept || "", amount: n(s.amount) }] : [];
  }
  // the petty cash account's posted balance for the fund's company
  function bookBal(f) {
    var t = 0;
    if (typeof ledger === "function") ledger().lines.forEach(function (l) { if (l.acc === f.account && l.ent === f.entity) t += l.amt; });
    return t;
  }
  function claimSlips(r) {
    return D(SLIPS).filter(function (s) { return s.fund === r.fund && s.claim === r.id; });
  }

  function defs() {
    var fundRef = { k: "fund", l: "Petty cash fund", t: "ref", ref: FUNDS, req: 1, rf: function (f) { return f.status !== "Closed"; } };
    S[FUNDS] = { title: "Petty cash fund", fields: [
      { k: "name", l: "Fund name", req: 1, hint: "For example: Head office petty cash." },
      { k: "location", l: "Location / site", hint: "Where the cash is kept, for example: Head office, Karachi site." },
      { k: "entity", l: "Entity", t: "entity", req: 1 },
      { k: "custodian", l: "Custodian", req: 1, hint: "The person who holds the cash and signs the slips." },
      { k: "account", l: "Petty cash account", t: "acc", req: 1, af: "petty", hint: "The petty cash / cash in hand account in the chart." },
      { k: "float", l: "Float (imprest amount, PKR)", t: "money", req: 1, hint: "The cash the custodian holds when fully topped up." },
      { k: "bankAccount", l: "Topped up from (bank account)", t: "acc", req: 1, af: "bank" },
      { k: "status", l: "Status", t: "select", o: ["Active", "Closed"] },
      { k: "notes", l: "Notes", t: "textarea" }],
      // one row per location: who holds it, what was given, what was spent, what is left (hassan, 2026-10-30)
      cols: [["name", "Fund", function (r) { return esc(r.name) + "<br><span class=\"muted\">" + esc(r.custodian || "") + "</span>"; }],
        ["location", "Location"], ["entity", "Entity"], ["float", "Given (float)", null, "num"],
        ["spent", "Spent to date", function (r) { return fmt(fundFig(r).spent); }, "num"], ["paid", "Reimbursed", function (r) { return fmt(fundFig(r).paid); }, "num"],
        ["open", "Spent, not claimed", function (r) { return fmt(fundFig(r).open); }, "num"], ["wait", "In claims", function (r) { return fmt(fundFig(r).wait); }, "num"],
        ["cash", "Cash that should be in hand", function (r) { var x = fundFig(r); return fmt(x.cash) + (x.float && x.cash < x.float * 0.2 ? " " + pill("Top up", "warn") : ""); }, "num"],
        ["book", "Balance in books", function (r) { return fmt(bookBal(r)); }, "num"],
        ["gl", "Float voucher", function (r) { return ledgerTag(FUNDS, r); }], ["status", "Status", function (r) { return pill(r.status || "Active"); }]],
      sort: function (a, b) { return String(a.name).localeCompare(String(b.name)); } };
    S[SLIPS] = { title: "Petty cash expense", fields: [
      { k: "slipNo", l: "Slip no.", req: 1 }, { k: "date", l: "Date", t: "date", req: 1 }, fundRef,
      { k: "payee", l: "Paid to", req: 1 }, { k: "receipt", l: "Receipt kept", t: "select", o: ["Yes", "No"], hint: "Keep the receipts with the custodian until the claim is approved." },
      { k: "items", l: "Expenses", t: "pclines" }],
      cols: [["slipNo", "Slip", function (r) { return mono(r.slipNo); }], ["date", "Date", function (r) { return fdate(r.date); }],
        ["fund", "Fund", function (r) { var f = byId(FUNDS, r.fund); return esc(f ? f.name : ""); }], ["payee", "Paid to"], ["description", "For", function (r) { return esc(r.description || slipLines(r).map(function (l) { return l.desc; }).filter(Boolean).join("; ")); }],
        ["glAccount", "Account", function (r) { var l = slipLines(r); return l.length ? esc(accName(l[0].account)) + (l.length > 1 ? " <span class=\"muted\">+" + (l.length - 1) + " more</span>" : "") : ""; }], ["amount", "Amount", null, "num"],
        ["gl", "Voucher", function (r) { return ledgerTag(SLIPS, r); }],
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
          // a slip with its own voucher has already charged the expense and credited petty cash: this puts the cash back
          var own = liveJv(SLIPS, s.id, "pay");
          (own ? [{ account: f.account, amount: n(s.amount), desc: "" }] : slipLines(s)).forEach(function (ln) {
            var k = ln.account + "|" + (ln.project || "") + "|" + (ln.dept || "");
            var x = g[k] = g[k] || { account: ln.account, debit: 0, credit: 0, desc: [], project: ln.project || "", dept: ln.dept || "" };
            x.debit += n(ln.amount); x.desc.push(s.slipNo + (ln.desc ? " " + ln.desc : ""));
          });
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
    POSTERS[SLIPS] = { pay: { label: "petty cash payment voucher", keys: ["items", "amount", "fund", "date"],
      ready: function (r) { var f = byId(FUNDS, r.fund); return !f ? "choose the fund" : !f.account ? "set the fund's petty cash account" : slipLines(r).some(function (l) { return !l.account; }) ? "every line needs an expense account" : n(r.amount) > 0 ? true : "enter the amounts"; },
      build: function (r) {
        var f = byId(FUNDS, r.fund), sl = slipLines(r), lines = sl.map(function (ln) {
          var l = { account: ln.account, debit: Math.round(n(ln.amount)), credit: 0, desc: String(ln.desc || "").slice(0, 200) };
          if (ln.project) l.project = ln.project; if (ln.dept) l.dept = ln.dept;
          return l;
        }).filter(function (l) { return l.debit > 0; });
        var tot = lines.reduce(function (s, l) { return s + l.debit; }, 0);
        lines.push({ account: f.account, debit: 0, credit: tot, desc: "Paid from " + f.name });
        return { vtype: "Cash payment voucher", date: r.date, entity: f.entity, payee: r.payee || "", ref: "", dept: (sl[0] || {}).dept || "",
          narration: "Petty cash " + r.slipNo + " to " + (r.payee || "") + ": " + sl.map(function (l) { return l.desc; }).filter(Boolean).join("; ").slice(0, 150),
          lines: lines };
      } } };
    Object.assign(DOCNAME, { pcfunds: "petty cash fund", pcclaims: "replenishment claim", pcslips: "petty cash expense" });
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

  // ---- a slip's expense lines ----
  var expenseAcc = function (a) { return /^(5|6|72|8)/.test(a.code); };
  function slipFund() { return F && F.rec ? byId(FUNDS, F.rec.fund) : null; }
  function linesTot(it) { return Math.round(it.reduce(function (s, l) { return s + n(l.amount); }, 0) * 100) / 100; }
  function accOpts(v, ent) {
    var all = Store.data.accounts;
    Store.data.accounts = all.filter(function (a) { return a.posting === "Header" || a.id === v || expenseAcc(a); });
    try { return accOptsGrouped(v, ent); } finally { Store.data.accounts = all; }
  }
  function linesHtml(it) {
    var f = slipFund(), ent = f ? f.entity : "", pj = Store.data.projects || [], dp = DEPTS();
    var sel = function (o, v) { return o.map(function (x) { return "<option value=\"" + esc(x[0]) + "\"" + (x[0] === v ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join(""); };
    return "<div id=\"pcBox\"><div class=\"jhead\"><b>Expenses on this slip</b><button type=\"button\" class=\"btn sm\" id=\"pcAdd\">+ Add line</button></div>" +
      "<div class=\"tw\"><table class=\"bitab\"><thead><tr><th style=\"min-width:180px\">What it was for *</th><th style=\"min-width:280px\">Expense account *</th><th style=\"min-width:160px\">Project</th><th>Department</th><th class=\"num\">Amount (PKR) *</th><th></th></tr></thead><tbody>" +
      it.map(function (x, i) {
        var a = " data-pi=\"" + i + "\" aria-label=\"";
        return "<tr><td><input" + a + "What it was for, line " + (i + 1) + "\" data-pk=\"desc\" value=\"" + esc(x.desc || "") + "\" placeholder=\"For example: courier\"></td>" +
          "<td><select" + a + "Expense account, line " + (i + 1) + "\" data-pk=\"account\">" + accOpts(x.account || "", ent) + "</select></td>" +
          "<td><select" + a + "Project, line " + (i + 1) + "\" data-pk=\"project\"><option value=\"\">None</option>" + sel(pj.map(function (p) { return [p.id, refName("projects", p.id)]; }), x.project || "") + "</select></td>" +
          "<td><select" + a + "Department, line " + (i + 1) + "\" data-pk=\"dept\"><option value=\"\">Choose…</option>" + sel(dp.concat(x.dept && dp.indexOf(x.dept) < 0 ? [x.dept] : []).map(function (d) { return [d, d]; }), x.dept || "") + "</select></td>" +
          "<td><input" + a + "Amount, line " + (i + 1) + "\" data-pk=\"amount\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\" class=\"num amt\" style=\"width:120px\" value=\"" + esc(n(x.amount) ? x.amount : "") + "\"></td>" +
          "<td>" + (it.length > 1 ? "<button type=\"button\" class=\"btn sm\" data-pcrm=\"" + i + "\" aria-label=\"Remove line " + (i + 1) + "\">×</button>" : "") + "</td></tr>";
      }).join("") +
      "</tbody><tfoot><tr><td colspan=\"4\">Total</td><td class=\"num\" id=\"pcTot\">" + fmt(linesTot(it)) + "</td><td></td></tr></tfoot></table></div>" +
      "<p id=\"pcLeft\" class=\"muted\" style=\"margin:6px 0 0\"></p></div>";
  }
  function readLines() {
    var box = document.getElementById("pcBox"); if (!box) return (F && F.rec && F.rec.items) || [];
    var rows = {};
    box.querySelectorAll("[data-pi]").forEach(function (el) { (rows[+el.getAttribute("data-pi")] = rows[+el.getAttribute("data-pi")] || {})[el.getAttribute("data-pk")] = el.value; });
    return Object.keys(rows).sort(function (a, b) { return a - b; }).map(function (i) {
      var r = rows[i]; return { desc: String(r.desc || "").trim(), account: r.account || "", project: r.project || "", dept: r.dept || "", amount: n(r.amount) };
    });
  }
  function redrawLines() {
    var box = document.getElementById("pcBox"); if (!box) return;
    box.outerHTML = linesHtml(F.rec.items && F.rec.items.length ? F.rec.items : [{}]);
    if (typeof ssEnhance === "function") ssEnhance(document.getElementById("frm"));
    showLeft();
  }
  // the cash left in the fund before this slip, and after it
  function showLeft() {
    var p = document.getElementById("pcLeft"); if (!p) return;
    var it = readLines(), tot = linesTot(it), t = document.getElementById("pcTot"); if (t) t.textContent = fmt(tot);
    var f = slipFund(); if (!f) { p.textContent = "Choose the petty cash fund to see the cash left in it."; p.className = "muted"; return; }
    var prev = F.rec.id ? byId(SLIPS, F.rec.id) : null, x = fundFig(f);
    var left = x.cash + (prev && prev.fund === f.id && slipState(prev).k === "open" ? n(prev.amount) : 0), after = left - tot;
    p.innerHTML = "<b>" + esc(f.name) + "</b>: cash left Rs " + fmt(left) + " of the Rs " + fmt(x.float) + " float" +
      (x.open ? " (Rs " + fmt(x.open) + " spent, not claimed yet" + (x.wait ? "; Rs " + fmt(x.wait) + " in claims" : "") + ")" : x.wait ? " (Rs " + fmt(x.wait) + " in claims)" : "") +
      ". After this slip: <b>Rs " + fmt(after) + "</b>." + (after < -0.5 ? " Not enough cash: make a replenishment claim first." : after < x.float * 0.2 ? " Running low: make a replenishment claim soon." : "");
    p.className = after < -0.5 ? "err" : "muted";
  }

  // on a fund's form: where its money went, by expense head and by month
  var lastFund = "";
  function fundPanel() {
    var calc = document.querySelector("#frm .calc"); if (!calc) return;
    var f = byId(FUNDS, F.rec.id); if (!f) return;
    var head = {}, mon = {}, x = fundFig(f);
    D(SLIPS).forEach(function (s) {
      if (s.fund !== f.id) return;
      slipLines(s).forEach(function (l) { var k = l.account || ""; head[k] = (head[k] || 0) + n(l.amount); });
      var m = String(s.date || "").slice(0, 7); mon[m] = (mon[m] || 0) + n(s.amount);
    });
    var hk = Object.keys(head).sort(function (a, b) { return head[b] - head[a]; }), mk = Object.keys(mon).sort().reverse().slice(0, 12);
    var tab = function (t, rows) { return "<h4 style=\"margin:10px 0 6px\">" + t + "</h4>" + (rows.length ? "<div class=\"tw\"><table><tbody>" + rows.join("") + "</tbody></table></div>" : "<p class=\"muted\" style=\"margin:0\">Nothing spent yet.</p>"); };
    var h = "<div id=\"fsPcFund\"><h4 style=\"margin:0 0 6px\">" + esc(f.name) + (f.location ? " · " + esc(f.location) : "") + " (custodian " + esc(f.custodian || "") + ")</h4>" +
      "<dl><dt>Given (float)</dt><dd>" + fmt(x.float) + "</dd><dt>Spent to date</dt><dd>" + fmt(x.spent) + "</dd><dt>Reimbursed</dt><dd>" + fmt(x.paid) + "</dd>" +
      "<dt>Spent, not claimed / in claims</dt><dd>" + fmt(x.open) + " / " + fmt(x.wait) + "</dd><dt>Cash that should be in hand</dt><dd>" + fmt(x.cash) + "</dd><dt>Balance in books</dt><dd>" + fmt(bookBal(f)) + "</dd></dl>" +
      tab("Spent by expense head", hk.map(function (k) { return "<tr><td>" + esc(accName(k) || "No account") + "</td><td class=\"num\">" + fmt(head[k]) + "</td></tr>"; })) +
      tab("Spent by month", mk.map(function (m) { return "<tr><td>" + esc(m) + "</td><td class=\"num\">" + fmt(mon[m]) + "</td></tr>"; })) + "</div>";
    var cur = document.getElementById("fsPcFund");
    if (cur && cur.parentNode === calc && h === lastFund) return;
    lastFund = h; if (cur) cur.remove();
    calc.insertAdjacentHTML("afterbegin", h);
  }

  function err(m) { var e = document.getElementById("ferr"); if (e) e.textContent = m; return false; }
  function check() {
    var r = F.rec;
    if (F.c === SLIPS) {
      var f = byId(FUNDS, r.fund), prev = r.id ? byId(SLIPS, r.id) : null;
      if (!f) return err("Choose the petty cash fund.");
      if (f.status === "Closed") return err(f.name + " is closed.");
      r.items = (r.items || []).filter(function (l) { return l.account || n(l.amount) || l.desc; });
      if (!r.items.length) return err("Add at least one expense line.");
      for (var i = 0; i < r.items.length; i++) {
        if (!r.items[i].account) return err("Line " + (i + 1) + ": choose the expense account.");
        if (!(n(r.items[i].amount) > 0)) return err("Line " + (i + 1) + ": enter the amount.");
        if (!String(r.items[i].desc || "").trim()) return err("Line " + (i + 1) + ": say what it was for.");
      }
      r.amount = Math.round(r.items.reduce(function (s, l) { return s + n(l.amount); }, 0) * 100) / 100;
      r.description = r.items.map(function (l) { return l.desc; }).join("; ").slice(0, 200);
      ["glAccount", "project", "dept"].forEach(function (k) { delete r[k]; });
      var pj = prev && liveJv(SLIPS, prev.id, "pay");
      if (pj && (n(prev.amount) !== n(r.amount) || JSON.stringify(slipLines(prev)) !== JSON.stringify(r.items) || prev.fund !== r.fund || prev.date !== r.date))
        return err("This expense already has voucher " + (pj.ref || "") + ". Reject or reverse that voucher before changing the amounts.");
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
      typeof submitForm !== "function" || typeof openForm !== "function" || typeof advJournal !== "function" ||
      typeof fieldHtml !== "function" || typeof readForm !== "function" || typeof accOptsGrouped !== "function") return false;
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

    // a slip's expense lines, and the cash left in its fund
    fieldHtml = (function (old) { // eslint-disable-line no-global-assign
      return function (f, v) {
        if (!f || f.t !== "pclines") return old.apply(this, arguments);
        var it = Array.isArray(v) && v.length ? v : F && F.rec ? slipLines(F.rec) : [];
        return "<div class=\"f w lines\">" + linesHtml(it.length ? it : [{}]) + "</div>";
      };
    })(fieldHtml);
    readForm = (function (old) { // eslint-disable-line no-global-assign
      return function () {
        var r = old.apply(this, arguments);
        if (F && F.c === SLIPS && document.getElementById("pcBox")) { F.rec.items = readLines(); F.rec.amount = linesTot(F.rec.items); }
        return r;
      };
    })(readForm);
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("#pcAdd, [data-pcrm]");
      if (!t || typeof F === "undefined" || !F || F.c !== SLIPS) return;
      var it = readLines();
      if (t.id === "pcAdd") it.push({ dept: (it[it.length - 1] || {}).dept || "" });
      else { it.splice(+t.getAttribute("data-pcrm"), 1); if (!it.length) it.push({}); }
      F.rec.items = it; redrawLines();
      if (t.id === "pcAdd") { var el = document.querySelector("[data-pi=\"" + (it.length - 1) + "\"][data-pk=\"desc\"]"); if (el) el.focus(); }
    });
    document.addEventListener("input", function (e) { if (typeof F !== "undefined" && F && F.c === SLIPS && e.target.closest && e.target.closest("#pcBox")) showLeft(); });
    document.addEventListener("change", function (e) {
      if (typeof F === "undefined" || !F || F.c !== SLIPS || !e.target) return;
      if (e.target.id === "f_fund") { F.rec.items = readLines(); F.rec.fund = e.target.value; redrawLines(); } // the fund sets the company of the accounts
      else if (e.target.closest && e.target.closest("#pcBox")) showLeft();
    });

    // the slips a claim takes in, on the claim form
    var last = "";
    new MutationObserver(function () {
      if (typeof F !== "undefined" && F && F.c === SLIPS) {
        var fm = document.getElementById("frm"); if (fm && !fm.classList.contains("wide")) fm.classList.add("wide"); // room for the lines table
        var pl = document.getElementById("pcLeft"); if (pl && !pl.textContent) showLeft();
        return;
      }
      if (typeof F !== "undefined" && F && F.c === FUNDS && F.rec && F.rec.id) { fundPanel(); return; }
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
