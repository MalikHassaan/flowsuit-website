// Bank and other accounts per company (hassan, 2026-11-16: "remove extra banks", on a bank list that showed every
// company's banks plus the chart's unused Bank 1 / 2 / 3 placeholders). An account gets two settings on its form:
//  * Company: blank = every company (the default, as before); a company = only that company's lists show it;
//  * Show in lists: No hides an account nobody uses (Bank 2 – current account ...) from every pick list without
//    deleting it, so nothing already posted to it changes.
// Every account pick list (voucher lines, bank boxes, payments, filters) then leaves out accounts of other companies
// and hidden ones. An account already chosen on a record always stays in its list.
(function () {
  /* global S, F, V, Store, fieldHtml, ENTS, coLabel, esc */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var map = { src: null, n: -1, m: {} };
  function accMap() {
    var L = safe(function () { return Store.data.accounts; }, null) || [];
    if (map.src !== L || map.n !== L.length) { map = { src: L, n: L.length, m: {} }; L.forEach(function (a) { map.m[a.id] = a; }); }
    return map.m;
  }
  function entFor(sel) {
    var own = sel.getAttribute && sel.getAttribute("data-fsco"); if (own) return own; // a box that names its company (Paid by company on a demand)
    var inForm = sel.closest && sel.closest("#frm, #layer");
    var e = inForm ? safe(function () { return F && F.rec && F.rec.entity; }, "") : "";
    return e || safe(function () { return V.ent; }, "") || "";
  }
  // drop other companies' and hidden accounts from one select
  function trim(sel) {
    if (!sel.options || sel.options.length < 3) return;
    var M = accMap(), ent = entFor(sel), all = ent === "All" ? "" : ent, hits = 0, out = [];
    [].slice.call(sel.options).forEach(function (o) {
      var a = M[o.value]; if (!a) return; hits++;
      if (o.selected || o.value === sel.value) return;
      if (a.hidden === "Yes" || (all && a.entity && a.entity !== all)) out.push(o);
    });
    if (hits < 2) return; // not an account list
    out.forEach(function (o) { o.remove(); });
  }
  var busy = false;
  function sweep() {
    if (busy) return; busy = true;
    try { [].slice.call(document.querySelectorAll("#layer select, #main select, #printLayer select")).forEach(function (s) { safe(function () { trim(s); }, null); }); }
    finally { busy = false; }
  }

  function hook() {
    if (typeof S === "undefined" || !S.accounts || typeof fieldHtml !== "function") return false;
    var F0 = S.accounts.fields, at = F0.findIndex(function (f) { return f.k === "reviewed"; });
    if (!F0.some(function (f) { return f.k === "entity"; })) {
      F0.splice(at < 0 ? F0.length : at, 0,
        { k: "entity", l: "Company", t: "fsacco", hint: "Blank: every company can use it. A bank account belongs to one company: choose it, and the other companies' lists leave it out." },
        { k: "hidden", l: "Show in pick lists?", t: "select", o: [["", "Yes"], ["Yes", "No, hide it (not used)"]], hint: "No hides an unused account (e.g. Bank 2 – current account) from every list. Nothing posted to it changes; set Yes to bring it back." });
    }
    fieldHtml = (function (old) { // eslint-disable-line no-global-assign
      return function (f, v) {
        if (!f || f.t !== "fsacco") return old.apply(this, arguments);
        var E = safe(function () { return ENTS(); }, []), lab = function (e) { return safe(function () { return coLabel(e); }, e); };
        return "<div class=\"f\"><label for=\"f_entity\">" + esc(f.l) + "</label><select id=\"f_entity\"><option value=\"\">All companies</option>" +
          E.concat(v && E.indexOf(v) < 0 ? [v] : []).map(function (e) { return "<option value=\"" + esc(e) + "\"" + (e === v ? " selected" : "") + ">" + esc(lab(e)) + "</option>"; }).join("") +
          "</select><span class=\"hint\">" + esc(f.hint) + "</span></div>";
      };
    })(fieldHtml);
    // the chart of accounts list says which company an account belongs to, and which are hidden
    var cols = S.accounts.cols;
    if (cols && !cols.some(function (c) { return c[0] === "fsco"; })) {
      cols.splice(2, 0, ["fsco", "Company", function (r) { return (r.entity ? esc(r.entity) : "<span class=\"muted\">All</span>") + (r.hidden === "Yes" ? " <span class=\"pill\">Hidden</span>" : ""); }]);
    }
    new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", function (e) { if (e.target && e.target.tagName === "SELECT") safe(function () { trim(e.target); }, null); }, true);
    return true;
  }
  (function start() { if (!document.body || !hook()) setTimeout(start, 300); })();
})();
