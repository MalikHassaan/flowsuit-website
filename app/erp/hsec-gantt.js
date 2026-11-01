// Project Gantt charts (hassan, 2026-11-01: "while we create a project a Gantt chart should also be shown and the same
// Gantt charts project-wise on the management dashboard").
// Each project is planned in the five phases of its business cycle (Win the work, Buy and import, Store and site, Bill and
// collect, Hand over and close). On the project form the phases get From / To dates, filled in from the project's Start
// and Planned completion until someone changes them, with the chart drawn live underneath. Bars fill with progress from
// the business-cycle steps already done, billing milestones show as diamonds and a red line marks today. The management
// dashboard shows the same chart for every open project. Plans are saved on the project (project.plan).
(function () {
  /* global MODS, F, S, Store, V, fieldHtml, readForm, pwState, bsRows, bsAmt, esc, fdate, byEnt, render, special, LIFE */
  var SHARE = [0.08, 0.42, 0.30, 0.12, 0.08];   // default share of the project's time per phase
  var FALLBACK = [["Win the work", "#1D346C"], ["Buy and import", "#0F997B"], ["Store and site", "#B07D12"], ["Bill and collect", "#C8202F"], ["Hand over and close", "#5B6475"]];
  var PH = function () { try { return LIFE.map(function (x) { return [x[0], x[1]]; }); } catch (e) { return FALLBACK; } };
  var DAY = 864e5;
  var toD = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
  var toS = function (t) { return new Date(t).toISOString().slice(0, 10); };
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var fd = function (s) { return s ? safe(function () { return fdate(s); }, s) : "–"; };
  var today = function () { var d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };

  // The default plan: the project's start to planned completion, split by SHARE, phases back to back.
  function auto(start, end) {
    var a = toD(start), b = toD(end); if (a === null || b === null || b <= a) return null;
    var len = (b - a) / DAY, t = a, out = [];
    SHARE.forEach(function (sh, i) { var d = i === SHARE.length - 1 ? (b - t) / DAY : Math.max(1, Math.round(len * sh)); var e = t + d * DAY; out.push({ from: toS(t), to: toS(Math.min(e, b)), auto: true }); t = e; });
    return out;
  }
  // The plan to draw: the saved one where its dates are complete, otherwise the default from start / end.
  function planOf(p) {
    var A = auto(p.start, p.end) || [], P = Array.isArray(p.plan) ? p.plan : [];
    var out = PH().map(function (ph, i) { var r = P[i] || {}; return r.from && r.to && !r.auto ? { from: r.from, to: r.to } : A[i] || null; });
    return out.some(Boolean) ? out : null;
  }
  // Share of each phase's business-cycle steps already done (or skipped)
  function progress(p) {
    var S2 = safe(function () { return pwState(p); }, []), out = PH().map(function () { return [0, 0]; });
    S2.forEach(function (s) { if (out[s.pi]) { out[s.pi][1]++; if (s.state !== "todo") out[s.pi][0]++; } });
    return out.map(function (x) { return x[1] ? x[0] / x[1] : 0; });
  }
  function milestones(p) {
    return safe(function () { return bsRows(p).filter(function (r) { return r.plan; }).map(function (r) { return { d: r.plan, m: r.m || "Milestone", amt: safe(function () { return bsAmt(p, r); }, 0) }; }); }, []);
  }

  // One chart. items: [{label, sub, plan, prog, ms, href}]; detail = one row per phase (project form) or one row per project.
  function chart(items, detail) {
    var t0 = Infinity, t1 = -Infinity, T = today();
    items.forEach(function (it) { it.plan.forEach(function (r) { if (!r) return; t0 = Math.min(t0, toD(r.from)); t1 = Math.max(t1, toD(r.to)); }); it.ms.forEach(function (m) { var d = toD(m.d); if (d !== null) { t0 = Math.min(t0, d); t1 = Math.max(t1, d); } }); });
    if (!isFinite(t0)) return "";
    var s0 = new Date(t0), s1 = new Date(t1);
    t0 = Date.UTC(s0.getUTCFullYear(), s0.getUTCMonth(), 1); t1 = Date.UTC(s1.getUTCFullYear(), s1.getUTCMonth() + 1, 1);
    var span = t1 - t0, pc = function (t) { return Math.max(0, Math.min(100, (t - t0) / span * 100)); };
    var months = [], m = new Date(t0), nM = 0;
    while (m.getTime() < t1) { var a = m.getTime(); m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)); months.push([a, m.getTime()]); nM++; }
    var every = nM > 36 ? 6 : nM > 18 ? 3 : nM > 10 ? 2 : 1;
    var head = months.map(function (x, i) { var d = new Date(x[0]); return '<span class="fsg-m' + (d.getUTCMonth() === 0 ? " y" : "") + '" style="left:' + pc(x[0]) + '%;width:' + (pc(x[1]) - pc(x[0])) + '%">'
      + (i % every === 0 ? d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }) + (d.getUTCMonth() === 0 || i === 0 ? " " + String(d.getUTCFullYear()).slice(2) : "") : "") + '</span>'; }).join("");
    var grid = months.map(function (x) { return '<i style="left:' + pc(x[0]) + '%"></i>'; }).join("");
    var todayLine = T >= t0 && T <= t1 ? '<b class="fsg-today" style="left:' + pc(T) + '%" title="Today"></b>' : "";
    var ph = PH();
    var bar = function (r, i, prog, thin) {
      if (!r) return "";
      var a = toD(r.from), b = toD(r.to) + DAY, w = Math.max(0.6, pc(b) - pc(a)), col = ph[i][1];
      return '<span class="fsg-bar' + (thin ? " thin" : "") + '" style="left:' + pc(a) + '%;width:' + w + '%;--c:' + col + '" title="' + esc(ph[i][0] + ": " + fd(r.from) + " to " + fd(r.to) + " · " + Math.round(prog * 100) + "% done") + '"><span style="width:' + Math.round(prog * 100) + '%"></span></span>';
    };
    var dia = function (ms) { return ms.map(function (x) { var d = toD(x.d); return d === null ? "" : '<em class="fsg-ms" style="left:' + pc(d) + '%" title="' + esc(x.m + " · " + fd(x.d) + (x.amt ? " · " + Math.round(x.amt).toLocaleString("en-US") : "")) + '"></em>'; }).join(""); };
    var rows = "";
    items.forEach(function (it) {
      if (detail) {
        it.plan.forEach(function (r, i) {
          rows += '<div class="fsg-row"><div class="fsg-l"><i style="background:' + ph[i][1] + '"></i>' + esc(ph[i][0]) + (r ? '<small>' + esc(fd(r.from)) + ' – ' + esc(fd(r.to)) + '</small>' : '<small>no dates</small>') + '</div><div class="fsg-t">' + grid + bar(r, i, it.prog[i]) + todayLine + '</div></div>';
        });
        if (it.ms.length) rows += '<div class="fsg-row"><div class="fsg-l"><i class="dm"></i>Billing milestones<small>' + it.ms.length + ' with a planned date</small></div><div class="fsg-t">' + grid + dia(it.ms) + todayLine + '</div></div>';
      } else {
        var done = it.prog.reduce(function (s, x, i) { return s + x * SHARE[i]; }, 0);
        rows += '<div class="fsg-row"><div class="fsg-l">' + (it.href ? '<a href="' + it.href + '">' + esc(it.label) + '</a>' : esc(it.label)) + '<small>' + esc(it.sub || "") + ' · ' + Math.round(done * 100) + '% of steps</small></div><div class="fsg-t">' + grid
          + it.plan.map(function (r, i) { return bar(r, i, it.prog[i], true); }).join("") + dia(it.ms) + todayLine + '</div></div>';
      }
    });
    var key = '<div class="fsg-key">' + ph.map(function (x) { return '<span><i style="background:' + x[1] + '"></i>' + esc(x[0]) + '</span>'; }).join("") + '<span><i class="dm"></i>Billing milestone</span><span><i class="td"></i>Today</span><span><i class="pg"></i>Solid part = done</span></div>';
    return '<div class="fsg"><div class="fsg-row fsg-h"><div class="fsg-l"></div><div class="fsg-t">' + head + '</div></div>' + rows + key + '</div>';
  }
  window.FS_GANTT = { chart: chart, planOf: planOf, progress: progress, milestones: milestones };

  // ---------- Project form ----------
  function rowsNow() {
    if (F._gtFor !== F) { F._gtFor = F; F.rec.plan = (Array.isArray(F.rec.plan) ? F.rec.plan : []).map(function (r) { return Object.assign({}, r); }); }
    var A = auto(val("start"), val("end")) || [];
    PH().forEach(function (x, i) { var r = F.rec.plan[i] = F.rec.plan[i] || { auto: true }; if (r.auto !== false && (!r.from || !r.to || r.auto)) { var d = A[i]; r.from = d ? d.from : ""; r.to = d ? d.to : ""; r.auto = true; } });
    return F.rec.plan;
  }
  function val(k) { var el = document.getElementById("f_" + k); return el ? el.value : F && F.rec[k]; }
  function preview() {
    var rows = rowsNow(), p = Object.assign({}, F.rec, { plan: rows.map(function (r) { return Object.assign({}, r, { auto: false }); }) });
    var plan = rows.map(function (r) { return r.from && r.to && toD(r.to) >= toD(r.from) ? { from: r.from, to: r.to } : null; });
    if (!plan.some(Boolean)) return '<p class="muted" style="margin:6px 0 0">Enter the Start and Planned completion dates above and the chart draws itself.</p>';
    return chart([{ plan: plan, prog: F.rec.id ? progress(p) : [0, 0, 0, 0, 0], ms: milestones(p) }], true);
  }
  function table() {
    var rows = rowsNow(), ph = PH();
    return '<div class="tw"><table class="gtab fsg-tab"><thead><tr><th>Phase</th><th style="width:170px">From</th><th style="width:170px">To</th><th class="num" style="width:90px">Days</th><th style="width:70px"></th></tr></thead><tbody>'
      + ph.map(function (x, i) { var r = rows[i], d = r.from && r.to ? Math.round((toD(r.to) - toD(r.from)) / DAY) + 1 : "";
        return '<tr><td><i class="fsg-dot" style="background:' + x[1] + '"></i>' + (i + 1) + '. ' + esc(x[0]) + '</td><td><input type="date" data-gt="from" data-i="' + i + '" value="' + esc(r.from || "") + '"></td><td><input type="date" data-gt="to" data-i="' + i + '" value="' + esc(r.to || "") + '"></td>'
          + '<td class="num" data-gtd="' + i + '">' + (d > 0 ? d : d === "" ? "" : '<span class="neg">check</span>') + '</td><td class="muted">' + (r.auto ? "auto" : '<button type="button" class="btn sm" data-gtauto="' + i + '">Reset</button>') + '</td></tr>'; }).join("")
      + '</tbody></table></div>';
  }
  function box() {
    return '<div class="f w grid74" id="fsGtBox"><label>Project plan (Gantt chart)</label><div id="fsGtTab">' + table() + '</div><div id="fsGtChart">' + preview() + '</div>'
      + '<span class="hint">Each phase is filled in from Start and Planned completion; change any date to set your own plan. Billing milestones with a planned date show as diamonds, and progress fills in as the business-cycle steps are done.</span></div>';
  }
  function redraw(all) {
    if (all) { var t = document.getElementById("fsGtTab"); if (t) t.innerHTML = table(); }
    var c = document.getElementById("fsGtChart"); if (c) c.innerHTML = preview();
  }

  // ---------- Management dashboard ----------
  function dashCard() {
    var ps = safe(function () { return byEnt(Store.data.projects || []); }, Store.data.projects || []).filter(function (p) { return p.status !== "Closed" && p.status !== "Cancelled"; });
    var items = [], none = [];
    ps.forEach(function (p) { var pl = planOf(p); if (!pl) { none.push(p); return; }
      items.push({ label: (p.code ? p.code + " · " : "") + (p.name || ""), sub: (p.status || "") + (p.end ? " · completion " + fd(p.end) : ""), plan: pl, prog: progress(p), ms: milestones(p), href: "#proj/projects", s: toD(pl.find(Boolean).from) }); });
    items.sort(function (a, b) { return a.s - b.s; });
    return '<div class="card"><h3>Project timelines <small>Gantt chart of every open project by business-cycle phase; solid part = steps done, diamonds = billing milestones</small></h3>'
      + (items.length ? chart(items, false) : '<p class="muted">No open project has a Start and Planned completion date yet.</p>')
      + (none.length ? '<p class="note">' + none.length + ' open project' + (none.length === 1 ? " has" : "s have") + ' no Start / Planned completion date, so ' + (none.length === 1 ? "it is" : "they are") + ' not drawn: ' + none.slice(0, 8).map(function (p) { return esc(p.code || p.name); }).join(", ") + (none.length > 8 ? "…" : "") + '. Set them on the project form.</p>' : "")
      + '</div>';
  }

  function hook() {
    if (typeof MODS === "undefined" || !MODS.mgmt || typeof fieldHtml !== "function" || typeof S === "undefined" || !S.projects || typeof pwState !== "function" || typeof special !== "function" || typeof Store === "undefined") return false;
    fieldHtml = (function (old) { return function (f) { var h = old.apply(this, arguments); return F && F.c === "projects" && f.k === "status" ? h + box() : h; }; })(fieldHtml); // eslint-disable-line no-global-assign
    Store.save = (function (old) {
      return function (c, rec) {
        if (c === "projects" && rec && Array.isArray(rec.plan)) rec.plan = rec.plan.map(function (r) { return { from: r.from || "", to: r.to || "", auto: !!r.auto }; });
        return old.apply(this, arguments);
      };
    })(Store.save);
    document.addEventListener("input", function (e) {
      var t = e.target; if (!F || F.c !== "projects" || !t) return;
      if (t.id === "f_start" || t.id === "f_end") { redraw(true); return; }
      if (!t.dataset || t.dataset.gt === undefined) return;
      var r = rowsNow()[+t.dataset.i]; if (!r) return;
      r[t.dataset.gt] = t.value; r.auto = false;
      var d = document.querySelector('[data-gtd="' + t.dataset.i + '"]'); if (d) { var n = r.from && r.to ? Math.round((toD(r.to) - toD(r.from)) / DAY) + 1 : ""; d.innerHTML = n > 0 ? n : n === "" ? "" : '<span class="neg">check</span>'; }
      redraw(false);
    });
    document.addEventListener("change", function (e) { var t = e.target; if (F && F.c === "projects" && t && t.dataset && t.dataset.gt !== undefined) redraw(true); });
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-gtauto]"); if (!b || !F || F.c !== "projects") return;
      e.preventDefault(); var r = rowsNow()[+b.dataset.gtauto]; if (r) { r.auto = true; r.from = r.to = ""; } redraw(true);
    });
    // management dashboard: the timelines card after the KPI tiles
    var old = special;
    special = function (tab) { // eslint-disable-line no-global-assign
      var h = old(tab);
      if (tab !== "mgmt" || typeof h !== "string") return h;
      var card = safe(dashCard, "");
      var at = h.indexOf('<div class="card"><h3>Month by month');
      return at < 0 ? h + card : h.slice(0, at) + card + h.slice(at);
    };
    if (typeof render === "function") render();
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fsg{position:relative;font-size:12.5px;overflow-x:auto}.fsg-row{display:grid;grid-template-columns:minmax(180px,24%) 1fr;align-items:center;min-height:30px;border-bottom:1px solid var(--line,#eef2f7)}"
    + ".fsg-h{min-height:24px;border-bottom:1px solid var(--line,#cbd5e1)}.fsg-l{padding:4px 10px 4px 0;line-height:1.25}.fsg-l small{display:block;color:var(--muted,#64748b);font-size:11.5px}.fsg-l i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}"
    + ".fsg-t{position:relative;height:100%;min-height:30px;min-width:420px}.fsg-h .fsg-t{min-height:24px}.fsg-m{position:absolute;top:4px;font-size:11px;color:var(--muted,#64748b);white-space:nowrap;padding-left:3px;box-sizing:border-box}.fsg-m.y{font-weight:700;color:var(--ink,#0f172a)}"
    + ".fsg-t>i{position:absolute;top:0;bottom:0;width:1px;background:var(--line,#eef2f7)}"
    + ".fsg-bar{position:absolute;top:50%;height:14px;margin-top:-7px;border-radius:4px;background:color-mix(in srgb,var(--c) 28%,#fff);border:1px solid var(--c);box-sizing:border-box;overflow:hidden}.fsg-bar.thin{height:12px;margin-top:-6px;border-radius:2px}"
    + ".fsg-bar>span{display:block;height:100%;background:var(--c)}"
    + ".fsg-ms{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;background:#f59e0b;border:1px solid #92400e;transform:rotate(45deg);z-index:2}"
    + ".fsg-today{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#dc2626;z-index:3}"
    + ".fsg-key{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:12px;color:var(--muted,#64748b)}.fsg-key i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}"
    + ".fsg i.dm,.fsg-key i.dm{background:#f59e0b;transform:rotate(45deg);border-radius:0}.fsg-key i.td{background:#dc2626;width:3px}.fsg-key i.pg{background:linear-gradient(90deg,#0F997B 55%,#bfe6dc 55%)}"
    + ".fsg-tab{min-width:640px}.fsg-tab input{width:100%;box-sizing:border-box}.fsg-dot{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}#fsGtChart{margin-top:10px}#fsGtBox .tw{overflow-x:auto}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
