// Project form: payment terms as a table (hassan, 2026-10-29: "it should be in table form and predefined fields as well and link
// that fields with each factors and give option of add in it as well").
// Each row is one billing milestone of the project (the same project.billing rows the Billing schedule uses): milestone name
// (pick a predefined one or type a new one; names typed before are offered again), the business-cycle step it is linked to,
// %, amount (from the contract value) and an optional planned date. A milestone linked to a step becomes "Ready to invoice"
// in the Billing schedule and on Home as soon as that step is done in the project's business cycle (LC opened, documents
// received, goods delivered to site, handover...), so a planned date is no longer required for linked milestones.
(function () {
  /* global F, S, Store, V, fieldHtml, readForm, bsState, bsInv, pwState, pwSteps, render, toast, esc, fmt, n, $, approverName, bsAmt */
  // [name, step index in the business cycle (pwSteps)]
  var PRESET = [["Advance on signing", 1], ["Against bank guarantee", 2], ["After LC opening", 5], ["Against shipping documents / BL", 6],
    ["On arrival at port", 7], ["On delivery at site", 9], ["During installation", 10], ["After installation", 10], ["After testing & commissioning", 10],
    ["After handover", 13], ["After third-party inspection", 13], ["Retention after defects period", 13]];
  var STEPS = function () { try { return pwSteps(); } catch (e) { return []; } };
  function guess(m) {
    var s = String(m || "").toLowerCase(), p = PRESET.find(function (x) { return x[0].toLowerCase() === s; });
    if (p) return p[1];
    if (/\bbg\b|guarantee/.test(s)) return 2;
    if (/\blc\b|letter of credit/.test(s)) return 5;
    if (/ship|\bbl\b|lading|dispatch/.test(s)) return 6;
    if (/site|deliver/.test(s)) return 9;
    if (/port|arrival/.test(s)) return 7;
    if (/install|testing|commission|t\s*&\s*c|mechanical/.test(s)) return 10;
    if (/hand\s*over|inspection|retention|defect|month/.test(s)) return 13;
    if (/advance|sign|confirm|order|mobili/.test(s)) return 1;
    return "";
  }
  var evOf = function (r) { return r.ev === undefined || r.ev === null ? guess(r.m) : r.ev; };
  var stepName = function (k) { var s = STEPS()[k]; return s ? s.t : ""; };
  function names() {
    var seen = {}, out = [];
    PRESET.map(function (x) { return x[0]; }).concat(Store.data.projects.reduce(function (a, p) { return a.concat((p.billing || []).map(function (r) { return r.m; })); }, []))
      .forEach(function (m) { m = String(m || "").trim(); if (m && !seen[m.toLowerCase()]) { seen[m.toLowerCase()] = 1; out.push(m); } });
    return out;
  }
  var newId = function () { return "ms" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var cv = function () { var el = document.getElementById("f_contractValue"); return el ? n(String(el.value).replace(/,/g, "")) : n(F && F.rec.contractValue); };
  var amtOf = function (r) { return n(r.amt) || (cv() && n(r.pct) ? Math.round(cv() * n(r.pct) / 100) : 0); };
  var text = function (rows) { return rows.filter(function (r) { return r.m || n(r.pct); }).map(function (r) { return (n(r.pct) ? n(r.pct) + "% " : "") + (r.m || ""); }).join("; "); };
  function rowsNow() {
    if (F._msFor !== F) { F._msFor = F; F.rec.billing = (F.rec.billing || []).map(function (r) { return Object.assign({}, r); }); }
    return F.rec.billing;
  }
  var locked = function (r) { try { var p = F.rec.id && Store.data.projects.find(function (x) { return x.id === F.rec.id; }); return !!(p && (p.billing || []).some(function (b) { return b.id === r.id; }) && bsInv(p, r)); } catch (e) { return false; } };

  function table() {
    var rows = rowsNow(), steps = STEPS(), tp = rows.reduce(function (s, r) { return s + n(r.pct); }, 0), ta = rows.reduce(function (s, r) { return s + amtOf(r); }, 0);
    return '<div class="tw"><table class="gtab fs-ms"><thead><tr><th style="width:30px">#</th><th>Milestone</th><th style="width:220px">Linked to (business cycle step)</th><th class="num" style="width:76px">%</th><th class="num" style="width:130px">Amount (PKR)</th><th style="width:150px">Planned date</th><th style="width:36px"></th></tr></thead><tbody>' +
      (rows.map(function (r, i) {
        var lk = locked(r), dis = lk ? " disabled" : "", ev = evOf(r);
        return '<tr><td class="muted">' + (i + 1) + '</td><td><input list="fsMsNames" data-ms="m" data-i="' + i + '" value="' + esc(r.m || "") + '" placeholder="Pick or type a milestone" aria-label="Milestone, row ' + (i + 1) + '"' + dis + "></td>" +
          '<td><select data-ms="ev" data-i="' + i + '" aria-label="Linked step, row ' + (i + 1) + '"' + dis + '><option value="">Not linked (planned date only)</option>' +
          steps.map(function (s) { return '<option value="' + s.k + '"' + (String(ev) === String(s.k) ? " selected" : "") + ">" + (s.k + 1) + ". " + esc(s.t) + "</option>"; }).join("") + "</select></td>" +
          '<td><input class="num" inputmode="decimal" data-ms="pct" data-i="' + i + '" value="' + esc(r.pct ?? "") + '"' + dis + "></td>" +
          '<td class="num" data-msamt="' + i + '">' + (amtOf(r) ? fmt(amtOf(r)) : "") + "</td>" +
          '<td><input type="date" data-ms="plan" data-i="' + i + '" value="' + esc(r.plan || "") + '"' + dis + "></td>" +
          "<td>" + (lk ? '<span class="muted" title="Invoiced">✓</span>' : '<button type="button" class="btn sm" data-msdel="' + i + '" aria-label="Remove row ' + (i + 1) + '">×</button>') + "</td></tr>";
      }).join("") || '<tr><td colspan="7" class="muted">No milestones yet. Add a row, or paste the terms below.</td></tr>') +
      '</tbody><tfoot><tr><td></td><td colspan="2"><b>Total</b></td><td class="num' + (tp > 100.001 ? " neg" : "") + '"><b>' + fmt(tp) + '%</b></td><td class="num"><b>' + fmt(ta) + "</b></td><td colspan=\"2\">" +
      (rows.length && Math.abs(tp - 100) > 0.001 ? '<span class="muted">' + (tp < 100 ? fmt(100 - tp) + "% not yet scheduled" : "over 100%") + "</span>" : "") + "</td></tr></tfoot></table></div>";
  }
  function box(f) {
    return '<div class="f w grid74" id="fsMsBox"><label>' + esc(f.l) + '</label><input type="hidden" id="f_paymentTerms" value="' + esc(text(rowsNow())) + '">' +
      '<datalist id="fsMsNames">' + names().map(function (m) { return '<option value="' + esc(m) + '">'; }).join("") + "</datalist>" +
      '<div id="fsMsTab">' + table() + "</div>" +
      '<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="btn sm" id="fsMsAdd">+ Add row</button>' +
      '<input id="fsMsPaste" placeholder="Or paste the terms: 25% advance; 25% on delivery at site; ..." style="flex:1;min-width:240px"><button type="button" class="btn sm" id="fsMsPasteGo">Add from text</button></div>' +
      '<span class="hint">Pick a milestone or type your own; new names are offered on every project after this. A linked milestone is flagged "Ready to invoice" in Receivables › Billing schedule as soon as that step is done, so its date is optional.</span>' +
      '<p class="err" id="fsMsErr"></p></div>';
  }
  function redraw() {
    var t = document.getElementById("fsMsTab"); if (t) t.innerHTML = table();
    var h = document.getElementById("f_paymentTerms"); if (h) h.value = text(rowsNow());
  }

  function hook() {
    if (typeof fieldHtml !== "function" || typeof S === "undefined" || !S.projects || typeof bsState !== "function" || typeof pwState !== "function") return false;
    window.FS_MS = { guess: guess };
    fieldHtml = (function (old) { return function (f, v) { return F && F.c === "projects" && f.k === "paymentTerms" ? box(f) : old.apply(this, arguments); }; })(fieldHtml); // eslint-disable-line no-global-assign
    // the form is read on every keystroke, so rows stay as they are here; empty rows are dropped when the project is saved
    readForm = (function (old) { // eslint-disable-line no-global-assign
      return function () {
        old.apply(this, arguments);
        if (F && F.c === "projects" && F._msFor === F) F.rec.paymentTerms = text(F.rec.billing);
      };
    })(readForm);
    Store.save = (function (old) {
      return function (c, rec) {
        if (c === "projects" && rec && Array.isArray(rec.billing)) rec.billing = rec.billing.filter(function (r) { return String(r.m || "").trim() || n(r.pct) || n(r.amt); })
          .map(function (r) { return Object.assign({}, r, { id: r.id || newId(), m: String(r.m || "").trim() || "Milestone", ev: evOf(r) }); });
        return old.apply(this, arguments);
      };
    })(Store.save);
    document.addEventListener("input", function (e) {
      var t = e.target; if (!F || F.c !== "projects") return;
      if (t.id === "f_contractValue") { redraw(); return; }
      if (!t.dataset || t.dataset.ms === undefined) return;
      var r = rowsNow()[+t.dataset.i]; if (!r) return; var k = t.dataset.ms;
      if (k === "pct") { r.pct = t.value.trim() === "" ? "" : n(t.value); r.amt = ""; var a = document.querySelector('[data-msamt="' + t.dataset.i + '"]'); if (a) a.textContent = amtOf(r) ? fmt(amtOf(r)) : ""; }
      else if (k === "ev") r.ev = t.value === "" ? "" : +t.value;
      else r[k] = t.value;
      var h = document.getElementById("f_paymentTerms"); if (h) h.value = text(rowsNow());
    });
    document.addEventListener("change", function (e) {
      var t = e.target; if (!F || F.c !== "projects" || !t.dataset) return;
      if (t.dataset.ms === "m") { var r = rowsNow()[+t.dataset.i]; if (r && (r.ev === undefined || r.ev === "" || r.ev === null)) { r.ev = guess(r.m); redraw(); } }
      if (t.dataset.ms === "ev" || t.dataset.ms === "pct") redraw();
    });
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("button"); if (!t || !F || F.c !== "projects") return;
      if (t.id === "fsMsAdd") { rowsNow().push({ id: newId(), m: "", ev: "", pct: "", amt: "", plan: "" }); redraw(); var ins = document.querySelectorAll('#fsMsTab [data-ms="m"]'); if (ins.length) ins[ins.length - 1].focus(); }
      if (t.dataset.msdel !== undefined) { rowsNow().splice(+t.dataset.msdel, 1); redraw(); }
      if (t.id === "fsMsPasteGo") {
        var er = $("#fsMsErr"), inp = $("#fsMsPaste"), parts = window.FS_TERMS ? FS_TERMS.parse(inp.value) : [];
        er.textContent = "";
        if (!parts.length) { er.textContent = "Type the terms first, for example: 25% advance; 25% on delivery at site."; return; }
        if (parts.some(function (p) { return !p; })) { er.textContent = "Every part needs a %, for example \"10% on T&C\"."; return; }
        var have = rowsNow().reduce(function (s, r) { return s + n(r.pct); }, 0), add = parts.reduce(function (s, p) { return s + p.pct; }, 0);
        if (have + add > 100.001) { er.textContent = "These add " + add + "% to the " + have + "% already in the table, more than 100%."; return; }
        parts.forEach(function (p) { rowsNow().push({ id: newId(), m: p.m, ev: guess(p.m), pct: p.pct, amt: "", plan: "" }); });
        inp.value = ""; redraw();
      }
    });

    // Billing schedule and Home: a linked milestone is ready once its step is done; until then it waits for that step.
    var memo = {}, cached = function (p) { var m = memo[p.id], now = Date.now(); if (!m || m.p !== p || now - m.at > 2000) m = memo[p.id] = { p: p, at: now, s: pwState(p) }; return m.s; };
    var oldState = bsState;
    bsState = function (p, row) { // eslint-disable-line no-global-assign
      var s = oldState(p, row), ev = evOf(row);
      if (s.r || ev === "" || p.status === "Tendering" || ["over", "due"].indexOf(s.k) >= 0) return s;
      var st; try { st = cached(p)[ev]; } catch (e) { st = null; }
      if (!st) return s;
      if (st.state === "ok") return { k: "due", t: "Ready to invoice: " + st.t + " done", c: "bad" };
      return s.k === "nodate" ? { k: "wait", t: "Waits for: " + st.t, c: "" } : s;
    };
    // Billing schedule "Save schedule": a linked milestone needs no planned date
    document.addEventListener("click", async function (e) {
      var t = e.target.closest && e.target.closest("#bsSave"), BS = V.bs; if (!t || !BS || !BS.edit) return;
      var E = BS.edit, P = Store.data.projects.find(function (p) { return p.id === BS.pid; }), er = $("#bsErr"); if (!P) return;
      var rows = E.rows.filter(function (r) { return String(r.m || "").trim() || n(r.pct) || n(r.amt); }).map(function (r) { return Object.assign({}, r, { id: r.id || newId(), m: String(r.m || "").trim() }); });
      if (!rows.some(function (r) { return !r.plan; }) || rows.some(function (r) { return !r.m; }) || rows.reduce(function (s, r) { return s + n(r.pct); }, 0) > 100.001) return; // the app's own checks
      e.stopImmediatePropagation();
      rows.forEach(function (r) { if (r.ev === undefined || r.ev === null || r.ev === "") r.ev = guess(r.m); });
      var miss = rows.filter(function (r) { return !r.plan && r.ev === ""; });
      if (miss.length) { er.textContent = "\"" + miss[0].m + "\" is not linked to a business-cycle step, so it needs a planned invoice date. Or link it on the project form."; return; }
      try { await Store.save("projects", Object.assign({}, P, { billing: rows })); BS.edit = null; toast("Billing schedule saved for " + P.name + ": " + rows.length + " milestone" + (rows.length === 1 ? "" : "s") + "."); }
      catch (x) { er.textContent = x.message || "Could not save. You may have view-only access."; }
      render();
    }, true);
    var css = document.createElement("style");
    css.textContent = ".fs-ms{min-width:880px;table-layout:fixed;width:100%}.fs-ms input,.fs-ms select{width:100%;box-sizing:border-box;min-width:0}.fs-ms td{vertical-align:middle}#fsMsBox .tw{overflow-x:auto}";
    document.head.appendChild(css);
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
