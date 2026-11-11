// AMC contract renewal (hassan, 2026-11-11: "there should be an renewal option and details as well that when it was
// renewed and revised rate will be", on the AMC contracts list).
//  * Every contract on AMC (maintenance contracts) › AMC contracts gets "↻ Renew". It asks: renewed on, the new period
//    (from the day after the current end; same length as the last term), units, the revised rate per unit per month (or
//    the revised monthly fee when the contract has no rate) and a reference / note. It shows the change against the
//    old rate in rupees and %.
//  * Renewing extends the contract's end date and puts the revised rate and fee on the contract, and keeps a record of
//    each renewal on it (amcRenewals): when, by whom, the new period, rate / fee / units before and after, the note.
//    The contract value becomes the whole contract at the rate in force each month (as the project form works it out).
//  * Months before the renewal's start keep billing at the old rate (FS_AMCU.termAt in hsec-amcunits.js), so
//    renewing early does not change bills still to be made for the current term.
//  * The list shows "Renewed <date>: 15,000 → 16,500 from Dec 2026" under the period; the contract's View has a Renewal
//    history table and "Undo last renewal" (refused once an invoice exists for a month of that renewal).
// window.FS_AMCR = { open(id), history(p), note(p) }
(function () {
  /* global Store, esc, fmt, fdate, todayStr, render, toast, approverName */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; })); };
  var num = function (v) { return parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0; };
  var money = function (v) { return safe(function () { return fmt(v); }, String(Math.round(v))); };
  var fd = function (d) { return d ? safe(function () { return fdate(d); }, d) : ""; };
  var today = function () { return safe(function () { return todayStr(); }, new Date().toISOString().slice(0, 10)); };
  var SH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var mName = function (d) { d = String(d || ""); return d.length >= 7 ? SH[+d.slice(5, 7) - 1] + " " + d.slice(0, 4) : ""; };
  var D = function (s) { var p = String(s || "").split("-"); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; };
  var iso = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  var addDays = function (s, k) { var d = D(s); if (!d) return ""; d.setDate(d.getDate() + k); return iso(d); };
  // the day before the same date k months later: 2026-12-01 + 12 -> 2027-11-30
  var endAfter = function (s, k) { var d = D(s); if (!d) return ""; var x = new Date(d.getFullYear(), d.getMonth() + k, d.getDate()); x.setDate(x.getDate() - 1); return iso(x); };
  var monthsIn = function (a, b) { var x = D(a), y = D(b); if (!x || !y || y < x) return 0; return Math.max(1, Math.round((y - x) / 86400000 / 30.44)); };
  var pct = function (a, b) { return a ? Math.round((b - a) / a * 1000) / 10 : 0; };
  var signed = function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + money(Math.abs(v)); };
  var ren = function (p) { return p && Array.isArray(p.amcRenewals) ? p.amcRenewals : []; };
  var proj = function (id) { return safe(function () { return Store.data.projects.find(function (x) { return x.id === id; }); }, null); };
  var termStart = function (p) { var R = ren(p); return R.length ? R[R.length - 1].from : p.amcStart; };

  // the whole contract's value, start to the new end, at the rate in force each month, less free maintenance months
  // (the same sum the project form works out)
  function whole(x) {
    var a = String(x.amcStart || "").slice(0, 7), b = String(x.amcEnd || "").slice(0, 7); if (!a || !b || !window.FS_AMCU) return 0;
    var fr = safe(function () { return window.FS_AMCFREE.months(x); }, []) || [], tot = 0;
    for (var m = a, i = 0; m <= b && i < 600; i++) {
      if (fr.indexOf(m) < 0) tot += window.FS_AMCU.feeAt(x, m);
      var d = new Date(+m.slice(0, 4), +m.slice(5, 7), 1); m = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    }
    return Math.round(tot);
  }

  // ---- the renew window
  var cur = null;
  function close() { var m = document.getElementById("fsRnM"); if (m) m.remove(); cur = null; }
  function open(id) {
    var p = proj(id); if (!p) return;
    close(); cur = p;
    var from = p.amcEnd ? addDays(p.amcEnd, 1) : today(), len = monthsIn(termStart(p), p.amcEnd) || 12;
    var U = num(p.amcUnits), rt = num(p.amcRate), fee = num(p.amcFee), byRate = !!(rt || !fee);
    var box = document.createElement("div"); box.id = "fsRnM"; box.className = "fs-rn-m";
    box.innerHTML = "<div class=\"fs-rn-d\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"fsRnT\">" +
      "<h3 id=\"fsRnT\">Renew AMC contract " + h(p.code || "") + "</h3><p class=\"muted\">" + h(p.name || "") + " · " + h(p.customer || "") + "</p>" +
      "<div class=\"fs-rn-now\"><div><small>Current period</small><b>" + h(fd(termStart(p)) || "–") + " to " + h(fd(p.amcEnd) || "–") + "</b></div>" +
      "<div><small>Current rate</small><b>" + (rt ? "Rs " + money(rt) + " per unit" : "–") + "</b></div><div><small>Current monthly charge</small><b>Rs " + money(fee) + "</b></div>" +
      (ren(p).length ? "<div><small>Renewed before</small><b>" + ren(p).length + (ren(p).length === 1 ? " time" : " times") + "</b></div>" : "") + "</div>" +
      "<div class=\"fs-rn-g\">" +
      "<label>Renewed on<input type=\"date\" id=\"fsRnOn\" value=\"" + h(today()) + "\"></label>" +
      "<label>New period from<input type=\"date\" id=\"fsRnFrom\" value=\"" + h(from) + "\"></label>" +
      "<label>New period to<input type=\"date\" id=\"fsRnTo\" value=\"" + h(endAfter(from, len)) + "\"></label>" +
      "<label>Units (lifts)<input type=\"number\" min=\"0\" step=\"1\" id=\"fsRnU\" value=\"" + h(U || "") + "\"></label>" +
      (byRate ? "<label>Revised rate per unit per month (PKR)<input type=\"number\" min=\"0\" step=\"any\" id=\"fsRnR\" value=\"" + h(rt || "") + "\"></label>" +
        "<label>Revised monthly charge (PKR)<input type=\"text\" id=\"fsRnF\" readonly class=\"fs-cv-lock\"></label>" :
        "<label>Revised monthly charge (PKR)<input type=\"number\" min=\"0\" step=\"any\" id=\"fsRnF\" value=\"" + h(fee || "") + "\"></label><span></span>") +
      "<label class=\"w\">Reference / note<input type=\"text\" id=\"fsRnN\" maxlength=\"200\" placeholder=\"e.g. renewal letter no., revised by 10% as agreed\"></label></div>" +
      "<p class=\"fs-rn-sum\" id=\"fsRnS\"></p><p class=\"fs-rn-err\" id=\"fsRnE\" role=\"alert\"></p>" +
      "<div class=\"fs-rn-b\"><button type=\"button\" class=\"btn\" data-rnx=\"1\">Cancel</button><button type=\"button\" class=\"btn pri\" id=\"fsRnGo\">↻ Renew contract</button></div></div>";
    document.body.appendChild(box);
    calc();
    var r = document.getElementById(byRate ? "fsRnR" : "fsRnF"); if (r) { r.focus(); r.select(); }
  }
  function vals() {
    var g = function (id) { return String((document.getElementById(id) || {}).value || "").trim(); };
    var byRate = !!document.getElementById("fsRnR"), u = num(g("fsRnU")), rt = byRate ? num(g("fsRnR")) : 0;
    return { on: g("fsRnOn"), from: g("fsRnFrom"), to: g("fsRnTo"), units: u, rate: rt, fee: byRate ? Math.round(u * rt * 100) / 100 : num(g("fsRnF")), note: g("fsRnN"), byRate: byRate };
  }
  function calc() {
    var p = cur, s = document.getElementById("fsRnS"); if (!p || !s) return;
    var v = vals(), f = document.getElementById("fsRnF");
    if (v.byRate && f) f.value = v.fee ? money(v.fee) : "";
    var old = num(p.amcFee), m = monthsIn(v.from, v.to), d = v.fee - old;
    var gap = p.amcEnd && v.from > addDays(p.amcEnd, 1) ? monthsIn(addDays(p.amcEnd, 1), addDays(v.from, -1)) : 0;
    s.innerHTML = !v.fee || !m ? "" :
      "Monthly charge Rs " + money(old) + " → <b>Rs " + money(v.fee) + "</b> (" + signed(d) + ", " + (d >= 0 ? "+" : "") + pct(old, v.fee) + "%)" +
      (v.byRate && num(p.amcRate) && v.rate !== num(p.amcRate) ? "; rate per unit Rs " + money(num(p.amcRate)) + " → Rs " + money(v.rate) : "") + ". " +
      "New term " + m + " month" + (m === 1 ? "" : "s") + " = Rs " + money(v.fee * m) + " (excl. tax). Bills from " + h(mName(v.from)) + " use the revised rate; earlier months keep the old one." +
      (gap ? " <span class=\"warn\">The " + gap + " month" + (gap === 1 ? "" : "s") + " between the old end and the new start stay part of the contract and show as due in AMC billing; add them as free maintenance months on the contract if they are not billed.</span>" : "");
  }
  async function save() {
    var p = cur, e = document.getElementById("fsRnE"), go = document.getElementById("fsRnGo"); if (!p || !e) return;
    var v = vals(), re = /^\d{4}-\d{2}-\d{2}$/;
    var err = !re.test(v.on) ? "Enter the date it was renewed." : !re.test(v.from) || !re.test(v.to) ? "Enter the new period's from and to dates." :
      v.to < v.from ? "The new period ends before it starts." : p.amcEnd && v.from <= p.amcEnd ? "The new period must start after the current end, " + fd(p.amcEnd) + "." :
      v.byRate && !v.rate ? "Enter the revised rate per unit." : !v.fee ? "Enter the revised monthly charge." : !v.units && v.byRate ? "Enter the units." : "";
    if (err) { e.textContent = err; return; }
    var by = safe(function () { return approverName(); }, "") || "";
    var R = ren(p), m = monthsIn(v.from, v.to);
    var r = { no: R.length + 1, on: v.on, from: v.from, to: v.to, prevStart: termStart(p) || "", prevEnd: p.amcEnd || "",
      prevUnits: num(p.amcUnits), prevRate: num(p.amcRate), prevFee: num(p.amcFee), units: v.units || num(p.amcUnits), rate: v.rate, fee: v.fee,
      prevValue: num(p.contractValue), value: Math.round(v.fee * m), note: v.note, by: by, at: new Date().toISOString() };
    var x = JSON.parse(JSON.stringify(p));
    x.amcRenewals = R.concat([r]); x.amcEnd = v.to; x.amcFee = v.fee; x.amcRate = v.byRate ? v.rate : ""; if (v.units) x.amcUnits = v.units;
    x.contractValue = whole(x) || num(p.contractValue) + r.value;
    if (x.status === "Completed") x.status = "Active";
    go.disabled = true; e.textContent = "";
    try { await Store.save("projects", x); } catch (ex) { go.disabled = false; e.textContent = "Not saved: " + (ex.message || ex); return; }
    close();
    safe(function () { toast((p.code || p.name) + " renewed to " + fd(v.to) + " at Rs " + money(v.fee) + " a month from " + mName(v.from) + "."); }, null);
    safe(function () { render(); }, null);
  }
  async function undo(id) {
    var p = proj(id), R = ren(p); if (!p || !R.length) return;
    var r = R[R.length - 1], from = String(r.from).slice(0, 7);
    var billed = safe(function () { return Store.data.receivables.filter(function (x) { var k = String(x.amcKey || "").split("|"); return x.status !== "Void" && k[0] === p.id && (k[1] || "") >= from; }); }, []);
    if (billed.length) { safe(function () { toast("Invoices are already made for this renewal (" + billed.map(function (x) { return x.invoiceNo; }).join(", ") + "). Delete them in AMC billing first."); }, null); return; }
    if (!window.confirm("Undo renewal " + r.no + " of " + (p.code || p.name) + "? The contract goes back to ending " + fd(r.prevEnd) + " at Rs " + money(r.prevFee) + " a month.")) return;
    var x = JSON.parse(JSON.stringify(p));
    x.amcRenewals = R.slice(0, -1); if (!x.amcRenewals.length) delete x.amcRenewals;
    x.amcEnd = r.prevEnd; x.amcFee = r.prevFee; x.amcRate = r.prevRate || ""; if (r.prevUnits) x.amcUnits = r.prevUnits;
    x.contractValue = r.prevValue != null ? r.prevValue : Math.max(0, num(x.contractValue) - num(r.value));
    try { await Store.save("projects", x); } catch (ex) { safe(function () { toast("Not undone: " + (ex.message || ex)); }, null); return; }
    var c = document.getElementById("closeSheet"); if (c) c.click();
    safe(function () { toast("Renewal " + r.no + " of " + (p.code || p.name) + " undone."); }, null);
    safe(function () { render(); }, null);
  }

  // ---- what the list and the contract's View show
  function note(p) {
    var R = ren(p); if (!R.length) return "";
    var r = R[R.length - 1], up = r.fee - r.prevFee;
    return "<small class=\"fs-rn-l\">↻ Renewed " + h(fd(r.on)) + (R.length > 1 ? " (" + R.length + "×)" : "") + ": " +
      (r.rate && r.prevRate && r.rate !== r.prevRate ? "rate " + money(r.prevRate) + " → " + money(r.rate) : "Rs " + money(r.prevFee) + " → " + money(r.fee)) +
      (up ? " (" + (up > 0 ? "+" : "") + pct(r.prevFee, r.fee) + "%)" : "") + " from " + h(mName(r.from)) + "</small>";
  }
  function history(p) {
    var R = ren(p);
    var head = "<h4 style=\"margin:12px 0 4px\">Renewal history</h4>";
    if (!R.length) return head + "<p class=\"muted\" style=\"margin:0\">Not renewed yet. Use ↻ Renew on the AMC contracts list when it is renewed.</p>";
    return head + "<div class=\"tw\"><table class=\"fs-ac-t fs-rn-h\"><thead><tr><th>No.</th><th>Renewed on</th><th>New period</th><th class=\"num\">Units</th><th class=\"num\">Rate per unit</th><th class=\"num\">Monthly charge</th><th class=\"num\">Change</th><th>Reference / note</th><th>By</th></tr></thead><tbody>" +
      R.map(function (r) {
        return "<tr><td>" + r.no + "</td><td>" + h(fd(r.on)) + "</td><td style=\"white-space:nowrap\">" + h(fd(r.from)) + " to " + h(fd(r.to)) + "<br><small class=\"muted\">was " + h(fd(r.prevStart) || "–") + " to " + h(fd(r.prevEnd) || "–") + "</small></td>" +
          "<td class=\"num\">" + (r.prevUnits && r.units !== r.prevUnits ? r.prevUnits + " → " : "") + h(r.units || "–") + "</td>" +
          "<td class=\"num\">" + (r.rate || r.prevRate ? money(r.prevRate) + " → <b>" + money(r.rate) + "</b>" : "–") + "</td>" +
          "<td class=\"num\">" + money(r.prevFee) + " → <b>" + money(r.fee) + "</b></td>" +
          "<td class=\"num\">" + signed(r.fee - r.prevFee) + "<br><small class=\"muted\">" + (r.fee >= r.prevFee ? "+" : "") + pct(r.prevFee, r.fee) + "%</small></td>" +
          "<td>" + h(r.note || "") + "</td><td>" + h(r.by || "") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      "<p style=\"margin:6px 0 0\"><button type=\"button\" class=\"btn sm\" data-rnundo=\"" + h(p.id) + "\">Undo last renewal</button></p>";
  }
  window.FS_AMCR = { open: open, history: history, note: note };

  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var b = t.closest("[data-rnopen]"); if (b) { e.preventDefault(); safe(function () { open(b.getAttribute("data-rnopen")); }, null); return; }
    var u = t.closest("[data-rnundo]"); if (u) { e.preventDefault(); undo(u.getAttribute("data-rnundo")); return; }
    if (t.closest("[data-rnx]") || t.id === "fsRnM") { e.preventDefault(); close(); return; }
    if (t.closest("#fsRnGo")) { e.preventDefault(); save(); }
  });
  document.addEventListener("input", function (e) { if (e.target && e.target.closest && e.target.closest("#fsRnM")) safe(calc, null); });
  document.addEventListener("change", function (e) { if (e.target && e.target.closest && e.target.closest("#fsRnM")) safe(calc, null); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.getElementById("fsRnM")) close(); });

  var css = document.createElement("style");
  css.textContent = ".fs-rn-m{position:fixed;inset:0;background:rgba(15,30,50,.45);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px;overflow:auto}" +
    ".fs-rn-d{background:#fff;border-radius:12px;max-width:640px;width:100%;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.25)}.fs-rn-d h3{margin:0 0 2px}.fs-rn-d>p.muted{margin:0 0 10px}" +
    ".fs-rn-now{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;background:#f4f7fa;border:1px solid #e0e6ec;border-radius:8px;padding:8px 10px;margin-bottom:12px}.fs-rn-now div{display:flex;flex-direction:column}.fs-rn-now small{color:#667;font-weight:600;font-size:11.5px}.fs-rn-now b{font-size:13.5px}" +
    ".fs-rn-g{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fs-rn-g label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:600;color:#445}.fs-rn-g .w{grid-column:1/-1}.fs-rn-g input{font:inherit;font-weight:400;padding:7px 9px;border:1px solid #cfd6de;border-radius:8px;width:100%;box-sizing:border-box}" +
    ".fs-rn-g input.fs-cv-lock{background:#f3f6f9}.fs-rn-sum{font-size:13px;margin:12px 0 0;color:#234}.fs-rn-sum .warn{color:#9a5b00;display:block;margin-top:4px}.fs-rn-err{color:#b0412e;font-size:13px;margin:6px 0 0;min-height:1em}" +
    ".fs-rn-b{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.fs-rn-l{display:block;color:#1F6FB8;font-weight:600;margin-top:3px;white-space:normal;max-width:220px}" +
    "@media (max-width:560px){.fs-rn-g{grid-template-columns:1fr}}";
  (document.head || document.documentElement).appendChild(css);
})();
