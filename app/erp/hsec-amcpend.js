// AMC pending amounts from the maintenance recovery sheet (hassan, 2026-11-24: "treat the red highlighted as the pending
// amount, and the red highlighted by totalling should be equal to the pending column; I need to upload that into the
// system in AMC"). AMC › AMC contracts gets "Import pending from Excel":
//  * The workbook has one sheet per office (Rawalpindi, Lahore, Faisalabad, Karachi, Multan ...), each with a heading
//    row (Project, Jan ... Dec, Pending). A month cell whose amount is written in red is unpaid; the red cells of a row
//    must add up to its Pending column, and a row where they don't is flagged and not imported.
//  * Each row is matched to an AMC contract by name (it can be changed or skipped in the preview). Each red month
//    becomes an AMC invoice for that contract and month (dated the 1st, due 30 days later), so it shows as outstanding in
//    AMC billing, AMC reports, receipts and the projects dashboard, and the month is not billed again.
//  * A month the contract already has an invoice for is skipped.
//  * Each invoice gets its JV like any AMC invoice (Dr receivable, Cr AMC income), dated the 1st of its month (hassan,
//    2026-11-24: "it was never booked anywhere"). A month in a locked period keeps its invoice without a JV and is
//    listed, so it can be posted from the invoice once the period is open or dated later.
(function () {
  /* global Store, V, byEnt, tbLib, ivNextNo, idc, toast, esc, fmt, todayStr, scheduleRender, render, coName, makeAutoJv, approverName */
  var AMC = "Maintenance contract (AMC)";
  var MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  var MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var money = function (v) { return safe(function () { return fmt(Math.round(v)); }, String(Math.round(v))); };
  var low = function (s) { return String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim(); };
  var title = function (s) { s = String(s || "").trim(); return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s; };
  var plan = null;

  // ---- which cells are written in red: read from the file's own XML (SheetJS does not keep font colours) ----
  function redCells(X, buf) {
    var out = {};
    try {
      var cfb = X.CFB.read(new Uint8Array(buf), { type: "array" });
      var get = function (p) { var e = X.CFB.find(cfb, p); if (!e || !e.content) return ""; return new TextDecoder("utf-8").decode(e.content instanceof Uint8Array ? e.content : new Uint8Array(e.content)); };
      var dom = function (s) { return new DOMParser().parseFromString(s, "application/xml"); };
      var st = dom(get("xl/styles.xml") || get("/xl/styles.xml"));
      var fonts = [].slice.call(st.getElementsByTagName("fonts")[0] ? st.getElementsByTagName("fonts")[0].getElementsByTagName("font") : []).map(function (f) {
        var c = f.getElementsByTagName("color")[0]; if (!c) return false;
        var rgb = String(c.getAttribute("rgb") || "").toUpperCase();
        return /^(FF)?FF0000$/.test(rgb) || c.getAttribute("indexed") === "10";
      });
      var xfs = st.getElementsByTagName("cellXfs")[0], red = xfs ? [].slice.call(xfs.getElementsByTagName("xf")).map(function (x) { return !!fonts[+x.getAttribute("fontId") || 0]; }) : [];
      var wbx = dom(get("xl/workbook.xml") || get("/xl/workbook.xml")), rels = dom(get("xl/_rels/workbook.xml.rels") || get("/xl/_rels/workbook.xml.rels")), tgt = {};
      [].slice.call(rels.getElementsByTagName("Relationship")).forEach(function (r) { tgt[r.getAttribute("Id")] = r.getAttribute("Target"); });
      [].slice.call(wbx.getElementsByTagName("sheet")).forEach(function (s) {
        var id = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"), t = String(tgt[id] || "").replace(/^\/?(xl\/)?/, "");
        var xml = get("xl/" + t) || get("/xl/" + t); if (!xml) return;
        var set = out[s.getAttribute("name")] = {};
        [].slice.call(dom(xml).getElementsByTagName("c")).forEach(function (c) { if (red[+c.getAttribute("s") || 0]) set[c.getAttribute("r")] = 1; });
      });
    } catch (e) { out.err = (e && e.message) || "Could not read the colours."; }
    return out;
  }

  function contracts() { return safe(function () { return (byEnt(Store.data.projects) || []).filter(function (p) { return p.type === AMC; }); }, []); }
  function match(name) {
    var C = contracts(), t = low(name); if (!t) return "";
    var eq = C.filter(function (p) { return low(p.name) === t || low(p.customer) === t; }); if (eq.length === 1) return eq[0].id;
    var near = C.filter(function (p) { var q = low(p.name); return q.length > 2 && (q.indexOf(t) >= 0 || t.indexOf(q) >= 0); }); return near.length === 1 ? near[0].id : "";
  }

  function read(X, wb, red, year) {
    var rows = [];
    wb.SheetNames.forEach(function (sn) {
      var ws = wb.Sheets[sn], R = red[sn] || {}, A = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }), hd = null;
      var rg = X.utils.decode_range(ws["!ref"] || "A1"), r0 = rg.s.r, c0 = rg.s.c;
      A.forEach(function (row, i) {
        var L = row.map(function (v) { return low(v); });
        if (L.indexOf("project") >= 0 && L.indexOf("jan") >= 0) {
          hd = { p: L.indexOf("project"), m: MON.map(function (m) { return L.findIndex(function (x) { return x.slice(0, 3) === m; }); }), pend: L.indexOf("pending") };
          if (hd.pend < 0 && hd.m[11] >= 0) hd.pend = hd.m[11] + 1;
          return;
        }
        if (!hd) return;
        var name = String(row[hd.p] || "").trim(); if (!name || typeof row[0] !== "number") return;
        var addr = function (c) { return X.utils.encode_cell({ r: r0 + i, c: c0 + c }); };
        var items = [];
        hd.m.forEach(function (c, k) { if (c < 0 || !R[addr(c)]) return; var v = row[c]; if (typeof v === "number" && v > 0) items.push({ k: k, amt: Math.round(v) }); });
        var pend = Math.round(+row[hd.pend] || 0), sum = items.reduce(function (s, x) { return s + x.amt; }, 0);
        if (!items.length && !pend) return;
        var x = { sheet: sn, office: title(sn), name: name, items: items, pend: pend, sum: sum, pid: match(name) };
        x.bad = pend !== sum ? "Red months add to " + money(sum) + " but Pending says " + money(pend) : "";
        rows.push(x);
      });
    });
    return { rows: rows, year: year };
  }

  // the months of a row that will become invoices, given the contract picked
  function todo(x) {
    if (!x.pid || x.bad) return [];
    return x.items.filter(function (it) {
      var key = x.pid + "|" + plan.year + "-" + String(it.k + 1).padStart(2, "0");
      it.have = safe(function () { return (Store.data.receivables.find(function (r) { return r.amcKey === key && r.status !== "Void"; }) || {}).invoiceNo || (Store.data.receivables.some(function (r) { return r.amcKey === key && r.status !== "Void"; }) ? "an invoice" : ""); }, "");
      return !it.have;
    });
  }

  function box() {
    var C = contracts().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    var go = 0, amt = 0, tot = 0;
    var body = plan.err ? "<p class=\"err\">" + h(plan.err) + "</p>" : "<div class=\"tw\" style=\"max-height:56vh;overflow:auto\"><table class=\"fs-ap-t\"><thead><tr><th>Office (sheet)</th><th>Project in the sheet</th><th>AMC contract</th><th>Red months</th><th class=\"num\">Red total</th><th class=\"num\">Pending column</th><th>Result</th></tr></thead><tbody>" +
      plan.rows.map(function (x, i) {
        var T = todo(x), a = T.reduce(function (s, it) { return s + it.amt; }, 0); go += T.length; amt += a; tot += x.pend;
        var res = x.bad ? "<span class=\"bad\">" + h(x.bad) + ". Not imported.</span>" : !x.pid ? "<span class=\"warnt\">Pick the contract, or it is skipped</span>" :
          (T.length ? "<b>" + T.length + " invoice" + (T.length > 1 ? "s" : "") + ", Rs " + money(a) + "</b>" : "Nothing new") + (x.items.some(function (it) { return it.have; }) ? "<br><small class=\"muted\">Already billed: " + h(x.items.filter(function (it) { return it.have; }).map(function (it) { return MN[it.k] + " (" + it.have + ")"; }).join(", ")) + "</small>" : "");
        return "<tr class=\"" + (x.bad ? "skip" : "") + "\"><td>" + h(x.office) + "</td><td>" + h(x.name) + "</td><td><select data-apc=\"" + i + "\"><option value=\"\">Skip this row</option>" +
          C.map(function (p) { return "<option value=\"" + h(p.id) + "\"" + (p.id === x.pid ? " selected" : "") + ">" + h(p.name + (p.region ? " (" + p.region + ")" : "") + (V.ent === "All" ? " · " + p.entity : "")) + "</option>"; }).join("") + "</select></td><td>" +
          h(x.items.map(function (it) { return MN[it.k] + " " + money(it.amt); }).join(", ")) + "</td><td class=\"num\">" + money(x.sum) + "</td><td class=\"num\">" + money(x.pend) + "</td><td>" + res + "</td></tr>";
      }).join("") + "</tbody><tfoot><tr><td colspan=\"4\">Total</td><td class=\"num\">" + money(plan.rows.reduce(function (s, x) { return s + x.sum; }, 0)) + "</td><td class=\"num\">" + money(tot) + "</td><td>" + go + " invoices, Rs " + money(amt) + "</td></tr></tfoot></table></div>";
    var bad = plan.rows ? plan.rows.filter(function (x) { return x.bad; }).length : 0;
    return "<div class=\"fs-ap-bg\" id=\"fsApBg\"><div class=\"fs-ap\"><h3 style=\"margin-top:0\">Import AMC pending amounts</h3>" +
      (plan.err ? "" : "<p class=\"muted\" style=\"margin-top:0\">Every amount written in red is an unpaid month. Each becomes an AMC invoice for that month of <label>year <select id=\"fsApYr\">" +
        [0, 1, 2].map(function (k) { var y = +String(safe(todayStr, "") || new Date().toISOString()).slice(0, 4) - k; return "<option" + (y === plan.year ? " selected" : "") + ">" + y + "</option>"; }).join("") + "</select></label>, " +
        "with its JV (Dr receivable, Cr AMC income) dated the 1st of that month. " + (bad ? "<b class=\"bad\">" + bad + " row(s) don't add up and are left out.</b>" : "Every row's red months add up to its Pending column.") + "</p>") + body +
      "<div class=\"actions\" style=\"margin-top:10px\">" + (!plan.err && go ? "<button class=\"btn pri\" type=\"button\" id=\"fsApGo\">Create " + go + " invoices (Rs " + money(amt) + ")</button>" : "") +
      "<button class=\"btn line\" type=\"button\" id=\"fsApX\">Close</button></div></div></div>";
  }
  function show() { var o = document.getElementById("fsApBg"); if (o) o.remove(); if (plan) document.body.insertAdjacentHTML("beforeend", box()); }

  async function create() {
    var b = document.getElementById("fsApGo"); if (b) { b.disabled = true; b.textContent = "Saving..."; }
    var k = 0, sum = 0, fail = "", nojv = [], who = safe(function () { return approverName(); }, "") || "Accounts";
    for (var i = 0; i < plan.rows.length; i++) {
      var x = plan.rows[i], T = todo(x), p = (Store.data.projects || []).find(function (q) { return q.id === x.pid; }); if (!p) continue;
      for (var j = 0; j < T.length; j++) {
        var it = T[j], m = plan.year + "-" + String(it.k + 1).padStart(2, "0"), due = new Date(Date.UTC(plan.year, it.k, 1) + 30 * 864e5).toISOString().slice(0, 10);
        var rec = { entity: p.entity, projectId: p.id, customer: String(p.customer || p.name || "").trim(), project: p.code || "", invoiceNo: safe(function () { return ivNextNo(p.entity); }, ""),
          invoiceDate: m + "-01", dueDate: due, amount: it.amt, outputTax: 0, revAccount: safe(function () { return idc("410201"); }, ""), status: "Open", amcKey: p.id + "|" + m,
          notes: "Pending for " + MN[it.k] + " " + plan.year + " from the maintenance recovery sheet (" + x.office + ": " + x.name + "). Never booked before; posted on import.",
          doc: Object.assign({ layout: "standard", title: "INVOICE", to: { name: String(p.customer || p.name || "").trim(), address: "", attn: "" }, poRef: p.code || "", taxPct: 0, taxLabel: "Sales tax on services", notes: "" },
            safe(function () { return window.FS_AMCINV ? window.FS_AMCINV.docFor(p, 0) : {}; }, {}),
            { taxPct: 0, lines: [{ name: "Monthly maintenance and trouble shooting of elevators – " + (p.name || ""), period: MN[it.k] + ", " + plan.year, specs: "Pending amount brought forward", qty: 1, unit: it.amt }] }) };
        try {
          var id = await Store.save("receivables", rec);
          if (!(Store.data.receivables || []).some(function (r) { return r.id === id; })) Store.data.receivables.push(Object.assign({ id: id }, rec));
          k++; sum += it.amt;
        } catch (e) { fail = (e && e.message) || String(e); continue; }
        try {
          rec.id = id; var jv = typeof makeAutoJv === "function" ? await makeAutoJv("receivables", rec, "invoice", null, who) : null;
          if (jv) { rec.jvId = jv.id; await Store.save("receivables", rec); } else nojv.push(rec.invoiceNo + " (" + MN[it.k] + ")");
        } catch (e2) { nojv.push(rec.invoiceNo + " (" + MN[it.k] + ": " + ((e2 && e2.message) || e2) + ")"); }
      }
    }
    safe(function () { toast(k + " AMC invoice" + (k === 1 ? "" : "s") + " made for Rs " + money(sum) + " pending" + (fail ? "; some could not be saved: " + fail : "") + (nojv.length ? ". " + nojv.length + " have no JV yet: " + nojv.slice(0, 5).join("; ") + (nojv.length > 5 ? " …" : "") + ". Open them and use Post invoice to ledger." : ", each with its JV") + "."); }, null);
    show(); var g = document.getElementById("fsApGo"); if (g) g.remove();
    safe(scheduleRender, null);
  }

  var canEdit = function () { return !(window.FS_BRIDGE && FS_BRIDGE.edit === false); };
  new MutationObserver(function () {
    var bar = document.querySelector(".fs-ac-bar"); if (!bar || document.getElementById("fsApOpen") || !canEdit()) return;
    bar.insertAdjacentHTML("beforeend", "<button class=\"btn line\" type=\"button\" id=\"fsApOpen\">Import pending from Excel</button><input type=\"file\" id=\"fsApFile\" accept=\".xlsx\" style=\"position:absolute;left:-9999px\">");
  }).observe(document.documentElement, { childList: true, subtree: true });
  var last = null;
  async function load(buf, year) {
    try {
      var X = await tbLib(), wb = X.read(buf, { type: "array" }), red = redCells(X, buf);
      if (red.err) { plan = { err: "Could not read which amounts are red: " + red.err }; return; }
      plan = read(X, wb, red, year);
      if (!plan.rows.length) plan.err = "No red amounts found. The sheet needs a row with Project, Jan ... Dec and Pending, and the unpaid amounts written in red.";
    } catch (er) { plan = { err: (er && er.message) || "Could not read the file." }; }
  }
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.id) return;
    if (t.id === "fsApOpen") { var f = document.getElementById("fsApFile"); if (f) { f.value = ""; f.click(); } }
    if (t.id === "fsApGo") create();
    if (t.id === "fsApX" || t.id === "fsApBg") { plan = null; last = null; show(); safe(render, null); }
  });
  document.addEventListener("change", async function (e) {
    var t = e.target; if (!t) return;
    if (t.id === "fsApFile" && t.files[0]) { last = await t.files[0].arrayBuffer(); await load(last, +String(safe(todayStr, "") || new Date().toISOString()).slice(0, 4)); show(); }
    if (t.id === "fsApYr" && plan) { plan.year = +t.value; show(); }
    if (t.hasAttribute && t.hasAttribute("data-apc") && plan) { plan.rows[+t.getAttribute("data-apc")].pid = t.value; show(); }
  });
  var css = document.createElement("style");
  css.textContent = ".fs-ap-bg{position:fixed;inset:0;background:rgba(15,30,50,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".fs-ap{background:#fff;border-radius:12px;padding:18px 20px;max-width:1200px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.25)}" +
    ".fs-ap-t{width:100%;border-collapse:collapse;font-size:13px}.fs-ap-t th,.fs-ap-t td{padding:6px 8px;border-bottom:1px solid #e6eaef;text-align:left;vertical-align:top}.fs-ap-t th{background:#f4f6f9;position:sticky;top:0}" +
    ".fs-ap-t .num{text-align:right;white-space:nowrap}.fs-ap-t tfoot td{font-weight:700;background:#f6f8fa;border-top:2px solid #cfd6de}.fs-ap-t select{max-width:260px}.fs-ap .bad{color:#c0392b}.fs-ap .warnt{color:#a15c00;font-weight:600}.fs-ap-t tr.skip td{background:#fff6f5}";
  (document.head || document.documentElement).appendChild(css);
})();
