// AMC billing by month range, client and lump sum, and bulk printing (arrears built, then switched off at hassan's ask) (hassan, 2026-11-04: "while invoice is
// created invoice is not showed in printable in months; give month wise to and from so that multiple invoices can be made
// and give bulk printing option; also give drop down of client wise detail and on that also give all option to make
// invoices lumpsum of all the projects; and while creating the invoice if previous invoice is unpaid then balance should
// be moved in arrears and total invoice should be changed; use invoicing template same as HSEC but with the JSPL letterhead").
//  * Receivables / AMC › AMC billing: "Create AMC invoices" takes a client (or all clients), a From and To month and
//    either one invoice per contract or one lump-sum invoice per client per month (all that client's contracts on it).
//    It lists what will be made, with arrears, before anything is created.
//  * Each contract still gets its own invoice record (ledger, aging, statements and AMC reports stay per project). A
//    lump-sum invoice is those records printed as one document, numbered with their invoice numbers.
//  * Arrears: the unpaid balance of earlier invoices of the same contract(s) at the time the invoice is made. It is
//    printed under the invoice total with "Total amount payable"; it is NOT posted again (it is already in debtors).
//  * "Invoices made" lists every AMC invoice in the range with Letterhead / Plain print buttons, tick boxes and
//    "Print ticked" (one print, each invoice on its own page). Printing uses the normal invoice template and the
//    company's letterhead (the imported JSPL letterhead for JSPL).
(function () {
  /* global Store, V, byEnt, amcDue, amcTax, AMC_STEP, ivNextNo, ivCo, ivDoc, ivBody, ivWords, ivAmt, outAR, monthB, iso, addDays, fdate, idc, makeAutoJv, approverName, todayStr, esc, fmt, toast, render, sheetOpen, amcView, ENTS */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var num = function (v) { return parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0; };
  var money = function (v) { return safe(function () { return fmt(v); }, String(Math.round(v))); };
  var AMC = "Maintenance contract (AMC)";
  var MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var mLabel = function (m) { return MN[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); };
  var addM = function (m, k) { var d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + k, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  var cur = function () { return safe(function () { return todayStr().slice(0, 7); }, new Date().toISOString().slice(0, 7)); };
  var ST = { from: "", to: "", cli: "", mode: "each", sel: {} };

  var client = function (p) { return String(p.customer || "").trim() || String(p.name || "").trim(); };
  function contracts() { return safe(function () { return byEnt(Store.data.projects).filter(function (p) { return p.type === AMC; }); }, []); }
  function months() {
    var a = ST.from || cur(), b = ST.to || a, out = [];
    if (b < a) { var t = a; a = b; b = t; }
    for (var m = a; m <= b && out.length < 36; m = addM(m, 1)) out.push(m);
    return out;
  }
  var projOf = function (r) { return String(r.amcKey || "").split("|")[0] || r.projectId; };
  var billedKey = function (p, m) { return safe(function () { return Store.data.receivables.find(function (r) { return r.amcKey === p.id + "|" + m && r.status !== "Void"; }); }, null); };
  // unpaid balance of earlier invoices of these contracts
  // hassan, 2026-11-04 ("ignore the arrears"): switched off; invoices carry only their own charge
  var ARREARS = false;
  function arrears(ids, date, skip) {
    var refs = [], amt = 0;
    if (!ARREARS) return { amt: 0, refs: refs };
    safe(function () {
      Store.data.receivables.forEach(function (r) {
        if (r.status === "Void" || ids.indexOf(projOf(r)) < 0 || !(String(r.invoiceDate || "") < date) || (skip && skip.indexOf(r.id) >= 0)) return;
        var b = Math.round(safe(function () { return outAR(r); }, 0)); if (b <= 0) return;
        amt += b; refs.push({ no: r.invoiceNo || "", date: r.invoiceDate || "", bal: b });
      });
    }, null);
    refs.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    return { amt: amt, refs: refs };
  }
  // what "Create" would make: [{key, client, entity, m, tax, items:[p]}]
  function plan() {
    var L = contracts().filter(function (p) { return !ST.cli || client(p) === ST.cli; }), G = [], by = {};
    months().forEach(function (m) {
      L.forEach(function (p) {
        if (!safe(function () { return amcDue(p, m); }, false) || billedKey(p, m)) return;
        var tx = safe(function () { return amcTax(p); }, 0), k = ST.mode === "lump" ? [client(p), p.entity, m, tx].join("|") : p.id + "|" + m;
        if (!by[k]) { by[k] = { key: k, client: client(p), entity: p.entity, m: m, tax: tx, items: [] }; G.push(by[k]); }
        by[k].items.push(p);
      });
    });
    return G;
  }
  function charge(p) { var k = safe(function () { return AMC_STEP[p.amcFreq]; }, 1) || 1, sub = Math.round(num(p.amcFee) * k); return { k: k, sub: sub }; }

  function line(p, m, k) {
    var u = num(p.amcUnits), rt = num(p.amcRate), fee = num(p.amcFee), per = k > 1 ? (p.amcFreq || "") + " charge, " + mLabel(m) + " to " + mLabel(addM(m, k - 1)) : "Monthly charge for " + mLabel(m);
    var specs = [p.code ? "Contract: " + p.code : "", num(p.amcFloors) ? "Floors: " + p.amcFloors : "", u ? "Units (lifts): " + u : "", u && rt ? "Rate per unit per month: " + money(rt) : "", k > 1 ? "Months: " + k : ""].filter(Boolean).join("; ");
    var byUnit = u && rt && Math.abs(u * rt - fee) < 0.5;
    return { name: "Annual maintenance services – " + (p.name || "") + " – " + per, specs: specs, qty: byUnit ? u * k : k, unit: byUnit ? rt : fee };
  }
  async function create(G) {
    var name = safe(function () { return approverName(); }, "") || "Accounts", made = [];
    for (var gi = 0; gi < G.length; gi++) {
      var g = G[gi], s = monthB(g.m).s, date = iso(s), gid = g.items.length > 1 ? "AMCG-" + g.entity + "-" + g.m + "-" + Date.now().toString(36) + gi : "";
      for (var i = 0; i < g.items.length; i++) {
        var p = g.items[i], c = charge(p), tx = Math.round(c.sub * g.tax / 100), ar = arrears([p.id], date);
        var rec = { entity: p.entity, projectId: p.id, customer: p.name, project: p.code, invoiceNo: ivNextNo(p.entity), invoiceDate: date, dueDate: iso(addDays(s, 30)), amount: c.sub + tx, outputTax: tx,
          revAccount: idc("410201"), taxAcc: idc("220304"), status: "Open", amcKey: p.id + "|" + g.m,
          doc: { layout: "standard", title: tx ? "SALES TAX INVOICE" : "INVOICE", to: { name: g.client, address: "", attn: "" }, poRef: p.code || "", poDate: "", lines: [line(p, g.m, c.k)], taxPct: g.tax, taxLabel: "Sales tax on services", notes: "", bank: "", signoff: "For and on behalf of\n" + ivCo(p.entity),
            arrears: ar.amt ? { amt: ar.amt, refs: ar.refs, asOf: todayStr() } : null } };
        if (gid) rec.amcGroup = gid;
        rec.id = await Store.save("receivables", rec);
        var j = await makeAutoJv("receivables", rec, "invoice", null, name); rec.jvId = j.id; await Store.save("receivables", rec);
        made.push(rec.invoiceNo);
      }
    }
    return made;
  }

  // ---- printing: arrears under the total; a lump-sum group as one document
  function hookBody() {
    var old = ivBody;
    ivBody = function (M) { // eslint-disable-line no-global-assign
      var html = old.apply(this, arguments), A = M && M.d && M.d.arrears;
      if (!A || !(num(A.amt) > 0)) return html;
      return safe(function () {
        var nc = M.ms ? 4 : 5, pay = M.T.total + num(A.amt), at = html.indexOf("<tr><td colspan=\"" + nc + "\"><b>IN WORDS:</b>");
        if (at < 0) return html;
        var refs = (A.refs || []).map(function (x) { return h(x.no) + " (" + h(safe(function () { return fdate(x.date); }, x.date)) + ") " + money(x.bal); }).join("; ");
        var rows = "<tr><td colspan=\"" + (nc - 1) + "\" class=\"r\">Arrears: unpaid balance of previous invoices (PKR)</td><td class=\"r\">" + ivAmt(A.amt) + "</td></tr>" +
          "<tr class=\"iv-tot\"><td colspan=\"" + (nc - 1) + "\" class=\"r\">Total Amount Payable (PKR)</td><td class=\"r\">" + ivAmt(pay) + "</td></tr>" +
          (refs ? "<tr><td colspan=\"" + nc + "\" style=\"font-size:10.5px\"><b>Previous unpaid invoices:</b> " + refs + "</td></tr>" : "");
        return (html.slice(0, at) + rows + html.slice(at)).replace(/(<b>IN WORDS:<\/b> )[^<]*/, "$1" + h(ivWords(pay)));
      }, html);
    };
  }
  function group(gid) { return safe(function () { return Store.data.receivables.filter(function (r) { return r.amcGroup === gid && r.status !== "Void"; }); }, []).sort(function (a, b) { return String(a.invoiceNo).localeCompare(String(b.invoiceNo)); }); }
  // a printable record: the invoice itself, or its lump-sum group merged into one document
  function printable(r) {
    var G = r.amcGroup ? group(r.amcGroup) : [r]; if (G.length < 2) return r;
    var f = G[0], d0 = f.doc || {}, lines = [], ar = { amt: 0, refs: [] };
    G.forEach(function (x) {
      ((x.doc || {}).lines || []).forEach(function (l) { lines.push(Object.assign({}, l, { specs: ["Invoice: " + (x.invoiceNo || "")].concat(l.specs ? [l.specs] : []).join("; ") })); });
      var a = (x.doc || {}).arrears; if (a && num(a.amt) > 0) { ar.amt += num(a.amt); ar.refs = ar.refs.concat(a.refs || []); }
    });
    ar.refs.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.no).localeCompare(String(b.no)); });
    var nos = G.map(function (x) { return x.invoiceNo; });
    return { id: f.id, entity: f.entity, customer: (d0.to || {}).name || f.customer, project: "", invoiceNo: nos.length > 2 ? nos[0] + " to " + nos[nos.length - 1] : nos.join(", "), invoiceDate: f.invoiceDate, dueDate: f.dueDate,
      doc: Object.assign({}, d0, { poRef: "", lines: lines, arrears: ar.amt ? ar : null }) };
  }
  function printSet(R, lh) {
    var ents = {}; R.forEach(function (r) { ents[r.entity] = 1; });
    if (Object.keys(ents).length > 1) { safe(function () { toast("Tick invoices of one company at a time: each company prints on its own letterhead."); }, null); return; }
    var html = R.map(function (r, i) { return (i ? "<div style=\"break-before:page;page-break-before:always\"></div>" : "") + ivDoc(r, lh); }).join("");
    sheetOpen(html);
    var s = document.querySelector("#printLayer .sheet"); if (s) s.classList.add("qsheet");
    safe(function () { toast(R.length + " invoice" + (R.length === 1 ? "" : "s") + " open " + (lh ? "on the letterhead" : "on plain paper") + ". Each prints on its own page."); }, null);
  }

  // ---- the AMC billing screen
  function made() {
    var M = months(), ids = {};
    contracts().forEach(function (p) { if (!ST.cli || client(p) === ST.cli) ids[p.id] = p; });
    var R = safe(function () { return byEnt(Store.data.receivables); }, []).filter(function (r) {
      if (r.status === "Void" || !r.amcKey) return false; var k = String(r.amcKey).split("|"); return ids[k[0]] && M.indexOf(k[1]) >= 0;
    });
    var seen = {}, out = [];
    R.sort(function (a, b) { return String(a.invoiceDate).localeCompare(String(b.invoiceDate)) || String(a.invoiceNo).localeCompare(String(b.invoiceNo)); }).forEach(function (r) {
      if (r.amcGroup) { if (seen[r.amcGroup]) return; seen[r.amcGroup] = 1; }
      var G = r.amcGroup ? group(r.amcGroup) : [r], P = G.map(function (x) { return ids[projOf(x)] || {}; });
      var amt = G.reduce(function (t, x) { return t + num(x.amount); }, 0), ar = G.reduce(function (t, x) { return t + num(((x.doc || {}).arrears || {}).amt); }, 0), o = G.reduce(function (t, x) { return t + safe(function () { return outAR(x); }, 0); }, 0);
      out.push({ r: r, G: G, P: P, m: String(r.amcKey).split("|")[1], amt: amt, ar: ar, out: o });
    });
    return out;
  }
  function view() {
    var C = contracts(), clients = {}; C.forEach(function (p) { clients[client(p)] = 1; });
    var M = months(), G = plan(), n = G.reduce(function (t, g) { return t + g.items.length; }, 0);
    var opts = "<option value=\"\">All clients</option>" + Object.keys(clients).sort().map(function (c) { return "<option" + (ST.cli === c ? " selected" : "") + ">" + h(c) + "</option>"; }).join("");
    var prev = G.map(function (g) {
      var sub = g.items.reduce(function (t, p) { return t + charge(p).sub; }, 0), tx = g.items.reduce(function (t, p) { return t + Math.round(charge(p).sub * g.tax / 100); }, 0);
      return "<tr><td>" + h(mLabel(g.m)) + "</td><td>" + h(g.client) + "</td><td>" + g.items.map(function (p) { return h(p.name) + " <span class=\"muted\">" + h(p.code || "") + "</span>"; }).join("<br>") + "</td><td class=\"num\"><b>" + money(sub + tx) + "</b></td></tr>";
    }).join("");
    var card = "<div class=\"card fs-ab\"><h3>Create AMC invoices</h3><div class=\"ctls fs-ab-ctl\">" +
      "<label>Client <select id=\"fsAbCli\">" + opts + "</select></label>" +
      "<label>From month <input type=\"month\" id=\"fsAbFrom\" value=\"" + h(M[0]) + "\"></label><label>To month <input type=\"month\" id=\"fsAbTo\" value=\"" + h(M[M.length - 1]) + "\"></label>" +
      "<label>Invoices <select id=\"fsAbMode\"><option value=\"each\"" + (ST.mode === "each" ? " selected" : "") + ">One per contract</option><option value=\"lump\"" + (ST.mode === "lump" ? " selected" : "") + ">Lump sum: one per client per month (all projects)</option></select></label></div>" +
      "<p class=\"muted\">" + (G.length ? G.length + " invoice" + (G.length === 1 ? "" : "s") + " to make (" + n + " contract-month" + (n === 1 ? "" : "s") + ")." : "Nothing left to bill for " + h(mLabel(M[0])) + (M.length > 1 ? " to " + h(mLabel(M[M.length - 1])) : "") + ".") +
      "</p>" +
      (G.length ? "<div class=\"tw\"><table class=\"fs-ab-t\"><thead><tr><th>Month</th><th>Client</th><th>Contracts</th><th class=\"num\">Invoice amount (with tax)</th></tr></thead><tbody>" + prev + "</tbody></table></div>" +
        "<div class=\"actions\"><button type=\"button\" class=\"btn pri\" id=\"fsAbGo\">Create " + G.length + " invoice" + (G.length === 1 ? "" : "s") + "</button></div>" : "") +
      "<p class=\"err\" id=\"fsAbErr\"></p></div>";
    var D = made(), tot = function (k) { return D.reduce(function (t, x) { return t + x[k]; }, 0); };
    var list = "<div class=\"card fs-ab\"><h3>Invoices made: " + h(mLabel(M[0])) + (M.length > 1 ? " to " + h(mLabel(M[M.length - 1])) : "") + (ST.cli ? " · " + h(ST.cli) : "") + "</h3>" +
      (D.length ? "<div class=\"actions\" style=\"margin-bottom:8px\"><button type=\"button\" class=\"btn pri\" data-abbulk=\"1\">Print ticked on letterhead</button> <button type=\"button\" class=\"btn\" data-abbulk=\"0\">Print ticked on plain paper</button> <span class=\"muted\" id=\"fsAbN\"></span></div>" : "") +
      "<div class=\"tw\"><table class=\"fs-ab-t\"><thead><tr><th><input type=\"checkbox\" id=\"fsAbAll\" title=\"Tick all\"></th><th>Invoice</th><th>Month</th><th>Client</th><th>Contracts</th><th class=\"num\">Amount (with tax)</th><th class=\"num\">Unpaid now</th><th>Print</th></tr></thead><tbody>" +
      (D.map(function (x) {
        var id = x.r.id, nos = x.G.map(function (g) { return g.invoiceNo; });
        return "<tr><td><input type=\"checkbox\" class=\"fsAbCk\" value=\"" + h(id) + "\"" + (ST.sel[id] ? " checked" : "") + "></td><td class=\"mono\"><b>" + h(nos.length > 2 ? nos[0] + " to " + nos[nos.length - 1] : nos.join(", ")) + "</b>" + (x.G.length > 1 ? "<br><small class=\"muted\">Lump sum, " + x.G.length + " contracts</small>" : "") + "</td>" +
          "<td>" + h(mLabel(x.m)) + "</td><td>" + h(((x.r.doc || {}).to || {}).name || x.r.customer || "") + "</td><td>" + x.P.map(function (p) { return h(p.name || ""); }).join("<br>") + "</td>" +
          "<td class=\"num\"><b>" + money(x.amt) + "</b></td><td class=\"num\">" + money(x.out) + "</td>" +
          "<td style=\"white-space:nowrap\"><button type=\"button\" class=\"btn sm pri\" data-abprint=\"" + h(id) + "\" data-lh=\"1\">Letterhead</button> <button type=\"button\" class=\"btn sm\" data-abprint=\"" + h(id) + "\" data-lh=\"0\">Plain</button></td></tr>";
      }).join("") || "<tr><td colspan=\"8\" class=\"muted\">No AMC invoices in these months yet.</td></tr>") + "</tbody>" +
      (D.length > 1 ? "<tfoot><tr><td colspan=\"5\"><b>Total</b></td><td class=\"num\"><b>" + money(tot("amt")) + "</b></td><td class=\"num\"><b>" + money(tot("out")) + "</b></td><td></td></tr></tfoot>" : "") + "</table></div></div>";
    return { card: card, list: list };
  }
  var CUT = function (html, startMark, endMark) { var a = html.indexOf(startMark); if (a < 0) return null; var b = html.indexOf(endMark, a); if (b < 0) return null; return [a, b + endMark.length]; };
  function hookView() {
    var old = amcView;
    amcView = function () { // eslint-disable-line no-global-assign
      var html = old.apply(this, arguments);
      return safe(function () {
        if (!ST.from) { ST.from = (V.amcM || cur()); ST.to = ST.from; }
        var v = view(), c = CUT(html, "<div class=\"card\"><h3>Bill a month</h3>", "<p class=\"err\" id=\"docErr\"></p></div>");
        if (c) html = html.slice(0, c[0]) + v.card + html.slice(c[1]); else html = v.card + html;
        var t = CUT(html, "<div class=\"tw\"><table><thead><tr><th>Contract (project)</th>", "</tbody></table></div>");
        return t ? html.slice(0, t[1]) + v.list + html.slice(t[1]) : html + v.list;
      }, html);
    };
  }

  document.addEventListener("change", function (e) {
    var id = e.target && e.target.id;
    if (id === "fsAbCli") { ST.cli = e.target.value; safe(render, null); }
    else if (id === "fsAbFrom" || id === "fsAbTo") {
      if (!e.target.value) return;
      ST[id === "fsAbFrom" ? "from" : "to"] = e.target.value;
      if (ST.to < ST.from) { if (id === "fsAbFrom") ST.to = ST.from; else ST.from = ST.to; }
      safe(function () { V.amcM = ST.to; }, null); safe(render, null);
    }
    else if (id === "fsAbMode") { ST.mode = e.target.value; safe(render, null); }
    else if (id === "fsAbAll") { document.querySelectorAll(".fsAbCk").forEach(function (c) { c.checked = e.target.checked; ST.sel[c.value] = c.checked; }); count(); }
    else if (e.target.classList && e.target.classList.contains("fsAbCk")) { ST.sel[e.target.value] = e.target.checked; count(); }
  });
  function count() { var n = document.querySelectorAll(".fsAbCk:checked").length, s = document.getElementById("fsAbN"); if (s) s.textContent = n ? n + " ticked" : "Tick the invoices to print together"; }
  var busy = false;
  document.addEventListener("click", async function (e) {
    var b = e.target.closest && e.target.closest("#fsAbGo,[data-abprint],[data-abbulk]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var find = function (id) { return safe(function () { return Store.data.receivables.find(function (r) { return r.id === id; }); }, null); };
    if (b.hasAttribute("data-abprint")) { var r = find(b.getAttribute("data-abprint")); if (r) printSet([printable(r)], b.getAttribute("data-lh") === "1"); return; }
    if (b.hasAttribute("data-abbulk")) {
      var R = []; document.querySelectorAll(".fsAbCk:checked").forEach(function (c) { var x = find(c.value); if (x) R.push(printable(x)); });
      if (!R.length) { var s = document.getElementById("fsAbN"); if (s) s.textContent = "Tick at least one invoice first."; return; }
      printSet(R, b.getAttribute("data-abbulk") === "1"); return;
    }
    if (busy) return;
    var G = plan(); if (!G.length) return;
    if (!confirm("Create " + G.length + " AMC invoice" + (G.length === 1 ? "" : "s") + "? Each posts Dr debtors / Cr AMC revenue and sales tax and waits for signature.")) return;
    busy = true; b.disabled = true; b.textContent = "Creating…";
    try {
      var M = await create(G);
      safe(function () { toast(M.length + " AMC invoice" + (M.length === 1 ? "" : "s") + " created: " + M.join(", ") + ". Vouchers wait for signature."); }, null);
    } catch (er) { var el = document.getElementById("fsAbErr"); if (el) el.textContent = (er && er.message) || "Could not create the invoices."; }
    busy = false; safe(render, null);
  }, true);

  var hooked = false;
  function hook() {
    if (hooked) return true;
    if (typeof amcView !== "function" || typeof ivBody !== "function" || typeof Store === "undefined" || typeof makeAutoJv !== "function") return false;
    hooked = true; hookView(); if (ARREARS) hookBody(); safe(render, null); return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-ab{margin:12px 0}.fs-ab-ctl{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}.fs-ab-ctl label{display:flex;flex-direction:column;gap:3px;font-size:12.5px}" +
    ".fs-ab-t{width:100%;border-collapse:collapse}.fs-ab-t th,.fs-ab-t td{padding:7px 9px;border-bottom:1px solid #e6eaef;text-align:left;vertical-align:top}.fs-ab-t .num{text-align:right}.fs-ab-t tfoot td{background:#f6f8fa}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 400); }
  start();
})();
