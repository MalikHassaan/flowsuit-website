// GRNs & bills (hassan, 2026-11-03: "how this one can be managed in our system" + "yes", with another ERP's
// "Procurement GRN's & Bills" screen). The GRNI screen becomes "GRNs & bills" and is also under Payables:
//  * a Supplier / vendor filter;
//  * Unbilled GRNs (n): one row per posted goods receipt (GRN, company, vendor, PO, billing state, total, billed,
//    remaining), billed amounts allocated to a PO's receipts oldest first;
//  * Created vendor bills (n): the bills raised against those POs.
// "Enter bill" still makes ONE bill per purchase order, covering every unbilled receipt on it, so the three-way match
// (PO price, GRN quantity, bill) stays per PO. The original per-PO match table stays below.
(function () {
  /* global grniView, grnDocs, docVal, grniBilled, byEnt, Store, MODS, esc, fmt, fdate, pill, vendorName, render, V, jvOf */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var ST = { ven: "", tab: "open" };
  var orig = null;

  function rows() {
    var out = [];
    safe(function () { return byEnt(Store.data.pos); }, []).forEach(function (po) {
      var G = safe(function () { return grnDocs(po); }, []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.docNo).localeCompare(String(b.docNo)); });
      if (!G.length) return;
      var left = safe(function () { return grniBilled(po); }, 0), vn = safe(function () { return vendorName(po); }, "");
      G.forEach(function (d) {
        var tot = safe(function () { return docVal(d); }, 0), b = Math.min(tot, Math.max(0, left)); left -= b;
        out.push({ d: d, po: po, vn: vn, tot: tot, billed: b, rem: Math.max(0, tot - b) });
      });
    });
    return out;
  }
  function view() {
    var all = rows(), vens = all.map(function (x) { return x.vn; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort();
    if (ST.ven && vens.indexOf(ST.ven) < 0) ST.ven = "";
    var R = all.filter(function (x) { return !ST.ven || x.vn === ST.ven; }), open = R.filter(function (x) { return x.rem >= 1; });
    var poIds = R.map(function (x) { return x.po.id; });
    var bills = safe(function () { return Store.data.payables.filter(function (b) { return b.po && poIds.indexOf(b.po) >= 0; }); }, []);
    var sel = open.reduce(function (s, x) { return s + x.rem; }, 0);
    var tab = function (k, l) { return "<button type=\"button\" class=\"btn" + (ST.tab === k ? " pri" : "") + "\" data-gbtab=\"" + k + "\">" + h(l) + "</button>"; };
    var head = "<div class=\"panel fs-gb\"><div class=\"fs-gbbar\"><label>Supplier / vendor <select id=\"fsGbVen\"><option value=\"\">All vendors</option>" +
      vens.map(function (v) { return "<option" + (v === ST.ven ? " selected" : "") + ">" + h(v) + "</option>"; }).join("") + "</select></label>" +
      "<span class=\"fs-gbtabs\">" + tab("open", "Unbilled GRNs (" + open.length + ")") + tab("bills", "Created vendor bills (" + bills.length + ")") + "</span></div>";
    var body;
    if (ST.tab === "bills") {
      body = "<table><thead><tr><th>Bill no.</th><th>Vendor invoice</th><th>Date</th><th>Vendor</th><th>PO</th><th>For receipts</th><th>Voucher</th><th>Status</th><th class=\"num\">Amount</th></tr></thead><tbody>" +
        (bills.map(function (b) {
          var po = Store.data.pos.find(function (p) { return p.id === b.po; }) || {}, j = safe(function () { return jvOf(b.jvId); }, null);
          var g = (b.items || []).map(function (x) { return x.desc || ""; }).join(" ").match(/GRN-[A-Z0-9]+-\d+/g);
          return "<tr class=\"click\" data-edit=\"payables\" data-id=\"" + h(b.id) + "\"><td class=\"mono\">" + h(b.billNo || "") + "</td><td>" + h(b.invoiceNo || "") + "</td><td>" + h(safe(function () { return fdate(b.invoiceDate); }, b.invoiceDate || "")) + "</td><td>" + h(b.vendor || "") + "</td><td class=\"mono\">" + h(po.poNo || "") + "</td><td>" + h(g ? g.join(", ") : "") + "</td><td>" + h(j ? j.ref : "") + "</td><td>" + safe(function () { return pill(b.status || ""); }, h(b.status)) + "</td><td class=\"num\">" + fmt(b.amount) + "</td></tr>";
        }).join("") || "<tr><td colspan=\"9\" class=\"empty\">No vendor bills against these purchase orders yet.</td></tr>") + "</tbody></table>";
    } else {
      body = "<p class=\"fs-gbsum\"><b>Billable GRNs (Bill → GRN → PO)</b> · Unbilled total: <b>Rs " + fmt(sel) + "</b></p>" +
        "<table><thead><tr><th>GRN</th><th>Date</th><th>Company</th><th>Supplier / vendor</th><th>PO</th><th>Status</th><th>Billing</th><th class=\"num\">Total</th><th class=\"num\">Billed</th><th class=\"num\">Remaining</th><th></th></tr></thead><tbody>" +
        (open.map(function (x) {
          return "<tr><td class=\"mono\">" + h(x.d.docNo || "") + "</td><td style=\"white-space:nowrap\">" + h(safe(function () { return fdate(x.d.date); }, x.d.date)) + "</td><td>" + h(x.d.entity || x.po.entity || "") + "</td><td>" + h(x.vn) + "</td><td class=\"mono\">" + h(x.po.poNo || "") + "</td><td>" + safe(function () { return pill(x.d.status || "Posted", "good"); }, "Posted") + "</td><td>" + safe(function () { return x.billed > 0.5 ? pill("Part billed", "warn") : pill("Unbilled", "warn"); }, "") +
            "</td><td class=\"num\">" + fmt(x.tot) + "</td><td class=\"num\">" + fmt(x.billed) + "</td><td class=\"num\">" + fmt(x.rem) + "</td><td><button class=\"btn sm pri\" data-pobill=\"" + h(x.po.id) + "\">Create bill</button></td></tr>";
        }).join("") || "<tr><td colspan=\"11\" class=\"empty\">No billable GRNs found.</td></tr>") + "</tbody></table>" +
        "<p class=\"note\">Create bill makes one vendor bill for the purchase order and fills it with every unbilled receipt on that PO (Dr 220210 GRNI, Cr Payables). Type the vendor's invoice number and date on the bill, then Save. Pay it from Payables › Payments.</p>";
    }
    return head + "<div class=\"tw\">" + body + "</div></div><h3 class=\"fs-gbh\">Match by purchase order</h3>";
  }
  function hook() {
    if (typeof grniView !== "function" || typeof MODS === "undefined" || !MODS.inv || !MODS.e_ap) return false;
    if (!orig) {
      orig = grniView;
      grniView = function () { return safe(view, "") + orig.apply(this, arguments); }; // eslint-disable-line no-global-assign
      MODS.inv.tabs.forEach(function (t) { if (t[0] === "grni") t[1] = "GRNs & bills (GRNI)"; });
      if (!MODS.e_ap.tabs.some(function (t) { return t[0] === "grni"; })) {
        var at = MODS.e_ap.tabs.findIndex(function (t) { return t[0] === "apos"; });
        MODS.e_ap.tabs.splice(at < 0 ? 1 : at + 1, 0, ["grni", "GRNs & bills"]);
      }
      safe(function () { render(); }, null);
    }
    return true;
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-gbtab]"); if (!b) return;
    e.preventDefault(); ST.tab = b.getAttribute("data-gbtab"); safe(function () { render(); }, null);
  });
  document.addEventListener("change", function (e) { if (e.target && e.target.id === "fsGbVen") { ST.ven = e.target.value; safe(function () { render(); }, null); } });
  var css = document.createElement("style");
  css.textContent = ".fs-gb{padding:12px 14px;margin-bottom:12px}.fs-gbbar{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:8px}.fs-gbbar label{display:flex;flex-direction:column;font-size:12px;color:#556;gap:3px}" +
    ".fs-gbbar select{min-width:260px}.fs-gbtabs{display:flex;gap:6px}.fs-gbsum{margin:6px 0}.fs-gbh{margin:14px 0 6px;font-size:15px}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 400); }
  start();
})();
