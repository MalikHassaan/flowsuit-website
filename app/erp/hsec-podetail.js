// Purchase order details (hassan, 2026-11-03: "need this kind ... on po screen", with a sample from another ERP).
//  * Procurement › Purchase orders list gains Initiator, Expected delivery and "Currently with" (who has to act next).
//  * Every PO (a "Details" button in the list and "Purchase order details" on the PO form) opens one window with tabs:
//    Purchase order (printable PO: company, vendor, PO no., dates, status, cost centre, quotation ref, indent ref and
//    the items at the chosen vendor's rates), GRN(s), Requisition, Comparative statement, Quotations (n), and
//    Bills & payments. Print prints the open tab.
//  * Workflow history lists every step from the requisition to the payment with who did it, when, how long the
//    record sat there (Held) and the remark. Status moves come from the server's change history (/hist), so steps
//    taken before this window existed still show; the rest comes from what each record keeps (store vetting,
//    comparative approvals, GRN posting, voucher approvals).
(function () {
  /* global Store, S, F, esc, fmt, n, fdate, coLabel, refName, termText, poFin, itemOf, sheetOpen, toast */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var num = function (v) { return parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0; };
  var money = function (v) { return safe(function () { return fmt(Math.round(v * 100) / 100); }, String(v)); };
  var CS = function () { return window.FS_CS || {}; };
  var D = function (c) { return safe(function () { return Store.data[c] || []; }, []); };
  var fd = function (d) { return d ? safe(function () { return fdate(d); }, d) : ""; };
  var when = function (x) { return x ? safe(function () { return new Date(x).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); }, x) : ""; };
  var person = function (id) { var p = (window.FS_SIGN || {}).people || {}; return id && p[id] ? p[id].name : ""; };
  var poById = function (id) { return D("pos").find(function (p) { return p.id === id; }); };
  var prOf = function (po) { return po && po.prRef ? D("requisitions").find(function (r) { return r.id === po.prRef; }) : null; };
  var vendOf = function (po) { return D("vendors").find(function (v) { return v.id === po.vendor; }) || { name: safe(function () { return refName("vendors", po.vendor); }, "") }; };
  var grns = function (po) { return D("invdocs").filter(function (d) { return d.po === po.id && d.type === "grn"; }); };
  var bills = function (po) { return D("payables").filter(function (b) { return b.po === po.id; }); };
  var advs = function (po) { return D("vadvances").filter(function (a) { return a.po === po.id; }); };
  var jv = function (id) { return id ? D("journals").find(function (j) { return j.id === id; }) : null; };
  var pays = function (po) {
    var ids = bills(po).map(function (b) { return b.id; });
    return ids.length ? D("journals").filter(function (j) { var s = j.source || {}; return s.c === "payables" && s.ev === "payment" && (s.ids || [s.id]).some(function (x) { return ids.indexOf(x) >= 0; }); }) : [];
  };
  var pill = function (t, cls) { return "<span class=\"fs-pdpill " + (cls || "") + "\">" + h(t) + "</span>"; };

  function initiator(po) { var r = prOf(po); return (r && (r.requestedBy || person(r.createdBy))) || person(po.createdBy) || ""; }
  // who has to act on the PO now, and why
  function withNow(po) {
    if (po.status === "Cancelled") return ["–", "Cancelled"];
    var f = safe(function () { return poFin(po); }, null) || {};
    if (f.st === "Complete") return ["Completed", ""];
    if (f.next === "post") return ["Finance approvers", "Advance voucher waiting for approval"];
    if (f.next === "adv") return ["Finance – Payables", "Pay the advance"];
    if (num(po.received) < num(po.amount) - 0.5 && ["Received", "Closed"].indexOf(po.status) < 0) return ["Store – goods receipt", num(po.received) > 0 ? "Part received" : "Waiting for delivery"];
    if (f.next === "bill") return ["Finance – Payables", "Enter the vendor bill"];
    if (f.next === "pay") return ["Finance – Payments", "Pay the bill"];
    return ["Finance", ""];
  }

  // the PO's lines: the requisition's items at the chosen vendor's rates, else one line for the PO value
  function lines(po) {
    var L = safe(function () { return CS().poLines(po); }, null);
    return L && L.length ? L : [{ i: po.description || "As per purchase order", s: "", q: 1, u: "", p: num(po.amount) }];
  }
  function quote(po) {
    var r = prOf(po), c = r && r.cs, k = c && c.pick != null ? c.pick : -1, v = k >= 0 && c.v ? c.v[k] : null;
    return v ? { v: v, k: k, ref: v.ref || (r.prNo || "PR") + "/Q" + (k + 1) } : null;
  }

  function head(po, title) {
    var lh = safe(function () { return window.FS_QTPL && window.FS_QTPL.company(po.entity); }, null);
    return (lh ? "<img src=\"" + lh.head + "\" alt=\"\" class=\"fs-pdlh\">" : "<div class=\"fs-pdco\">" + h(safe(function () { return coLabel(po.entity); }, po.entity || "")) + "</div>") +
      "<h2 class=\"fs-pdh\">" + h(title) + "</h2>";
  }
  function foot(po) { var lh = safe(function () { return window.FS_QTPL && window.FS_QTPL.company(po.entity); }, null); return lh && lh.foot ? "<img src=\"" + lh.foot + "\" alt=\"\" class=\"fs-pdlh\">" : ""; }
  var kv = function (rows) { return "<table class=\"fs-pdkv\">" + rows.map(function (x) { return "<tr><th>" + h(x[0]) + "</th><td>" + (x[2] ? x[1] : h(x[1] || "–")) + "</td></tr>"; }).join("") + "</table>"; };

  function tabPo(po) {
    var v = vendOf(po), r = prOf(po), q = quote(po), L = lines(po);
    var sub = L.reduce(function (s, l) { return s + l.q * l.p; }, 0), tax = q ? sub * num(q.v.tax) / 100 : 0, tot = sub + tax;
    var proj = safe(function () { return refName("projects", po.project || (r && r.project)); }, "") || (r && r.project) || "";
    var c = r && r.cs || {}, ap = c.appr || [];
    var sign = [["Prepared by", person(po.createdBy) || c.by || "", po.createdAt], ["Checked by (Finance)", ap[0] && ap[0].by, ap[0] && ap[0].at], ["Approved by", ap[1] && ap[1].by, ap[1] && ap[1].at], ["Vendor acceptance", "", ""]];
    return head(po, "PURCHASE ORDER") +
      "<div class=\"fs-pdgrid\"><div><h4>Vendor</h4>" + kv([["Name", v.name], ["Contact", v.contact], ["Phone", v.phone], ["Email", v.email], ["Address", v.address], ["NTN", v.ntn]]) + "</div>" +
      "<div><h4>Order</h4>" + kv([["PO number", po.poNo], ["Order date", fd(po.date)], ["Expected delivery", fd(po.delivery)], ["Status", po.status || "Open"], ["Cost centre", proj], ["Quotation ref", q ? q.ref + (q.v.date ? " (" + fd(q.v.date) + ")" : "") : ""], ["Requisition ref", r ? r.prNo : ""]]) + "</div></div>" +
      "<table class=\"fs-pdt\"><thead><tr><th style=\"width:34px\">S#</th><th>Item description</th><th class=\"num\">Qty</th><th>Unit</th><th class=\"num\">Unit price</th><th class=\"num\">Amount</th></tr></thead><tbody>" +
      L.map(function (l, i) { return "<tr><td>" + (i + 1) + "</td><td>" + h(l.i) + (l.s ? "<br><small>" + h(l.s) + "</small>" : "") + "</td><td class=\"num\">" + h(l.q) + "</td><td>" + h(l.u || "") + "</td><td class=\"num\">" + (l.p ? money(l.p) : "–") + "</td><td class=\"num\">" + (l.p ? money(l.p * l.q) : "–") + "</td></tr>"; }).join("") +
      (tax ? "<tr class=\"tot\"><td colspan=\"5\">Subtotal</td><td class=\"num\">" + money(sub) + "</td></tr><tr class=\"tot\"><td colspan=\"5\">Sales tax " + h(q.v.tax) + "%</td><td class=\"num\">" + money(tax) + "</td></tr>" : "") +
      "<tr class=\"tot\"><td colspan=\"5\"><b>Total (" + h(po.currency || "PKR") + ")</b></td><td class=\"num\"><b>" + money(tot) + "</b></td></tr>" +
      (Math.abs(tot - num(po.amount)) > 0.5 ? "<tr><td colspan=\"5\">PO value as entered</td><td class=\"num\">" + money(num(po.amount)) + "</td></tr>" : "") + "</tbody></table>" +
      kv([["Payment terms", safe(function () { return termText(po); }, "") || (q && q.v.terms) || ""], ["Delivery", q ? q.v.delivery : ""], ["Delivery place", (q && q.v.place) || (r && r.deliveryPlace) || ""], ["Notes", po.description]]) +
      "<table class=\"fs-pdsign\"><tr>" + sign.map(function (x) { return "<td><div class=\"fs-pdsg\">" + h(x[1] || "") + (x[2] ? "<br><small>" + h(when(x[2])) + "</small>" : "") + "</div><div class=\"ln\"></div>" + h(x[0]) + "</td>"; }).join("") + "</tr></table>" + foot(po);
  }

  function tabGrn(po) {
    var G = grns(po);
    var rows = G.map(function (d) {
      var j = jv(d.jvId), L = d.lines || [];
      return "<h4>" + h(d.docNo || "Draft GRN") + " " + pill(d.status || "Draft", d.status === "Posted" ? "good" : "") + "</h4>" +
        kv([["Date", fd(d.date)], ["Received at", d.direct === "Yes" ? "Straight to project site" + (d.project ? " – " + safe(function () { return refName("projects", d.project); }, "") : "") : safe(function () { return refName("whs", d.wh); }, "") || "Our store"], ["Posted by", d.postedBy ? d.postedBy.name + ", " + when(d.postedBy.at) : ""], ["Voucher", j ? j.ref : ""]]) +
        "<table class=\"fs-pdt\"><thead><tr><th>#</th><th>Item</th><th class=\"num\">Qty</th><th class=\"num\">Cost</th><th class=\"num\">Value</th></tr></thead><tbody>" +
        L.map(function (l, i) { var it = safe(function () { return itemOf(l.item); }, null) || {}; return "<tr><td>" + (i + 1) + "</td><td>" + h(it.description || it.code || l.item || "") + "</td><td class=\"num\">" + h(l.qty) + " " + h(it.uom || "") + "</td><td class=\"num\">" + money(num(l.cost)) + "</td><td class=\"num\">" + money(num(l.qty) * num(l.cost)) + "</td></tr>"; }).join("") + "</tbody></table>";
    }).join("");
    return head(po, "GOODS RECEIVED – " + (po.poNo || "")) + "<p>Received to date: <b>" + money(num(po.received)) + "</b> of " + money(num(po.amount)) + "</p>" + (rows || "<p class=\"muted\">No goods receipt against this PO yet. Inventory › Receive or issue stock › Goods receipt, pick this PO.</p>");
  }

  function tabPr(po) {
    var r = prOf(po); if (!r) return head(po, "REQUISITION") + "<p class=\"muted\">This PO was made without a requisition.</p>";
    var its = safe(function () { return CS().items(r); }, []), S2 = CS().STORE || [], sv = r.store;
    var raw = (r.descriptionRows || []).filter(function (x) { return x && (x.i || x.q || x.p); });
    return head(po, "PURCHASE REQUISITION – " + (r.prNo || "")) +
      kv([["Date", fd(r.date)], ["Department", r.dept], ["Requested by", r.requestedBy || person(r.createdBy)], ["Project", safe(function () { return refName("projects", r.project); }, "") || r.project], ["Status", r.status], ["Store vetting", sv ? ((S2.find(function (x) { return x[0] === sv.res; }) || [0, sv.res])[1] + (sv.remark ? " · " + sv.remark : "") + (sv.by ? " · " + sv.by + ", " + when(sv.at) : "")) : "Not done"]]) +
      "<table class=\"fs-pdt\"><thead><tr><th>#</th><th>Item</th><th class=\"num\">Qty</th><th>Unit</th><th class=\"num\">Estimated rate</th></tr></thead><tbody>" +
      its.map(function (it, i) { var p = num((raw[i] || {}).p); return "<tr><td>" + (i + 1) + "</td><td>" + h(it.i) + (it.s ? "<br><small>" + h(it.s) + "</small>" : "") + "</td><td class=\"num\">" + h(it.q) + "</td><td>" + h(it.u) + "</td><td class=\"num\">" + (p ? money(p) : "–") + "</td></tr>"; }).join("") +
      "</tbody></table>" + (r.estAmount ? "<p>Estimated amount: <b>" + money(num(r.estAmount)) + "</b></p>" : "");
  }

  function tabCs(po) {
    var r = prOf(po), c = r && r.cs; if (!c || !(c.v || []).length) return head(po, "COMPARATIVE STATEMENT") + "<p class=\"muted\">No comparative statement on this PO's requisition.</p>";
    var its = CS().items(r), V = c.v.filter(function (v) { return String(v.name || "").trim(); }), low = -1, bt = Infinity;
    V.forEach(function (v, k) { var t = CS().totals(v, its); if (t.full && t.tot < bt) { bt = t.tot; low = k; } });
    var st = CS().stages(r), ap = c.appr || [];
    return head(po, "COMPARATIVE STATEMENT – " + (r.prNo || "")) +
      "<table class=\"fs-pdt\"><thead><tr><th>Vendor</th><th>Quotation ref</th><th>Date</th><th>Payment terms</th><th class=\"num\">Total</th><th></th></tr></thead><tbody>" +
      V.map(function (v, k) { var t = CS().totals(v, its), i = c.v.indexOf(v); return "<tr" + (i === c.pick ? " class=\"pick\"" : "") + "><td>" + h(v.name) + "</td><td>" + h(v.ref || (r.prNo || "PR") + "/Q" + (i + 1)) + "</td><td>" + h(fd(v.date)) + "</td><td>" + h(v.terms || "") + "</td><td class=\"num\">" + money(t.tot) + "</td><td>" + (k === low ? pill("Lowest", "good") + " " : "") + (i === c.pick ? pill("Chosen", "acc") : "") + "</td></tr>"; }).join("") + "</tbody></table>" +
      kv([["Prepared by", c.by ? c.by + ", " + when(c.at) : ""], [st[0], ap[0] ? ap[0].by + ", " + when(ap[0].at) : "Waiting"], [st[1], ap[1] ? ap[1].by + ", " + when(ap[1].at) : "Waiting"], ["Reason for choice", c.why], ["Fewer than 3 quotations", c.exempt ? c.exemptWhy : ""]]) +
      "<p class=\"fs-pdnp\"><button type=\"button\" class=\"btn\" data-pdcs=\"" + h(r.id) + "\">Open the full comparative statement</button></p>";
  }

  function tabQt(po, files) {
    var r = prOf(po), c = r && r.cs; if (!c) return head(po, "QUOTATIONS") + "<p class=\"muted\">No quotations recorded.</p>";
    var its = CS().items(r), V = (c.v || []).filter(function (v) { return String(v.name || "").trim(); });
    return V.length ? V.map(function (v) { return safe(function () { return CS().qPage(r, v, c.v.indexOf(v), its); }, ""); }).join("").replace(/^<section class="fs-qpage"/, "<section class=\"fs-qpage first\"") : "<p class=\"muted\">No quotations recorded.</p>";
  }

  function tabFin(po) {
    var A = advs(po), B = bills(po), P = pays(po), f = safe(function () { return poFin(po); }, {}) || {};
    var t = function (hd, rows) { return "<table class=\"fs-pdt\"><thead><tr>" + hd.map(function (x) { return "<th" + (/Amount/.test(x) ? " class=\"num\"" : "") + ">" + x + "</th>"; }).join("") + "</tr></thead><tbody>" + (rows.join("") || "<tr><td colspan=\"" + hd.length + "\" class=\"muted\">None yet</td></tr>") + "</tbody></table>"; };
    return head(po, "BILLS AND PAYMENTS – " + (po.poNo || "")) +
      kv([["PO value", money(num(po.amount))], ["Advance paid", money(num(f.paid))], ["Billed", money(num(f.billed))], ["Advance still to adjust", money(num(f.left))], ["Bills unpaid", money(num(f.payable))], ["Finance status", f.st || ""]]) +
      "<h4>Advances</h4>" + t(["Date", "Voucher", "Status", "Amount"], A.map(function (a) { var j = jv(a.jvId); return "<tr><td>" + h(fd(a.date)) + "</td><td>" + h(j ? j.ref : "") + "</td><td>" + h(a.status || "") + "</td><td class=\"num\">" + money(num(a.amount)) + "</td></tr>"; })) +
      "<h4>Vendor bills</h4>" + t(["Bill no.", "Vendor invoice", "Date", "Voucher", "Status", "Amount"], B.map(function (b) { var j = jv(b.jvId); return "<tr><td>" + h(b.billNo || "") + "</td><td>" + h(b.invoiceNo || "") + "</td><td>" + h(fd(b.invoiceDate)) + "</td><td>" + h(j ? j.ref : "") + "</td><td>" + h(b.status || "") + "</td><td class=\"num\">" + money(num(b.amount)) + "</td></tr>"; })) +
      "<h4>Payments</h4>" + t(["Voucher", "Date", "Status", "Narration"], P.map(function (j) { return "<tr><td>" + h(j.ref || "") + "</td><td>" + h(fd(j.date)) + "</td><td>" + h(j.status || "") + "</td><td>" + h(j.narration || "") + "</td></tr>"; }));
  }

  // ---- workflow history
  var dur = function (ms) { if (!(ms >= 0)) return ""; var m = Math.round(ms / 60000), d = Math.floor(m / 1440), hh = Math.floor(m % 1440 / 60), mm = m % 60; return (d ? d + "d " : "") + (d || hh ? hh + "h " : "") + mm + "m"; };
  function recKeys(po) {
    var r = prOf(po), k = ["pos/" + po.id];
    if (r) k.unshift("requisitions/" + r.id);
    advs(po).forEach(function (a) { k.push("vadvances/" + a.id); });
    bills(po).forEach(function (b) { k.push("payables/" + b.id); });
    return k;
  }
  function voucherEv(ev, stage, j, label) {
    if (!j) return;
    if (j.maker && j.maker.at) ev.push({ st: stage, from: "", to: (j.ref || "Voucher") + " prepared", by: j.maker.name, at: j.maker.at, note: label });
    (j.approvals || []).forEach(function (a) { if (a && a.at) ev.push({ st: stage, from: "", to: (j.ref || "Voucher") + " " + (a.action || "Approved").toLowerCase() + (a.stage ? " (" + a.stage + ")" : ""), by: a.name || a.by, at: a.at, note: a.note || a.remark || "" }); });
    if (j.postedBy && j.postedBy.at) ev.push({ st: stage, from: "", to: (j.ref || "Voucher") + " posted", by: j.postedBy.name, at: j.postedBy.at, note: "" });
  }
  function events(po, hist) {
    var ev = [], r = prOf(po), lab = { requisitions: "Requisition", pos: "Purchase order", vadvances: "Advance", payables: "Vendor bill" };
    Object.keys(hist || {}).forEach(function (k) {
      var c = k.split("/")[0], rec = c === "pos" ? po : c === "requisitions" ? r : null, no = rec ? (rec.poNo || rec.prNo || "") : "";
      (hist[k] || []).forEach(function (x) { ev.push({ st: lab[c] || c, from: x.op === "INSERT" ? "–" : x.from || "–", to: x.op === "DELETE" ? "Deleted" : (x.to || (x.op === "INSERT" ? "Created" : "Changed")), by: x.by, at: x.at, note: x.op === "INSERT" ? (lab[c] || "Record") + " created" + (no ? " (" + no + ")" : "") : "" }); });
    });
    // records the server has no history for (made before it was kept): use when they were created
    [["requisitions", r], ["pos", po]].forEach(function (x) { if (x[1] && !(hist && (hist[x[0] + "/" + x[1].id] || []).length) && x[1].createdAt) ev.push({ st: lab[x[0]], from: "–", to: x[1].status || "Created", by: person(x[1].createdBy), at: x[1].createdAt, note: lab[x[0]] + " created" }); });
    if (r && r.store && r.store.at) ev.push({ st: "Store vetting", from: "", to: (CS().STORE || []).reduce(function (s, x) { return x[0] === r.store.res ? x[1] : s; }, r.store.res || "Checked"), by: r.store.by, at: r.store.at, note: r.store.remark || "" });
    var c = r && r.cs;
    if (c && c.at) ev.push({ st: "Comparative", from: "", to: "Comparative statement prepared", by: c.by, at: c.at, note: c.pick != null && c.v[c.pick] ? "Recommended: " + c.v[c.pick].name + (c.why ? " · " + c.why : "") : "" });
    (c && c.appr || []).forEach(function (a) { if (a && a.at) ev.push({ st: "Comparative", from: "", to: a.stage || "Approved", by: a.by, at: a.at, note: a.remark || "" }); });
    advs(po).forEach(function (a) { voucherEv(ev, "Advance", jv(a.jvId), "Advance to vendor"); });
    grns(po).forEach(function (d) { if (d.postedBy && d.postedBy.at) ev.push({ st: "GRN", from: "", to: (d.docNo || "GRN") + " posted", by: d.postedBy.name, at: d.postedBy.at, note: d.note || "" }); });
    bills(po).forEach(function (b) { voucherEv(ev, "Vendor bill", jv(b.jvId), b.billNo ? "Bill " + b.billNo : ""); });
    pays(po).forEach(function (j) { voucherEv(ev, "Payment", j, j.narration || ""); });
    ev = ev.filter(function (e) { return e.at && !isNaN(new Date(e.at)); }).sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
    ev.forEach(function (e, i) { var nx = ev[i + 1]; e.held = dur((nx ? new Date(nx.at) : new Date()) - new Date(e.at)) + (nx ? "" : " so far"); });
    return ev;
  }
  function histHtml(po, ev) {
    var w = withNow(po);
    return "<p class=\"muted\">Full flow: Requisition → Store vetting → Comparative statement → Approval (Finance, then authority) → Purchase order → Advance → GRN → Vendor bill → Payment</p>" +
      "<p><b>Currently with:</b> " + h(w[0]) + (w[1] ? " · " + h(w[1]) : "") + "</p>" +
      (ev.length ? "<ol class=\"fs-pdtl\">" + ev.map(function (e) {
        return "<li><div class=\"fs-pdtlh\">" + pill(e.st, "acc") + " <b>" + (e.from ? h(e.from) + " → " : "") + h(e.to) + "</b></div>" +
          "<div class=\"muted\">By: " + h(e.by || "–") + " • " + h(when(e.at)) + (e.held ? " &nbsp; Held: " + h(e.held) : "") + "</div>" + (e.note ? "<div class=\"fs-pdnote\">" + h(e.note) + "</div>" : "") + "</li>";
      }).join("") + "</ol>" : "<p class=\"muted\">Nothing recorded yet.</p>");
  }
  function loadHist(po) {
    var api = (window.FS_BRIDGE || {}).api || "/erp/m/hsec/api";
    return fetch(api + "/hist?k=" + encodeURIComponent(recKeys(po).join(",")), { credentials: "same-origin" }).then(function (x) { return x.ok ? x.json() : {}; }).then(function (d) { return (d && d.hist) || {}; }).catch(function () { return {}; });
  }

  // ---- the window
  var TABS = [["po", "Purchase order"], ["grn", "GRN(s)"], ["pr", "Requisition"], ["cs", "Comparative statement"], ["qt", "Quotations"], ["fin", "Bills & payments"]];
  async function open(id, tab) {
    var po = poById(id); if (!po) { safe(function () { toast("Save the purchase order first."); }, null); return; }
    var r = prOf(po);
    if (r) await safe(function () { return CS().loadFiles(r.id); }, null);
    var nq = r && r.cs ? (r.cs.v || []).filter(function (v) { return String(v.name || "").trim(); }).length : 0;
    var body = { po: tabPo, grn: tabGrn, pr: tabPr, cs: tabCs, qt: tabQt, fin: tabFin }, cur = tab || "po";
    var html = "<div class=\"sheetwrap\"><div class=\"sheet fs-pdsheet\" data-pdpo=\"" + h(po.id) + "\"><div class=\"bar fs-pdbar\"><div class=\"fs-pdtabs\">" +
      TABS.map(function (t) { var lbl = t[0] === "qt" ? t[1] + " (" + nq + ")" : t[0] === "grn" ? t[1] + " (" + grns(po).length + ")" : t[1]; return "<button type=\"button\" class=\"btn" + (t[0] === cur ? " pri" : "") + "\" data-pdtab=\"" + t[0] + "\">" + h(lbl) + "</button>"; }).join("") +
      "</div><span style=\"flex:1\"></span><button type=\"button\" class=\"btn\" id=\"fsPdHist\">Workflow history</button><button class=\"btn pri\" id=\"printSheet\">Print</button><button class=\"btn\" id=\"closeSheet\">Close</button></div>" +
      "<div class=\"fs-pdtitle\"><b>Purchase order details</b> " + h(po.poNo || "") + " " + pill(po.status || "Open") + "</div>" +
      "<div id=\"fsPdHistBox\" class=\"fs-pdpane\" hidden></div>" +
      TABS.map(function (t) { return "<div class=\"fs-pdpane\" data-pdpane=\"" + t[0] + "\"" + (t[0] === cur ? "" : " hidden") + ">" + safe(function () { return body[t[0]](po); }, "<p class=\"muted\">Could not show this tab.</p>") + "</div>"; }).join("") +
      "</div></div>";
    safe(function () { sheetOpen(html); }, null);
  }
  async function showHist(id) {
    var box = document.getElementById("fsPdHistBox"), po = poById(id); if (!box || !po) return;
    if (!box.hidden) { box.hidden = true; var a = document.querySelector(".fs-pdtabs .btn.pri"); if (a) showTab(a.getAttribute("data-pdtab")); return; }
    box.hidden = false; box.innerHTML = "<p class=\"muted\">Loading the history…</p>";
    document.querySelectorAll("[data-pdpane]").forEach(function (p) { p.hidden = true; });
    document.querySelectorAll(".fs-pdtabs .btn").forEach(function (b) { b.classList.remove("pri"); });
    var hist = await loadHist(po);
    box.innerHTML = head(po, "WORKFLOW HISTORY – " + (po.poNo || "")) + histHtml(po, events(po, hist));
  }
  function showTab(t) {
    var hb = document.getElementById("fsPdHistBox"); if (hb) hb.hidden = true;
    document.querySelectorAll("[data-pdpane]").forEach(function (p) { p.hidden = p.getAttribute("data-pdpane") !== t; });
    document.querySelectorAll(".fs-pdtabs .btn").forEach(function (b) { b.classList.toggle("pri", b.getAttribute("data-pdtab") === t); });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-podet],[data-pdtab],#fsPdHist,[data-pdcs]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.hasAttribute("data-podet")) return void open(b.getAttribute("data-podet"));
    if (b.hasAttribute("data-pdtab")) return showTab(b.getAttribute("data-pdtab"));
    if (b.hasAttribute("data-pdcs")) { var r = D("requisitions").find(function (x) { return x.id === b.getAttribute("data-pdcs"); }); if (r) safe(function () { CS().printCs(r); }, null); return; }
    var s = document.querySelector("[data-pdpo]"); if (s) showHist(s.getAttribute("data-pdpo"));
  }, true);

  // "Purchase order details" on a saved PO's form
  function formBtn() {
    var f = document.getElementById("frm"); if (!f || f.querySelector(".fs-podetbtn")) return;
    var rec = safe(function () { return F && F.c === "pos" && F.rec; }, null); if (!rec || !rec.id) return;
    var h2 = f.querySelector("h2"); if (!h2) return;
    h2.insertAdjacentHTML("afterend", "<p class=\"fs-podetbtn\"><button type=\"button\" class=\"btn\" data-podet=\"" + h(rec.id) + "\">Purchase order details</button> <span class=\"muted\">PO, GRN(s), requisition, comparative, quotations, bills and workflow history</span></p>");
  }
  function hook() {
    if (typeof S === "undefined" || !S.pos || !Array.isArray(S.pos.cols)) return false;
    var cols = S.pos.cols, at = function (k) { return cols.findIndex(function (c) { return c[0] === k; }); };
    if (at("fsinit") < 0) {
      cols.splice(at("vendor") + 1, 0, ["fsinit", "Initiator", function (r) { return h(initiator(r)); }]);
      cols.splice(at("date") + 1, 0, ["delivery", "Expected delivery", function (r) { return h(fd(r.delivery)); }]);
      cols.push(["fswith", "Currently with", function (r) { var w = withNow(r); return "<span class=\"fs-pdwith\">" + h(w[0]) + "</span>" + (w[1] ? "<br><small class=\"muted\">" + h(w[1]) + "</small>" : ""); }]);
      cols.push(["fsdet", "", function (r) { return "<button type=\"button\" class=\"btn sm\" data-podet=\"" + h(r.id) + "\">Details</button>"; }]);
    }
    var lay = document.getElementById("layer");
    if (lay && !lay._fsPd) { lay._fsPd = 1; new MutationObserver(function () { safe(formBtn, null); }).observe(lay, { childList: true, subtree: true }); }
    return !!lay;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-pdsheet{max-width:1000px}.fs-pdbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.fs-pdtabs{display:flex;flex-wrap:wrap;gap:4px}" +
    ".fs-pdtitle{margin:10px 0 4px;font-size:14px}.fs-pdlh{width:100%;height:auto;display:block;margin-bottom:8px}.fs-pdco{text-align:center;font-weight:700;font-size:16px}" +
    ".fs-pdh{text-align:center;letter-spacing:.05em;margin:6px 0 12px;font-size:17px}.fs-pdgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fs-pdgrid h4,.fs-pdpane h4{margin:10px 0 4px;color:#1B3A5C}" +
    ".fs-pdkv{border-collapse:collapse;font-size:12.5px;margin:4px 0 8px}.fs-pdkv th{text-align:left;font-weight:600;color:#445;padding:2px 14px 2px 0;white-space:nowrap;vertical-align:top}.fs-pdkv td{padding:2px 0}" +
    ".fs-pdt{width:100%;border-collapse:collapse;margin:8px 0;font-size:12.5px}.fs-pdt th,.fs-pdt td{border:1px solid #c8ced6;padding:5px 6px;vertical-align:top;text-align:left}.fs-pdt th{background:#f1f4f8}.fs-pdt .num{text-align:right}" +
    ".fs-pdt tr.tot td{font-weight:600;background:#fafbfc}.fs-pdt tr.pick td{background:#eef6ff}.fs-pdpill{display:inline-block;border-radius:10px;padding:1px 8px;font-size:11px;background:#eef1f4;color:#334}" +
    ".fs-pdpill.good{background:#e3f4e8;color:#1b7a3d}.fs-pdpill.acc{background:#e6f0fa;color:#1F6FB8}.fs-pdsign{width:100%;margin-top:36px;border-collapse:collapse}.fs-pdsign td{width:25%;text-align:center;padding:0 8px;font-size:11px;vertical-align:bottom}" +
    ".fs-pdsign .ln{border-top:1px solid #333;margin:2px 0 4px}.fs-pdsg{min-height:30px;font-weight:600}.fs-pdhh{margin:4px 0}.fs-pdtl{list-style:none;margin:10px 0;padding:0 0 0 18px;border-left:2px solid #cfe0f1}" +
    ".fs-pdtl li{position:relative;margin:0 0 12px;padding:8px 10px;border:1px solid #e1e7ee;border-radius:8px;background:#fff}.fs-pdtl li:before{content:'';position:absolute;left:-25px;top:12px;width:10px;height:10px;border-radius:50%;background:#1F6FB8;border:2px solid #fff}" +
    ".fs-pdnote{margin-top:6px;padding:6px 8px;background:#f6f8fa;border-radius:6px;font-size:12px}.fs-pdwith{color:#9a2b4e;font-weight:600;font-size:12px}.fs-podetbtn{margin:4px 0 8px}" +
    ".fs-pdpane .fs-qpage.first{break-before:auto;page-break-before:auto;padding-top:0}@media print{.fs-pdtitle,.fs-pdnp{display:none}.fs-pdtl li{break-inside:avoid}}@media (max-width:700px){.fs-pdgrid{grid-template-columns:1fr}}";
  (document.head || document.documentElement).appendChild(css);
  window.FS_PODET = { open: open, withNow: withNow, events: events };
  function start() { if (!hook()) setTimeout(start, 400); }
  start();
})();
