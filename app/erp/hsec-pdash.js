// Projects dashboard (hassan, 2026-11-23: "make a dashboard in the projects ... filtration, stats, selections, region
// wise progress ... and also give receipts collection details region wise and pending details"). The first tab of
// Projects (and of the AMC area): filters for category, region, status and a search, total tiles, then one view at a
// time: by region, by category, by company, by project, pending receipts (invoice by invoice) and receipts by month.
// Each view prints in the report template and exports to Excel (CSV).
//  * Contract value: the project's contract value (PKR).
//  * Invoiced: its customer invoices (not void). Collected: receipts on those invoices whose voucher is posted, money
//    received before go-live, and posted customer advances. Due: what the invoices still have outstanding (the app's own
//    outstanding figure). Overdue: due on invoices past their due date. Still to invoice: contract value less invoiced.
// Nothing is saved or posted.
(function () {
  /* global Store, MODS, TAB_HOME, TITLE, special, byEnt, V, esc, fmt, fdate, todayStr, render, sheetOpen, recdAR, outAR, jvOf, liveJv, coName, n, S */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var num = function (v) { return safe(function () { return n(v); }, parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0); };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var money = function (v) { return safe(function () { return fmt(Math.round(v)); }, String(Math.round(v))); };
  var pctOf = function (a, b) { return b > 0 ? Math.round(a / b * 100) : 0; };
  var today = function () { return safe(todayStr, new Date().toISOString().slice(0, 10)); };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var ST = (function () { try { return JSON.parse(sessionStorage.getItem("fs-pdash") || "") || {}; } catch (e) { return {}; } })();
  ST = Object.assign({ v: "region", cat: "", rg: "", st: "", q: "" }, ST);
  var keep = function () { try { sessionStorage.setItem("fs-pdash", JSON.stringify(ST)); } catch (e) { /* private window */ } };
  var DONE = /^(completed|cancelled|closed)$/i;
  var running = function (p) { return !DONE.test(p.status || "") && p.status !== "Tendering" && p.status !== "On hold"; };
  var group = function () { return safe(function () { return V.ent === "All"; }, false); };
  var regionOf = function (p) { return p.region ? p.region + (group() ? " (" + p.entity + ")" : "") : "No region set"; };
  var coOf = function (p) { return safe(function () { return coName(p.entity); }, "") || p.entity || ""; };

  // every project of the company chosen at the top, with its money figures
  function build() {
    var P = safe(function () { return byEnt(Store.data.projects); }, []) || [];
    var byId = {}; P.forEach(function (p) { byId[p.id] = { p: p, inv: [], cv: num(p.contractValue), invd: 0, col: 0, due: 0, od: 0, adv: 0, rc: [] }; });
    var t = today();
    (safe(function () { return Store.data.receivables; }, []) || []).forEach(function (r) {
      if (r.status === "Void") return;
      var x = byId[r.projectId] || byId[String(r.amcKey || "").split("|")[0]]; if (!x) return;
      var got = safe(function () { return num(recdAR(r)); }, num(r.received)), due = safe(function () { return num(outAR(r)); }, 0);
      x.inv.push({ r: r, due: due }); x.invd += num(r.amount); x.col += got; x.due += due;
      if (due > 0 && r.dueDate && r.dueDate < t) x.od += due;
      (r.receipts || []).forEach(function (c) { var j = safe(function () { return jvOf(c.jvId); }, null); if (j && j.status === "Posted" && c.date) x.rc.push({ d: c.date, a: num(c.amount) }); });
    });
    (safe(function () { return Store.data.custadv; }, []) || []).forEach(function (a) {
      var x = byId[a.projectId]; if (!x) return;
      var j = safe(function () { return liveJv("custadv", a.id, "receive"); }, null); if (!j || j.status !== "Posted") return;
      x.adv += num(a.amount); x.col += num(a.amount); if (a.date) x.rc.push({ d: a.date, a: num(a.amount) });
    });
    return Object.keys(byId).map(function (k) { var x = byId[k]; x.left = Math.max(0, x.cv - x.invd); return x; });
  }
  function filtered(all) {
    var q = String(ST.q || "").toLowerCase().trim();
    return all.filter(function (x) {
      var p = x.p;
      if (ST.cat && (p.type || "") !== ST.cat) return false;
      if (ST.rg && (ST.rg === "-" ? !!p.region : (p.region || "") !== ST.rg)) return false;
      if (ST.st === "run" && !running(p)) return false;
      if (ST.st && ST.st !== "run" && (p.status || "") !== ST.st) return false;
      if (q && [p.name, p.customer, p.code, p.poNo, p.region, p.type].join(" ").toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  var sum = function (L, k) { return L.reduce(function (s, x) { return s + x[k]; }, 0); };
  function groups(L, key) {
    var m = {}; L.forEach(function (x) { var k = key(x.p) || "Not set"; (m[k] = m[k] || []).push(x); });
    return Object.keys(m).map(function (k) { return { k: k, L: m[k] }; }).sort(function (a, b) { return sum(b.L, "cv") - sum(a.L, "cv"); });
  }
  var bar = function (v, tone) { v = Math.max(0, Math.min(100, v)); return "<div class=\"fs-pd-bar\" title=\"" + v + "%\"><i class=\"" + (tone || "") + "\" style=\"width:" + v + "%\"></i><span>" + v + "%</span></div>"; };

  // ---- the views: each returns { title, head, rows (array of cells as text), html } ----
  function groupView(title, first, G) {
    var head = [first, "Projects", "Running", "Contract value", "Invoiced", "Collected", "Due", "Overdue", "Still to invoice", "Billed %", "Collected %"];
    var line = function (k, L) { var cv = sum(L, "cv"), iv = sum(L, "invd"), c = sum(L, "col"); return [k, L.length, L.filter(function (x) { return running(x.p); }).length, cv, iv, c, sum(L, "due"), sum(L, "od"), sum(L, "left"), pctOf(iv, cv), pctOf(c, iv)]; };
    var rows = G.map(function (g) { return line(g.k, g.L); }), all = [].concat.apply([], G.map(function (g) { return g.L; })), tot = line("Total", all);
    var td = function (r, tag) { tag = tag || "td"; return "<" + tag + ">" + h(r[0]) + "</" + tag + ">" + r.slice(1, 9).map(function (v, i) { return "<" + tag + " class=\"num" + (i === 6 && v > 0 ? " bad" : "") + "\">" + (i < 2 ? v : money(v)) + "</" + tag + ">"; }).join("") + "<" + tag + ">" + bar(r[9]) + "</" + tag + "><" + tag + ">" + bar(r[10], r[10] < 50 ? "lo" : r[10] < 80 ? "mid" : "") + "</" + tag + ">"; };
    var html = "<table class=\"fs-pd-t\"><thead><tr>" + head.map(function (x, i) { return "<th" + (i && i < 9 ? " class=\"num\"" : "") + ">" + h(x) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + td(r) + "</tr>"; }).join("") + "</tbody><tfoot><tr>" + td(tot) + "</tr></tfoot></table>";
    return { title: title, head: head, rows: rows.concat([tot]), html: html };
  }
  function projView(L) {
    var head = ["Project", "Customer", "Company", "Category", "Region", "Status", "Contract value", "Invoiced", "Collected", "Due", "Overdue", "Still to invoice", "Billed %"];
    L = L.slice().sort(function (a, b) { return b.due - a.due || b.cv - a.cv; });
    var rows = L.map(function (x) { var p = x.p; return [p.name || "", p.customer || "", coOf(p), p.type || "", p.region || "", p.status || "", x.cv, x.invd, x.col, x.due, x.od, x.left, pctOf(x.invd, x.cv)]; });
    var tot = ["Total", "", "", "", "", L.length + " projects", sum(L, "cv"), sum(L, "invd"), sum(L, "col"), sum(L, "due"), sum(L, "od"), sum(L, "left"), pctOf(sum(L, "invd"), sum(L, "cv"))];
    var tr = function (r, tag) { tag = tag || "td"; return r.slice(0, 6).map(function (v) { return "<" + tag + ">" + h(v) + "</" + tag + ">"; }).join("") + r.slice(6, 12).map(function (v, i) { return "<" + tag + " class=\"num" + (i === 4 && v > 0 ? " bad" : "") + "\">" + money(v) + "</" + tag + ">"; }).join("") + "<" + tag + ">" + bar(r[12]) + "</" + tag + ">"; };
    return { title: "Projects", head: head, rows: rows.concat([tot]),
      html: "<table class=\"fs-pd-t\"><thead><tr>" + head.map(function (x, i) { return "<th" + (i > 5 && i < 12 ? " class=\"num\"" : "") + ">" + h(x) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + tr(r) + "</tr>"; }).join("") + "</tbody><tfoot><tr>" + tr(tot) + "</tr></tfoot></table>" };
  }
  function pendView(L) {
    var t = today(), I = [];
    L.forEach(function (x) { x.inv.forEach(function (i) { if (i.due > 0) I.push({ x: x, r: i.r, due: i.due, days: i.r.dueDate && i.r.dueDate < t ? Math.round((new Date(t) - new Date(i.r.dueDate)) / 864e5) : 0 }); }); });
    I.sort(function (a, b) { return b.days - a.days || b.due - a.due; });
    var head = ["Invoice no.", "Invoice date", "Due date", "Days overdue", "Project", "Region", "Category", "Invoice amount", "Due"];
    var rows = I.map(function (i) { return [i.r.invoiceNo || "", i.r.invoiceDate || "", i.r.dueDate || "", i.days, i.x.p.name || i.r.customer || "", i.x.p.region || "", i.x.p.type || "", num(i.r.amount), i.due]; });
    var tot = ["Total", "", "", "", I.length + " invoices", "", "", sum(I.map(function (i) { return { a: num(i.r.amount) }; }), "a"), sum(I, "due")];
    var d = function (s) { return s ? safe(function () { return fdate(s); }, s) : ""; };
    var tr = function (r, foot) { var tag = "td"; return "<" + tag + ">" + h(r[0]) + "</" + tag + "><" + tag + ">" + (!foot ? d(r[1]) : "") + "</" + tag + "><" + tag + ">" + (!foot ? d(r[2]) : "") + "</" + tag + "><" + tag + " class=\"num" + (r[3] > 90 ? " bad" : r[3] > 30 ? " warnt" : "") + "\">" + (!foot ? (r[3] || "Not yet due") : "") + "</" + tag + ">" + r.slice(4, 7).map(function (v) { return "<" + tag + ">" + h(v) + "</" + tag + ">"; }).join("") + "<" + tag + " class=\"num\">" + money(r[7]) + "</" + tag + "><" + tag + " class=\"num\">" + money(r[8]) + "</" + tag + ">"; };
    return { title: "Pending receipts", head: head, rows: rows.concat([tot]),
      html: I.length ? "<table class=\"fs-pd-t\"><thead><tr>" + head.map(function (x, i) { return "<th" + (i === 3 || i > 6 ? " class=\"num\"" : "") + ">" + h(x) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + tr(r) + "</tr>"; }).join("") + "</tbody><tfoot><tr>" + tr(tot, true) + "</tr></tfoot></table>" : "<p class=\"muted\">Nothing is outstanding on these projects' invoices.</p>" };
  }
  function monthView(L) {
    var t = today(), M = [], y = +t.slice(0, 4), m = +t.slice(5, 7) - 1;
    for (var i = 0; i < 12; i++) { var d = new Date(y, m - i, 1); M.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }
    var cols = groups(L, regionOf).map(function (g) { return g.k; });
    if (cols.length === 1 && cols[0] === "No region set") cols = [];
    var cell = {}; L.forEach(function (x) { var c = regionOf(x.p); x.rc.forEach(function (r) { var k = r.d.slice(0, 7); cell[k] = cell[k] || {}; cell[k][c] = (cell[k][c] || 0) + r.a; }); });
    var head = ["Month"].concat(cols, ["Total received"]);
    var rows = M.map(function (k) { var o = cell[k] || {}, tt = 0; var r = [MON[+k.slice(5, 7) - 1] + " " + k.slice(0, 4)].concat(cols.map(function (c) { tt += o[c] || 0; return o[c] || 0; })); if (!cols.length) Object.keys(o).forEach(function (c) { tt += o[c]; }); return r.concat([tt]); });
    var tot = ["Total"].concat(cols.map(function (c, i) { return rows.reduce(function (s, r) { return s + r[i + 1]; }, 0); }), [rows.reduce(function (s, r) { return s + r[r.length - 1]; }, 0)]);
    var tr = function (r, tag) { tag = tag || "td"; return "<" + tag + ">" + h(r[0]) + "</" + tag + ">" + r.slice(1).map(function (v) { return "<" + tag + " class=\"num\">" + (v ? money(v) : "") + "</" + tag + ">"; }).join(""); };
    return { title: "Receipts by month", head: head, rows: rows.concat([tot]),
      html: "<table class=\"fs-pd-t\"><thead><tr>" + head.map(function (x, i) { return "<th" + (i ? " class=\"num\"" : "") + ">" + h(x) + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + tr(r) + "</tr>"; }).join("") + "</tbody><tfoot><tr>" + tr(tot) + "</tr></tfoot></table>" +
        "<p class=\"muted\" style=\"margin-top:6px\">Posted receipts and posted customer advances, by the date the money came in, last 12 months" + (cols.length ? ", one column per office" : "") + ".</p>" };
  }
  var VIEWS = [["region", "By region"], ["cat", "By category"], ["co", "By company"], ["proj", "Projects"], ["pend", "Pending receipts"], ["month", "Receipts by month"]];
  function current(L) {
    if (ST.v === "cat") return groupView("By category", "Category", groups(L, function (p) { return p.type; }));
    if (ST.v === "co") return groupView("By company", "Company", groups(L, coOf));
    if (ST.v === "proj") return projView(L);
    if (ST.v === "pend") return pendView(L);
    if (ST.v === "month") return monthView(L);
    return groupView("By region", "Region / office", groups(L, regionOf));
  }

  function view() {
    var all = build(), L = filtered(all), R = current(L);
    var cv = sum(L, "cv"), iv = sum(L, "invd"), c = sum(L, "col"), due = sum(L, "due"), od = sum(L, "od"), left = sum(L, "left");
    var cats = []; all.forEach(function (x) { if (x.p.type && cats.indexOf(x.p.type) < 0) cats.push(x.p.type); }); cats.sort();
    var rgs = []; all.forEach(function (x) { if (x.p.region && rgs.indexOf(x.p.region) < 0) rgs.push(x.p.region); }); rgs.sort();
    var sts = []; all.forEach(function (x) { if (x.p.status && sts.indexOf(x.p.status) < 0) sts.push(x.p.status); });
    var opt = function (v, l, cur) { return "<option value=\"" + h(v) + "\"" + (v === cur ? " selected" : "") + ">" + h(l) + "</option>"; };
    var tile = function (l, v, s, tone) { return "<div class=\"fs-pd-tile " + (tone || "") + "\"><small>" + h(l) + "</small><b>" + v + "</b><span>" + s + "</span></div>"; };
    var edit = !!(window.FS_BRIDGE && FS_BRIDGE.edit !== false);
    return "<div class=\"fs-pd\">" +
      "<div class=\"fs-pd-f\"><select id=\"fsPdCat\">" + opt("", "All categories", ST.cat) + cats.map(function (x) { return opt(x, x, ST.cat); }).join("") + "</select>" +
      (rgs.length ? "<select id=\"fsPdRg\">" + opt("", "All regions", ST.rg) + rgs.map(function (x) { return opt(x, x, ST.rg); }).join("") + opt("-", "No region set", ST.rg) + "</select>" : "") +
      "<select id=\"fsPdSt\">" + opt("", "All statuses", ST.st) + opt("run", "Running only", ST.st) + sts.map(function (x) { return opt(x, x, ST.st); }).join("") + "</select>" +
      "<input id=\"fsPdQ\" placeholder=\"Search project, customer or PO\" value=\"" + h(ST.q) + "\">" +
      (ST.cat || ST.rg || ST.st || ST.q ? "<button class=\"btn sm line\" id=\"fsPdClr\" type=\"button\">Clear filters</button>" : "") +
      "<span style=\"flex:1\"></span>" + (edit ? "<button class=\"btn line\" id=\"fsPdImp\" type=\"button\">Import projects from Excel</button>" : "") + "</div>" +
      "<div class=\"fs-pd-tiles\">" +
      tile("Projects", L.length, L.filter(function (x) { return running(x.p); }).length + " running") +
      tile("Contract value", "PKR " + money(cv), "across " + L.length + " projects") +
      tile("Invoiced", "PKR " + money(iv), pctOf(iv, cv) + "% of contract value") +
      tile("Collected", "PKR " + money(c), pctOf(c, iv) + "% of invoiced", "good") +
      tile("Due from customers", "PKR " + money(due), od > 0 ? "PKR " + money(od) + " overdue" : "nothing overdue", od > 0 ? "bad" : "") +
      tile("Still to invoice", "PKR " + money(left), pctOf(left, cv) + "% of contract value") + "</div>" +
      "<div class=\"fs-pd-head\"><div class=\"fs-pd-tabs\">" + VIEWS.map(function (v) { return "<button type=\"button\" data-pdv=\"" + v[0] + "\" class=\"" + (v[0] === ST.v ? "on" : "") + "\">" + h(v[1]) + "</button>"; }).join("") + "</div>" +
      "<span><button class=\"btn sm\" id=\"fsPdPrint\" type=\"button\">Print</button> <button class=\"btn sm line\" id=\"fsPdCsv\" type=\"button\">Export to Excel</button></span></div>" +
      "<div class=\"tw fs-pd-w\">" + (L.length ? R.html : "<p class=\"muted\">No projects match these filters.</p>") + "</div></div>";
  }

  function filterText() { return [ST.cat || "All categories", ST.rg ? (ST.rg === "-" ? "No region set" : ST.rg) : "All regions", ST.st === "run" ? "Running only" : ST.st || "All statuses", ST.q ? "search \"" + ST.q + "\"" : ""].filter(Boolean).join(" · "); }
  function printIt() {
    var R = current(filtered(build())), co = safe(function () { return V.ent === "All" ? "All companies" : coName(V.ent); }, "");
    safe(function () { sheetOpen("<div class=\"sheetwrap\"><div class=\"sheet\"><div class=\"bar\"><button class=\"btn pri\" id=\"printSheet\">Print</button><button class=\"btn\" id=\"closeSheet\">Close</button></div><h2>Projects dashboard: " + h(R.title) + "</h2><p class=\"muted\">" + h(co) + " · " + h(filterText()) + "</p><div class=\"fs-pd\">" + R.html + "</div></div></div>"); }, null);
  }
  function csv() {
    var R = current(filtered(build()));
    var q = function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? "\"" + v.replace(/"/g, "\"\"") + "\"" : v; };
    var txt = [["Projects dashboard: " + R.title], [filterText()], [], R.head].concat(R.rows.map(function (r) { return r.map(function (v) { return typeof v === "number" ? Math.round(v) : v; }); })).map(function (r) { return r.map(q).join(","); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + txt], { type: "text/csv" })); a.download = "Projects-dashboard-" + R.title.replace(/\s+/g, "-") + ".csv"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  var redraw = function () { keep(); safe(render, null); };
  document.addEventListener("change", function (e) {
    var id = e.target && e.target.id; if (!id) return;
    if (id === "fsPdCat") { ST.cat = e.target.value; redraw(); }
    if (id === "fsPdRg") { ST.rg = e.target.value; redraw(); }
    if (id === "fsPdSt") { ST.st = e.target.value; redraw(); }
    if (id === "fsPdQ") { ST.q = e.target.value; redraw(); }
  });
  document.addEventListener("keyup", function (e) { if (e.target && e.target.id === "fsPdQ" && e.key === "Enter") { ST.q = e.target.value; redraw(); } });
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-pdv], #fsPdClr, #fsPdPrint, #fsPdCsv, #fsPdImp") : null; if (!t) return;
    if (t.dataset.pdv) { ST.v = t.dataset.pdv; redraw(); return; }
    if (t.id === "fsPdClr") { ST.cat = ST.rg = ST.st = ST.q = ""; redraw(); }
    if (t.id === "fsPdPrint") printIt();
    if (t.id === "fsPdCsv") csv();
    if (t.id === "fsPdImp") { // to the projects list, with the import box open
      safe(function () { V.tab[V.mod] = "projects"; render(); }, null);
      setTimeout(function () { var b = document.getElementById("fsPiOpen"); if (b) b.click(); }, 50);
    }
  });

  var hooked = false;
  function hook() {
    if (hooked) return true;
    if (typeof special !== "function" || typeof MODS === "undefined" || !MODS.proj || typeof Store === "undefined" || !Store.data) return false;
    hooked = true;
    special = (function (old) { return function (tab) { return tab === "pdash" ? safe(view, "<p class=\"muted\">Could not build the projects dashboard.</p>") : old.apply(this, arguments); }; })(special); // eslint-disable-line no-global-assign
    if (!MODS.proj.tabs.some(function (t) { return t[0] === "pdash"; })) MODS.proj.tabs.unshift(["pdash", "Dashboard"]);
    safe(function () { var T = MODS.amcm && MODS.amcm.tabs; if (T && !T.some(function (t) { return t[0] === "pdash"; })) T.splice(T.some(function (t) { return t[0] === "amccon"; }) ? 1 : 0, 0, ["pdash", "Dashboard"]); }, null);
    safe(function () { if (!TAB_HOME.pdash) TAB_HOME.pdash = "proj"; }, null);
    safe(function () { if (TITLE && !TITLE.pdash) TITLE.pdash = "Projects dashboard"; }, null);
    safe(function () { render(); }, null);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-pd-f{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.fs-pd-f select,.fs-pd-f input{min-width:150px}.fs-pd-f input{min-width:240px}" +
    ".fs-pd-tiles{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}" +
    ".fs-pd-tile{background:#fff;border:1px solid #d9e0e8;border-left:4px solid #1F6FB8;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:3px;min-width:0}" +
    ".fs-pd-tile small{color:#556;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.04em}.fs-pd-tile b{font-size:18px;color:#13304f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fs-pd-tile span{font-size:12px;color:#667}" +
    ".fs-pd-tile.good{border-left-color:#2e7d32}.fs-pd-tile.bad{border-left-color:#d32f2f}.fs-pd-tile.bad span{color:#c0392b;font-weight:600}" +
    ".fs-pd-head{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap;border-bottom:2px solid #e1e6ec;margin-bottom:0}" +
    ".fs-pd-tabs{display:flex;gap:2px;flex-wrap:wrap}.fs-pd-tabs button{border:0;background:none;padding:8px 14px;font:inherit;font-weight:600;color:#556;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px}" +
    ".fs-pd-tabs button.on{color:#1F6FB8;border-bottom-color:#1F6FB8}.fs-pd-tabs button:hover{color:#1F6FB8}.fs-pd-head>span{padding-bottom:6px}" +
    ".fs-pd-w{background:#fff;border:1px solid #e1e6ec;border-top:0;border-radius:0 0 10px 10px}" +
    ".fs-pd-t{width:100%;border-collapse:collapse;font-size:13px}.fs-pd-t th,.fs-pd-t td{padding:8px 10px;border-bottom:1px solid #e9edf2;text-align:left;white-space:nowrap}.fs-pd-t th{background:#f4f6f9;color:#334;font-size:12px}" +
    ".fs-pd-t .num{text-align:right}.fs-pd-t tbody tr:hover td{background:#f5f9fe}.fs-pd-t tfoot td{font-weight:700;background:#f6f8fa;border-top:2px solid #cfd6de}.fs-pd-t td.bad{color:#c0392b;font-weight:600}.fs-pd-t td.warnt{color:#a15c00;font-weight:600}" +
    ".fs-pd-bar{position:relative;min-width:90px;height:16px;background:#e9edf2;border-radius:8px;overflow:hidden}.fs-pd-bar i{position:absolute;left:0;top:0;bottom:0;background:#1F6FB8;border-radius:8px}.fs-pd-bar i.mid{background:#f2a516}.fs-pd-bar i.lo{background:#d32f2f}" +
    ".fs-pd-bar span{position:relative;display:block;text-align:center;font-size:11px;line-height:16px;font-weight:700;color:#13304f}" +
    "@media (max-width:1100px){.fs-pd-tiles{grid-template-columns:repeat(3,minmax(0,1fr))}}@media (max-width:640px){.fs-pd-tiles{grid-template-columns:1fr 1fr}}" +
    "@media print{.fs-pd-bar{border:1px solid #ccc}.fs-pd-bar i{print-color-adjust:exact;-webkit-print-color-adjust:exact}}";
  (document.head || document.documentElement).appendChild(css);
  function start(k) { if (!hook() && k < 300) setTimeout(function () { start(k + 1); }, 400); }
  start(0);
})();
