// QuickBooks vouchers linked to projects (hassan, 2026-10-29). The QuickBooks import now puts a voucher on a project
// (costCentre) when its lines name exactly one of the company's projects (hsec_qb_match in hsec-qb.php). Vouchers imported
// before that carry the QuickBooks Name only as the line's party; this links them the same way, by itself, when someone
// with edit access opens the books, so project profitability, Project P&L and IFRS 15 see their revenue and cost.
// Only the voucher's project changes; its lines, date and amounts stay as posted. Same matching rules as the server.
(function () {
  /* global Store, toast, render */
  var low = function (v) { return String(v || "").trim().toLowerCase(); };
  function match(projects, name) {
    var s = low(name); if (!s || !projects.length) return null;
    var parts = s.split(":").map(function (x) { return x.trim(); }).filter(Boolean), last = parts[parts.length - 1] || s;
    var keys = [s, last];
    for (var i = 0; i < keys.length; i++) {
      var hit = projects.find(function (p) { return keys[i] === low(p.name) || (low(p.code) && keys[i] === low(p.code)); });
      if (hit) return hit.id;
    }
    var inside = projects.filter(function (p) { var nm = low(p.name); return nm.length > 3 && s.indexOf(nm) >= 0; });
    if (inside.length === 1) return inside[0].id;
    var cu = projects.filter(function (p) { var c = low(p.customer); return c && (c === s || c === (parts[0] || "")); });
    return cu.length === 1 ? cu[0].id : null;
  }
  function projectOf(j) {
    var ps = Store.data.projects.filter(function (p) { return p.entity === j.entity && low(p.name); }), ids = {};
    (j.lines || []).forEach(function (l) { var id = match(ps, l.party); if (id) ids[id] = 1; });
    var k = Object.keys(ids); return k.length === 1 ? k[0] : null;
  }
  var RUN = { busy: false, last: 0 };
  async function run() {
    if (RUN.busy || !(window.FS_BRIDGE && FS_BRIDGE.edit) || !Store.data.projects.length) return;
    var todo = Store.data.journals.filter(function (j) { return j.source && j.source.c === "qbimport" && !j.costCentre && !(j.lines || []).some(function (l) { return l.project || l.costCentre; }); })
      .map(function (j) { return [j, projectOf(j)]; }).filter(function (x) { return x[1]; });
    if (!todo.length) return;
    RUN.busy = true; var n = 0;
    try { for (var i = 0; i < todo.length; i++) { try { await Store.save("journals", Object.assign({}, todo[i][0], { costCentre: todo[i][1] })); n++; } catch (e) { console.warn(e); } } }
    finally { RUN.busy = false; }
    if (n) { toast(n + " QuickBooks voucher" + (n === 1 ? " was" : "s were") + " linked to their project by the QuickBooks name (Customer:Job)."); render(); }
  }
  window.FS_QBP = { match: match, run: run };
  function hook() {
    if (typeof render !== "function" || typeof Store === "undefined") return false;
    var old = render;
    render = function () { // eslint-disable-line no-global-assign
      var out = old.apply(this, arguments);
      if (!RUN.busy && Date.now() - RUN.last > 600000 && Store.ready) { RUN.last = Date.now(); setTimeout(run, 2500); }
      return out;
    };
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
