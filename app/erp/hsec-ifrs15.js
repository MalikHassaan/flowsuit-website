// Period-end › Revenue recognition (IFRS 15), automatic (hassan, 2026-10-29: "no i dont want to post adjustment manually").
// Contract revenue is earned as the work is done, not as it is billed. For each running project (not AMC, not Tendering)
// with a contract value and a budget, at each month end:
//   % complete = physical % (engineer's estimate) if entered, else cost to date ÷ budgeted cost (5xxxx accounts, posted)
//   earned     = contract value × % complete
//   in books   = revenue already posted to the project on 41xxxx accounts (invoices), up to the month end
//   adjustment = earned − in books
// Earned more than billed: Dr Unbilled revenue (120201, or 120202 for modernisation) / Cr revenue.
// Billed more than earned: Dr revenue / Cr Billings in excess of revenue recognised (220603).
// One voucher per company per month, dated the month end, with its reversal on the 1st of the next month, so the next
// month starts again from the invoices. Earlier IFRS 15 vouchers are left out of "in books" for that reason.
// The system makes last month's voucher by itself from the 5th of the month (costs for the month are in by then), when
// someone with edit access has the books open. The vouchers follow the normal approval setting (autoMode).
(function () {
  /* global MODS, TAB_HOME, special, render, Store, V, ENTS, monthB, iso, addDays, dt, TODAY, todayStr, fdate, fmt, acct, n, esc, pill, mono, toast,
     idc, autoMode, isLocked, lockTxt, nextVoucherNo, jvTot, armed, armOn, ymLabel, coName, recCanRun, $ */
  var SRC = "ifrs15", RUN = { busy: false, last: 0 };
  var acc = function (id) { return Store.data.accounts.find(function (a) { return a.id === id; }) || {}; };
  var prevMonth = function () { var t = TODAY; return iso(new Date(t.getFullYear(), t.getMonth(), 0)).slice(0, 7); };
  var vid = function (ent, ym, rev) { return (rev ? "ifrs15r-" : "ifrs15-") + ent + "-" + ym; };
  var mine = function (ent, ym) { return Store.data.journals.filter(function (j) { return j.source && j.source.c === SRC && j.source.id === ent + "_" + ym; }); };

  function ledger(pid, end) {
    var cost = 0, rev = 0;
    Store.data.journals.forEach(function (j) {
      if (j.status !== "Posted" || !j.date || j.date > end || (j.source && j.source.c === SRC)) return;
      (j.lines || []).forEach(function (l) {
        if ((l.project || l.costCentre || j.costCentre) !== pid) return;
        var c = String(acc(l.account).code || "");
        if (/^5/.test(c)) cost += n(l.debit) - n(l.credit);
        if (/^41/.test(c)) rev += n(l.credit) - n(l.debit);
      });
    });
    return { cost: cost, rev: rev };
  }
  function revAcc(p) {
    var cnt = {};
    Store.data.receivables.forEach(function (r) { if (r.projectId === p.id && r.revAccount) cnt[r.revAccount] = (cnt[r.revAccount] || 0) + 1; });
    var best = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
    return best || idc(p.type === "Modernisation" ? "410103" : p.type === "Supply only" ? "410302" : "410101");
  }
  function rows(ent, ym) {
    var end = iso(monthB(ym).e);
    return Store.data.projects.filter(function (p) {
      return p.entity === ent && !p.sample && p.type !== "Maintenance contract (AMC)" && p.status !== "Tendering" && n(p.contractValue) > 0 && n(p.budgetCost) > 0 && (!p.start || p.start <= end);
    }).map(function (p) {
      var g = ledger(p.id, end), cv = n(p.contractValue), bc = n(p.budgetCost), phys = n(p.physPct) > 0;
      var pct = phys ? Math.min(1, n(p.physPct) / 100) : Math.max(0, Math.min(1, g.cost / bc)), earned = Math.round(cv * pct), adj = Math.round(earned - g.rev);
      return { p: p, cv: cv, bc: bc, cost: g.cost, pct: pct, phys: phys, earned: earned, rev: g.rev, adj: Math.abs(adj) < 1 ? 0 : adj };
    });
  }
  function lines(R) {
    var out = [];
    R.forEach(function (x) {
      if (!x.adj) return;
      var ra = revAcc(x.p), tag = { project: x.p.id, ref: x.p.code || "" }, a = Math.abs(x.adj);
      if (x.adj > 0) {
        out.push(Object.assign({ account: idc(x.p.type === "Modernisation" ? "120202" : "120201"), debit: a, credit: 0, desc: "Unbilled revenue: " + x.p.name }, tag));
        out.push(Object.assign({ account: ra, debit: 0, credit: a, desc: "Revenue earned, not yet billed: " + x.p.name }, tag));
      } else {
        out.push(Object.assign({ account: ra, debit: a, credit: 0, desc: "Revenue billed ahead of work: " + x.p.name }, tag));
        out.push(Object.assign({ account: idc("220603"), debit: 0, credit: a, desc: "Billings in excess of revenue recognised: " + x.p.name }, tag));
      }
    });
    return out;
  }
  // Makes the voucher and its reversal for one company and month. Returns {made}, {skip: why} or null when nothing is due.
  async function post(ent, ym, who) {
    if (mine(ent, ym).length) return null;
    var L = lines(rows(ent, ym));
    if (!L.length) return null;
    if (L.some(function (l) { return !l.account; })) throw new Error(coName(ent) + ": an IFRS 15 account (120201, 120202, 220603 or a 41 revenue account) is missing from the chart.");
    var me = monthB(ym).e, now = new Date().toISOString(), maker = { name: who, at: now };
    var mk = function (date, ls, rev) {
      return { id: vid(ent, ym, rev), vtype: "Journal voucher", entity: ent, date: date, dept: "Finance & Accounts", opening: "No", payee: "",
        narration: rev ? "Reversal of IFRS 15 revenue adjustment at " + fdate(iso(me)) : "IFRS 15 revenue recognition at " + fdate(iso(me)) + ": revenue matched to work done on each project",
        lines: ls, status: autoMode(), source: { c: SRC, id: ent + "_" + ym, ev: rev ? "reverse" : "recognise", key: rev ? "reverse" : "recognise" }, maker: maker, approvals: [] };
    };
    var a = mk(iso(me), L, false), b = mk(iso(addDays(me, 1)), L.map(function (l) { return Object.assign({}, l, { debit: l.credit, credit: l.debit }); }), true);
    if (isLocked(a)) return { skip: coName(ent) + " " + ymLabel(ym) + ": " + lockTxt(ent) };
    if (isLocked(b)) return { skip: coName(ent) + " " + ymLabel(ym) + " reversal: " + lockTxt(ent) };
    if (!jvTot(a).ok) throw new Error("The IFRS 15 voucher does not balance.");
    for (var j of [a, b]) { j.ref = nextVoucherNo(j); await Store.save("journals", j); }
    return { made: a.ref + " and reversal " + b.ref };
  }
  async function autoRun() {
    if (RUN.busy || !(window.FS_BRIDGE && FS_BRIDGE.edit) || typeof recCanRun === "function" && !recCanRun()) return;
    if (TODAY.getDate() < 5) return;
    var ym = prevMonth(), due = ENTS().filter(function (e) { return !mine(e, ym).length; });
    if (!due.length) return;
    RUN.busy = true; var done = [];
    try { for (var e of due) { try { var r = await post(e, ym, "System – IFRS 15 month end"); if (r && r.made) done.push(r.made); } catch (x) { console.warn(x); } } }
    finally { RUN.busy = false; }
    if (done.length) { toast("IFRS 15 revenue vouchers for " + ymLabel(ym) + " created: " + done.join("; ") + ". See Period-end › Revenue recognition (IFRS 15)."); render(); }
  }

  function view() {
    var ym = V.ifM || prevMonth(), end = monthB(ym).e;
    var h = '<div class="ctls"><label for="ifM">Month end <input type="month" id="ifM" value="' + esc(ym) + '"></label><span class="muted">Revenue follows the work done, not the bills. ' +
      "The system makes last month's voucher and its reversal by itself from the 5th. Physical % complete, when entered on a project, is used instead of cost ÷ budget.</span></div>";
    if (V.ent === "All") return h + '<div class="panel empty"><b>Choose one company</b>Revenue recognition is posted per company.</div>';
    var R = rows(V.ent, ym), J = mine(V.ent, ym), tot = R.reduce(function (s, x) { return s + x.adj; }, 0);
    if (!R.length) return h + '<div class="panel empty"><b>No running projects</b>Projects with a contract value and a budgeted cost appear here. AMC and Tendering projects are left out.</div>';
    h += '<div class="tw"><table><thead><tr><th>Project</th><th class="num">Contract value</th><th class="num">Budgeted cost</th><th class="num">Cost to ' + esc(fdate(iso(end))) + '</th><th class="num">% complete</th><th class="num">Revenue earned</th><th class="num">Revenue in books</th><th class="num">Adjustment</th><th>Posted to</th></tr></thead><tbody>' +
      R.map(function (x) {
        return "<tr><td>" + mono(x.p.code || "") + " " + esc(x.p.name) + '</td><td class="num">' + fmt(x.cv) + '</td><td class="num">' + fmt(x.bc) + '</td><td class="num">' + fmt(x.cost) + '</td><td class="num">' + (x.pct * 100).toFixed(1) + "%" + (x.phys ? ' <span class="muted">(physical)</span>' : "") +
          '</td><td class="num">' + fmt(x.earned) + '</td><td class="num">' + fmt(x.rev) + '</td><td class="num">' + acct(x.adj) + "</td><td>" + (x.adj > 0 ? "Unbilled revenue" : x.adj < 0 ? "Billings in excess" : '<span class="muted">Nothing</span>') + "</td></tr>";
      }).join("") + '<tr><td colspan="7"><b>Net adjustment to revenue</b></td><td class="num"><b>' + acct(tot) + "</b></td><td></td></tr></tbody></table></div>";
    h += '<div class="actions">' + (J.length ? "Vouchers: " + J.map(function (j) { return '<a href="#e_jv/journals" data-open="' + esc(j.id) + '">' + esc(j.ref) + "</a> " + pill(j.status); }).join(", ") +
      (J.every(function (j) { return j.status === "Rejected"; }) ? ' <span class="muted">Both were rejected; delete them to make new ones.</span>' : "")
      : R.some(function (x) { return x.adj; }) ? '<button class="btn pri" id="ifPost">' + (armOn("ifPost") ? "Click again to create the voucher and its reversal" : "Create now") + '</button><span class="muted">Or leave it: the system makes it by itself from the 5th of next month.</span>'
      : '<span class="muted">Revenue in books already matches the work done. Nothing to post.</span>') + '</div><p class="err" id="docErr"></p>';
    return h;
  }

  function hook() {
    if (typeof special !== "function" || typeof MODS === "undefined" || !MODS.e_close || typeof recCanRun !== "function") return false;
    MODS.e_close.tabs.push(["ifrs15", "Revenue recognition (IFRS 15)"]); TAB_HOME.ifrs15 = "e_close";
    var old = special;
    special = function (tab) { return tab === "ifrs15" ? view() : old(tab); }; // eslint-disable-line no-global-assign
    var oldR = render;
    render = function () { // eslint-disable-line no-global-assign
      var out = oldR.apply(this, arguments);
      if (!RUN.busy && Date.now() - RUN.last > 600000 && Store.ready) { RUN.last = Date.now(); setTimeout(autoRun, 1500); }
      return out;
    };
    document.addEventListener("change", function (e) { if (e.target.id === "ifM") { V.ifM = e.target.value; render(); } });
    document.addEventListener("click", async function (e) {
      if (!(e.target.closest && e.target.closest("#ifPost")) || !armed("ifPost")) return;
      try { var r = await post(V.ent, V.ifM || prevMonth(), (typeof approverName === "function" && approverName()) || "Accounts"); toast(r && r.made ? r.made + " created." : r && r.skip ? r.skip : "Nothing to post."); render(); }
      catch (x) { var d = $("#docErr"); if (d) d.textContent = x.message; }
    });
    if (/ifrs15/.test(location.hash)) render();
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
