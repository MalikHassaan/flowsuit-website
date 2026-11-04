// AMC contracts dashboard (hassan, 2026-11-04: "once the site province is added it should auto show the amount of gst ...
// its status is always active until its tenure is completed ... give number of days until renewal ... the dashboard
// should also be there and also the project details: what is the total project monthly charge", with a picture of an
// agreements list: number, unit, customer, amount, period, time left, status, view / edit).
//  * AMC (maintenance contracts) › AMC contracts: cards (active contracts, total monthly charge, renewals due in 60 days,
//    expired) and one row per contract with its period, time left or "Expired n ago", and a status worked out from the
//    dates: Active until the end date, "Renewal due" in its last 60 days, then Expired. On hold stays On hold.
//  * The eye opens the contract's details: monthly charge with sales tax, per-bill amount, contract value, invoiced,
//    received, balance and its invoices (printable, on the letterhead).
//  * Project form: choosing the site province fills "AMC sales tax %" with that province's rate (Settings rates), and a
//    maintenance contract starts as Active instead of Tendering.
(function () {
  /* global Store, MODS, TAB_HOME, TITLE, special, byEnt, V, esc, fmt, fdate, todayStr, render, sheetOpen, openForm, AMC_STEP, pstRates, pill */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var num = function (v) { return parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0; };
  var money = function (v) { return safe(function () { return fmt(v); }, String(Math.round(v))); };
  var fd = function (d) { return d ? safe(function () { return fdate(d); }, d) : ""; };
  var AMC = "Maintenance contract (AMC)";
  var ST = { q: "", f: "all" };
  var today = function () { return safe(function () { return todayStr(); }, new Date().toISOString().slice(0, 10)); };
  var D = function (s) { var p = String(s || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; };
  var dayDiff = function (a, b) { return Math.round((b - a) / 86400000); };

  function rate(p) { return num(p.amcTaxPct) || safe(function () { return num((pstRates().find(function (x) { return x[0] === p.province; }) || [0, 0])[1]); }, 0); }
  // "8 months 27 days" between two dates (a <= b)
  function span(a, b) {
    var m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(), x = new Date(a.getFullYear(), a.getMonth() + m, a.getDate());
    if (x > b) { m--; x = new Date(a.getFullYear(), a.getMonth() + m, a.getDate()); }
    var d = dayDiff(x, b), y = Math.floor(m / 12), mm = m % 12, out = [];
    if (y) out.push(y + (y === 1 ? " year" : " years"));
    if (mm) out.push(mm + (mm === 1 ? " month" : " months"));
    if (d || !out.length) out.push(d + (d === 1 ? " day" : " days"));
    return out.join(" ");
  }
  function state(p) {
    var t = D(today()), s = D(p.amcStart), e = D(p.amcEnd);
    if (p.status === "On hold") return { k: "On hold", tone: "warn", left: "" };
    if (p.status === "Completed" && (!e || e < t)) return { k: "Expired", tone: "bad", left: e ? "Expired " + span(e, t) + " ago" : "", bad: true };
    if (e && e < t) return { k: "Expired", tone: "bad", left: "Expired " + span(e, t) + " ago", bad: true };
    if (s && s > t) return { k: "Starts later", tone: "", left: "Starts in " + span(t, s) };
    if (!e) return { k: "Active", tone: "good", left: "No end date" };
    var dl = dayDiff(t, e);
    if (dl <= 60) return { k: "Renewal due", tone: "warn", left: dl + (dl === 1 ? " day" : " days") + " to renewal", warn: true };
    return { k: "Active", tone: "good", left: span(t, e) + " left" };
  }
  function invs(p) { return safe(function () { return Store.data.receivables.filter(function (r) { return r.status !== "Void" && (String(r.amcKey || "").split("|")[0] === p.id || r.projectId === p.id); }); }, []); }
  function got(r) { return (r.receipts || []).reduce(function (s, x) { return s + num(x.amount); }, 0) || (r.status === "Paid" ? num(r.amount) : 0); }
  function contracts() { return safe(function () { return byEnt(Store.data.projects).filter(function (p) { return p.type === AMC; }); }, []); }
  var badge = function (s) { return "<span class=\"fs-ac-pill " + (s.tone || "") + "\">" + h(s.k) + "</span>"; };

  function view() {
    var all = contracts().map(function (p) { return { p: p, s: state(p) }; });
    var live = all.filter(function (x) { return x.s.k === "Active" || x.s.k === "Renewal due"; });
    var mrr = live.reduce(function (t, x) { return t + num(x.p.amcFee); }, 0), mrrT = live.reduce(function (t, x) { return t + num(x.p.amcFee) * (1 + rate(x.p) / 100); }, 0);
    var due = all.filter(function (x) { return x.s.k === "Renewal due"; }), exp = all.filter(function (x) { return x.s.k === "Expired"; });
    var q = ST.q.toLowerCase(), rows = all.filter(function (x) {
      if (ST.f === "active" && x.s.k !== "Active") return false;
      if (ST.f === "due" && x.s.k !== "Renewal due") return false;
      if (ST.f === "exp" && x.s.k !== "Expired") return false;
      return !q || [x.p.code, x.p.name, x.p.customer, x.p.pm].join(" ").toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return String(b.p.code || "").localeCompare(String(a.p.code || "")); });
    var card = function (k, l, v, sub) { return "<button type=\"button\" class=\"fs-ac-card" + (ST.f === k ? " on" : "") + "\" data-acf=\"" + k + "\"><small>" + h(l) + "</small><b>" + v + "</b><span>" + h(sub || "") + "</span></button>"; };
    return "<div class=\"fs-ac\"><div class=\"fs-ac-cards\">" +
      card("all", "All contracts", all.length, contracts().length ? "click a card to filter" : "") +
      card("active", "Active", live.length - due.length, "running normally") +
      "<div class=\"fs-ac-card m\"><small>Total monthly charge</small><b>Rs " + money(mrr) + "</b><span>Rs " + money(mrrT) + " with sales tax</span></div>" +
      card("due", "Renewal due (60 days)", due.length, due.length ? "contact these customers" : "none") +
      card("exp", "Expired", exp.length, exp.length ? "renew or close" : "none") + "</div>" +
      "<div class=\"fs-ac-bar\"><button class=\"btn pri\" data-acnew=\"1\">+ New AMC contract</button><input id=\"fsAcQ\" placeholder=\"Search contract, customer or engineer\" value=\"" + h(ST.q) + "\"><span class=\"muted\">" + rows.length + " contract" + (rows.length === 1 ? "" : "s") + "</span></div>" +
      "<div class=\"tw\"><table class=\"fs-ac-t\"><thead><tr><th>Contract</th><th>Site / project</th><th>Customer</th><th class=\"num\">Monthly charge</th><th>Period</th><th>Time left</th><th>Status</th><th></th></tr></thead><tbody>" +
      (rows.map(function (x) {
        var p = x.p, s = x.s, r = rate(p);
        return "<tr><td><b class=\"mono\">" + h(p.code || "") + "</b><br><small class=\"muted\">" + h(p.amcFreq || "Monthly") + " billing</small></td>" +
          "<td><b>" + h(p.name || "") + "</b>" + (p.pm ? "<br><small class=\"muted\">Engineer: " + h(p.pm) + "</small>" : "") + "</td>" +
          "<td>" + h(p.customer || "") + (p.province ? "<br><small class=\"muted\">" + h(p.province) + "</small>" : "") + "</td>" +
          "<td class=\"num\">Rs " + money(num(p.amcFee)) + "<br><small class=\"muted\">+ " + r + "% tax = " + money(num(p.amcFee) * (1 + r / 100)) + "</small></td>" +
          "<td style=\"white-space:nowrap\">" + h(fd(p.amcStart) || "–") + " –<br>" + h(fd(p.amcEnd) || "–") + "</td>" +
          "<td class=\"" + (s.bad ? "bad" : s.warn ? "warnt" : "") + "\">" + h(s.left) + "</td><td>" + badge(s) + "</td>" +
          "<td class=\"fs-ac-act\"><button class=\"btn sm\" data-acview=\"" + h(p.id) + "\" title=\"Contract details\">👁 View</button> <button class=\"btn sm\" data-acedit=\"" + h(p.id) + "\" title=\"Edit\">✎ Edit</button></td></tr>";
      }).join("") || "<tr><td colspan=\"8\" class=\"empty\">" + (all.length ? "No contract matches." : "No AMC contracts yet. Click “+ New AMC contract”.") + "</td></tr>") +
      "</tbody></table></div></div>";
  }

  function detail(id) {
    var p = safe(function () { return Store.data.projects.find(function (x) { return x.id === id; }); }, null); if (!p) return;
    var s = state(p), r = rate(p), fee = num(p.amcFee), k = safe(function () { return AMC_STEP[p.amcFreq]; }, 1) || 1;
    var I = invs(p).slice().sort(function (a, b) { return String(a.invoiceDate || "").localeCompare(String(b.invoiceDate || "")); });
    var inv = I.reduce(function (t, x) { return t + num(x.amount); }, 0), rec = I.reduce(function (t, x) { return t + got(x); }, 0);
    var a = D(p.amcStart), e = D(p.amcEnd), months = a && e ? Math.max(1, Math.round(dayDiff(a, e) / 30.44)) : 0;
    var row = function (l, v) { return "<tr><th>" + h(l) + "</th><td>" + v + "</td></tr>"; };
    var html = "<h2 style=\"margin:0 0 4px\">AMC contract " + h(p.code || "") + "</h2><p class=\"muted\" style=\"margin:0 0 10px\">" + h(p.name || "") + " · " + h(p.customer || "") + " · " + badge(s) + " " + h(s.left) + "</p>" +
      "<div class=\"fs-ac-dg\"><table class=\"fs-ac-kv\"><tbody>" +
      row("Customer", h(p.customer || "–")) + row("Site / project", h(p.name || "–")) + row("Company", h(p.entity || "")) +
      row("Service engineer", h(p.pm || "–")) + row("Site province", h(p.province || "–")) +
      row("Period", h((fd(p.amcStart) || "–") + " to " + (fd(p.amcEnd) || "–")) + (months ? " (" + months + " months)" : "")) +
      "</tbody></table><table class=\"fs-ac-kv\"><tbody>" +
      row("Monthly charge (excl. tax)", "<b>Rs " + money(fee) + "</b>") + row("Sales tax " + r + "%", "Rs " + money(fee * r / 100)) +
      row("Monthly charge with tax", "<b>Rs " + money(fee * (1 + r / 100)) + "</b>") +
      row("Billing", h(p.amcFreq || "Monthly") + (k > 1 ? " · Rs " + money(fee * k * (1 + r / 100)) + " per bill with tax" : "")) +
      row("Contract value (excl. tax)", "Rs " + money(num(p.contractValue) || fee * months)) +
      row("Invoiced / received / balance", "Rs " + money(inv) + " / Rs " + money(rec) + " / <b>Rs " + money(inv - rec) + "</b>") +
      "</tbody></table></div><h4 style=\"margin:12px 0 4px\">Invoices</h4><table class=\"fs-ac-t\"><thead><tr><th>Invoice</th><th>Date</th><th>For</th><th class=\"num\">Amount</th><th class=\"num\">Received</th><th class=\"num\">Balance</th></tr></thead><tbody>" +
      (I.map(function (x) { var g = got(x); return "<tr><td class=\"mono\">" + h(x.invoiceNo || "") + "</td><td>" + h(fd(x.invoiceDate)) + "</td><td>" + h(String(x.amcKey || "").split("|")[1] || x.description || "") + "</td><td class=\"num\">" + money(num(x.amount)) + "</td><td class=\"num\">" + money(g) + "</td><td class=\"num\">" + money(num(x.amount) - g) + "</td></tr>"; }).join("") ||
        "<tr><td colspan=\"6\" class=\"empty\">No invoices yet. Bill it from AMC billing.</td></tr>") + "</tbody></table>";
    safe(function () { sheetOpen(html); }, null);
  }

  // ---- project form: province fills the AMC sales tax %; a maintenance contract starts Active
  function formFix(why) {
    var t = document.getElementById("f_type"); if (!t || t.value !== AMC) return;
    var st = document.getElementById("f_status"); if (st && st.value === "Tendering") { st.value = "Active"; }
    var pv = document.getElementById("f_province"), tx = document.getElementById("f_amcTaxPct");
    if (!pv || !tx) return;
    if (why === "prov" || !tx.value || tx.getAttribute("data-fs-auto") === tx.value) {
      var r = safe(function () { return (pstRates().find(function (x) { return x[0] === pv.value; }) || [0, ""])[1]; }, "");
      if (r !== "" && r != null) { tx.value = String(r); tx.setAttribute("data-fs-auto", tx.value); tx.dispatchEvent(new Event("input", { bubbles: true })); }
    }
  }
  document.addEventListener("change", function (e) {
    var id = e.target && e.target.id;
    if (id === "f_province") safe(function () { formFix("prov"); }, null);
    if (id === "f_type") setTimeout(function () { safe(formFix, null); }, 30);
    if (id === "fsAcQ") { ST.q = e.target.value; safe(render, null); }
  });
  document.addEventListener("keyup", function (e) { if (e.target && e.target.id === "fsAcQ" && e.key === "Enter") { ST.q = e.target.value; safe(render, null); } });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-acf],[data-acview],[data-acedit],[data-acnew]"); if (!b) return;
    e.preventDefault();
    if (b.hasAttribute("data-acf")) { ST.f = b.getAttribute("data-acf"); safe(render, null); }
    else if (b.hasAttribute("data-acview")) detail(b.getAttribute("data-acview"));
    else if (b.hasAttribute("data-acedit")) safe(function () { openForm("projects", b.getAttribute("data-acedit")); setTimeout(function () { formFix(); }, 30); }, null);
    else safe(function () { openForm("projects", null, { type: AMC, status: "Active" }); setTimeout(function () { formFix(); }, 30); }, null);
  });

  var hooked = false;
  function hook() {
    if (hooked) return true;
    if (typeof special !== "function" || typeof MODS === "undefined" || !MODS.amcm || typeof Store === "undefined") return false;
    hooked = true;
    special = (function (old) { return function (tab) { return tab === "amccon" ? safe(view, "<p class=\"muted\">Could not build the AMC contracts list.</p>") : old.apply(this, arguments); }; })(special); // eslint-disable-line no-global-assign
    var T = MODS.amcm.tabs;
    if (!T.some(function (t) { return t[0] === "amccon"; })) T.unshift(["amccon", "AMC contracts"]);
    T.forEach(function (t) { if (t[0] === "projects") t[1] = "All projects (AMC & supply)"; });
    safe(function () { if (!TAB_HOME.amccon) TAB_HOME.amccon = "amcm"; }, null);
    safe(function () { if (TITLE && !TITLE.amccon) TITLE.amccon = "AMC contracts"; }, null);
    safe(function () { render(); }, null);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-ac-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:12px}" +
    ".fs-ac-card{display:flex;flex-direction:column;gap:2px;text-align:left;background:#fff;border:1px solid #d9e0e8;border-radius:10px;padding:10px 12px;cursor:pointer;font:inherit}" +
    ".fs-ac-card.m{cursor:default;background:#f2f8ff}.fs-ac-card.on{border-color:#1F6FB8;box-shadow:0 0 0 2px rgba(31,111,184,.18)}.fs-ac-card small{color:#556;font-weight:600}.fs-ac-card b{font-size:20px}.fs-ac-card span{font-size:12px;color:#667}" +
    ".fs-ac-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.fs-ac-bar input{min-width:280px}" +
    ".fs-ac-t{width:100%;border-collapse:collapse}.fs-ac-t td,.fs-ac-t th{padding:8px 10px;border-bottom:1px solid #e6eaef;vertical-align:top;text-align:left}.fs-ac-t .num{text-align:right}" +
    ".fs-ac-t td.bad{color:#c0392b;font-weight:600}.fs-ac-t td.warnt{color:#a15c00;font-weight:600}.fs-ac-act{white-space:nowrap}" +
    ".fs-ac-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#e9edf2;color:#334}.fs-ac-pill.good{background:#2e7d32;color:#fff}.fs-ac-pill.bad{background:#d32f2f;color:#fff}.fs-ac-pill.warn{background:#f2a516;color:#fff}" +
    ".fs-ac-dg{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fs-ac-kv{width:100%;border-collapse:collapse}.fs-ac-kv th,.fs-ac-kv td{border:1px solid #dde3ea;padding:5px 8px;text-align:left;font-size:13px}.fs-ac-kv th{background:#f4f6f9;width:45%}" +
    "@media (max-width:900px){.fs-ac-cards{grid-template-columns:1fr 1fr}.fs-ac-dg{grid-template-columns:1fr}}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 400); }
  start();
})();
