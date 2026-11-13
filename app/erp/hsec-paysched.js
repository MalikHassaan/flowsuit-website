// Project form: payment terms as a table (hassan, 2026-10-29: "it should be in table form and predefined fields as well and link
// that fields with each factors and give option of add in it as well").
// Each row is one billing milestone of the project (the same project.billing rows the Billing schedule uses): milestone name
// (pick a predefined one or type a new one; names typed before are offered again), the business-cycle step it is linked to,
// %, amount (from the contract value) and an optional planned date. A milestone linked to a step becomes "Ready to invoice"
// in the Billing schedule and on Home as soon as that step is done in the project's business cycle (LC opened, documents
// received, goods delivered to site, handover...), so a planned date is no longer required for linked milestones.
(function () {
  /* global F, S, Store, V, fieldHtml, readForm, bsState, bsInv, pwState, pwSteps, render, toast, esc, fmt, n, $, approverName, bsAmt, todayStr, fdate */
  // [name, what makes it ready]: a business-cycle step index (pwSteps), "hand" = confirmed by hand on the project form
  // (Reached on date), "after" = some months after another milestone of the same project (hassan, 2026-11-13: the 12
  // parameters new-installation invoices are raised on; each project uses some of them with its own %)
  var PRESET = [["Advance", 1], ["On BG", 2], ["After LC opening", 5], ["Pre-shipment", "hand"], ["Shipping docs / BL", 6],
    ["Arrival at port", 7], ["Delivery at site", 9], ["Installation", "hand"], ["Testing & commissioning", "hand"],
    ["Handover", 13], ["Third-party inspection", "hand"], ["3 months after T&C", "after"]];
  var STEPS = function () { try { return pwSteps(); } catch (e) { return []; } };
  function guess(m) {
    var s = String(m || "").toLowerCase(), p = PRESET.find(function (x) { return x[0].toLowerCase() === s; });
    if (p) return p[1];
    if (/\d+\s*months?\s*(after|from|post)\b/.test(s)) return "after";
    if (/pre[\s-]*shipment|third[\s-]*party|\btpi\b|inspection/.test(s)) return "hand";
    if (/testing|commission|t\s*&\s*c|install/.test(s)) return "hand";
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
  var waitOf = function (r) { if (r.wait !== undefined && r.wait !== null && r.wait !== "") return n(r.wait); var x = /(\d+)\s*months?\s*(after|from|post)\b/i.exec(r.m || ""); return x ? +x[1] : 0; };
  // the milestone an "after" row waits for: the one picked, else the one its name points at (T&C, installation, handover...)
  function target(rows, r) {
    var ev = String(evOf(r)), id = ev.indexOf("ms:") === 0 ? ev.slice(3) : "", L = (rows || []).filter(function (x) { return x !== r && (!r.id || x.id !== r.id); });
    if (id) return L.find(function (x) { return x.id === id; }) || null;
    if (ev !== "after") return null;
    var t = String(r.m || "").toLowerCase().replace(/^.*?\d+\s*months?\s*(after|from|post)\s*/, "");
    var re = /t\s*&\s*c|testing|commission/.test(t) ? /t\s*&\s*c|testing|commission/i : /install/.test(t) ? /install/i : /hand\s*over/.test(t) ? /hand\s*over/i : /inspection|tpi/.test(t) ? /inspection|tpi/i : /deliver|site/.test(t) ? /deliver|site/i : null;
    return re ? L.find(function (x) { return re.test(x.m || "") && !/\d+\s*months?\s*(after|from|post)/i.test(x.m || ""); }) || null : null;
  }
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
    return '<div class="tw"><table class="gtab fs-ms"><thead><tr><th style="width:30px">#</th><th>Milestone</th><th style="width:220px">Ready when</th><th style="width:150px">Reached on / after</th><th class="num" style="width:76px">%</th><th class="num" style="width:130px">Amount (PKR)</th><th style="width:150px">Planned date</th><th style="width:36px"></th></tr></thead><tbody>' +
      (rows.map(function (r, i) {
        var lk = locked(r), dis = lk ? " disabled" : "", ev = evOf(r);
        return '<tr><td class="muted">' + (i + 1) + '</td><td><input list="fsMsNames" data-ms="m" data-i="' + i + '" value="' + esc(r.m || "") + '" placeholder="Pick or type a milestone" aria-label="Milestone, row ' + (i + 1) + '"' + dis + "></td>" +
          '<td><select data-ms="ev" data-i="' + i + '" aria-label="Linked step, row ' + (i + 1) + '"' + dis + '><option value="">Not linked (planned date only)</option>' +
                    '<option value="hand"' + (ev === "hand" ? " selected" : "") + '>Confirmed by hand (date reached)</option>' +
          '<optgroup label="Months after another milestone">' + rows.filter(function (x, j) { return j !== i && (x.m || "").trim(); }).map(function (x) { var tg = target(rows, r), sel = ev === "ms:" + x.id || (ev === "after" && tg === x); return '<option value="ms:' + esc(x.id || "") + '"' + (sel ? " selected" : "") + ">After: " + esc(x.m) + "</option>"; }).join("") + "</optgroup>" +
          '<optgroup label="Business cycle step done">' + steps.map(function (s) { return '<option value="' + s.k + '"' + (String(ev) === String(s.k) ? " selected" : "") + ">" + (s.k + 1) + ". " + esc(s.t) + "</option>"; }).join("") + "</optgroup></select></td>" +
          "<td>" + (ev === "hand" ? '<input type="date" data-ms="reached" data-i="' + i + '" value="' + esc(r.reached || "") + '" title="The day this milestone was reached; it becomes ready to invoice"' + dis + ">" :
            String(ev) === "after" || String(ev).indexOf("ms:") === 0 ? '<label class="fs-ms-w"><input class="num" inputmode="numeric" data-ms="wait" data-i="' + i + '" value="' + esc(waitOf(r) || "") + '"' + dis + "> months after</label>" : '<span class="muted">when the step is done</span>') + "</td>" +
          '<td><input class="num" inputmode="decimal" data-ms="pct" data-i="' + i + '" value="' + esc(r.pct ?? "") + '"' + dis + "></td>" +
          '<td class="num" data-msamt="' + i + '">' + (amtOf(r) ? fmt(amtOf(r)) : "") + "</td>" +
          '<td><input type="date" data-ms="plan" data-i="' + i + '" value="' + esc(r.plan || "") + '"' + dis + "></td>" +
          "<td>" + (lk ? '<span class="muted" title="Invoiced">✓</span>' : '<button type="button" class="btn sm" data-msdel="' + i + '" aria-label="Remove row ' + (i + 1) + '">×</button>') + "</td></tr>";
      }).join("") || '<tr><td colspan="8" class="muted">No milestones yet. Add a row, or paste the terms below.</td></tr>') +
      '</tbody><tfoot><tr><td></td><td colspan="3"><b>Total</b></td><td class="num' + (tp > 100.001 ? " neg" : "") + '"><b>' + fmt(tp) + '%</b></td><td class="num"><b>' + fmt(ta) + "</b></td><td colspan=\"2\">" +
      (rows.length && Math.abs(tp - 100) > 0.001 ? '<span class="muted">' + (tp < 100 ? fmt(100 - tp) + "% not yet scheduled" : "over 100%") + "</span>" : "") + "</td></tr></tfoot></table></div>";
  }
  function box(f) {
    return '<div class="f w grid74" id="fsMsBox"><label>' + esc(f.l) + '</label><input type="hidden" id="f_paymentTerms" value="' + esc(text(rowsNow())) + '">' +
      '<datalist id="fsMsNames">' + names().map(function (m) { return '<option value="' + esc(m) + '">'; }).join("") + "</datalist>" +
      '<div id="fsMsTab">' + table() + "</div>" +
      '<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="btn sm" id="fsMsAdd">+ Add row</button>' +
      '<input id="fsMsPaste" placeholder="Or paste the terms: 25% advance; 25% on delivery at site; ..." style="flex:1;min-width:240px"><button type="button" class="btn sm" id="fsMsPasteGo">Add from text</button></div>' +
      '<span class="hint">Pick a milestone or type your own; new names are offered on every project after this. "Ready when" decides when Receivables › Billing schedule (and Home) says "Ready to invoice": a business-cycle step being done, the date you enter when the milestone is reached (pre-shipment, installation, T&C, third-party inspection), or some months after another milestone (3 months after T&C). A planned date is then optional.</span>' +
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
      else if (k === "ev") r.ev = t.value === "" ? "" : /^\d+$/.test(t.value) ? +t.value : t.value;
      else if (k === "wait") r.wait = t.value.trim() === "" ? "" : n(t.value);
      else r[k] = t.value;
      var h = document.getElementById("f_paymentTerms"); if (h) h.value = text(rowsNow());
    });
    document.addEventListener("change", function (e) {
      var t = e.target; if (!F || F.c !== "projects" || !t.dataset) return;
      if (t.dataset.ms === "m") { var r = rowsNow()[+t.dataset.i]; if (r && (r.ev === undefined || r.ev === "" || r.ev === null)) { r.ev = guess(r.m); redraw(); } }
      if (t.dataset.ms === "ev" || t.dataset.ms === "pct" || t.dataset.ms === "m") redraw();
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
    var addMo = function (d, k) { var p = String(d).split("-"); if (p.length !== 3) return ""; var x = new Date(+p[0], +p[1] - 1 + k, +p[2]); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
    var today = function () { try { return todayStr(); } catch (e) { return new Date().toISOString().slice(0, 10); } };
    var fd = function (d) { try { return fdate(d); } catch (e) { return d; } };
    // when this milestone's trigger happened: {ok, date ("" when not recorded), what}
    function reach(p, row, depth) {
      var ev = evOf(row);
      if (ev === "hand") return row.reached ? { ok: true, date: row.reached, what: (row.m || "Milestone") + " reached" } : { ok: false, what: (row.m || "this milestone") + " to be confirmed on the project (Reached on)" };
      if (String(ev) === "after" || String(ev).indexOf("ms:") === 0) {
        var tg = target(p.billing || [], row), w = waitOf(row);
        if (!tg && !depth) { // no such milestone on this project: count from the installation and commissioning step
          var st0; try { st0 = cached(p)[10]; } catch (e) { st0 = null; }
          if (!st0) return { ok: false, what: "the milestone it follows (pick it under Ready when on the project)" };
          if (st0.state !== "ok") return { ok: false, what: st0.t + (w ? " (then " + w + " month" + (w === 1 ? "" : "s") + ")" : "") };
          var d0 = (p.pw && p.pw.done && p.pw.done[10]) || "";
          return { ok: true, date: d0 ? addMo(d0, w) : "", what: (w ? w + " month" + (w === 1 ? "" : "s") + " after " : "") + st0.t, wait: w, base: d0 };
        }
        if (!tg || depth > 4) return { ok: false, what: "the milestone it follows (pick it under Ready when on the project)" };
        var b = reach(p, tg, (depth || 0) + 1), inv = null; try { inv = bsInv(p, tg); } catch (e) { /* no invoice */ }
        var base = b.ok ? b.date || (inv && inv.invoiceDate) || "" : "";
        if (!b.ok) return { ok: false, what: tg.m + (w ? " (then " + w + " month" + (w === 1 ? "" : "s") + ")" : "") };
        return { ok: true, date: base ? addMo(base, w) : "", what: (w ? w + " month" + (w === 1 ? "" : "s") + " after " : "") + tg.m, wait: w, base: base };
      }
      if (ev === "" || ev === undefined || ev === null) return null;
      var st; try { st = cached(p)[ev]; } catch (e) { st = null; }
      if (!st) return null;
      if (st.state !== "ok") return { ok: false, what: st.t };
      return { ok: true, date: (p.pw && p.pw.done && p.pw.done[ev]) || "", what: st.t + " done" };
    }
    window.FS_MS.reach = function (p, row) { try { return reach(p, row, 0); } catch (e) { return null; } };
    bsState = function (p, row) { // eslint-disable-line no-global-assign
      var s = oldState(p, row);
      if (s.r || p.status === "Tendering" || ["over", "due"].indexOf(s.k) >= 0) return s;
      var e; try { e = reach(p, row, 0); } catch (x) { e = null; }
      if (!e) return s;
      if (!e.ok) return s.k === "nodate" ? { k: "wait", t: "Waits for: " + e.what, c: "" } : s;
      if (e.wait && !e.base) return s.k === "nodate" ? { k: "wait", t: e.what + ": the date it was reached is not recorded", c: "warn" } : s;
      if (e.date && e.date > today()) { var t = oldState(p, Object.assign({}, row, { plan: e.date })); return { k: t.k, t: (t.k === "later" ? "Ready on " + fd(e.date) : t.t) + " (" + e.what + ")", c: t.c }; }
      return { k: "due", t: "Ready to invoice: " + e.what + (e.date ? " " + fd(e.date) : ""), c: "bad" };
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
    css.textContent = ".fs-ms{min-width:1040px;table-layout:fixed;width:100%}.fs-ms input,.fs-ms select{width:100%;box-sizing:border-box;min-width:0}.fs-ms td{vertical-align:middle}#fsMsBox .tw{overflow-x:auto}.fs-ms-w{display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:12.5px}.fs-ms-w input{width:56px!important}";
    document.head.appendChild(css);
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
