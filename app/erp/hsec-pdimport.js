// Payment demands from an Excel demand sheet (hassan, 2026-11-24: "upload these demands into the system in demand
// module, if they are already updated ignore that"). Payables › Payment demands gets "Import demands from Excel":
//  * The sheet is the "Necessary Demands of <company>" layout: a heading row naming the company, then Date, Details,
//    Payment, Regions, Comments; several companies may follow each other on one sheet. Total rows are skipped.
//  * Each row becomes a demand in that company: branch from Regions ("HO" = Head office), pay to from Details (the part
//    before the first "_", or after "Vendor Payable:"), one line with the Details and the amount, payable account
//    220204, a date in Comments becomes "Needed by", other comments go to Notes.
//  * A row already in the system (same company and amount, and the same date or the same pay to), or twice in the file,
//    is shown as such and not imported.
//  * Imported demands are saved WITHOUT their JV: the sheet has no expense account. Opening one, choosing the account
//    on its line and saving posts the JV as usual. Nothing is posted by the import.
(function () {
  /* global Store, V, ENTS, coName, accByCode, nextNo, tbLib, toast, esc, fmt, n, scheduleRender, settings */
  var DEM = "paydemands";
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var num = function (v) { return typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")) || 0; };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var money = function (v) { return safe(function () { return fmt(v); }, String(v)); };
  var low = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  var plan = null;

  function isoDate(v) {
    if (v == null || v === "") return "";
    if (typeof v === "number" && v > 20000 && v < 80000) { var d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
    if (v instanceof Date && !isNaN(v)) return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0") + "-" + String(v.getDate()).padStart(2, "0");
    var s = String(v).trim(), m = s.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})$/);
    if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : "";
  }
  function entOf(text) {
    var t = String(text || "").replace(/^.*\bof\b/i, "").trim().toUpperCase(); if (!t) return "";
    var E = safe(ENTS, []) || [];
    return E.find(function (e) { return String(e).toUpperCase() === t; }) ||
      E.find(function (e) { return low(safe(function () { return coName(e); }, "")) === low(t); }) ||
      E.find(function (e) { return t.split(/\s+/).indexOf(String(e).toUpperCase()) >= 0; }) || "";
  }
  var branchOf = function (v) { var s = String(v || "").trim(); return !s || /^(.*\s)?h\.?o\.?$|head ?office/i.test(s) ? "Head office" : s; };
  function payeeOf(d) {
    var s = String(d || "").trim(), m = s.match(/vendor payable\s*:\s*(.+)$/i); if (m) return m[1].trim();
    var p = s.split("_")[0].trim(); return p || s;
  }
  var amtOf = function (r) { return Math.round(n(r.amount) || (r.items || []).reduce(function (s, l) { return s + n(l.amount); }, 0)); };

  // the rows of the sheet, company by company
  function read(rows) {
    var out = [], ent = "", head = null, seen = {};
    rows.forEach(function (r, i) {
      var cells = r.map(function (c) { return c == null ? "" : c; }), first = String(cells[0] || "").trim();
      if (/demands?\s+of\b/i.test(first) && !cells.slice(1).some(function (c) { return String(c).trim(); })) { ent = entOf(first); head = null; out.push({ hdr: first, ent: ent }); return; }
      var labels = cells.map(function (c) { return low(c); });
      if (labels.indexOf("date") >= 0 && labels.some(function (l) { return /^(details?|description)$/.test(l); })) {
        head = { date: labels.indexOf("date"), det: labels.findIndex(function (l) { return /^(details?|description)$/.test(l); }), amt: labels.findIndex(function (l) { return /^(payment|amount)/.test(l); }),
          rg: labels.findIndex(function (l) { return /^(regions?|branch|office)/.test(l); }), cm: labels.findIndex(function (l) { return /^(comments?|remarks?)/.test(l); }) };
        return;
      }
      if (!head) return;
      var det = String(cells[head.det] || "").trim(), amt = Math.round(num(cells[head.amt]));
      if (!det || /^(grand )?total/i.test(det) || !amt) return;
      var x = { line: i + 1, ent: ent || safe(function () { return V.ent !== "All" ? V.ent : ""; }, ""), date: isoDate(cells[head.date]), desc: det, amount: amt, branch: branchOf(head.rg >= 0 ? cells[head.rg] : ""), payee: payeeOf(det) };
      var cm = head.cm >= 0 ? cells[head.cm] : "", cd = isoDate(cm);
      if (cd) x.due = cd; else if (String(cm).trim()) x.note = String(cm).trim();
      var have = (Store.data[DEM] || []).find(function (r) { return r.entity === x.ent && Math.abs(amtOf(r) - x.amount) < 1 && (r.date === x.date || low(r.payee) === low(x.payee) || low(r.description) === low(x.desc)); });
      var key = [x.ent, x.date, x.amount, low(x.desc)].join("|");
      x.skip = !x.ent ? "Company not found in the heading" : !x.date ? "No date" : have ? "Already in the system (" + (have.demandNo || "saved") + ")" : seen[key] ? "Twice in this file" : "";
      seen[key] = 1;
      out.push(x);
    });
    return out;
  }

  function box() {
    var R = plan.rows, go = R.filter(function (x) { return !x.hdr && !x.skip; });
    var body = plan.err ? "<p class=\"err\">" + h(plan.err) + "</p>" :
      "<p class=\"muted\" style=\"margin-top:0\">" + go.length + " new demand" + (go.length === 1 ? "" : "s") + " (Rs " + money(go.reduce(function (s, x) { return s + x.amount; }, 0)) + ") will be added; " +
      R.filter(function (x) { return x.skip; }).length + " row(s) are skipped. They are saved without their JV: open each one, choose the expense account on its line and save to post it.</p>" +
      "<div class=\"tw\" style=\"max-height:55vh;overflow:auto\"><table class=\"fs-pdi-t\"><thead><tr><th>Date</th><th>Pay to</th><th>For</th><th>Branch</th><th class=\"num\">Amount</th><th>Needed by / notes</th><th>Action</th></tr></thead><tbody>" +
      R.map(function (x) {
        if (x.hdr) return "<tr class=\"hdr\"><td colspan=\"7\">" + h(x.hdr) + (x.ent ? " → " + h(safe(function () { return coName(x.ent); }, x.ent)) : " (company not recognised)") + "</td></tr>";
        return "<tr class=\"" + (x.skip ? "skip" : "") + "\"><td>" + h(x.date) + "</td><td>" + h(x.payee) + "</td><td>" + h(x.desc) + "</td><td>" + h(x.branch) + "</td><td class=\"num\">" + money(x.amount) + "</td><td>" + h(x.due ? "Needed by " + x.due : x.note || "") + "</td><td>" + (x.skip ? h(x.skip) : "<b>New</b>") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    return "<div class=\"fs-pdi-bg\" id=\"fsPdiBg\"><div class=\"fs-pdi\"><h3 style=\"margin-top:0\">Import payment demands from Excel</h3>" + body +
      "<div class=\"actions\" style=\"margin-top:10px\">" + (!plan.err && go.length ? "<button class=\"btn pri\" type=\"button\" id=\"fsPdiGo\">Add " + go.length + " demand" + (go.length === 1 ? "" : "s") + "</button>" : "") +
      "<button class=\"btn line\" type=\"button\" id=\"fsPdiX\">Close</button></div></div></div>";
  }
  function show() { var o = document.getElementById("fsPdiBg"); if (o) o.remove(); if (plan) document.body.insertAdjacentHTML("beforeend", box()); }

  async function create() {
    var b = document.getElementById("fsPdiGo"); if (b) { b.disabled = true; b.textContent = "Saving..."; }
    var k = 0, fail = "";
    var payAcc = function (ent) { var A = (Store.data.accounts || []).filter(function (a) { return String(a.code) === "220204" && (!a.entity || a.entity === ent); }); return (A.find(function (a) { return a.entity === ent; }) || A[0] || safe(function () { return accByCode()["220204"]; }, null) || {}).id || ""; };
    for (var i = 0; i < plan.rows.length; i++) {
      var x = plan.rows[i]; if (x.hdr || x.skip) continue;
      var rec = { demandNo: nextNo(DEM, "demandNo", "PD-"), date: x.date, entity: x.ent, branch: x.branch, requestedBy: x.branch + " (demand sheet)", payee: x.payee,
        dueDate: x.due || "", kind: "", payAcc: payAcc(x.ent), description: x.desc, amount: x.amount, notes: [x.note || "", "Imported from the demand sheet, row " + x.line + "."].filter(Boolean).join(" "),
        items: [{ desc: x.desc, account: "", project: "", dept: "", qty: 1, rate: x.amount, amount: x.amount }] };
      try { var id = await Store.save(DEM, rec); if (!(Store.data[DEM] || []).some(function (r) { return r.id === id; })) Store.data[DEM].push(Object.assign({ id: id }, rec)); x.skip = "Added as " + rec.demandNo; k++; }
      catch (e) { fail = (e && e.message) || String(e); x.skip = "Not saved: " + fail; }
    }
    safe(function () { toast(k + " demand" + (k === 1 ? "" : "s") + " added" + (fail ? "; some could not be saved: " + fail : "") + ". Open each, choose the expense account and save to post its JV."); }, null);
    show(); var g = document.getElementById("fsPdiGo"); if (g) g.remove();
    safe(scheduleRender, null);
  }

  // the button in the list's bar
  var canEdit = function () { return !(window.FS_BRIDGE && FS_BRIDGE.edit === false); };
  new MutationObserver(function () {
    if (!/\/paydemands$/.test(location.hash) || document.getElementById("fsPdiOpen") || !canEdit()) return;
    var q = document.querySelector("#q"), bar = q && q.closest(".bar"); if (!bar) return;
    bar.insertAdjacentHTML("beforeend", "<button class=\"btn line\" type=\"button\" id=\"fsPdiOpen\">Import demands from Excel</button><input type=\"file\" id=\"fsPdiFile\" accept=\".xlsx,.xls,.csv\" style=\"position:absolute;left:-9999px\">");
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.id) return;
    if (t.id === "fsPdiOpen") { var f = document.getElementById("fsPdiFile"); if (f) { f.value = ""; f.click(); } }
    if (t.id === "fsPdiGo") create();
    if (t.id === "fsPdiX" || t.id === "fsPdiBg") { plan = null; show(); }
  });
  document.addEventListener("change", async function (e) {
    if (!e.target || e.target.id !== "fsPdiFile" || !e.target.files[0]) return;
    try {
      var X = await tbLib(), wb = X.read(await e.target.files[0].arrayBuffer(), { type: "array", cellDates: true }), rows = [];
      wb.SheetNames.forEach(function (s) { rows = rows.concat(X.utils.sheet_to_json(wb.Sheets[s], { header: 1, raw: true, defval: "" })); });
      plan = { rows: read(rows) };
      if (!plan.rows.some(function (x) { return !x.hdr; })) plan.err = "No demand rows found. The sheet needs a row with Date, Details and Payment headings.";
    } catch (er) { plan = { rows: [], err: (er && er.message) || "Could not read the file." }; }
    show();
  });
  var css = document.createElement("style");
  css.textContent = ".fs-pdi-bg{position:fixed;inset:0;background:rgba(15,30,50,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".fs-pdi{background:#fff;border-radius:12px;padding:18px 20px;max-width:1100px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.25)}" +
    ".fs-pdi-t{width:100%;border-collapse:collapse;font-size:13px}.fs-pdi-t th,.fs-pdi-t td{padding:6px 8px;border-bottom:1px solid #e6eaef;text-align:left;vertical-align:top}.fs-pdi-t th{background:#f4f6f9;position:sticky;top:0}" +
    ".fs-pdi-t .num{text-align:right;white-space:nowrap}.fs-pdi-t tr.hdr td{background:#13304f;color:#fff;font-weight:700}.fs-pdi-t tr.skip td{color:#8a94a3}";
  (document.head || document.documentElement).appendChild(css);
})();
