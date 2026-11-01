// Contract bookings (hassan, 2026-11-01: "once the advance is received the sale should be booked completely and later
// from that invoices be made"). When a project's first customer advance is posted, the whole contract is booked here:
// the full order value, what has been invoiced from it, and the balance still to invoice, with the next milestone's
// "Raise invoice" button. This is the order book, not the ledger: under IFRS 15 the profit and loss shows sales as
// they are invoiced (or earned), and the advance stays a liability until invoices adjust it. Every figure comes from
// records already in the ERP (projects, customer advances, invoices, billing schedule), so nothing new is saved.
(function () {
  /* global MODS, TAB_HOME, V, Store, byEnt, liveJv, jvOf, outAR, bsRows, bsState, bsAmt, bsKey, esc, fdate, coName, render, special */
  var num = function (x) { return +x || 0; };
  var money = function (x) { var v = Math.round(Math.abs(num(x))).toLocaleString("en-US"); return num(x) < -0.5 ? "(" + v + ")" : v; };
  var big = function (x) { var a = Math.abs(num(x)), s = num(x) < 0 ? "-" : "";
    return a >= 1e9 ? s + (a / 1e9).toFixed(2) + " bn" : a >= 1e6 ? s + (a / 1e6).toFixed(1) + " m" : s + Math.round(a).toLocaleString("en-US"); };
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var fd = function (d) { return d ? safe(function () { return fdate(d); }, d) : "–"; };
  var D = function (c) { return (Store.data && Store.data[c]) || []; };
  var mine = function (c) { return safe(function () { return byEnt(D(c)); }, D(c)); };
  var posted = function (j) { return !!(j && j.status === "Posted"); };
  // Pakistan financial year: 1 July to 30 June
  function fyStart() { var d = new Date(), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return y + "-07-01"; }

  function rows() {
    var adv = {}, inv = {};
    D("custadv").forEach(function (a) {
      if (!a.projectId || !posted(safe(function () { return liveJv("custadv", a.id, "receive"); }, null))) return;
      (adv[a.projectId] = adv[a.projectId] || []).push(a);
    });
    D("receivables").forEach(function (r) {
      if (!r.projectId) return;
      var j = r.jvId && safe(function () { return jvOf(r.jvId); }, null);
      if (!posted(j)) return;
      (inv[r.projectId] = inv[r.projectId] || []).push(r);
    });
    return mine("projects").filter(function (p) { return p.status !== "Cancelled"; }).map(function (p) {
      var A = (adv[p.id] || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      var I = (inv[p.id] || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      var cv = num(p.contractValue);
      var invoiced = I.reduce(function (s, r) { return s + num(r.amount) - num(r.outputTax); }, 0);
      var advIn = A.reduce(function (s, a) { return s + num(a.amount); }, 0);
      var advUsed = I.reduce(function (s, r) { return s + num(r.advAdjust); }, 0);
      var next = null;
      safe(function () { bsRows(p).some(function (row) { var s = bsState(p, row); if (["paid", "handed", "inv"].indexOf(s.k) >= 0) return false; next = { row: row, s: s, amt: bsAmt(p, row) }; return true; }); });
      var on = A.length ? A[0].date : I.length ? I[0].date : "";
      return { p: p, cv: cv, invoiced: invoiced, left: Math.max(0, cv - invoiced), advIn: advIn, advHeld: Math.max(0, advIn - advUsed),
        on: on, how: A.length ? "Advance received" : I.length ? "First invoice" : "", invN: I.length, next: next };
    });
  }

  function view() {
    if (!Store || !Store.data) return '<div class="panel empty"><b>Loading</b></div>';
    var all = rows(), booked = all.filter(function (r) { return r.on; }), waiting = all.filter(function (r) { return !r.on && r.p.status !== "Closed"; });
    booked.sort(function (a, b) { return String(b.on).localeCompare(String(a.on)); });
    var fy = fyStart(), thisFy = booked.filter(function (r) { return r.on >= fy; });
    var sum = function (L, f) { return L.reduce(function (s, r) { return s + r[f]; }, 0); };
    var who = safe(function () { return V.ent === "All" ? "HSEC Group" : coName(V.ent); }, "");
    var h = '<div class="fsbk">';
    h += '<div class="banner info">A contract is booked in full on the date its first customer advance is posted. Invoices are then raised from it milestone by milestone until the balance to invoice reaches zero. '
      + 'This is the order book: the profit and loss shows sales as they are invoiced, and the advance stays under "Advances from customers" until invoices adjust it (IFRS 15).</div>';
    h += '<div class="fsbk-kpis">'
      + kpi("Booked this financial year", big(sum(thisFy, "cv")), thisFy.length + " contract" + (thisFy.length === 1 ? "" : "s") + " since " + fd(fy))
      + kpi("Total booked (all open contracts)", big(sum(booked, "cv")), booked.length + " contract" + (booked.length === 1 ? "" : "s"))
      + kpi("Invoiced from bookings", big(sum(booked, "invoiced")), "excl. sales tax, posted invoices")
      + kpi("Balance to invoice", big(sum(booked, "left")), "order backlog")
      + kpi("Advances still held", big(sum(booked, "advHeld")), "not yet adjusted against invoices")
      + '</div>';
    h += '<div class="card"><h3>Booked contracts <small>' + esc(who) + ' · newest first</small></h3>'
      + (booked.length ? '<div class="tw"><table><thead><tr><th>Booked on</th><th>Project / customer</th><th>Company</th><th class="num">Contract value</th><th class="num">Advance received</th><th class="num">Invoiced</th><th class="num">Balance to invoice</th><th style="width:120px">Progress</th><th>Next invoice</th></tr></thead><tbody>'
        + booked.map(function (r) {
          var pc = r.cv ? Math.min(100, Math.round(r.invoiced / r.cv * 100)) : 0, nx = r.next;
          return '<tr><td>' + esc(fd(r.on)) + '<div class="muted small">' + esc(r.how) + '</div></td>'
            + '<td><b>' + esc((r.p.code ? r.p.code + " · " : "") + (r.p.name || "")) + '</b>' + (r.p.status ? '<div class="muted small">' + esc(r.p.status) + '</div>' : "") + '</td>'
            + '<td>' + esc(r.p.entity || "") + '</td><td class="num"><b>' + money(r.cv) + '</b></td><td class="num">' + money(r.advIn) + '</td><td class="num">' + money(r.invoiced) + '</td>'
            + '<td class="num">' + (!r.cv ? '<a href="#proj">Set the contract value</a>' : r.left >= 1 ? '<b>' + money(r.left) + '</b>' : '<span class="good">Fully invoiced</span>') + '</td>'
            + '<td><span class="fsbk-bar"><span style="width:' + pc + '%"></span></span> ' + pc + '%</td>'
            + '<td>' + (nx ? esc(nx.row.m || "Milestone") + ' · ' + money(nx.amt) + ' <span class="muted small">' + esc(nx.s.t || "") + '</span>'
                + (/^waits/i.test(nx.s.t || "") ? "" : '<br><button class="btn sm pri" data-bsraise="' + esc(bsKey(r.p, nx.row)) + '">Raise invoice</button>')
              : r.left >= 1 ? '<a href="#e_ar/bsched">Set billing milestones</a>' : '<span class="muted">–</span>') + '</td></tr>';
        }).join("")
        + '</tbody><tfoot><tr><th colspan="3">Total</th><th class="num">' + money(sum(booked, "cv")) + '</th><th class="num">' + money(sum(booked, "advIn")) + '</th><th class="num">' + money(sum(booked, "invoiced")) + '</th><th class="num">' + money(sum(booked, "left")) + '</th><th colspan="2"></th></tr></tfoot></table></div>'
        : '<p class="muted">No contract booked yet. Post the first customer advance under Receivables › Customer advances and the contract appears here in full.</p>')
      + '</div>';
    if (waiting.length) {
      h += '<div class="card"><h3>Awaiting advance <small>projects with no advance or invoice posted yet, so not booked</small></h3><div class="tw"><table><thead><tr><th>Project / customer</th><th>Company</th><th>Status</th><th class="num">Contract value</th></tr></thead><tbody>'
        + waiting.map(function (r) { return '<tr><td>' + esc((r.p.code ? r.p.code + " · " : "") + (r.p.name || "")) + '</td><td>' + esc(r.p.entity || "") + '</td><td>' + esc(r.p.status || "") + '</td><td class="num">' + money(r.cv) + '</td></tr>'; }).join("")
        + '</tbody></table></div><p class="note">Record the advance under <a href="#e_ar/custadv">Receivables › Customer advances</a>; once its voucher is posted the contract is booked.</p></div>';
    }
    return h + '</div>';
  }
  function kpi(t, v, s) { return '<div class="fsbk-kpi"><span>' + esc(t) + '</span><b>' + v + '</b><i>' + esc(s) + '</i></div>'; }

  // For the management dashboard
  window.FS_BOOK = { rows: function () { return safe(rows, []); }, fyStart: fyStart };

  function hook() {
    if (typeof MODS === "undefined" || !MODS.e_ar || typeof special !== "function" || typeof Store === "undefined" || typeof liveJv !== "function") return false;
    if (!MODS.e_ar.tabs.some(function (t) { return t[0] === "booking"; })) {
      var at = MODS.e_ar.tabs.findIndex(function (t) { return t[0] === "custadv"; });
      MODS.e_ar.tabs.splice(at < 0 ? 1 : at + 1, 0, ["booking", "Contract bookings"]);
      try { TAB_HOME.booking = "e_ar"; } catch (x) { /* older app */ }
      var old = special; // eslint-disable-line no-undef
      special = function (tab) { return tab === "booking" ? safe(view, '<div class="panel empty"><b>Could not build the bookings</b>Reload the page.</div>') : old(tab); }; // eslint-disable-line no-global-assign
    }
    if (typeof render === "function") render();
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fsbk-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin:12px 0 14px}"
    + ".fsbk-kpi{display:flex;flex-direction:column;gap:3px;padding:14px 16px;border:1px solid var(--line,#e2e8f0);border-left:4px solid #16a34a;border-radius:10px;background:var(--panel,#fff)}"
    + ".fsbk-kpi span{font-size:12.5px;color:var(--muted,#64748b);font-weight:600;text-transform:uppercase;letter-spacing:.03em}.fsbk-kpi b{font-size:24px;line-height:1.15}.fsbk-kpi i{font-style:normal;font-size:12.5px;color:var(--muted,#64748b)}"
    + ".fsbk .small{font-size:12px}.fsbk .good{color:#15803d;font-weight:600}.fsbk td .btn{margin-top:4px}"
    + ".fsbk-bar{display:inline-block;width:70px;height:7px;border-radius:4px;background:#e2e8f0;vertical-align:middle;overflow:hidden}.fsbk-bar span{display:block;height:100%;background:#16a34a}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
