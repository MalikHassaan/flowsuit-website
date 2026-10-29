// Projects: import a projects list from Excel (hassan, 2026-10-29). One row per project with Project, Contract Value,
// Expected LC, Payment Terms and Status columns. Each row becomes a project in the chosen company, and its payment terms
// become its billing milestones (same reading as the Billing schedule's paste box, FS_TERMS in hsec-terms.js).
// "In hand" projects are Active; "Pipeline (90%)" ones are Tendering with a 90% win chance. Subtotal and total rows are
// skipped, and a project whose name is already in the company is left as it is. Nothing is saved until "Create" is pressed.
(function () {
  /* global S, V, Store, listView, render, toast, esc, fmt, n, tbLib, byEnt, coName */
  var plan = null;
  var str = function (v) { return v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim(); };
  var num = function (v) { if (typeof v === "number") return v; var x = parseFloat(str(v).replace(/[,\s]/g, "")); return isNaN(x) ? 0 : x; };
  var same = function (a, b) { return str(a).toLowerCase() === str(b).toLowerCase(); };

  function header(rows) {
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var t = (rows[i] || []).map(function (c) { return str(c).toLowerCase(); }), find = function (re) { for (var k = 0; k < t.length; k++) if (re.test(t[k])) return k; return -1; };
      var c = { name: find(/^project/), cv: find(/contract/), lc: find(/\blc\b|budget/), terms: find(/payment|terms/), status: find(/status/), customer: find(/customer|client/) };
      if (c.name >= 0 && c.cv >= 0) return { row: i, c: c };
    }
    return null;
  }
  function type(name) { return /spare|parts|supply/i.test(name) ? "Supply only" : /modern/i.test(name) ? "Modernisation" : "New installation"; }
  function read(rows) {
    var h = header(rows);
    if (!h) return { err: "No Project and Contract Value columns found in the first rows of the first sheet." };
    var have = byEnt(Store.data.projects.slice()), out = [];
    rows.slice(h.row + 1).forEach(function (r) {
      r = r || [];
      var name = str(r[h.c.name]), cv = num(r[h.c.cv]);
      if (!name || /^(sub)?total\b/i.test(name) || /^(sub)?total\b/i.test(str(r[0]))) return;
      var st = h.c.status >= 0 ? str(r[h.c.status]) : "", win = (st.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1];
      var terms = h.c.terms >= 0 ? str(r[h.c.terms]) : "", parts = terms ? window.FS_TERMS.parse(terms) : [];
      var bad = parts.some(function (p) { return !p; }), tot = bad ? 0 : parts.reduce(function (s, p) { return s + p.pct; }, 0);
      var x = { name: name, customer: h.c.customer >= 0 ? str(r[h.c.customer]) : "", cv: Math.round(cv), lc: h.c.lc >= 0 ? Math.round(num(r[h.c.lc])) : 0,
        pipeline: /pipeline|tender|prospect/i.test(st), win: win ? +win : null, statusTxt: st, terms: terms, parts: bad ? [] : parts, tot: Math.round(tot * 10) / 10, note: "" };
      if (have.some(function (p) { return same(p.name, name); })) x.note = "Already in this company, left as it is";
      else if (!cv) x.note = "No contract value, skipped";
      else if (bad) x.note = "Payment terms could not be read; add milestones by hand";
      else if (parts.length && Math.abs(tot - 100) > 0.5) x.note = "Payment terms add to " + x.tot + "%, not 100%; check them";
      x.make = !/^(Already|No contract)/.test(x.note);
      out.push(x);
    });
    return { rows: out };
  }

  function panel() {
    var p = '<div class="panel" id="fsPi" style="margin-bottom:12px"><h3 style="margin-top:0">Import projects from Excel</h3>' +
      '<p class="muted" style="margin-top:0">One row per project with Project, Contract Value, Expected LC, Payment Terms and Status columns. Each payment term becomes a billing milestone.</p>';
    if (V.ent === "All") return p + '<p class="muted">Pick one company at the top right first; the projects are created in that company.</p></div>';
    p += '<div class="actions"><label class="btn" for="fsPiFile" style="cursor:pointer">Choose Excel file</label><input type="file" id="fsPiFile" accept=".xlsx,.xls" style="position:absolute;left:-9999px">' +
      '<span class="muted">Projects go into ' + esc(coName(V.ent)) + '.</span></div><p class="err" id="fsPiErr">' + (plan && plan.err ? esc(plan.err) : "") + "</p>";
    if (plan && plan.rows && plan.ent === V.ent) {
      var mk = plan.rows.filter(function (x) { return x.make; });
      p += '<div class="tw"><table><thead><tr><th>Project</th><th class="num">Contract value</th><th class="num">Expected LC</th><th>Status</th><th class="num">Milestones</th><th>Note</th></tr></thead><tbody>' +
        plan.rows.map(function (x) {
          return "<tr><td>" + esc(x.name) + '</td><td class="num">' + fmt(x.cv) + '</td><td class="num">' + (x.lc ? fmt(x.lc) : "") + "</td><td>" + (x.pipeline ? "Tendering" + (x.win ? ", " + x.win + "% win chance" : "") : "Active") +
            '</td><td class="num">' + (x.parts.length ? x.parts.length + " (" + x.tot + "%)" : "none") + "</td><td>" + esc(x.note || (x.parts.length ? "" : "No payment terms; add milestones later")) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<div class="banner info" style="margin-top:10px">The budgeted cost is set to the expected LC amount. Add freight, duties, installation labour and other local costs to each project\'s budget, or profit and % complete will be overstated.</div>' +
        '<div class="actions" style="margin-top:8px">' + (mk.length ? '<button class="btn pri" type="button" id="fsPiGo">Create ' + mk.length + " project" + (mk.length > 1 ? "s" : "") + "</button>" : '<span class="muted">Nothing new to create.</span>') +
        '<button class="btn line" type="button" id="fsPiX">Cancel</button></div>';
    }
    return p + "</div>";
  }

  async function create() {
    var go = document.getElementById("fsPiGo"); if (go) { go.disabled = true; go.textContent = "Creating..."; }
    var k = 0, ms = 0;
    try {
      for (var i = 0; i < plan.rows.length; i++) {
        var x = plan.rows[i]; if (!x.make) continue;
        var rec = { name: x.name, customer: x.customer, entity: plan.ent, type: type(x.name), contractValue: x.cv, budgetCost: x.lc || "", lcExpected: x.lc || "",
          status: x.pipeline ? "Tendering" : "Active", winPct: x.win || "", paymentTerms: x.terms,
          billing: x.parts.map(function (p, j) { return { id: "ms" + Date.now().toString(36) + j + Math.random().toString(36).slice(2, 6), m: p.m, ev: window.FS_MS ? FS_MS.guess(p.m) : "", pct: p.pct, amt: "", plan: "" }; }) };
        await Store.save("projects", rec); k++; ms += rec.billing.length;
      }
      toast(k + " projects created with " + ms + " billing milestones. Enter the planned dates under Receivables › Billing schedule.");
      plan = null;
    } catch (e) { toast((e && e.message) || "Could not save. Reload and try again; projects already created stay."); plan = null; }
    render();
  }

  function hook() {
    if (typeof listView !== "function" || typeof S === "undefined" || !S.projects || !window.FS_TERMS || typeof tbLib !== "function") return false;
    var f = S.projects.fields, at = f.findIndex(function (x) { return x.k === "costToDate"; });
    f.splice(at < 0 ? f.length : at, 0, { k: "lcExpected", l: "Expected LC amount (PKR)", t: "money", hint: "Imported cost; the budget above should add local costs to it." },
      { k: "winPct", l: "Win chance % (tendering)", t: "number" }, { k: "paymentTerms", l: "Payment terms (as in the contract)", t: "textarea" });
    var old = listView;
    listView = function (c) { // eslint-disable-line no-global-assign
      var h = old(c);
      return c === "projects" && window.FS_BRIDGE && FS_BRIDGE.edit !== false ? panel() + h : h;
    };
    document.addEventListener("change", async function (e) {
      if (e.target.id !== "fsPiFile" || !e.target.files[0]) return;
      try {
        var X = await tbLib(), wb = X.read(await e.target.files[0].arrayBuffer(), { type: "array" });
        plan = read(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" })); plan.ent = V.ent;
      } catch (er) { plan = { err: (er && er.message) || "Could not read the file." }; }
      render();
    });
    document.addEventListener("click", function (e) {
      if (e.target.id === "fsPiGo") create();
      if (e.target.id === "fsPiX") { plan = null; render(); }
    });
    if (/projects/.test(location.hash) && typeof render === "function") render();
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
