// AMC reports (hassan, 2026-11-04: "AMC report ... client wise, client and months on top, invoiced, received and
// balance, the receipt detail (on which date the amount is received), AMC customer statement or ledger (like the
// resident ledger sample) with received amount and received date, visible to the person who has AMC rights in the
// report module, AMC aging report and total receipt report").
// One tab "AMC reports" under Projects (where AMC billing is) and under Reports, with five reports:
//  * By client and month: clients down, months across, each cell invoiced / received, totals and balance;
//  * Receipts: every receipt against an AMC invoice, with date, voucher, bank, tax deducted and amount;
//  * Customer ledger: one client: contract details, the AMC invoices (period from/to, amount, received, received
//    on, balance) and the receipts, printable;
//  * Aging: what each client still owes, by days past the due date;
//  * Total receipts: received by month, per client.
// AMC invoices are the ones AMC billing made (amcKey) or any invoice on an AMC project. "Received" counts receipts
// whose voucher is posted, like the rest of Receivables; receipts still waiting for approval are shown as pending.
(function () {
  /* global openForm, NAV, TITLE, NS_ALIAS, Store, MODS, TAB_HOME, special, byEnt, V, esc, fmt, fdate, todayStr, render, sheetOpen, jvOf, AMC_STEP, cnFor */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var num = function (v) { return parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0; };
  var money = function (v) { return safe(function () { return fmt(Math.round(v)); }, String(Math.round(v))); };
  var fd = function (d) { return d ? safe(function () { return fdate(d); }, d) : ""; };
  var AMC = "Maintenance contract (AMC)";
  var ST = { r: "matrix", from: "", to: "", client: "" };
  var addM = function (m, k) { var d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  var mName = function (m) { return safe(function () { return new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleString("en-GB", { month: "short", year: "2-digit" }); }, m); };
  function fyDefault() { var t = todayStr(), y = +t.slice(0, 4), mo = +t.slice(5, 7); var s = mo >= 7 ? y : y - 1; return [s + "-07", (s + 1) + "-06"]; }

  function projs() { return safe(function () { return byEnt(Store.data.projects).filter(function (p) { return p.type === AMC; }); }, []); }
  var clientOf = function (p) { return String((p && (p.customer || p.name)) || "").trim() || "(no client)"; };
  function invs() {
    var P = projs(), byId = {}; P.forEach(function (p) { byId[p.id] = p; });
    return safe(function () { return byEnt(Store.data.receivables); }, []).filter(function (r) { return r.status !== "Void" && (r.amcKey || byId[r.projectId]); }).map(function (r) {
      var p = byId[r.projectId] || byId[String(r.amcKey || "").split("|")[0]] || null;
      var m = r.amcKey ? String(r.amcKey).split("|")[1] : String(r.invoiceDate || "").slice(0, 7);
      var k = r.amcDef ? r.amcDef.months : p ? safe(function () { return AMC_STEP[p.amcFreq]; }, 1) || 1 : 1;
      var rc = (r.receipts || []).map(function (x) { var j = safe(function () { return jvOf(x.jvId); }, null); return { date: x.date, amount: num(x.amount), wht: num(x.wht), ref: x.voucher || (j && j.ref) || x.ref || "", chq: x.ref || "", bank: x.bank, posted: !!(j && j.status === "Posted"), st: j ? j.status : "" }; });
      var rec = rc.filter(function (x) { return x.posted; }).reduce(function (s, x) { return s + x.amount; }, 0) + num(r.received);
      var cn = safe(function () { return cnFor(r.id); }, 0) || 0;
      var bal = Math.max(0, num(r.amount) - num(r.retention) - num(r.advAdjust) - rec - cn);
      return { r: r, p: p, client: clientOf(p) === "(no client)" ? String(r.customer || "(no client)") : clientOf(p), m: m, to: addM(m, k - 1), k: k, rc: rc, rec: rec, cn: cn, bal: bal };
    });
  }
  function range() { var d = fyDefault(); return [ST.from || d[0], ST.to || d[1]]; }
  function months(a, b) { var out = [], m = a; while (m <= b && out.length < 60) { out.push(m); m = addM(m, 1); } return out; }

  function ctls(I) {
    var rg = range(), clients = I.map(function (x) { return x.client; }).filter(function (c, i, a) { return a.indexOf(c) === i; }).sort();
    var b = function (k, l) { return "<button type=\"button\" class=\"btn" + (ST.r === k ? " pri" : "") + "\" data-amcr=\"" + k + "\">" + h(l) + "</button>"; };
    return "<div class=\"fs-amcr-bar\">" + b("matrix", "By client and month") + b("rec", "Receipts") + b("ledger", "Customer ledger") + b("age", "Aging") + b("tot", "Total receipts") + "</div>" +
      "<div class=\"ctls fs-amcr-ctl\">" + (ST.r === "age" ? "" : "<label>From <input type=\"month\" id=\"amcrFrom\" value=\"" + h(rg[0]) + "\"></label><label>To <input type=\"month\" id=\"amcrTo\" value=\"" + h(rg[1]) + "\"></label>") +
      "<label>Client <select id=\"amcrCl\"><option value=\"\">" + (ST.r === "ledger" ? "Choose a client" : "All clients") + "</option>" + clients.map(function (c) { return "<option" + (c === ST.client ? " selected" : "") + ">" + h(c) + "</option>"; }).join("") + "</select></label>" +
      "<span style=\"flex:1\"></span><button type=\"button\" class=\"btn\" id=\"amcrPrint\">Print</button><button type=\"button\" class=\"btn\" id=\"amcrCsv\">Download CSV</button></div>";
  }
  var flt = function (I) { return ST.client ? I.filter(function (x) { return x.client === ST.client; }) : I; };

  function matrix(I) {
    var rg = range(), M = months(rg[0], rg[1]), cl = {};
    flt(I).forEach(function (x) {
      var c = cl[x.client] = cl[x.client] || { inv: {}, rec: {}, ti: 0, tr: 0, bal: 0 };
      if (x.m >= rg[0] && x.m <= rg[1]) { c.inv[x.m] = (c.inv[x.m] || 0) + num(x.r.amount); c.ti += num(x.r.amount); }
      x.rc.forEach(function (q) { var mm = String(q.date || "").slice(0, 7); if (q.posted && mm >= rg[0] && mm <= rg[1]) { c.rec[mm] = (c.rec[mm] || 0) + q.amount; c.tr += q.amount; } });
      c.bal += x.bal;
    });
    var names = Object.keys(cl).sort(), T = { inv: {}, rec: {}, ti: 0, tr: 0, bal: 0 };
    names.forEach(function (n) { var c = cl[n]; M.forEach(function (m) { T.inv[m] = (T.inv[m] || 0) + (c.inv[m] || 0); T.rec[m] = (T.rec[m] || 0) + (c.rec[m] || 0); }); T.ti += c.ti; T.tr += c.tr; T.bal += c.bal; });
    var cell = function (c, m) { var a = c.inv[m] || 0, b = c.rec[m] || 0; return "<td class=\"num\">" + (a ? money(a) : "") + "</td><td class=\"num rc\">" + (b ? money(b) : "") + "</td>"; };
    var head = "<tr><th rowspan=\"2\">Client</th>" + M.map(function (m) { return "<th colspan=\"2\" class=\"c\">" + h(mName(m)) + "</th>"; }).join("") + "<th rowspan=\"2\" class=\"num\">Invoiced</th><th rowspan=\"2\" class=\"num\">Received</th><th rowspan=\"2\" class=\"num\">Balance (all time)</th></tr><tr>" + M.map(function () { return "<th class=\"num\">Inv.</th><th class=\"num rc\">Rec.</th>"; }).join("") + "</tr>";
    var body = names.map(function (n) { var c = cl[n]; return "<tr><td>" + h(n) + "</td>" + M.map(function (m) { return cell(c, m); }).join("") + "<td class=\"num\"><b>" + money(c.ti) + "</b></td><td class=\"num\"><b>" + money(c.tr) + "</b></td><td class=\"num\"><b>" + money(c.bal) + "</b></td></tr>"; }).join("");
    var csv = [["Client"].concat(M.map(function (m) { return [m + " invoiced", m + " received"]; }).reduce(function (a, b) { return a.concat(b); }, [])).concat(["Invoiced", "Received", "Balance"])]
      .concat(names.map(function (n) { var c = cl[n]; return [n].concat(M.map(function (m) { return [Math.round(c.inv[m] || 0), Math.round(c.rec[m] || 0)]; }).reduce(function (a, b) { return a.concat(b); }, [])).concat([Math.round(c.ti), Math.round(c.tr), Math.round(c.bal)]); }));
    return { title: "AMC by client and month", sub: "Invoiced by the month the AMC period starts; received by the date the money came in (posted receipts). " + mName(rg[0]) + " to " + mName(rg[1]) + ".", csv: csv,
      html: "<table class=\"fs-amcr-t\"><thead>" + head + "</thead><tbody>" + (body || "<tr><td colspan=\"" + (M.length * 2 + 4) + "\" class=\"muted\">No AMC invoices.</td></tr>") + "</tbody><tfoot><tr><td>Total</td>" + M.map(function (m) { return cell(T, m); }).join("") + "<td class=\"num\">" + money(T.ti) + "</td><td class=\"num\">" + money(T.tr) + "</td><td class=\"num\">" + money(T.bal) + "</td></tr></tfoot></table>" };
  }

  function recList(I) {
    var rg = range(), L = [];
    flt(I).forEach(function (x) { x.rc.forEach(function (q) { var mm = String(q.date || "").slice(0, 7); if (mm >= rg[0] && mm <= rg[1]) L.push({ x: x, q: q }); }); });
    L.sort(function (a, b) { return String(a.q.date).localeCompare(String(b.q.date)); });
    var tot = 0, tw = 0;
    var body = L.map(function (e) { if (e.q.posted) { tot += e.q.amount; tw += e.q.wht; } return "<tr><td style=\"white-space:nowrap\">" + h(fd(e.q.date)) + "</td><td>" + h(e.x.client) + "</td><td class=\"mono\">" + h(e.x.r.invoiceNo || "") + "</td><td>" + h(mName(e.x.m) + (e.x.k > 1 ? " – " + mName(e.x.to) : "")) + "</td><td class=\"mono\">" + h(e.q.ref) + "</td><td>" + h(e.q.chq && e.q.chq !== e.q.ref ? e.q.chq : "") + "</td><td>" + (e.q.posted ? "Posted" : "<span class=\"warn\">" + h(e.q.st || "Pending") + "</span>") + "</td><td class=\"num\">" + money(e.q.amount - e.q.wht) + "</td><td class=\"num\">" + (e.q.wht ? money(e.q.wht) : "") + "</td><td class=\"num\">" + money(e.q.amount) + "</td></tr>"; }).join("");
    return { title: "AMC receipts", sub: "Every receipt against an AMC invoice, " + mName(rg[0]) + " to " + mName(rg[1]) + ". Totals count posted receipts only.",
      csv: [["Date", "Client", "Invoice", "AMC period", "Voucher", "Cheque / ref", "Status", "Into bank", "Tax deducted", "Amount cleared"]].concat(L.map(function (e) { return [e.q.date, e.x.client, e.x.r.invoiceNo || "", e.x.m + (e.x.k > 1 ? " to " + e.x.to : ""), e.q.ref, e.q.chq, e.q.posted ? "Posted" : e.q.st || "Pending", Math.round(e.q.amount - e.q.wht), Math.round(e.q.wht), Math.round(e.q.amount)]; })),
      html: "<table class=\"fs-amcr-t\"><thead><tr><th>Received on</th><th>Client</th><th>Invoice</th><th>AMC period</th><th>Voucher</th><th>Cheque / ref</th><th>Status</th><th class=\"num\">Into bank</th><th class=\"num\">Tax deducted</th><th class=\"num\">Amount cleared</th></tr></thead><tbody>" +
        (body || "<tr><td colspan=\"10\" class=\"muted\">No receipts in this period.</td></tr>") + "</tbody><tfoot><tr><td colspan=\"7\">Total (posted)</td><td class=\"num\">" + money(tot - tw) + "</td><td class=\"num\">" + money(tw) + "</td><td class=\"num\">" + money(tot) + "</td></tr></tfoot></table>" };
  }

  function ledger(I) {
    if (!ST.client) return { title: "AMC customer ledger", sub: "Choose a client above.", html: "<p class=\"muted\">Choose a client to see the ledger.</p>", csv: [] };
    var X = I.filter(function (x) { return x.client === ST.client; }).sort(function (a, b) { return String(a.r.invoiceDate).localeCompare(String(b.r.invoiceDate)); });
    var P = projs().filter(function (p) { return clientOf(p) === ST.client; }), p = P[0] || {};
    var ti = 0, tr = 0, tb = 0, run = 0;
    var inv = X.map(function (x) {
      ti += num(x.r.amount); tr += x.rec; tb += x.bal;
      var dates = x.rc.filter(function (q) { return q.posted; }).map(function (q) { return fd(q.date); }).join(", ");
      return "<tr><td>" + h(fd(x.r.invoiceDate)) + "</td><td class=\"mono\">" + h(x.r.invoiceNo || "") + "</td><td>" + h(fd(x.r.dueDate)) + "</td><td>" + h(fd(x.m + "-01")) + "</td><td>" + h(safe(function () { var d = new Date(+x.to.slice(0, 4), +x.to.slice(5, 7), 0); return fdate(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")); }, x.to)) + "</td><td class=\"num\">" + money(num(x.r.amount)) + "</td><td class=\"num\">" + (x.rec ? money(x.rec) : "–") + "</td><td>" + h(dates || "–") + "</td><td class=\"num\">" + money(x.bal) + "</td></tr>";
    }).join("");
    // running ledger: invoices debit, receipts and credit notes credit, by date
    var ev = [];
    X.forEach(function (x) {
      ev.push({ d: x.r.invoiceDate, t: "Invoice", desc: "AMC " + mName(x.m) + (x.k > 1 ? " – " + mName(x.to) : "") + " · " + (x.r.invoiceNo || ""), dr: num(x.r.amount), cr: 0, ref: x.r.invoiceNo || "" });
      x.rc.forEach(function (q) { if (q.posted) ev.push({ d: q.date, t: "Receipt", desc: "Received against " + (x.r.invoiceNo || "") + (q.wht ? " (tax deducted " + money(q.wht) + ")" : ""), dr: 0, cr: q.amount, ref: q.ref }); });
      if (x.cn) ev.push({ d: x.r.invoiceDate, t: "Credit note", desc: "Credit against " + (x.r.invoiceNo || ""), dr: 0, cr: x.cn, ref: "" });
    });
    ev.sort(function (a, b) { return String(a.d).localeCompare(String(b.d)) || (a.dr ? -1 : 1); });
    var led = ev.map(function (e) { run += e.dr - e.cr; return "<tr><td style=\"white-space:nowrap\">" + h(fd(e.d)) + "</td><td>" + h(e.t) + "</td><td>" + h(e.desc) + "</td><td class=\"mono\">" + h(e.ref) + "</td><td class=\"num\">" + (e.dr ? money(e.dr) : "") + "</td><td class=\"num\">" + (e.cr ? money(e.cr) : "") + "</td><td class=\"num\">" + money(run) + "</td></tr>"; }).join("");
    var info = "<div class=\"fs-amcr-info\"><h4>Client information</h4><div class=\"fs-amcr-g\">" +
      [["Client", ST.client], ["Contract", P.map(function (q) { return (q.code ? q.code + " " : "") + q.name; }).join("; ")], ["Billing", p.amcFreq || "Monthly"], ["Fee per month (excl. tax)", p.amcFee ? money(num(p.amcFee)) : ""], ["Start", fd(p.amcStart)], ["End / renewal", fd(p.amcEnd)], ["Company", p.entity || ""], ["Balance", "PKR " + money(tb)]]
        .map(function (x) { return "<div><small>" + h(x[0]) + "</small><b>" + h(x[1] || "–") + "</b></div>"; }).join("") + "</div></div>";
    var csv = [["Invoice date", "Invoice no", "Due date", "Period from", "Period to", "Invoice amount", "Received", "Received on", "Balance"]].concat(X.map(function (x) { return [x.r.invoiceDate, x.r.invoiceNo || "", x.r.dueDate || "", x.m, x.to, Math.round(num(x.r.amount)), Math.round(x.rec), x.rc.filter(function (q) { return q.posted; }).map(function (q) { return q.date; }).join(" "), Math.round(x.bal)]; }));
    return { title: "AMC customer ledger – " + ST.client, sub: "All AMC invoices and receipts for this client.", csv: csv,
      html: info + "<h4>AMC invoices</h4><table class=\"fs-amcr-t\"><thead><tr><th>Invoice date</th><th>Invoice no</th><th>Due date</th><th>Period from</th><th>Period to</th><th class=\"num\">Invoice amount</th><th class=\"num\">Received</th><th>Received on</th><th class=\"num\">Balance</th></tr></thead><tbody>" +
        (inv || "<tr><td colspan=\"9\" class=\"muted\">No records</td></tr>") + "</tbody><tfoot><tr><td colspan=\"5\">Total</td><td class=\"num\">" + money(ti) + "</td><td class=\"num\">" + money(tr) + "</td><td></td><td class=\"num\">" + money(tb) + "</td></tr></tfoot></table>" +
        "<h4>Ledger</h4><table class=\"fs-amcr-t\"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Ref</th><th class=\"num\">Debit</th><th class=\"num\">Credit</th><th class=\"num\">Balance</th></tr></thead><tbody>" + (led || "<tr><td colspan=\"7\" class=\"muted\">No records</td></tr>") + "</tbody></table>" };
  }

  var BK = [["Not yet due", -1e9, 0], ["1–30 days", 1, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["Over 90 days", 91, 1e9]];
  function aging(I) {
    var today = new Date(todayStr()), cl = {};
    flt(I).filter(function (x) { return x.bal >= 1; }).forEach(function (x) {
      var dd = x.r.dueDate || x.r.invoiceDate, d = dd ? Math.floor((today - new Date(dd)) / 864e5) : 0, c = cl[x.client] = cl[x.client] || [0, 0, 0, 0, 0, 0];
      BK.forEach(function (b, i) { if (d >= b[1] && d <= b[2]) c[i] += x.bal; }); c[5] += x.bal;
    });
    var names = Object.keys(cl).sort(function (a, b) { return cl[b][5] - cl[a][5]; }), T = [0, 0, 0, 0, 0, 0];
    names.forEach(function (n) { cl[n].forEach(function (v, i) { T[i] += v; }); });
    return { title: "AMC aging", sub: "What each client still owes on AMC invoices, by days past the due date, as at " + fd(todayStr()) + ".",
      csv: [["Client"].concat(BK.map(function (b) { return b[0]; })).concat(["Total"])].concat(names.map(function (n) { return [n].concat(cl[n].map(Math.round)); })),
      html: "<table class=\"fs-amcr-t\"><thead><tr><th>Client</th>" + BK.map(function (b) { return "<th class=\"num\">" + h(b[0]) + "</th>"; }).join("") + "<th class=\"num\">Total</th></tr></thead><tbody>" +
        (names.map(function (n) { return "<tr><td>" + h(n) + "</td>" + cl[n].map(function (v, i) { return "<td class=\"num" + (i >= 3 && v ? " bad" : "") + "\">" + (v ? money(v) : "") + "</td>"; }).join("") + "</tr>"; }).join("") || "<tr><td colspan=\"7\" class=\"muted\">Nothing outstanding.</td></tr>") +
        "</tbody><tfoot><tr><td>Total</td>" + T.map(function (v) { return "<td class=\"num\">" + money(v) + "</td>"; }).join("") + "</tr></tfoot></table>" };
  }

  function totals(I) {
    var rg = range(), M = months(rg[0], rg[1]), cl = {}, T = {};
    flt(I).forEach(function (x) { x.rc.forEach(function (q) { var mm = String(q.date || "").slice(0, 7); if (!q.posted || mm < rg[0] || mm > rg[1]) return; var c = cl[x.client] = cl[x.client] || {}; c[mm] = (c[mm] || 0) + q.amount; T[mm] = (T[mm] || 0) + q.amount; }); });
    var names = Object.keys(cl).sort(), sum = function (o) { return M.reduce(function (s, m) { return s + (o[m] || 0); }, 0); };
    return { title: "AMC total receipts", sub: "Posted AMC receipts by month, " + mName(rg[0]) + " to " + mName(rg[1]) + ".",
      csv: [["Client"].concat(M).concat(["Total"])].concat(names.map(function (n) { return [n].concat(M.map(function (m) { return Math.round(cl[n][m] || 0); })).concat([Math.round(sum(cl[n]))]); })).concat([["Total"].concat(M.map(function (m) { return Math.round(T[m] || 0); })).concat([Math.round(sum(T))])]),
      html: "<table class=\"fs-amcr-t\"><thead><tr><th>Client</th>" + M.map(function (m) { return "<th class=\"num\">" + h(mName(m)) + "</th>"; }).join("") + "<th class=\"num\">Total</th></tr></thead><tbody>" +
        (names.map(function (n) { return "<tr><td>" + h(n) + "</td>" + M.map(function (m) { return "<td class=\"num\">" + (cl[n][m] ? money(cl[n][m]) : "") + "</td>"; }).join("") + "<td class=\"num\"><b>" + money(sum(cl[n])) + "</b></td></tr>"; }).join("") || "<tr><td colspan=\"" + (M.length + 2) + "\" class=\"muted\">No receipts in this period.</td></tr>") +
        "</tbody><tfoot><tr><td>Total</td>" + M.map(function (m) { return "<td class=\"num\">" + money(T[m] || 0) + "</td>"; }).join("") + "<td class=\"num\">" + money(sum(T)) + "</td></tr></tfoot></table>" };
  }

  function report() { var I = invs(); return ({ matrix: matrix, rec: recList, ledger: ledger, age: aging, tot: totals }[ST.r] || matrix)(I); }
  function view() {
    var I = invs(), R = report();
    return ctls(I) + "<h3 style=\"margin:8px 0 2px\">" + h(R.title) + "</h3><p class=\"muted\" style=\"margin:0 0 8px\">" + h(R.sub) + "</p><div class=\"panel tw fs-amcr\">" + R.html + "</div>";
  }
  function printIt() {
    var R = report(), co = safe(function () { return V.ent && V.ent !== "All" ? V.ent : "HSEC"; }, "");
    safe(function () { sheetOpen("<div class=\"sheetwrap\"><div class=\"sheet fs-amcr-sheet\"><div class=\"bar\"><button class=\"btn pri\" id=\"printSheet\">Print</button><button class=\"btn\" id=\"closeSheet\">Close</button></div><h2>" + h(R.title) + "</h2><p class=\"muted\">" + h(co) + " · Generated on " + h(new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })) + "</p><p>" + h(R.sub) + "</p><div class=\"fs-amcr\">" + R.html + "</div></div></div>"); }, null);
  }
  function csvIt() {
    var R = report(); if (!R.csv || !R.csv.length) return;
    var txt = R.csv.map(function (row) { return row.map(function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? "\"" + v.replace(/"/g, "\"\"") + "\"" : v; }).join(","); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv" })); a.download = R.title.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-") + ".csv"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-amcr],#amcrPrint,#amcrCsv"); if (!t) return; e.preventDefault();
    if (t.id === "amcrPrint") return printIt();
    if (t.id === "amcrCsv") return csvIt();
    ST.r = t.getAttribute("data-amcr"); safe(function () { render(); }, null);
  });
  document.addEventListener("change", function (e) {
    var id = e.target && e.target.id; if (["amcrFrom", "amcrTo", "amcrCl"].indexOf(id) < 0) return;
    if (id === "amcrFrom") ST.from = e.target.value; if (id === "amcrTo") ST.to = e.target.value; if (id === "amcrCl") ST.client = e.target.value;
    safe(function () { render(); }, null);
  });

  var hooked = false;
  function hook() {
    if (hooked) return true;
    if (typeof special !== "function" || typeof NAV === "undefined" || typeof MODS === "undefined" || !MODS.proj || !MODS.rpt || typeof Store === "undefined") return false;
    hooked = true;
    special = (function (old) { return function (tab) { return tab === "amcrpt" ? safe(view, "<p class=\"muted\">Could not build the AMC report.</p>") : old.apply(this, arguments); }; })(special); // eslint-disable-line no-global-assign
    if (!MODS.proj.tabs.some(function (t) { return t[0] === "amcrpt"; })) MODS.proj.tabs.push(["amcrpt", "AMC reports"]);
    if (!MODS.rpt.tabs.some(function (t) { return t[0] === "amcrpt"; })) MODS.rpt.tabs.push(["amcrpt", "AMC reports"]);
    safe(function () { if (!TAB_HOME.amcrpt) TAB_HOME.amcrpt = "proj"; }, null);
    // its own menu area, so Users and access can give AMC alone (hassan, 2026-11-04: "AMC is not appearing")
    if (!MODS.amcm) {
      MODS.amcm = { sub: "Maintenance contracts: set them up, bill them each month and see who has paid", tabs: [["amc", "AMC billing"], ["amcrpt", "AMC reports"], ["projects", "AMC contracts"]] };
      safe(function () { var g = NAV.find(function (x) { return x[0] === "Projects"; }); if (g && !g[1].some(function (i) { return i[0] === "amcm"; })) g[1].push(["amcm", "AMC (maintenance contracts)"]); }, null);
      // a new contract from this area is a maintenance contract
      // An AMC-only person (AMC area, without Project financial management or Business cycle) works only on maintenance
      // contracts and spare parts supply (the server enforces it too: hsec_amc_scope): other project types are not offered.
      var AMC_T = ["Maintenance contract (AMC)", "Supply only"];
      var amcOnly = function () { var m = window.FS_MODS; return !!(m && m.indexOf("amcm") >= 0 && m.indexOf("proj") < 0 && m.indexOf("pw") < 0); };
      safe(function () {
        var oF = openForm;
        openForm = function (c, id, pre) { // eslint-disable-line no-global-assign
          if (c === "projects" && !id && (V.mod === "amcm" || amcOnly())) pre = Object.assign({ type: AMC_T[0] }, pre || {});
          var out = oF.call(this, c, id, pre);
          if (c === "projects") safe(shapeProj, null);
          if (c === "projects" && amcOnly()) safe(function () {
            var s = document.getElementById("f_type"); if (!s) return;
            Array.prototype.slice.call(s.options).forEach(function (o) { if (AMC_T.indexOf(o.value) < 0) o.remove(); });
            if (AMC_T.indexOf(s.value) < 0) s.value = AMC_T[0];
          }, null);
          return out;
        };
      }, null);
      safe(function () { TITLE.amcm = "AMC (maintenance contracts)"; NS_ALIAS.amcm = "amc maintenance contract annual service billing recurring"; }, null);
    }
    safe(function () { render(); }, null);
    return true;
  }
  // The project form for maintenance contracts and spare parts supply (hassan, 2026-11-04: "for amc and spare parts
  // supply the form should be changed and precise"): only the fields those jobs use are shown; the others stay hidden
  // (their values are kept). Choosing another type shows the full form again. An AMC's contract value is worked out
  // from the monthly fee and the AMC dates until it is typed by hand.
  var PF_KEEP = {
    "Maintenance contract (AMC)": ["code", "name", "customer", "entity", "type", "province", "amcFee", "amcFreq", "amcTaxPct", "amcStart", "amcEnd", "contractValue", "pm", "status"],
    "Supply only": ["code", "name", "customer", "entity", "type", "currency", "contractFc", "fxRate", "contractValue", "paymentTerms", "start", "end", "pm", "status"]
  };
  var PF_BOX = { "Maintenance contract (AMC)": ["fsMsBox", "fsGtBox", "calcBox"], "Supply only": ["fsGtBox"] };
  var PF_LBL = {
    "Maintenance contract (AMC)": { contractValue: "Contract value for the whole AMC period (PKR)", pm: "Service engineer / account manager" },
    "Supply only": { start: "Order date", end: "Delivery date", pm: "Sales / supply person", contractValue: "Order value (PKR)" }
  };
  function pfLabel(w, txt) {
    var lab = w.querySelector("label") || w.firstElementChild; if (!lab) return;
    var t = null; for (var i = 0; i < lab.childNodes.length; i++) if (lab.childNodes[i].nodeType === 3 && lab.childNodes[i].nodeValue.trim()) { t = lab.childNodes[i]; break; }
    if (!t) return;
    if (lab.getAttribute("data-fs-orig") == null) lab.setAttribute("data-fs-orig", t.nodeValue);
    var o = lab.getAttribute("data-fs-orig");
    t.nodeValue = txt == null ? o : txt + (/\*\s*$/.test(o) ? " *" : "") + (/\s$/.test(o) ? " " : "");
  }
  function shapeProj() {
    var s = document.getElementById("f_type"), f = document.getElementById("frm");
    if (!s || !f || !document.getElementById("f_amcFee")) return;
    var keep = PF_KEEP[s.value], lbl = PF_LBL[s.value] || {}, box = PF_BOX[s.value] || [];
    f.querySelectorAll("[id^=f_]").forEach(function (e) {
      var k = e.id.slice(2), w = e.closest(".f"); if (!w || !f.contains(w)) return;
      w.classList.toggle("fs-pf-hide", !!keep && keep.indexOf(k) < 0);
      pfLabel(w, lbl[k]);
    });
    budgetSync();
    ["fsMsBox", "fsGtBox", "calcBox"].forEach(function (id) { var b = document.getElementById(id); if (b) b.classList.toggle("fs-pf-hide", box.indexOf(id) >= 0); });
  }
  // Budgeted cost is required by the app but not asked for these jobs (hassan, 2026-11-04): while it is hidden it
  // follows the contract value, unless someone typed a different figure before.
  function budgetSync() {
    var s = document.getElementById("f_type"), cv = document.getElementById("f_contractValue"), bc = document.getElementById("f_budgetCost");
    if (!s || !cv || !bc || !PF_KEEP[s.value]) return;
    if (bc.value && bc.getAttribute("data-fs-auto") !== bc.value) return;
    bc.value = cv.value; bc.setAttribute("data-fs-auto", bc.value);
    bc.dispatchEvent(new Event("input", { bubbles: true }));
  }
  document.addEventListener("input", function (e) { if (e.target && e.target.id === "f_contractValue") safe(budgetSync, null); });
  // the "Fill in:" message must not ask for a field that is hidden on this form
  (function errWatch() {
    if (!document.body) return setTimeout(errWatch, 300);
    new MutationObserver(function () {
      var er = document.getElementById("ferr"), f = document.getElementById("frm"); if (!er || !f || !/Fill in:/.test(er.textContent)) return;
      var hid = []; f.querySelectorAll(".f.fs-pf-hide").forEach(function (w) { var l = w.querySelector("label") || w.firstElementChild; if (l) hid.push((l.getAttribute("data-fs-orig") || l.textContent).replace(/\*/g, "").trim()); });
      if (!hid.length) return;
      var parts = er.textContent.replace(/^\s*Fill in:\s*/, "").replace(/\.\s*$/, "").split(/,\s*/).filter(function (p) { return hid.indexOf(p.replace(/\*/g, "").trim()) < 0; });
      var t = parts.length ? "Fill in: " + parts.join(", ") + "." : "";
      if (t !== er.textContent) er.textContent = t;
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  })();
  function amcValue() {
    var s = document.getElementById("f_type"), cv = document.getElementById("f_contractValue");
    if (!s || !cv || s.value !== "Maintenance contract (AMC)") return;
    var fee = parseFloat(String((document.getElementById("f_amcFee") || {}).value || "").replace(/,/g, "")) || 0;
    var a = String((document.getElementById("f_amcStart") || {}).value || ""), b = String((document.getElementById("f_amcEnd") || {}).value || "");
    if (!fee || !/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || b < a) return;
    var months = Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000 / 30.44));
    if (cv.value && cv.getAttribute("data-fs-auto") !== cv.value) return; // typed by hand: leave it
    var v = String(Math.round(fee * months)); cv.value = v; cv.setAttribute("data-fs-auto", v);
    cv.dispatchEvent(new Event("input", { bubbles: true }));
    budgetSync();
  }
  document.addEventListener("change", function (e) {
    if (!e.target || !e.target.id) return;
    if (e.target.id === "f_type") { safe(shapeProj, null); setTimeout(function () { safe(shapeProj, null); safe(amcValue, null); }, 0); }
    if (/^f_amc(Fee|Start|End)$/.test(e.target.id)) safe(amcValue, null);
  });

  var css = document.createElement("style");
  css.textContent = ".fs-pf-hide{display:none!important}.fs-amcr-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.fs-amcr-ctl{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}.fs-amcr-ctl label{display:flex;flex-direction:column;font-size:12px;gap:3px}" +
    ".fs-amcr{overflow:auto}.fs-amcr-t{border-collapse:collapse;width:100%;font-size:12.5px}.fs-amcr-t th,.fs-amcr-t td{border:1px solid #d5dbe2;padding:4px 6px;text-align:left;white-space:nowrap}.fs-amcr-t th{background:#eef1f5}.fs-amcr-t .num{text-align:right}.fs-amcr-t .c{text-align:center}" +
    ".fs-amcr-t td.rc,.fs-amcr-t th.rc{background:#f2faf4}.fs-amcr-t tfoot td{font-weight:700;background:#f6f8fa}.fs-amcr-t td.bad{color:#b0412e;font-weight:600}.fs-amcr-t .warn{color:#9a5b00}" +
    ".fs-amcr-info{border:1px solid #c9d1da;padding:8px 12px;margin:0 0 10px}.fs-amcr-g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.fs-amcr-g div{display:flex;flex-direction:column}.fs-amcr-g small{color:#556;font-weight:600}" +
    ".fs-amcr h4{margin:10px 0 4px}.fs-amcr-sheet{max-width:1100px}@media print{.fs-amcr-t th,.fs-amcr-t td{font-size:9.5px;padding:3px 4px}}@media (max-width:760px){.fs-amcr-g{grid-template-columns:1fr 1fr}}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 400); }
  start();
})();
