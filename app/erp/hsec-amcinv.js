// AMC sales tax invoice layout (hassan, 2026-11-04: "use this template of invoicing where the customer full detail like
// name address and NTN is required, whereas PO number will be the same as a real agreement or purchase order number;
// while applying the tax, on some invoices sales tax is exempt, add that as well; and account details ... use this on
// invoices as well", with a photo of a JPL sale tax invoice).
//  * Project form (AMC and supply): Customer address, Customer NTN, Customer STRN, PO / agreement number, Sales tax
//    (Taxable / Exempt) and an exemption reference. AMC billing will not make an invoice until the address (and, at first, NTN and
//    PO number are filled in. (Later the same day: "PO and NTN is optional"; only the customer name and address are
//    required, and a blank PO number or NTN is left off the invoice.)
//  * Invoices made by AMC billing print in the photo's layout: customer name, address and NTN on the left; invoice
//    number, date, PO number, currency and the company's NTN / STRN on the right; a line table with Qty, Unit price,
//    Gross amount, sales tax and Net amount and a TOTAL row; amount in words; the company's bank details; the signatory.
//    An exempt invoice is titled INVOICE and its tax column reads "Exempt".
//  * The company's NTN, STRN, bank account and signatory are kept per company in settings (admin edits them in
//    AMC billing › Invoice details per company), never in this public code.
(function () {
  /* global S, Store, settings, ivBody, ivWords, fmt, fmt2, fdate, esc, toast, render, ENTS, coLabel, amcTax, pstRates */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var num = function (v) { return parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0; };
  var m2 = function (v) { return safe(function () { return fmt2(v); }, (Math.round(v * 100) / 100).toFixed(2)); };
  var lines = function (s) { return String(s || "").split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean); };
  var TAXSHORT = { "Sindh": "S.S. Tax", "Punjab": "P.S.T.", "Khyber": "K.P.S.T.", "KP": "K.P.S.T.", "Islamabad": "I.C.T. Tax", "Balochistan": "B.S.T." };

  function co(e) { return safe(function () { return (settings().invCo || {})[e]; }, null) || {}; }
  function proj(r) { var id = String(r.amcKey || "").split("|")[0] || r.projectId; return safe(function () { return Store.data.projects.find(function (p) { return p.id === id; }); }, null); }
  var exempt = function (p) { return p && p.amcTaxMode === "Exempt"; };
  function taxOf(p) { return exempt(p) ? 0 : safe(function () { return amcTax(p); }, num(p.amcTaxPct)); }
  function taxShort(p) { var pv = String((p && p.province) || ""); for (var k in TAXSHORT) if (pv.indexOf(k) === 0) return TAXSHORT[k]; return "Sales Tax"; }
  function missing(p) {
    var m = [];
    if (!String(p.customer || "").trim()) m.push("customer name");
    if (!String(p.custAddress || "").trim()) m.push("customer address");
    // hassan, 2026-11-04: "PO and NTN is optional"
    return m;
  }
  // the parts of a new AMC invoice's document that come from the project and the company
  function docFor(p, tax) {
    var c = co(p.entity), ex = exempt(p);
    var bank = [c.title ? "Account title: " + c.title : "", c.iban ? "IBAN: " + c.iban : "", c.bank ? "Bank: " + c.bank : ""].filter(Boolean).join("\n");
    return { layout: "amctax", title: ex || !tax ? "INVOICE" : "SALES TAX INVOICE", to: { name: String(p.customer || p.name || "").trim(), address: String(p.custAddress || "").trim(), attn: "" },
      buyerTax: String(p.custNtn || "").trim(), buyerStrn: String(p.custStrn || "").trim(), poRef: String(p.poNo || "").trim(), poDate: "",
      taxPct: ex ? 0 : tax, exempt: ex, exemptRef: ex ? String(p.amcTaxNote || "").trim() : "", taxLabel: taxShort(p), currency: "PKR",
      sellerNtn: c.ntn || "", sellerStrn: c.strn || "", bank: bank, signoff: [c.signName || "", c.signTitle || ""].filter(Boolean).join("\n") };
  }
  window.FS_AMCINV = { taxOf: taxOf, missing: missing, docFor: docFor, exempt: exempt };

  // ---- the printed layout (any invoice made by AMC billing, old ones included: blanks come from the project / company)
  function body(M) {
    var r = M.r, d = M.d, p = proj(r) || {}, c = co(r.entity), T = M.T, ex = d.exempt || exempt(p) && !num(d.taxPct), pct = ex ? 0 : num(d.taxPct);
    var to = d.to || {}, name = to.name || p.customer || r.customer || "", addr = lines(to.address || p.custAddress), ntn = d.buyerTax || p.custNtn || "", strn = d.buyerStrn || p.custStrn || "";
    var po = d.poRef && d.poRef !== p.code ? d.poRef : (p.poNo || ""), sN = d.sellerNtn || c.ntn || "", sS = d.sellerStrn || c.strn || "";
    var bank = lines(d.bank || [c.title ? "Account title: " + c.title : "", c.iban ? "IBAN: " + c.iban : "", c.bank ? "Bank: " + c.bank : ""].filter(Boolean).join("\n"));
    var so = lines(d.signoff && !/^For and on behalf of/.test(d.signoff) ? d.signoff : [c.signName || "", c.signTitle || ""].filter(Boolean).join("\n"));
    var dd = function (x) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : h(x); };
    var tl = (d.taxLabel || "Sales Tax") + (ex ? "" : " @" + (+pct.toFixed(2)) + "%");
    var gross = 0, tax = 0;
    var rows = T.L.map(function (l, i) {
      var g = num(l.amount), t = ex ? 0 : Math.round(g * pct) / 100; gross += g; tax += t;
      return "<tr><td class=\"c\">" + (i + 1) + ".</td><td>" + h(l.name) + (l.period ? "<br><b>(" + h(l.period) + ")</b>" : "") + (l.specs ? "<div class=\"fs-ai-sp\">" + h(l.specs) + "</div>" : "") + "</td>" +
        "<td class=\"c\">" + h(String(num(l.qty)).padStart(2, "0")) + "</td><td class=\"r\">" + m2(num(l.unit)) + "</td><td class=\"r\">" + m2(g) + "</td><td class=\"r\">" + (ex ? "Exempt" : m2(t)) + "</td><td class=\"r\">" + m2(g + t) + "</td></tr>";
    }).join("");
    var meta = [["Invoice Number", h(r.invoiceNo || "")], ["Invoice Date", dd(r.invoiceDate)]].concat(po ? [["PO Number", h(po)]] : []).concat([["Currency", h(d.currency || "PKR")]])
      .concat(sN ? [["NTN", h(sN)]] : []).concat(sS ? [["STRN", h(sS)]] : []);
    return "<div class=\"iv fs-ai\"><h1>" + h(ex ? "INVOICE" : (d.title || "SALES TAX INVOICE")) + "</h1>" +
      "<table class=\"ivb fs-ai-head\"><colgroup><col style=\"width:52%\"><col></colgroup><tr><td><div class=\"fs-ai-to\">" + [h(name)].concat(addr.map(h)).join("<br>") +
      (ntn ? "<br>NTN: " + h(ntn) : "") + (strn ? "<br>STRN: " + h(strn) : "") + "</div></td><td><table class=\"fs-ai-meta\">" +
      meta.map(function (x) { return "<tr><td>" + x[0] + "</td><td>: " + x[1] + "</td></tr>"; }).join("") + "</table></td></tr></table>" +
      "<table class=\"ivb fs-ai-lines\"><colgroup><col style=\"width:6%\"><col style=\"width:30%\"><col style=\"width:7%\"><col style=\"width:13%\"><col style=\"width:15%\"><col style=\"width:13%\"><col style=\"width:16%\"></colgroup>" +
      "<thead><tr><th>S#</th><th>Item Description</th><th>Qty</th><th>Unit Price</th><th>Gross amount</th><th>" + h(tl) + "</th><th>Net Amount</th></tr></thead><tbody>" + rows +
      "<tr class=\"iv-tot\"><td colspan=\"4\" class=\"r\">TOTAL</td><td class=\"r\">" + m2(gross) + "</td><td class=\"r\">" + (ex ? "Exempt" : m2(tax)) + "</td><td class=\"r\">" + m2(gross + tax) + "</td></tr>" +
      "<tr><td colspan=\"7\"><b>Amount in words:</b> " + h(safe(function () { return ivWords(gross + tax); }, "")) + "</td></tr>" +
      (ex ? "<tr><td colspan=\"7\">Exempt from sales tax" + (d.exemptRef || p.amcTaxNote ? ": " + h(d.exemptRef || p.amcTaxNote) : ".") + "</td></tr>" : "") + "</tbody></table>" +
      (bank.length ? "<div class=\"iv-bank\"><b>Please pay to:</b><br>" + bank.map(h).join("<br>") + "</div>" : "") +
      "<div class=\"fs-ai-sig\">" + (so.length ? so.map(h).join("<br>") : "") + "</div></div>";
  }

  // ---- project form fields
  var NEW = [
    { k: "custAddress", l: "Customer address", t: "textarea", hint: "Printed on the invoice under the customer's name." },
    { k: "custNtn", l: "Customer NTN", hint: "Optional. Printed on the invoice when filled in." },
    { k: "custStrn", l: "Customer STRN (if any)" },
    { k: "poNo", l: "PO / agreement number", hint: "Optional: the customer's purchase order or signed agreement number, printed as PO Number." },
    { k: "amcTaxMode", l: "Sales tax", t: "select", o: ["Taxable", "Exempt"], hint: "Exempt: invoices carry no sales tax." },
    { k: "amcTaxNote", l: "Exemption reference (if exempt)", hint: "e.g. the exemption certificate or SRO number; printed on the invoice." }
  ];
  function fields() {
    var f = S.projects.fields; if (f.some(function (x) { return x.k === "custAddress"; })) return;
    var at = f.findIndex(function (x) { return x.k === "customer"; });
    f.splice(at < 0 ? f.length : at + 1, 0, NEW[0], NEW[1], NEW[2], NEW[3]);
    var t = f.findIndex(function (x) { return x.k === "amcTaxPct"; });
    f.splice(t < 0 ? f.length : t, 0, NEW[4], NEW[5]);
  }
  // exempt: the AMC sales tax % box reads 0
  document.addEventListener("change", function (e) {
    if (!e.target || e.target.id !== "f_amcTaxMode") return;
    var tx = document.getElementById("f_amcTaxPct"); if (!tx) return;
    if (e.target.value === "Exempt") { tx.value = "0"; tx.setAttribute("data-fs-auto", "0"); }
    else { var pv = document.getElementById("f_province"); if (pv) pv.dispatchEvent(new Event("change", { bubbles: true })); }
  });

  // ---- invoice details per company (admin; stored in settings.invCo)
  var KEYS = [["title", "Account title"], ["iban", "IBAN / account number"], ["bank", "Bank and branch"], ["ntn", "Our NTN"], ["strn", "Our STRN"], ["signName", "Signed by (name)"], ["signTitle", "Designation"]];
  function panel(ents) {
    if (!window.FS_ADMIN || !ents.length) return "";
    return "<details class=\"card fs-ai-set\"><summary><b>Invoice details per company</b> <span class=\"muted\">(bank account, NTN / STRN and signatory printed on AMC invoices)</span></summary>" +
      ents.map(function (e) {
        var c = co(e);
        return "<div class=\"fs-ai-co\" data-aico=\"" + h(e) + "\"><h4>" + h(safe(function () { return coLabel(e); }, e)) + "</h4><div class=\"fs-ai-g\">" +
          KEYS.map(function (k) { return "<label>" + h(k[1]) + "<input data-aik=\"" + k[0] + "\" value=\"" + h(c[k[0]] || "") + "\"></label>"; }).join("") +
          "</div><button type=\"button\" class=\"btn sm pri\" data-aisave=\"" + h(e) + "\">Save " + h(e) + "</button> <span class=\"muted\" data-aimsg=\"" + h(e) + "\"></span></div>";
      }).join("") + "</details>";
  }
  window.FS_AMCINV.panel = panel;
  document.addEventListener("click", async function (e) {
    var b = e.target.closest && e.target.closest("[data-aisave]"); if (!b) return;
    e.preventDefault();
    var ent = b.getAttribute("data-aisave"), box = b.closest("[data-aico]"), msg = box.querySelector("[data-aimsg]"), v = {};
    box.querySelectorAll("[data-aik]").forEach(function (i) { v[i.getAttribute("data-aik")] = i.value.trim(); });
    var s = safe(function () { return settings(); }, {}), all = Object.assign({}, s.invCo || {}); all[ent] = v;
    b.disabled = true;
    try { await Store.save("settings", Object.assign({}, s, { id: "main", invCo: all })); msg.textContent = "Saved. New and reprinted AMC invoices use it."; }
    catch (x) { msg.textContent = "Could not save. Only an admin can change these."; }
    b.disabled = false;
  });

  var hooked = false;
  function hook() {
    if (hooked) return true;
    if (typeof S === "undefined" || !S.projects || typeof ivBody !== "function" || typeof Store === "undefined" || typeof settings !== "function") return false;
    hooked = true;
    safe(fields, null);
    var old = ivBody;
    ivBody = function (M) { // eslint-disable-line no-global-assign
      if (M && M.r && M.d && (M.d.layout === "amctax" || M.r.amcKey)) { var x = safe(function () { return body(M); }, null); if (x) return x; }
      return old.apply(this, arguments);
    };
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".qsheet .fs-ai .fs-ai-head td{vertical-align:top}.fs-ai-to{margin:4px 2px;line-height:1.55}.qsheet .fs-ai table.fs-ai-meta{border-collapse:collapse}.qsheet .fs-ai table.fs-ai-meta td{border:0!important;padding:1px 6px 1px 0}" +
    ".qsheet .fs-ai .fs-ai-lines td{vertical-align:middle}.fs-ai-sp{font-size:10px;color:#333;margin-top:3px}.fs-ai-sig{margin-top:70px;line-height:1.5;break-inside:avoid}" +
    ".fs-ai-set{margin:12px 0}.fs-ai-set summary{cursor:pointer}.fs-ai-co{border-top:1px solid #e3e8ee;padding:8px 0}.fs-ai-co h4{margin:4px 0 6px}" +
    ".fs-ai-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:8px}.fs-ai-g label{display:flex;flex-direction:column;gap:3px;font-size:12px}@media (max-width:900px){.fs-ai-g{grid-template-columns:1fr 1fr}}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 400); }
  start();
})();
