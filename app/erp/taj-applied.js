// TAJ dashboard, fifth export (hassan, 2026-10-28): the "Receipt VS Applied" detail list (one row per receipt line,
// with Bank, Credit Date, Amount, Applied and Account Head). taj_applied_hooks() in taj-store.php lets the dashboard
// detect and save this file like its other four exports, and adds the "Account Heads" report: account heads in
// rows, months in columns, for the banks below only. Each line counts its Applied amount; where Applied is zero
// (money received but not yet applied), the receipt Amount is used instead.
(function () {
  var BANKS = ["ABL-20079", "BIP-TP-206", "ABL-0056"];
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var str = function (v) { return v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim(); };
  var num = function (v) { if (typeof v === "number") return v; var x = parseFloat(str(v).replace(/,/g, "")); return isNaN(x) ? 0 : x; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };

  function header(rows) {
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var t = (rows[i] || []).map(str), c = {};
      ["Bank", "Credit Date", "Amount", "Applied", "Account Head", "Sector"].forEach(function (k) { c[k] = t.indexOf(k); });
      if (c.Bank >= 0 && c["Credit Date"] >= 0 && c.Amount >= 0 && c.Applied >= 0 && c["Account Head"] >= 0) return { row: i, c: c };
    }
    return null;
  }
  function day(v) {
    if (v instanceof Date) return v;
    var m = str(v).match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && m[1].toLowerCase() in MON) return new Date(+m[3], MON[m[1].toLowerCase()], +m[2]);
    m = str(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  // Totals per bank, account head, sector and month: [{bank, head, sector, month (year*12+month), amount, n}].
  function parse(rows) {
    var h = header(rows), map = {}, out = [];
    if (!h) return out;
    rows.slice(h.row + 1).forEach(function (r) {
      r = r || [];
      var bank = str(r[h.c.Bank]), d = day(r[h.c["Credit Date"]]);
      if (!bank || !d) return;
      var amt = num(r[h.c.Applied]) || num(r[h.c.Amount]);
      if (!amt) return;
      var head = str(r[h.c["Account Head"]]) || "(Blank)", sector = h.c.Sector >= 0 ? str(r[h.c.Sector]) || "(Blank)" : "(Blank)";
      var month = d.getFullYear() * 12 + d.getMonth(), k = [bank, head, sector, month].join("|");
      var e = map[k] || (map[k] = out[out.push({ bank: bank, head: head, sector: sector, month: month, amount: 0, n: 0 }) - 1]);
      e.amount += amt; e.n++;
    });
    return out;
  }
  function printDate(rows) {
    for (var i = 0; i < Math.min(rows.length, 6); i++) {
      var t = (rows[i] || []).map(str).join(" "), m = t.match(/Print Date:\s*([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
      if (m && m[1].slice(0, 3).toLowerCase() in MON) return new Date(+m[3], MON[m[1].slice(0, 3).toLowerCase()], +m[2]);
    }
    return null;
  }
  function count(data) { return data.reduce(function (a, x) { return a + x.n; }, 0); }
  var label = function (k) { return MN[k % 12] + " " + Math.floor(k / 12); };

  // cut: figures as of; pr: the period picked ({ys, ms}) or null; F: filters (only Sector applies here).
  function build(data, cut, pr, F) {
    if (!data || !data.length) return null;
    var to = cut.getFullYear() * 12 + cut.getMonth(), sec = F && F.sector && F.sector.length ? F.sector : null;
    var inP = function (k) { return !pr || ((!pr.ys.length || pr.ys.indexOf(Math.floor(k / 12)) >= 0) && (!pr.ms.length || pr.ms.indexOf(k % 12) >= 0)); };
    var rows = data.filter(function (x) { return BANKS.indexOf(x.bank) >= 0 && x.month <= to && inP(x.month) && (!sec || sec.indexOf(x.sector) >= 0); });
    var months = Array.from(new Set(rows.map(function (x) { return x.month; }))).sort(function (a, b) { return a - b; });
    var pivot = function (key, name) {
      var by = {}, tot = months.map(function () { return 0; });
      rows.forEach(function (x) { var r = by[x[key]] || (by[x[key]] = months.map(function () { return 0; })), i = months.indexOf(x.month); r[i] += x.amount; tot[i] += x.amount; });
      var all = function (a) { return a.reduce(function (s, v) { return s + v; }, 0); };
      var keys = Object.keys(by).sort(function (a, b) { return all(by[b]) - all(by[a]); });
      return { cols: [{ label: name, type: "text" }].concat(months.map(function (k) { return { label: label(k), type: "money" }; }), [{ label: "Total", type: "money" }]),
        rows: keys.map(function (k) { return { cells: [k].concat(by[k], [all(by[k])]), kind: "row" }; }).concat([{ cells: ["Total"].concat(tot, [all(tot)]), kind: "total" }]),
        totals: tot, keys: keys, by: by };
    };
    var heads = pivot("head", "Account head"), banks = pivot("bank", "Bank");
    return { table: heads.cols.length > 2 ? heads : { cols: heads.cols, rows: [] }, banks: banks, months: months, labels: months.map(label),
      total: heads.totals.reduce(function (a, b) { return a + b; }, 0), banksLabel: BANKS.join(", "), sector: !!sec,
      others: Object.keys(F || {}).filter(function (d) { return d !== "sector" && F[d] && F[d].length; }).length > 0 };
  }
  function kpis(a, h) {
    if (!a || !a.months.length) return [];
    var t = a.table.rows.filter(function (r) { return r.kind === "row"; }), last = function (r) { return r.cells[r.cells.length - 1]; };
    var best = a.months.map(function (k, i) { return [k, a.table.rows[a.table.rows.length - 1].cells[i + 1]]; }).sort(function (x, y) { return y[1] - x[1]; })[0];
    var un = t.filter(function (r) { return r.cells[0] === "Un-Applied"; })[0];
    var out = [{ l: "Received, " + a.labels[0] + (a.months.length > 1 ? " to " + a.labels[a.labels.length - 1] : ""), v: h.money(a.total), s: a.banksLabel, hero: true }];
    if (t[0]) out.push({ l: "Largest head", v: h.money(last(t[0])), s: t[0].cells[0] + ", " + Math.round(last(t[0]) / a.total * 100) + "%" });
    out.push({ l: "Best month", v: h.money(best[1]), s: label(best[0]) });
    out.push({ l: "Monthly average", v: h.money(a.total / a.months.length), s: a.months.length + (a.months.length === 1 ? " month" : " months") });
    if (un) out.push({ l: "Not yet applied", v: h.money(last(un)), s: "receipt amount, Applied was zero", cls: "down" });
    return out;
  }
  function html(a, h) {
    if (!a) return '<p class="callout">Upload the Receipt VS Applied detail file (the one with Credit Date, Applied and Account Head columns) under Data sources to see this report.</p>';
    if (!a.months.length) return '<p class="callout">No receipts from ' + esc(a.banksLabel) + " for this selection.</p>";
    return (a.others ? '<p class="callout">Only the Sector filter and the period change this page; other filters do not apply to this file.</p>' : "") + h.kp +
      h.card("Received by month and bank", h.canvas("c-heads"), "Banks " + a.banksLabel) +
      h.card("Account heads by month", h.table(a.table), "Applied amount; where Applied is zero, the receipt amount") +
      h.card("Banks by month", h.table(a.banks));
  }
  function chart(a, h) {
    if (!a || !a.months.length) return;
    var cols = ["--c1", "--c2", "--c3", "--c4", "--c6"];
    h.bars("c-heads", { labels: a.labels, keys: [], stacked: true, legend: true,
      sets: a.banks.keys.map(function (b, i) { return { label: b, data: a.banks.by[b], color: h.css(cols[i % cols.length]) }; }) });
  }
  var view = { cols: [["Month", "text"], ["Bank", "text"], ["Account head", "text"], ["Sector", "text"], ["Receipt lines", "count"], ["Amount", "money"]],
    rows: function (m) { return (m.applied || []).slice().sort(function (a, b) { return b.month - a.month || b.amount - a.amount; })
      .map(function (x) { return [label(x.month), x.bank, x.head, x.sector, x.n, x.amount]; }); } };

  window.FS_AP = { is: function (rows) { return !!header(rows); }, parse: parse, printDate: printDate, count: count, build: build, kpis: kpis, html: html, chart: chart, view: view, BANKS: BANKS };
})();
