// Projects: import a projects list from Excel (hassan, 2026-10-29). One row per project with Project, Contract Value,
// Expected LC, Payment Terms and Status columns. Each row becomes a project in the chosen company, and its payment terms
// become its billing milestones (same reading as the Billing schedule's paste box, FS_TERMS in hsec-terms.js).
// "In hand" projects are Active; "Pipeline (90%)" ones are Tendering with a 90% win chance. Subtotal and total rows are
// skipped. A project whose name is already in the company is updated (contract, LC, funding, milestones unless one is already
// invoiced). Milestones come from per-milestone % columns (Advance, BG, LC Opening, Shipping Docs / BL ...) when the sheet has
// them, otherwise from the Payment Terms text. Nothing is saved until the button under the preview is pressed.
(function () {
  /* global S, V, Store, listView, render, toast, esc, fmt, n, tbLib, byEnt, coName, bsInv */
  var plan = null;
  var str = function (v) { return v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim(); };
  var num = function (v) { if (typeof v === "number") return v; var x = parseFloat(str(v).replace(/[,\s]/g, "")); return isNaN(x) ? 0 : x; };
  var same = function (a, b) { return str(a).toLowerCase() === str(b).toLowerCase(); };

  // one column per milestone, as % of the contract (the "PROJECT PAYMENT SCHEDULE" layout): [header test, milestone name, business-cycle step]
  var MSCOLS = [[/^advance$/, "Advance", 1], [/bank guarantee|^bg$/, "Against bank guarantee", 2], [/^confirmation$/, "On confirmation", 1],
    [/^lc opening$/, "After LC opening", 5], [/shipping docs|\bbl\b/, "Against shipping documents / BL", 6], [/arrival at port/, "On arrival at port", 7],
    [/delivery at site/, "On delivery at site", 9], [/^installation$/, "After installation", 10], [/t\s*&\s*c|handover$/, "After T&C / handover", 10],
    [/post.?handover|retention/, "Retention after handover", 13]];
  // LC funding columns kept on the project: [header test, field, kind]
  var EXTRA = [[/receivables assigned/, "rcvAssigned", "text"], [/cash margin/, "lcMarginPct", "pct"], [/apg advance/, "apgAdjusted", "money"],
    [/funded by/, "lcFundedBy", "text"], [/^fatr amount/, "fatrPlanned", "money"], [/project funds at retirement/, "fundsAtRetire", "money"]];
  function header(rows) {
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var t = (rows[i] || []).map(function (c) { return str(c).toLowerCase(); }), find = function (re) { for (var k = 0; k < t.length; k++) if (t[k].length < 60 && re.test(t[k])) return k; return -1; };
      if (t.filter(Boolean).length < 2) continue; // a title line above the table
      var c = { name: find(/^project( name)?$/), cv: find(/^contract value/), lc: find(/\blc\b|budget/), terms: find(/payment terms|^terms/), status: find(/^status/), customer: find(/customer|client/) };
      if (c.name < 0) c.name = find(/^project/);
      if (c.cv < 0) c.cv = find(/contract/);
      if (c.lc === c.name || c.lc === c.cv) c.lc = -1;
      if (c.name >= 0 && c.cv >= 0) {
        c.ms = MSCOLS.map(function (m) { return { k: find(m[0]), m: m[1], ev: m[2] }; }).filter(function (m) { return m.k >= 0; });
        c.extra = EXTRA.map(function (x) { return { k: find(x[0]), f: x[1], t: x[2] }; }).filter(function (x) { return x.k >= 0; });
        return { row: i, c: c };
      }
    }
    return null;
  }
  function type(name) { return /spare|parts|supply/i.test(name) ? "Supply only" : /modern/i.test(name) ? "Modernisation" : "New installation"; }
  var pctOf = function (v) { var x = num(v); return x > 0 && x <= 1.0001 ? Math.round(x * 10000) / 100 : Math.round(x * 100) / 100; };
  var key = function (a) { return a.map(function (p) { return p.pct; }).sort(function (x, y) { return x - y; }).join(","); };
  function read(rows) {
    var h = header(rows);
    if (!h) return { err: "No Project and Contract Value columns found in the first rows of the first sheet." };
    var have = byEnt(Store.data.projects.slice()), out = [];
    rows.slice(h.row + 1).forEach(function (r) {
      r = r || [];
      var name = str(r[h.c.name]), cv = num(r[h.c.cv]);
      if (!name || /\(delete this row\)/i.test(name) || /^(sub)?total\b/i.test(name) || /^(sub)?total\b/i.test(str(r[0]))) return;
      var st = h.c.status >= 0 ? str(r[h.c.status]) : "", win = (st.match(/(\d+(?:\.\d+)?)\s*%/) || [])[1];
      var terms = h.c.terms >= 0 ? str(r[h.c.terms]) : "", tparts = terms ? window.FS_TERMS.parse(terms) : [], tbad = tparts.some(function (p) { return !p; });
      var cparts = h.c.ms.map(function (m) { return { m: m.m, ev: m.ev, pct: pctOf(r[m.k]) }; }).filter(function (p) { return p.pct > 0; });
      var parts = cparts.length ? cparts : tbad ? [] : tparts, tot = Math.round(parts.reduce(function (s, p) { return s + p.pct; }, 0) * 10) / 10;
      var extra = {}; h.c.extra.forEach(function (x) { var v = r[x.k]; extra[x.f] = x.t === "text" ? str(v) : x.t === "pct" ? pctOf(v) : Math.round(num(v)); });
      var low = name.toLowerCase(), old = have.find(function (p) { return same(p.name, name); }), like = null;
      if (!old) { var near = have.filter(function (p) { var q = str(p.name).toLowerCase(); return q.length > 3 && (low.indexOf(q) >= 0 || q.indexOf(low) >= 0); }); if (near.length === 1) old = like = near[0]; }
      var x = { name: name, customer: h.c.customer >= 0 ? str(r[h.c.customer]) : "", cv: Math.round(cv), lc: h.c.lc >= 0 ? Math.round(num(r[h.c.lc])) : 0, hasStatus: h.c.status >= 0,
        pipeline: /pipeline|tender|prospect/i.test(st), win: win ? +win : null, terms: terms, parts: parts, tot: tot, extra: extra, old: old || null, note: "" };
      var invoiced = old && (old.billing || []).some(function (b) { try { return !!bsInv(old, b); } catch (e) { return false; } });
      x.keepBilling = !!invoiced;
      if (!cv) x.note = "No contract value, skipped";
      else if (!cparts.length && tbad) x.note = "Payment terms could not be read; add milestones by hand";
      else if (parts.length && Math.abs(tot - 100) > 0.5) x.note = "Milestones add to " + tot + "%, not 100%; check them";
      else if (cparts.length && tparts.length && !tbad && key(cparts) !== key(tparts)) x.note = "Milestones taken from the % columns; the Payment Terms text says something different";
      if (like) x.note = "Same project as \"" + like.name + "\" (renamed to this name)" + (x.note ? ". " + x.note : "");
      if (invoiced) x.note = (x.note ? x.note + ". " : "") + "Milestones already invoiced, so its schedule is left as it is";
      x.make = !!cv;
      out.push(x);
    });
    return { rows: out };
  }

  function panel() {
    var p = '<div class="panel" id="fsPi" style="margin-bottom:12px"><h3 style="margin-top:0">Import projects from Excel</h3>' +
      '<p class="muted" style="margin-top:0">One row per project with Project, Contract Value and Expected LC, then either one % column per milestone (Advance, Bank Guarantee, LC Opening, Shipping Docs / BL, Arrival at Port, Delivery at Site, Installation, T&amp;C / Handover, Retention) or a Payment Terms text. Projects already here are updated, not added twice.</p>';
    if (V.ent === "All") return p + '<p class="muted">Pick one company at the top right first; the projects are created in that company.</p></div>';
    p += '<div class="actions"><label class="btn" for="fsPiFile" style="cursor:pointer">Choose Excel file</label><input type="file" id="fsPiFile" accept=".xlsx,.xls" style="position:absolute;left:-9999px">' +
      '<button class="btn line" type="button" id="fsPiTpl">Download template</button>' +
      '<span class="muted">Projects go into ' + esc(coName(V.ent)) + '.</span></div><p class="err" id="fsPiErr">' + (plan && plan.err ? esc(plan.err) : "") + "</p>";
    if (plan && plan.rows && plan.ent === V.ent) {
      var mk = plan.rows.filter(function (x) { return x.make; });
      p += '<div class="tw"><table><thead><tr><th>Project</th><th>Action</th><th class="num">Contract value</th><th class="num">Expected LC</th><th>Status</th><th class="num">Milestones</th><th>LC funded by</th><th>Note</th></tr></thead><tbody>' +
        plan.rows.map(function (x) {
          return "<tr><td>" + esc(x.name) + "</td><td>" + (!x.make ? "Skip" : x.old ? "Update" : "New") + '</td><td class="num">' + fmt(x.cv) + '</td><td class="num">' + (x.lc ? fmt(x.lc) : "") + "</td><td>" +
            (x.pipeline ? "Tendering" + (x.win ? ", " + x.win + "% win chance" : "") : x.old && !x.hasStatus ? esc(x.old.status || "Active") : "Active") +
            '</td><td class="num">' + (x.parts.length ? x.parts.length + " (" + x.tot + "%)" : "none") + "</td><td>" + esc(x.extra.lcFundedBy || "") + (x.extra.fatrPlanned ? " " + fmt(x.extra.fatrPlanned) : "") +
            "</td><td>" + esc(x.note || (x.parts.length ? "" : "No payment terms; add milestones later")) + "</td></tr>";
        }).join("") + "</tbody></table></div>" +
        '<div class="banner info" style="margin-top:10px">New projects start with the budgeted cost equal to the expected LC amount; an updated project keeps a budget you have already changed. Add freight, duties, installation labour and other local costs to each budget, or profit and % complete will be overstated.</div>' +
        '<div class="actions" style="margin-top:8px">' + (mk.length ? '<button class="btn pri" type="button" id="fsPiGo">' + (function () { var nw = mk.filter(function (x) { return !x.old; }).length, up = mk.length - nw; return [nw ? "Create " + nw : "", up ? "update " + up : ""].filter(Boolean).join(" and ").replace(/^u/, "U"); })() + " project" + (mk.length > 1 ? "s" : "") + "</button>" : '<span class="muted">Nothing to import.</span>') +
        '<button class="btn line" type="button" id="fsPiX">Cancel</button></div>';
    }
    return p + "</div>";
  }

  async function create() {
    var go = document.getElementById("fsPiGo"); if (go) { go.disabled = true; go.textContent = "Saving..."; }
    var k = 0, u = 0, ms = 0;
    var bill = function (x) { return x.parts.map(function (p, j) { return { id: "ms" + Date.now().toString(36) + j + Math.random().toString(36).slice(2, 6), m: p.m, ev: p.ev !== undefined ? p.ev : window.FS_MS ? FS_MS.guess(p.m) : "", pct: p.pct, amt: "", plan: "" }; }); };
    try {
      for (var i = 0; i < plan.rows.length; i++) {
        var x = plan.rows[i]; if (!x.make) continue;
        if (x.old) {
          var o = Store.data.projects.find(function (p) { return p.id === x.old.id; }) || x.old, upd = Object.assign({}, o, x.extra, { name: x.name, contractValue: x.cv, paymentTerms: x.terms || o.paymentTerms || "" });
          if (x.lc) { if (!n(o.budgetCost) || n(o.budgetCost) === n(o.lcExpected)) upd.budgetCost = x.lc; upd.lcExpected = x.lc; }
          if (x.customer) upd.customer = x.customer;
          if (x.hasStatus) { upd.status = x.pipeline ? "Tendering" : o.status === "Tendering" ? "Active" : o.status; upd.winPct = x.win || ""; }
          if (!x.keepBilling && x.parts.length) upd.billing = bill(x);
          await Store.save("projects", upd); u++; ms += x.keepBilling ? 0 : (upd.billing || []).length;
        } else {
          var rec = Object.assign({ name: x.name, customer: x.customer, entity: plan.ent, type: type(x.name), contractValue: x.cv, budgetCost: x.lc || "", lcExpected: x.lc || "",
            status: x.pipeline ? "Tendering" : "Active", winPct: x.win || "", paymentTerms: x.terms, billing: bill(x) }, x.extra);
          await Store.save("projects", rec); k++; ms += rec.billing.length;
        }
      }
      toast([k ? k + " projects created" : "", u ? u + " updated" : ""].filter(Boolean).join(", ") + ", with " + ms + " billing milestones. Each is linked to its business-cycle step.");
      plan = null;
    } catch (e) { toast((e && e.message) || "Could not save. Reload and try again; projects already saved stay."); plan = null; }
    render();
  }

  // a blank sheet in the layout read() expects, with two made-up example rows and a notes sheet
  async function template() {
    try {
      var X = await tbLib(), wb = X.utils.book_new();
      var ws = X.utils.aoa_to_sheet([["Sr.No.", "Project", "Customer", "Contract Value (PKR)", "Expected LC (PKR)", "Payment Terms", "Status"],
        [1, "Example Tower (delete this row)", "Example Developers", 25000000, 10000000, "25% advance; 25% after LC opening; 25% on delivery at site; 25% after handover", "In hand"],
        [2, "Example Hospital (delete this row)", "", 40000000, 18000000, "", "Pipeline (90%)"]]);
      ws["!cols"] = [{ wch: 7 }, { wch: 34 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 80 }, { wch: 16 }];
      X.utils.book_append_sheet(wb, ws, "Projects");
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["Column", "What to enter"],
        ["Project", "Required. The project name; a project already in the company with this name is updated, not added twice."],
        ["Customer", "Optional. The client's name."],
        ["Contract Value (PKR)", "Required. Total contract value, numbers only."],
        ["Expected LC (PKR)", "Optional. Imported cost; it becomes the starting budget, so add local costs to the budget after import."],
        ["Payment Terms", "Optional. Each part as 'NN% text', separated by ; or a new line, e.g. 10% on BG; 25% after LC. Each part becomes a milestone linked to its business-cycle step."],
        ["Status", "'In hand' makes an Active project. 'Pipeline (90%)' makes a Tendering project with a 90% win chance."],
        ["Totals", "Rows starting with Total or Subtotal are skipped."]]), "How to fill");
      X.writeFile(wb, "HSEC projects template.xlsx");
    } catch (er) { toast((er && er.message) || "Could not make the template."); }
  }

  function hook() {
    if (typeof listView !== "function" || typeof S === "undefined" || !S.projects || !window.FS_TERMS || typeof tbLib !== "function") return false;
    var f = S.projects.fields, at = f.findIndex(function (x) { return x.k === "costToDate"; });
    f.splice(at < 0 ? f.length : at, 0, { k: "lcExpected", l: "Expected LC amount (PKR)", t: "money", hint: "Imported cost; the budget above should add local costs to it." },
      { k: "winPct", l: "Win chance % (tendering)", t: "number" },
      { k: "rcvAssigned", l: "Receivables assigned to bank", t: "select", o: ["", "Yes", "No"] }, { k: "lcMarginPct", l: "LC cash margin %", t: "number" },
      { k: "apgAdjusted", l: "APG advance adjusted against LC (PKR)", t: "money" }, { k: "lcFundedBy", l: "LC balance funded by", t: "select", o: ["", "FATR", "Project funds"] },
      { k: "fatrPlanned", l: "FATR amount planned (PKR)", t: "money" }, { k: "fundsAtRetire", l: "Project funds needed at LC retirement (PKR)", t: "money" }, { k: "paymentTerms", l: "Payment terms (as in the contract)", t: "textarea" });
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
      if (e.target.id === "fsPiTpl") template();
      if (e.target.id === "fsPiGo") create();
      if (e.target.id === "fsPiX") { plan = null; render(); }
    });
    if (/projects/.test(location.hash) && typeof render === "function") render();
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
