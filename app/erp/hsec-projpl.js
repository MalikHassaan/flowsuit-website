// Project P&L: a tab under Project financial management that puts each project's sales, direct cost, overheads
// and finance cost coded to it side by side, down to net profit. Read only; it adds nothing to the books.
// Also hides the hand-typed "to date" boxes on a new project, since vouchers and invoices already give those.
(function () {
  /* global MODS, TAB_HOME, V, Store, FSLK, byEnt, projRow, esc, fmt, acct, n, render */
  var GROUPS = [["rev", "Sales (revenue)"], ["cor", "Direct cost"], ["adm", "Overheads"], ["fc", "Finance cost"], ["oi", "Other income"]];
  var pick = "", last = [];

  // Which part of the P&L an account belongs to: its statement line, or its code when it has none.
  function lineOf(a) {
    var k = a.fsLine;
    if (!k || !FSLK[k] || FSLK[k].s !== "PL") k = ({ 4: "rev", 5: "cor", 6: "adm", 8: "fc" })[String(a.code).charAt(0)] || "";
    return k === "tax" ? "" : k;
  }
  function group(k) { return k === "sell" || k === "ecl" || k === "oe" ? "adm" : k; }

  // Totals per project and per account from posted vouchers. A line counts for a project when the line
  // or its voucher carries the project, as in HSEC's own project costing.
  function ledger() {
    var acc = {}, out = {};
    Store.data.accounts.forEach(function (a) { acc[a.id] = a; });
    Store.data.journals.forEach(function (j) {
      if (j.status !== "Posted") return;
      (j.lines || []).forEach(function (l) {
        var p = l.project || l.costCentre || j.costCentre, a = acc[l.account];
        if (!p || !a) return;
        var k = lineOf(a);
        if (!k) return;
        var v = k === "rev" || k === "oi" ? n(l.credit) - n(l.debit) : n(l.debit) - n(l.credit);
        var P = out[p] = out[p] || { rev: 0, cor: 0, adm: 0, fc: 0, oi: 0, acc: {} };
        P[group(k)] += v;
        var r = P.acc[a.id] = P.acc[a.id] || { a: a, g: group(k), v: 0 };
        r.v += v;
      });
    });
    return out;
  }

  function figures(p, L) {
    var g = L[p.id] || { rev: 0, cor: 0, adm: 0, fc: 0, oi: 0, acc: {} }, x = null;
    try { x = projRow(p); } catch (e) {}
    // Fall back to invoices for sales, and to the typed figure for cost, only when no voucher is coded.
    var revFrom = g.rev ? "ledger" : x && x.billed ? "invoices" : "";
    var rev = g.rev || (x ? x.billed : 0);
    var cor = g.cor || n(p.costToDate);
    var gp = rev - cor, net = gp - g.adm - g.fc + g.oi;
    return { p: p, g: g, rev: rev, revFrom: revFrom, cor: cor, corTyped: !g.cor && !!n(p.costToDate), gp: gp, net: net,
      cv: n(p.contractValue), bc: n(p.budgetCost), pct: x ? x.pct : 0 };
  }
  function note(xs) { xs = xs.filter(Boolean); return xs.length ? '<p class="note">' + esc(xs.join(" ")) + '</p>' : ""; }
  function pc(a, b) { return b ? (a / b * 100).toFixed(1) + "%" : "–"; }
  function cls(v) { return v < 0 ? "num neg" : "num"; }

  function view() {
    var L = ledger(), rows = byEnt(Store.data.projects || []).map(function (p) { return figures(p, L); })
      .sort(function (a, b) { return b.cv - a.cv; });
    last = rows;
    if (!rows.length) return '<div class="panel empty"><b>No projects</b>Add a project with its contract value and budgeted cost first.</div>';
    var T = { cv: 0, rev: 0, cor: 0, gp: 0, adm: 0, fc: 0, oi: 0, net: 0 };
    rows.forEach(function (r) { T.cv += r.cv; T.rev += r.rev; T.cor += r.cor; T.gp += r.gp; T.adm += r.g.adm; T.fc += r.g.fc; T.oi += r.g.oi; T.net += r.net; });
    if (!rows.some(function (r) { return r.p.id === pick; })) pick = rows[0].p.id;
    var body = rows.map(function (r) {
      return '<tr data-ppl="' + esc(r.p.id) + '" style="cursor:pointer"><td>' + esc(r.p.name) + ' <span class="muted">' + esc(r.p.code || "") + '</span></td>'
        + '<td class="num">' + fmt(r.cv) + '</td><td class="num">' + fmt(r.rev) + (r.revFrom === "invoices" ? ' <span class="muted" title="From customer invoices; no revenue voucher is coded to this project">*</span>' : '') + '</td>'
        + '<td class="num">' + fmt(r.cor) + (r.corTyped ? ' <span class="muted" title="Typed on the project; no cost voucher is coded to it">†</span>' : '') + '</td>'
        + '<td class="' + cls(r.gp) + '">' + acct(r.gp) + '</td><td class="num">' + pc(r.gp, r.rev) + '</td>'
        + '<td class="num">' + acct(r.g.adm) + '</td><td class="num">' + acct(r.g.fc) + '</td><td class="num">' + acct(r.g.oi) + '</td>'
        + '<td class="' + cls(r.net) + '"><b>' + acct(r.net) + '</b></td><td class="' + cls(r.net) + '">' + pc(r.net, r.rev) + '</td>'
        + '<td class="num">' + pc(r.cor, r.bc) + '</td></tr>';
    }).join("");
    var un = 0;
    Store.data.journals.forEach(function (j) {
      if (j.status !== "Posted" || (V.ent !== "All" && j.entity !== V.ent)) return;
      (j.lines || []).forEach(function (l) {
        if (l.project || l.costCentre || j.costCentre) return;
        var a = Store.data.accounts.find(function (x) { return x.id === l.account; });
        if (a && group(lineOf(a)) === "adm") un += n(l.debit) - n(l.credit);
      });
    });
    return '<p class="muted">Profit of each project from its first voucher to today: sales less direct cost, overheads and finance cost coded to the project. Code a cost to a project by picking it in the voucher\'s Cost centre (project). Click a project to see it account by account.</p>'
      + '<div class="panel tw"><table><thead><tr><th>Project</th><th class="num">Contract value</th><th class="num">Sales</th><th class="num">Direct cost</th><th class="num">Gross profit</th><th class="num">GP %</th><th class="num">Overheads</th><th class="num">Finance cost</th><th class="num">Other income</th><th class="num">Net profit</th><th class="num">Net %</th><th class="num">Budget used</th></tr></thead><tbody>'
      + body + '<tr><td><b>Total</b></td><td class="num"><b>' + fmt(T.cv) + '</b></td><td class="num"><b>' + fmt(T.rev) + '</b></td><td class="num"><b>' + fmt(T.cor) + '</b></td><td class="' + cls(T.gp) + '"><b>' + acct(T.gp) + '</b></td><td class="num">' + pc(T.gp, T.rev) + '</td><td class="num"><b>' + acct(T.adm) + '</b></td><td class="num"><b>' + acct(T.fc) + '</b></td><td class="num"><b>' + acct(T.oi) + '</b></td><td class="' + cls(T.net) + '"><b>' + acct(T.net) + '</b></td><td class="num">' + pc(T.net, T.rev) + '</td><td></td></tr></tbody></table></div>'
      + note([rows.some(function (r) { return r.revFrom === "invoices"; }) ? "* Sales taken from customer invoices because no revenue voucher is coded to the project." : "",
        rows.some(function (r) { return r.corTyped; }) ? "† Cost typed on the project because no cost voucher is coded to it." : "",
        un ? "Overheads of " + fmt(un) + " are not coded to any project, so they appear in the company P&L but in no project here." : ""])
      + '<div id="fsPplDetail" style="margin-top:14px">' + detail(rows.find(function (r) { return r.p.id === pick; })) + '</div>';
  }

  // One project as a short statement, account by account, with the budget beside it.
  function detail(r) {
    var accs = Object.keys(r.g.acc).map(function (k) { return r.g.acc[k]; }).filter(function (x) { return Math.round(x.v); });
    function sec(g, label) {
      var ls = accs.filter(function (x) { return x.g === g; }).sort(function (a, b) { return String(a.a.code).localeCompare(String(b.a.code)); });
      return ls.map(function (x) { return '<tr><td class="ind">' + esc(x.a.code + " " + x.a.name) + '</td><td class="num">' + acct(x.v) + '</td><td></td></tr>'; }).join("")
        + '<tr class="sub"><td>' + label + '</td><td class="num">' + acct(g === "rev" ? r.rev : g === "cor" ? r.cor : r.g[g]) + '</td><td class="num">' + (g === "rev" ? fmt(r.cv) : g === "cor" ? fmt(r.bc) : "") + '</td></tr>';
    }
    return '<div class="card"><h3>' + esc(r.p.name) + ' <small>' + esc((r.p.code || "") + (r.p.customer ? " · " + r.p.customer : "") + " · " + Math.round(r.pct * 100) + "% complete") + '</small></h3><div class="tw"><table>'
      + '<thead><tr><th></th><th class="num">Actual to date</th><th class="num">Contract / budget</th></tr></thead><tbody>'
      + sec("rev", "Sales") + sec("cor", "Direct cost")
      + '<tr class="sub"><td><b>Gross profit</b></td><td class="' + cls(r.gp) + '"><b>' + acct(r.gp) + '</b></td><td class="num">' + acct(r.cv - r.bc) + '</td></tr>'
      + sec("adm", "Overheads") + sec("fc", "Finance cost") + sec("oi", "Other income")
      + '<tr class="tot"><td><b>Net profit / (loss)</b></td><td class="' + cls(r.net) + '"><b>' + acct(r.net) + '</b></td><td></td></tr>'
      + '</tbody></table></div><p class="note">Contract / budget shows the contract value and budgeted total cost entered on the project. Income tax is worked out for the company as a whole, so it is not split by project.</p></div>';
  }

  document.addEventListener("click", function (e) {
    var tr = e.target.closest && e.target.closest("tr[data-ppl]");
    if (!tr) return;
    pick = tr.getAttribute("data-ppl");
    var box = document.getElementById("fsPplDetail");
    var r = last.find(function (x) { return x.p.id === pick; });
    if (box && r) { box.innerHTML = detail(r); box.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });

  // New project: the hand-typed "to date" boxes go, since vouchers and invoices fill those in. A project
  // that already has a typed figure keeps its box so the number can still be seen and cleared.
  function trimForm() {
    var rec = null;
    try { rec = typeof F !== "undefined" && F && F.c === "projects" ? F.rec : null; } catch (x) {} // eslint-disable-line no-undef
    if (!rec) return;
    ["costToDate", "billed", "received"].forEach(function (k) {
      var el = document.getElementById("f_" + k), box = el && el.closest(".f");
      if (box && !n(rec[k]) && !box.hidden) box.hidden = true;
    });
  }

  function hook() {
    if (typeof MODS === "undefined" || !MODS.proj || typeof special !== "function") return false; // eslint-disable-line no-undef
    if (!MODS.proj.tabs.some(function (t) { return t[0] === "projpl"; })) MODS.proj.tabs.push(["projpl", "Project P&L"]);
    TAB_HOME.projpl = "proj";
    var old = special; // eslint-disable-line no-undef
    special = function (tab) { return tab === "projpl" ? view() : old(tab); }; // eslint-disable-line no-global-assign, no-undef
    new MutationObserver(trimForm).observe(document.body, { childList: true, subtree: true });
    if (/projpl/.test(location.hash) && typeof render === "function") render();
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
