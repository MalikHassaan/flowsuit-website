// Management dashboard (hassan, 2026-10-31): one screen for higher management with the bank balances (click Available
// balance for each bank from its latest reconciliation), LC / guarantee limits, guarantees outstanding, FATR and its
// repayments, what projects will bill month by month, what maintenance (AMC) contracts bring in each month, and
// sales and collections by location (the project's site province). Read only: every figure comes from records already
// in the ERP, and it follows the company picked at the top (or the whole group).
(function () {
  /* global MODS, NAV, TITLE, TAB_HOME, V, Store, byEnt, usable, sums, lcCalc, bgCalc, tfUse, tfIsLim, tfFacOf, fatrCalc,
     bsRows, bsState, bsAmt, projRow, outAR, outAP, esc, fdate, render, special, coName */
  var open = { bank: false, lim: false };
  var num = function (x) { return +x || 0; };
  var money = function (x) { var v = Math.round(Math.abs(num(x))).toLocaleString("en-US"); return num(x) < -0.5 ? "(" + v + ")" : v; };
  var big = function (x) { var a = Math.abs(num(x)), s = num(x) < 0 ? "-" : "";
    return a >= 1e9 ? s + (a / 1e9).toFixed(2) + " bn" : a >= 1e6 ? s + (a / 1e6).toFixed(1) + " m" : s + Math.round(a).toLocaleString("en-US"); };
  var today = function () { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var ym = function (d) { return String(d || "").slice(0, 7); };
  var monthName = function (m) { var p = m.split("-"); return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }); };
  var fd = function (d) { try { return d ? fdate(d) : "–"; } catch (e) { return d || "–"; } };
  var D = function (c) { return (Store.data && Store.data[c]) || []; };
  var mine = function (c) { try { return byEnt(D(c)); } catch (e) { return D(c); } };
  var safe = function (f, dflt) { try { return f(); } catch (e) { return dflt; } };
  function months(k) { var out = [], d = new Date(); d.setDate(1); for (var i = 0; i < k; i++) { out.push(d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2)); d.setMonth(d.getMonth() + 1); } return out; }
  var place = function (p) { return (p && String(p.province || "").trim()) || "Location not set"; };
  var isAmc = function (p) { return /maintenance|amc/i.test(String(p.type || "")); };

  // ---- Banks: statement balance from the latest reconciliation, else the register ----
  function banks() {
    var books = {}, recs = D("bankrecs");
    return mine("banks").filter(function (b) { return !tfIsLim(b) && b.type !== "Term loan"; }).map(function (b) {
      var rec = recs.filter(function (r) { return r.account && r.account === b.glAcc && r.entity === b.entity; })
        .sort(function (a, c) { return String(c.stmtDate).localeCompare(String(a.stmtDate)); })[0];
      if (b.glAcc && books[b.entity] === undefined) books[b.entity] = safe(function () { return sums(b.entity, null, null); }, {});
      var stmt = rec ? num(rec.stmtBalance) : num(b.balance);
      var avail = safe(function () { return usable(Object.assign({}, b, { balance: stmt })); }, Math.max(0, stmt - num(b.lien)));
      return { b: b, rec: rec, stmt: stmt, asOf: rec ? rec.stmtDate : b.asOf, from: rec ? (rec.status === "Reconciled" ? "Reconciled" : "Draft reconciliation") : "Bank register",
        book: b.glAcc && books[b.entity] ? num(books[b.entity][b.glAcc]) : null, avail: avail };
    }).sort(function (a, c) { return c.avail - a.avail; });
  }

  // ---- LC / guarantee limits ----
  function limits() {
    return mine("banks").filter(function (b) { return tfIsLim(b); }).map(function (b) { return { b: b, u: safe(function () { return tfUse(b); }, null) }; })
      .filter(function (x) { return x.u; });
  }

  function view() {
    if (!Store || !Store.data) return '<div class="panel empty"><b>Loading</b></div>';
    var T = today(), M = months(12), m0 = M[0];
    var who = safe(function () { return V.ent === "All" ? "HSEC Group" : coName(V.ent); }, "");
    var BK = banks(), LM = limits();
    var cash = BK.reduce(function (s, x) { return s + x.avail; }, 0);
    var lim = LM.reduce(function (t, x) { t.limit += num(x.b.limit); t.lc += x.u.lc; t.bg += x.u.bg; t.plan += x.u.plan; t.avail += x.u.avail; return t; }, { limit: 0, lc: 0, bg: 0, plan: 0, avail: 0 });

    // Guarantees
    var bgs = mine("bgs").map(function (g) { return { g: g, x: bgCalc(g) }; }).filter(function (r) { return r.x.live; });
    var bgIss = bgs.filter(function (r) { return r.x.issued; }), bgReq = bgs.filter(function (r) { return !r.x.issued; });
    var bgAmt = bgIss.reduce(function (s, r) { return s + r.x.pkr; }, 0);
    var in30 = new Date(); in30.setDate(in30.getDate() + 30); var d30 = in30.toISOString().slice(0, 10);
    var bgSoon = bgIss.filter(function (r) { return r.g.expiry && r.g.expiry <= d30; });
    var byType = {};
    bgIss.forEach(function (r) { var k = r.g.gtype || "Other"; byType[k] = byType[k] || { n: 0, a: 0, m: 0 }; byType[k].n++; byType[k].a += r.x.pkr; byType[k].m += r.x.margin; });

    // FATR and LC retirements by month
    var fat = mine("fatrs").map(function (f) { return { f: f, x: safe(function () { return fatrCalc(f); }, null) }; }).filter(function (r) { return r.x && r.x.out >= 1; });
    var fatOut = fat.reduce(function (s, r) { return s + r.x.out; }, 0), fatOver = fat.filter(function (r) { return r.x.due && r.x.due < T; });
    var fatM = {}, lcM = {};
    fat.forEach(function (r) { var k = !r.x.due ? "nd" : r.x.due < T ? "over" : ym(r.x.due); fatM[k] = (fatM[k] || 0) + r.x.out + num(r.x.mkToDue); });
    mine("lcs").forEach(function (l) { var x = safe(function () { return lcCalc(l); }, null); if (!x || !x.live || !x.retire) return;
      var k = x.retire < T ? "over" : ym(x.retire); lcM[k] = (lcM[k] || 0) + x.balance; });

    // Projects: milestones still to invoice, invoices still to collect, AMC fees
    var projs = mine("projects").filter(function (p) { return p.status !== "Closed" && p.status !== "Cancelled"; });
    var bill = {}, coll = {}, amc = {}, amcRows = [];
    projs.forEach(function (p) {
      safe(function () { bsRows(p).forEach(function (row) { var s = bsState(p, row); if (["paid", "handed", "inv"].indexOf(s.k) >= 0) return;
        var k = !row.plan ? "nd" : row.plan < T ? "over" : ym(row.plan); bill[k] = (bill[k] || 0) + bsAmt(p, row); }); });
      if (isAmc(p) && num(p.amcFee)) {
        var fee = num(p.amcFee) * (1 + num(p.amcTaxPct) / 100), per = 0;
        M.forEach(function (m) { if ((!p.amcStart || ym(p.amcStart) <= m) && (!p.amcEnd || ym(p.amcEnd) >= m)) { amc[m] = (amc[m] || 0) + fee; per++; } });
        if (per) amcRows.push({ p: p, fee: fee, end: p.amcEnd });
      }
    });
    mine("receivables").forEach(function (r) { var o = safe(function () { return outAR(r); }, 0); if (o < 1) return;
      var k = !r.dueDate ? "nd" : r.dueDate < T ? "over" : ym(r.dueDate); coll[k] = (coll[k] || 0) + o; });
    var arOut = Object.keys(coll).reduce(function (s, k) { return s + coll[k]; }, 0);
    var apDue = mine("payables").reduce(function (s, r) { var o = safe(function () { return outAP(r); }, 0); return s + (r.dueDate && r.dueDate <= d30 ? o : 0); }, 0);
    var amcMonth = amc[m0] || 0;

    // Sales and collections by location (project's site province); invoices without a project go to "No project"
    var loc = {};
    var L = function (k) { return loc[k] = loc[k] || { cv: 0, n: 0, billed: 0, recd: 0, out: 0, amc: 0 }; };
    var pById = {}; mine("projects").forEach(function (p) { pById[p.id] = p; });
    mine("projects").forEach(function (p) { var r = L(place(p)); r.n++; r.cv += num(p.contractValue); if (isAmc(p) && num(p.amcFee) && p.status !== "Closed") r.amc += num(p.amcFee) * (1 + num(p.amcTaxPct) / 100); });
    mine("receivables").forEach(function (r) {
      var p = pById[r.projectId] || mine("projects").find(function (q) { return q.entity === r.entity && (q.code && r.project === q.code || q.name && r.customer === q.name); });
      var x = L(p ? place(p) : "No project");
      x.billed += num(r.amount) - num(r.outputTax);
      x.recd += safe(function () { return num(r.amount) - num(r.retention) - num(r.advAdjust) - outAR(r); }, 0);
      x.out += safe(function () { return outAR(r); }, 0);
    });
    var locs = Object.keys(loc).sort(function (a, b) { return (loc[b].cv + loc[b].billed) - (loc[a].cv + loc[a].billed); });
    var maxLoc = Math.max.apply(null, locs.map(function (k) { return Math.max(loc[k].cv, loc[k].billed, loc[k].recd); }).concat([1]));

    var h = '<div class="fsm">';
    h += '<div class="fsm-head"><div><p class="muted">' + esc(who) + ' · as of ' + esc(fd(T)) + ' · read only, from the records in the ERP</p></div>'
      + '<button type="button" class="btn" id="fsmPrint">Print</button></div>';

    // KPI tiles
    h += '<div class="fsm-kpis">'
      + '<button type="button" class="fsm-kpi click' + (open.bank ? " on" : "") + '" data-fsm="bank"><span>Available balance</span><b>' + big(cash) + '</b><i>' + BK.length + ' bank account' + (BK.length === 1 ? "" : "s") + ' · click for each bank ▾</i></button>'
      + '<button type="button" class="fsm-kpi click' + (open.lim ? " on" : "") + '" data-fsm="lim"><span>LC / guarantee limits free</span><b>' + big(lim.avail) + '</b><i>of ' + big(lim.limit) + ' sanctioned · click for each bank ▾</i></button>'
      + '<a class="fsm-kpi" href="#e_lc/bgs"><span>Guarantees outstanding</span><b>' + big(bgAmt) + '</b><i>' + bgIss.length + ' issued' + (bgSoon.length ? ' · <em class="bad">' + bgSoon.length + ' expire in 30 days</em>' : "") + (bgReq.length ? ' · ' + bgReq.length + ' requested' : "") + '</i></a>'
      + '<a class="fsm-kpi" href="#e_lc/fatr"><span>FATR outstanding</span><b>' + big(fatOut) + '</b><i>' + fat.length + ' open' + (fatOver.length ? ' · <em class="bad">' + fatOver.length + ' overdue</em>' : "") + '</i></a>'
      + '<a class="fsm-kpi" href="#e_ar/receivables"><span>Receivables to collect</span><b>' + big(arOut) + '</b><i>' + (coll.over ? '<em class="bad">' + big(coll.over) + ' overdue</em>' : 'nothing overdue') + '</i></a>'
      + '<a class="fsm-kpi" href="#proj"><span>Maintenance income this month</span><b>' + big(amcMonth) + '</b><i>' + amcRows.length + ' active AMC' + (amcRows.length === 1 ? "" : "s") + '</i></a>'
      + '<a class="fsm-kpi" href="#e_ap/payables"><span>Payables due in 30 days</span><b>' + big(apDue) + '</b><i>incl. overdue</i></a>'
      + '</div>';

    if (open.bank) {
      h += '<div class="card fsm-drop"><h3>Bank balances <small>statement balance from the latest bank reconciliation; the register balance where no reconciliation is saved yet</small></h3>'
        + (BK.length ? '<div class="tw"><table><thead><tr><th>Bank</th><th>Account</th><th>Company</th><th>Type</th><th>Balance from</th><th>As of</th><th class="num">Statement balance</th><th class="num">Books balance</th><th class="num">Under lien</th><th class="num">Available</th></tr></thead><tbody>'
          + BK.map(function (x) { return '<tr><td><b>' + esc(x.b.bank) + '</b></td><td class="mono">' + esc(x.b.account || "") + '</td><td>' + esc(x.b.entity || "") + '</td><td>' + esc(x.b.type || "") + '</td><td>' + esc(x.from) + (x.rec && Math.abs(num(x.rec.diff)) >= 1 ? ' <em class="bad">diff ' + money(x.rec.diff) + '</em>' : "") + '</td><td>' + esc(fd(x.asOf)) + '</td><td class="num">' + money(x.stmt) + '</td><td class="num">' + (x.book === null ? "–" : money(x.book)) + '</td><td class="num">' + money(x.b.lien) + '</td><td class="num"><b>' + money(x.avail) + '</b></td></tr>'; }).join("")
          + '</tbody><tfoot><tr><th colspan="9">Total available</th><th class="num">' + money(cash) + '</th></tr></tfoot></table></div>'
          : '<p class="muted">No bank accounts yet. Add them under Cash management › Bank accounts & facilities.</p>')
        + '<p class="note">Available = statement balance less amounts under lien; for running finance, the unused limit. Reconcile each bank under Cash management to keep this current.</p></div>';
    }
    if (open.lim) {
      h += '<div class="card fsm-drop"><h3>LC and guarantee limits</h3>'
        + (LM.length ? '<div class="tw"><table><thead><tr><th>Bank</th><th>Company</th><th>Used for</th><th>Expiry</th><th class="num">Sanctioned</th><th class="num">LCs opened</th><th class="num">Guarantees issued</th><th class="num">Planned / requested</th><th class="num">Free</th><th class="num">Used</th></tr></thead><tbody>'
          + LM.map(function (x) { var u = x.u, pc = u.util === null ? "–" : Math.round(u.util * 100) + "%";
            return '<tr><td><b>' + esc(x.b.bank) + '</b></td><td>' + esc(x.b.entity || "") + '</td><td>' + esc(x.b.limFor || "LC and guarantees") + '</td><td>' + esc(fd(x.b.expiry)) + '</td><td class="num">' + money(x.b.limit) + '</td><td class="num">' + money(u.lc) + '</td><td class="num">' + money(u.bg) + '</td><td class="num">' + money(u.plan) + '</td><td class="num ' + (u.avail < 0 ? "neg" : "") + '"><b>' + money(u.avail) + '</b></td><td class="num"><span class="fsm-meter"><span style="width:' + Math.min(100, Math.max(0, (u.util || 0) * 100)) + '%" class="' + ((u.util || 0) > .9 ? "hot" : "") + '"></span></span> ' + pc + '</td></tr>'; }).join("")
          + '</tbody><tfoot><tr><th colspan="4">Total</th><th class="num">' + money(lim.limit) + '</th><th class="num">' + money(lim.lc) + '</th><th class="num">' + money(lim.bg) + '</th><th class="num">' + money(lim.plan) + '</th><th class="num">' + money(lim.avail) + '</th><th></th></tr></tfoot></table></div>'
          : '<p class="muted">No LC / LG limits yet. Add them under Cash management › Bank accounts & facilities with type "LC / LG limit".</p>') + '</div>';
    }

    // Month-wise outlook
    var cols = ["over"].concat(M).concat(["nd"]);
    var head = function (k) { return k === "over" ? "Overdue" : k === "nd" ? "No date" : monthName(k); };
    var rowOf = function (label, map, cls, link) { var tot = 0; var tds = cols.map(function (k) { tot += num(map[k]); return '<td class="num' + (k === "over" && num(map[k]) ? " neg" : "") + '">' + (num(map[k]) ? big(map[k]) : '<span class="muted">–</span>') + '</td>'; }).join("");
      return '<tr class="' + (cls || "") + '"><th>' + (link ? '<a href="' + link + '">' + esc(label) + '</a>' : esc(label)) + '</th>' + tds + '<td class="num"><b>' + big(tot) + '</b></td></tr>'; };
    var inflow = {}; cols.forEach(function (k) { inflow[k] = num(coll[k]) + num(bill[k]) + num(amc[k]); });
    var outflow = {}; cols.forEach(function (k) { outflow[k] = num(fatM[k]) + num(lcM[k]); });
    h += '<div class="card"><h3>Month by month <small>next 12 months; amounts in PKR (m = million)</small></h3><div class="tw fsm-mw"><table><thead><tr><th></th>'
      + cols.map(function (k) { return '<th class="num">' + head(k) + '</th>'; }).join("") + '<th class="num">Total</th></tr></thead><tbody>'
      + '<tr class="fsm-sec"><th colspan="' + (cols.length + 2) + '">Money coming in</th></tr>'
      + rowOf("Invoices raised, to collect (by due date)", coll, "", "#r_party/araging")
      + rowOf("Project milestones still to invoice (by planned date)", bill, "", "#e_ar/bsched")
      + rowOf("Maintenance (AMC) fees incl. tax", amc, "", "#proj")
      + rowOf("Expected receipts", inflow, "fsm-tot")
      + '<tr class="fsm-sec"><th colspan="' + (cols.length + 2) + '">Trade finance going out</th></tr>'
      + rowOf("LC retirements (LC balance after margin)", lcM, "", "#r_cash/lccal")
      + rowOf("FATR repayments incl. mark-up to due date", fatM, "", "#e_lc/fatr")
      + rowOf("Trade finance outflow", outflow, "fsm-tot")
      + '</tbody></table></div><p class="note">Milestones with "No date" wait for a project step (for example delivery) before they can be invoiced. Set planned dates under Receivables › Billing schedule to place them in a month.</p></div>';

    // Location-wise
    h += '<div class="card"><h3>Sales and collections by location <small>by the project\'s site province; invoices not linked to a project show as "No project"</small></h3>'
      + (locs.length ? '<div class="tw"><table><thead><tr><th>Location</th><th class="num">Projects</th><th class="num">Contract value (total sale)</th><th class="num">Invoiced (excl. tax)</th><th class="num">Collected</th><th class="num">Still to collect</th><th class="num">AMC per month</th><th style="width:28%"></th></tr></thead><tbody>'
        + locs.map(function (k) { var r = loc[k], w = function (v) { return Math.max(0, Math.round(v / maxLoc * 100)); };
          return '<tr><td><b>' + esc(k) + '</b></td><td class="num">' + (r.n || "–") + '</td><td class="num">' + money(r.cv) + '</td><td class="num">' + money(r.billed) + '</td><td class="num">' + money(r.recd) + '</td><td class="num">' + money(r.out) + '</td><td class="num">' + money(r.amc) + '</td>'
            + '<td><div class="fsm-bars"><span class="cv" style="width:' + w(r.cv) + '%" title="Contract value"></span><span class="bi" style="width:' + w(r.billed) + '%" title="Invoiced"></span><span class="rc" style="width:' + w(r.recd) + '%" title="Collected"></span></div></td></tr>'; }).join("")
        + '</tbody><tfoot><tr><th>Total</th>' + ["n", "cv", "billed", "recd", "out", "amc"].map(function (f) { return '<th class="num">' + (f === "n" ? locs.reduce(function (s, k) { return s + loc[k].n; }, 0) : money(locs.reduce(function (s, k) { return s + loc[k][f]; }, 0))) + '</th>'; }).join("") + '<th><span class="fsm-key"><i class="cv"></i>Contract <i class="bi"></i>Invoiced <i class="rc"></i>Collected</span></th></tr></tfoot></table></div>'
        + (loc["Location not set"] ? '<p class="note">Some projects have no site province. Open the project and set "Site province" to place it.</p>' : "")
        : '<p class="muted">No projects or invoices yet.</p>') + '</div>';

    // Guarantees by type + expiring, AMC list
    h += '<div class="fsm-two"><div class="card"><h3>Guarantees outstanding by type</h3>'
      + (Object.keys(byType).length ? '<div class="tw"><table><thead><tr><th>Type</th><th class="num">No.</th><th class="num">Amount</th><th class="num">Margin held</th></tr></thead><tbody>'
        + Object.keys(byType).sort(function (a, b) { return byType[b].a - byType[a].a; }).map(function (k) { return '<tr><td>' + esc(k) + '</td><td class="num">' + byType[k].n + '</td><td class="num">' + money(byType[k].a) + '</td><td class="num">' + money(byType[k].m) + '</td></tr>'; }).join("")
        + '</tbody><tfoot><tr><th>Total</th><th class="num">' + bgIss.length + '</th><th class="num">' + money(bgAmt) + '</th><th class="num">' + money(bgIss.reduce(function (s, r) { return s + r.x.margin; }, 0)) + '</th></tr></tfoot></table></div>' : '<p class="muted">No guarantees issued.</p>')
      + (bgSoon.length ? '<h4>Expiring in 30 days</h4><div class="tw"><table><tbody>' + bgSoon.sort(function (a, b) { return String(a.g.expiry).localeCompare(String(b.g.expiry)); }).map(function (r) { return '<tr><td class="mono">' + esc(r.g.ref || r.g.bgNo || "") + '</td><td>' + esc(r.g.beneficiary || "") + '</td><td>' + esc(r.g.bank || "") + '</td><td>' + esc(fd(r.g.expiry)) + '</td><td class="num">' + money(r.x.pkr) + '</td></tr>'; }).join("") + '</tbody></table></div>' : "")
      + '</div><div class="card"><h3>Maintenance contracts (AMC) <small>fee per month incl. tax</small></h3>'
      + (amcRows.length ? '<div class="tw"><table><thead><tr><th>Project</th><th>Location</th><th>Renewal</th><th class="num">Per month</th></tr></thead><tbody>'
        + amcRows.sort(function (a, b) { return b.fee - a.fee; }).map(function (r) { return '<tr><td>' + esc((r.p.code ? r.p.code + " " : "") + r.p.name) + '</td><td>' + esc(place(r.p)) + '</td><td>' + esc(fd(r.end)) + (r.end && r.end <= d30 ? ' <em class="bad">due</em>' : "") + '</td><td class="num">' + money(r.fee) + '</td></tr>'; }).join("")
        + '</tbody><tfoot><tr><th colspan="3">Total per month</th><th class="num">' + money(amcRows.reduce(function (s, r) { return s + r.fee; }, 0)) + '</th></tr></tfoot></table></div>'
        : '<p class="muted">No active maintenance contracts with a monthly fee. Set Type "Maintenance contract (AMC)" and the AMC fee on the project.</p>')
      + '</div></div>';
    return h + '</div>';
  }

  addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-fsm], #fsmPrint");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.id === "fsmPrint") { window.print(); return; }
    var k = b.getAttribute("data-fsm"); open[k] = !open[k];
    if (typeof render === "function") render();
  }, true);

  function hook() {
    if (typeof MODS === "undefined" || typeof NAV === "undefined" || typeof special !== "function" || typeof Store === "undefined") return false;
    if (!MODS.mgmt) {
      MODS.mgmt = { sub: "Bank balances, limits, guarantees, FATR, project billing, maintenance income and sales by location", tabs: [["mgmt", "Management dashboard"]] };
      var home = NAV.find(function (g) { return g[0] === "Home"; });
      if (home && !home[1].some(function (i) { return i[0] === "mgmt"; })) home[1].push(["mgmt", "Management dashboard"]);
      try { TITLE.mgmt = "Management dashboard"; TAB_HOME.mgmt = "mgmt"; } catch (x) { /* older app */ }
      var old = special; // eslint-disable-line no-undef
      special = function (tab) { return tab === "mgmt" ? safe(view, '<div class="panel empty"><b>Could not build the dashboard</b>Reload the page.</div>') : old(tab); }; // eslint-disable-line no-global-assign
    }
    if (typeof render === "function") render();
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fsm-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.fsm-head h2{margin:0}.fsm-head p{margin:2px 0 0}"
    + ".fsm-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-bottom:14px}"
    + ".fsm-kpi{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:3px;padding:14px 16px;border:1px solid var(--line,#e2e8f0);border-left:4px solid var(--accent,#1F6FB8);border-radius:10px;background:var(--panel,#fff);cursor:pointer;transition:transform .15s,box-shadow .15s}"
    + ".fsm-kpi:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(15,23,42,.1)}.fsm-kpi.on{border-color:var(--accent,#1F6FB8);box-shadow:0 0 0 2px rgba(31,111,184,.18)}"
    + ".fsm-kpi span{font-size:12.5px;color:var(--muted,#64748b);font-weight:600;text-transform:uppercase;letter-spacing:.03em}.fsm-kpi b{font-size:26px;line-height:1.15;color:var(--ink,#0f172a)}.fsm-kpi i{font-style:normal;font-size:12.5px;color:var(--muted,#64748b)}"
    + ".fsm em.bad{font-style:normal;color:#b91c1c;font-weight:600}.fsm-drop{animation:fsmIn .25s ease}@keyframes fsmIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}"
    + ".fsm-meter{display:inline-block;width:70px;height:7px;border-radius:4px;background:#e2e8f0;vertical-align:middle;overflow:hidden}.fsm-meter span{display:block;height:100%;background:#16a34a}.fsm-meter span.hot{background:#dc2626}"
    + ".fsm-mw th:first-child{min-width:260px;text-align:left}.fsm-mw td,.fsm-mw th{white-space:nowrap}.fsm-sec th{background:var(--soft,#f1f5f9);text-transform:uppercase;font-size:11.5px;letter-spacing:.04em}.fsm-tot th,.fsm-tot td{font-weight:700;border-top:2px solid var(--line,#cbd5e1)}"
    + ".fsm-bars{display:flex;flex-direction:column;gap:2px}.fsm-bars span{height:6px;border-radius:3px;min-width:1px}.cv{background:#1F6FB8}.bi{background:#f59e0b}.rc{background:#16a34a}"
    + ".fsm-key{font-weight:400;font-size:12px;color:var(--muted,#64748b)}.fsm-key i{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 8px;vertical-align:-1px}"
    + ".fsm-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:1000px){.fsm-two{grid-template-columns:1fr}}.fsm .card{margin-bottom:14px}"
    + "@media print{.fsm-head .btn{display:none}.fsm-kpi{break-inside:avoid}}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
