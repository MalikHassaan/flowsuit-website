// TAJ dashboard, three added reports (hassan, 2026-11-09: "figures are not the same, in some the total is different and on
// the other sheet it gets changed ... correct that, and need two reports on sales: total sales sector wise in rows and
// years in columns, and how much collection is received year wise, bank wise, a separate report").
//  * Reconciliation (Overview): every page's orders and balance next to the Summary page, the difference, and why.
//    The pages do not cover the same orders on purpose (they copy the Power BI pages), so the difference is shown and
//    explained with figures instead of being hidden.
//  * Sales by Sector and Year (Sales): sale value of the orders in the exports, sector in rows, booking year in columns.
//  * Collections by Bank and Year (Cash): the Bank Collection export, bank in rows, year in columns (same source and
//    total as the Year Trend page).
// taj_year_hooks() in taj-store.php wires these in; nothing changes unless every anchor is found once.
(function () {
  var BLANK = "(Blank)";
  var sum = function (l, f) { return l.reduce(function (a, x) { return a + (+f(x) || 0); }, 0); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var agg = function (l) { return { n: l.length, inv: sum(l, function (o) { return o.invoiced; }), rec: sum(l, function (o) { return o.received; }), bal: sum(l, function (o) { return o.balance; }) }; };

  function pivot(list, rowKey, yearOf, valOf, firstLabel) {
    var years = {}, by = {};
    list.forEach(function (x) {
      var y = yearOf(x), k = rowKey(x); if (y === null || y === undefined) y = BLANK;
      years[y] = 1; var r = by[k] || (by[k] = {}); r[y] = (r[y] || 0) + (+valOf(x) || 0);
    });
    var ys = Object.keys(years).sort(function (a, b) { return a === BLANK ? 1 : b === BLANK ? -1 : a - b; });
    var all = function (r) { return ys.reduce(function (a, y) { return a + (r[y] || 0); }, 0); };
    var keys = Object.keys(by).sort(function (a, b) { return a === BLANK ? 1 : b === BLANK ? -1 : all(by[b]) - all(by[a]); });
    var tot = ys.map(function (y) { return keys.reduce(function (a, k) { return a + (by[k][y] || 0); }, 0); });
    return {
      years: ys, totals: tot, total: tot.reduce(function (a, b) { return a + b; }, 0), keys: keys, by: by,
      table: {
        cols: [{ label: firstLabel, type: "text" }].concat(ys.map(function (y) { return { label: String(y), type: "money" }; }), [{ label: "Total", type: "money" }]),
        rows: keys.map(function (k) { return { cells: [k].concat(ys.map(function (y) { return by[k][y] || 0; }), [all(by[k])]), kind: "row" }; })
          .concat([{ cells: ["Total"].concat(tot, [tot.reduce(function (a, b) { return a + b; }, 0)]), kind: "total" }])
      }
    };
  }

  // m: the orders after the page filters; bank: Bank Collection lines {date, bank, amount}; cut: figures as at; pr: period.
  function build(m, bank, cut, pr, props) {
    m = m || [];
    var inP = function (d) { return !pr || (!!d && (!pr.ys.length || pr.ys.indexOf(d.getFullYear()) >= 0) && (!pr.ms.length || pr.ms.indexOf(d.getMonth()) >= 0)); };
    var sales = pivot(m, function (o) { return o.sector || BLANK; }, function (o) { return o.booking ? o.booking.getFullYear() : null; }, function (o) { return o.sales; }, "Sector");
    var cnt = pivot(m, function (o) { return o.sector || BLANK; }, function (o) { return o.booking ? o.booking.getFullYear() : null; }, function () { return 1; }, "Sector");
    var b = (bank || []).filter(function (x) { return x.date && x.date <= cut && inP(x.date); });
    var coll = bank ? pivot(b, function (x) { return x.bank || BLANK; }, function (x) { return x.date.getFullYear(); }, function (x) { return x.amount; }, "Bank") : null;
    props = props || [];
    var scope = {
      all: agg(m),
      notN: agg(m.filter(function (o) { return !o.inN; })),
      otherProp: agg(m.filter(function (o) { return o.inN && props.indexOf(o.property) < 0; })),
      neg: agg(m.filter(function (o) { return o.balance < 0; })),
      zero: agg(m.filter(function (o) { return !(o.balance > 0); })),
      blankGroup: agg(m.filter(function (o) { return !o.summaryGroup || o.summaryGroup === BLANK; }))
    };
    return { sales: sales, salesCount: cnt, coll: coll, scope: scope, cut: cut, props: props };
  }

  // Each page's own total row, read from what the page shows, and the known rule that explains any difference.
  function recon(r, last, money, nf) {
    var X = r.fsyr; if (!X) return null;
    var S = X.scope, k = r.kpis, f = function (v) { return money(v); }, n = function (v) { return nf.format(v); };
    var C = [
      { n: S.notN.n, bal: S.notN.bal, t: "orders only in the Paid Percentage file (not in the Installments file)" },
      { n: S.notN.n + S.otherProp.n, bal: S.notN.bal + S.otherProp.bal, t: "orders only in the Paid Percentage file, plus orders whose property is not " + X.props.join(", ") },
      { n: S.otherProp.n, bal: S.otherProp.bal, t: "orders whose property is not " + X.props.join(", ") },
      { n: S.blankGroup.n, bal: S.blankGroup.bal, t: "orders with no sector group" },
      { n: S.zero.n, bal: S.neg.bal, t: "orders with zero or negative balance (the overpaid ones)" }
    ];
    var P = [];
    var add = function (page, orders, bal) { P.push({ page: page, orders: orders, bal: bal }); };
    var safe = function (fn) { try { fn(); } catch (e) { /* page not built */ } };
    add("Summary (all orders)", k.orders, k.balance);
    safe(function () { var t = last(r.receivablesTill); add("Receivables Till", t[1], t[5]); });
    safe(function () { var t = last(r.dormant.all); add("Dormant / Active", t[1], t[5]); });
    safe(function () { var t = last(r.overdue); add("Overdue Instalments", t[1], t[4]); });
    safe(function () { var t = last(r.fileStatus); add("File Status", t[2], t[6]); });
    safe(function () { var t = last(r.sectorStatus); add("By Sector Status", t[3], t[6]); });
    safe(function () { var t = last(r.property), o = 0, b = 0; for (var i = 3; i + 3 < t.length; i += 4) { o += +t[i] || 0; b += +t[i + 3] || 0; } add("By Property", o, b); });
    safe(function () { add("Top Outstanding", r.top.count, r.top.total); });
    safe(function () { var t = last(r.agents); add("Agent Performance", t[1], t[4]); });
    safe(function () { var t = last(r.vintage); add("Booking Year", t[1], t[4]); });
    safe(function () { var t = last(r.plotSize); add("Plot Size", t[1], t[4]); });
    var B = k.balance, N = k.orders, near = function (a, b) { return Math.abs(a - b) < 1; };
    P.forEach(function (p, i) {
      var dn = N - p.orders, db = B - p.bal; p.ok = true;
      if (!i) { p.why = "Every order in the Installments and Paid Percentage files. This is the reference."; return; }
      if (!dn && near(db, 0)) { p.why = "Matches Summary."; return; }
      var both = C.filter(function (c) { return c.n === dn && near(c.bal, db); })[0];
      if (both) { p.why = "Leaves out " + n(dn) + " " + both.t + ", balance " + f(both.bal) + "."; return; }
      var cn = dn ? C.filter(function (c) { return c.n === dn; })[0] : null, cb = near(db, 0) ? null : C.filter(function (c) { return near(c.bal, db); })[0];
      var bits = [];
      if (dn && cn) bits.push("Counts " + n(dn) + " fewer orders: " + cn.t + (near(db, 0) ? ", but their balance is included." : "."));
      if (cb) bits.push("Balance leaves out " + f(cb.bal) + ": " + cb.t + ".");
      if ((dn && !cn) || (!near(db, 0) && !cb)) { p.ok = false; bits.push("Difference of " + n(dn) + " orders and " + f(db) + " not explained by a known rule. Check the exports."); }
      p.why = bits.join(" ");
    });
    var rows = P.map(function (p) { return { cells: [p.page, p.orders, p.orders - N, p.bal, p.bal - B, p.why], kind: "row" }; });
    return { cols: [{ label: "Page", type: "text" }, { label: "Orders", type: "count" }, { label: "Orders vs Summary", type: "count" }, { label: "Balance", type: "money" }, { label: "Balance vs Summary", type: "money" }, { label: "Why", type: "text" }], rows: rows, list: P };
  }

  function kpis(r, tab, h) {
    var X = r.fsyr; if (!X) return [];
    if (tab === "salesyr") {
      var s = X.sales, ys = s.years.filter(function (y) { return y !== BLANK; }), cy = String(r.cut.getFullYear());
      var best = ys.map(function (y) { return [y, s.totals[s.years.indexOf(y)]]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
      var out = [{ l: "Total sales, all years", v: h.money(s.total), s: h.nf.format(X.scope.all.n) + " orders", hero: true }];
      if (s.years.indexOf(cy) >= 0) out.push({ l: cy + " to date", v: h.money(s.totals[s.years.indexOf(cy)]), s: "booked in " + cy });
      if (best) out.push({ l: "Best year", v: h.money(best[1]), s: best[0] });
      if (s.keys[0]) out.push({ l: "Largest sector", v: h.money(s.table.rows[0].cells.slice(-1)[0]), s: s.keys[0] });
      return out;
    }
    if (tab === "collyr") {
      var c = X.coll; if (!c || !c.years.length) return [];
      var y0 = String(r.cut.getFullYear()), py = String(r.cut.getFullYear() - 1);
      var o2 = [{ l: "Collected, " + c.years[0] + " to " + c.years[c.years.length - 1], v: h.money(c.total), s: c.keys.length + " banks", hero: true }];
      if (c.years.indexOf(y0) >= 0) o2.push({ l: y0 + " to date", v: h.money(c.totals[c.years.indexOf(y0)]) });
      if (c.years.indexOf(py) >= 0) o2.push({ l: py + " full year", v: h.money(c.totals[c.years.indexOf(py)]) });
      if (c.keys[0]) o2.push({ l: "Largest bank", v: h.money(c.table.rows[0].cells.slice(-1)[0]), s: c.keys[0] });
      return o2;
    }
    if (tab === "recon") {
      var t = recon(r, h.last, h.money, h.nf); if (!t) return [];
      var off = t.list.filter(function (p, i) { return i && (Math.abs(p.bal - t.list[0].bal) >= 1 || p.orders !== t.list[0].orders); });
      return [{ l: "Summary balance", v: h.money(t.list[0].bal), s: h.nf.format(t.list[0].orders) + " orders", hero: true },
        { l: "Pages that match", v: String(t.list.length - 1 - off.length), s: "of " + (t.list.length - 1) + " pages" },
        { l: "Pages with a narrower scope", v: String(off.length), s: "explained below" },
        { l: "Unexplained differences", v: String(t.list.filter(function (p) { return !p.ok; }).length), s: "should be 0", cls: t.list.some(function (p) { return !p.ok; }) ? "down" : "up" },
        { l: "Only in Paid Percentage file", v: h.money(r.fsyr.scope.notN.bal), s: h.nf.format(r.fsyr.scope.notN.n) + " orders" }];
    }
    return [];
  }

  function html(r, tab, h) {
    var X = r.fsyr;
    if (!X) return '<p class="callout">Upload the exports under Data sources to see this report.</p>';
    if (tab === "salesyr") {
      return h.kp + h.card("Sales by booking year", h.canvas("c-syr")) +
        '<div class="fs-yrbig">' + h.card("Sales by sector and booking year", h.table(X.sales.table), "Sale value of the orders in the exports (cancelled orders are not in the exports). Year = booking date.") +
        h.card("Number of orders by sector and booking year", h.table(Object.assign({}, X.salesCount.table, { cols: X.salesCount.table.cols.map(function (c, i) { return i ? { label: c.label, type: "count" } : c; }) }))) + "</div>";
    }
    if (tab === "collyr") {
      if (!X.coll) return '<p class="callout">Upload the Bank Collection export under Data sources to see this report.</p>';
      return h.kp + h.card("Collections by year", h.canvas("c-cyr")) +
        '<div class="fs-yrbig">' + h.card("Collections by bank and year", h.table(X.coll.table), "Bank Collection export, the same figures as the Year Trend page, up to " + h.date(X.cut) + ".") + "</div>";
    }
    if (tab === "recon") {
      var t = recon(r, h.last, h.money, h.nf);
      return h.kp + '<p class="callout">No figure is changed between pages. Each page counts a set of orders, as the Power BI report did. Where a page shows a different total from the Summary, the line below says how much and which orders it leaves out. Filters you pick at the top apply to every page.</p>' +
        '<div class="fs-yrbig fs-rc">' + h.card("Balance and orders on each page against the Summary", h.table({ cols: t.cols, rows: t.rows })) + "</div>";
    }
    return "";
  }

  // Year tables must fit the page width with no scroll bar: shrink the font until the table fits.
  function fit() {
    var ws = document.querySelectorAll(".fs-yrbig:not(.fs-rc) .tw");
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i], t = w.querySelector("table"); if (!t || !w.clientWidth) continue;
      var f = 12; t.style.fontSize = f + "pt";
      while (t.scrollWidth > w.clientWidth + 1 && f > 6) { f -= 0.5; t.style.fontSize = f + "pt"; }
      var tight = f < 10; t.classList.toggle("fs-yrtight", tight);
      if (tight) { f = 12; t.style.fontSize = f + "pt"; while (t.scrollWidth > w.clientWidth + 1 && f > 6) { f -= 0.5; t.style.fontSize = f + "pt"; } }
    }
  }
  var fitT; window.addEventListener("resize", function () { clearTimeout(fitT); fitT = setTimeout(fit, 150); });

  function chart(r, tab, h) {
    setTimeout(fit, 0);
    var X = r.fsyr; if (!X) return;
    var s = tab === "salesyr" ? X.sales : tab === "collyr" ? X.coll : null; if (!s) return;
    h.bars(tab === "salesyr" ? "c-syr" : "c-cyr", { labels: s.years.map(String), keys: [], legend: false,
      sets: [{ label: tab === "salesyr" ? "Sales" : "Collected", data: s.totals, color: h.css("--c2") }], fmt: h.money });
  }

  function pdf(r, tab, T) {
    var X = r.fsyr; if (!X) return;
    if (tab === "salesyr") { T("Sales by sector and booking year", X.sales.table); }
    if (tab === "collyr" && X.coll) T("Collections by bank and year", X.coll.table);
  }

  var css = document.createElement("style");
  css.textContent = ".fs-yrbig table,.fs-yrbig table.dense{font-size:12pt}.fs-yrbig td,.fs-yrbig th{padding:7px 10px}.fs-rc .tw{overflow-x:auto}" +
    ".fs-yrbig:not(.fs-rc) .tw{overflow:hidden!important;max-height:none}.fs-yrbig:not(.fs-rc) table{width:100%}.fs-yrbig:not(.fs-rc) td.t{min-width:0}" +
    ".fs-yrbig table.fs-yrtight td,.fs-yrbig table.fs-yrtight th{padding:5px 3px}" +
    ".fs-rc td:last-child{white-space:normal;text-align:left;min-width:280px;font-size:11pt}body.present .fs-rc table{font-size:inherit!important}";
  document.head.appendChild(css);

  window.FS_YR = { build: build, kpis: kpis, html: html, chart: chart, pdf: pdf, recon: recon };
})();
