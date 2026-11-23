// Service jobs (hassan, 2026-11-23: "some po we get for installation of a temporary lift or dismantling the lift how we
// can get it" ... "add it"). A project type for one-off lift work on a customer PO: temporary lift installation,
// dismantling, shifting or repair.
//  * Projects › type "Service job (installation / dismantling / repair)". Its form asks only what such a job needs
//    (customer, PO number, site province, services tax, PO value, expected cost, dates, site engineer), see hsec-amcrpt.js.
//  * Its own income account "Service jobs: installation, dismantling and repair" under 4102 (service revenue), made the
//    first time a service job is saved. Being under 4102, the invoice's sales tax goes to provincial sales tax on
//    services (220304) by itself (the app's Auto tax type).
//  * A new invoice for a service job starts with that income account, the job's services tax % (from its site province,
//    0 when the job is marked Exempt) and the label "Sales tax on services". Anything typed by hand is kept.
(function () {
  /* global S, Store, IE, ivDraw, ivProj, ivLocked, idc, nextCode, addAccount, inheritFrom, accByCode, pstRates */
  var SVC = "Service job (installation / dismantling / repair)";
  var NAME = "Service jobs: installation, dismantling and repair", PAR = "4102";
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var num = function (v) { return parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0; };
  var low = function (s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); };

  function acc() { // the service jobs income account's id, "" until it exists
    var a = safe(function () { return Store.data.accounts.find(function (x) { return String(x.code).indexOf(PAR) === 0 && String(x.code).length === 6 && low(x.name) === low(NAME); }); }, null);
    return a ? a.id : "";
  }
  var making = null;
  function ensure() { // make the account once; people who may not change the chart of accounts simply don't make it
    if (acc()) return Promise.resolve(acc());
    if (making) return making;
    making = (async function () {
      var par = safe(function () { return accByCode()[PAR]; }, null), code = safe(function () { return nextCode(PAR); }, "");
      if (!par || !code) return "";
      return await addAccount(Object.assign(inheritFrom(par), { code: code, name: NAME, parent: PAR, posting: "Posting" }), "Service job project type");
    })().catch(function () { return ""; }).then(function (id) { making = null; return id || acc(); });
    return making;
  }
  function rate(p) {
    if (p.amcTaxMode === "Exempt") return 0;
    return num(p.amcTaxPct) || safe(function () { return num((pstRates().find(function (x) { return x[0] === p.province; }) || [0, 0])[1]); }, 0);
  }
  var isSvc = function (p) { return !!p && p.type === SVC; };

  // a new invoice for a service job: income account, services tax % and label (once per job chosen, so hand edits stay)
  var done = new WeakMap();
  function prefill(r, dom) {
    if (!r || r.id || !r.doc || safe(function () { return ivLocked(); }, false)) return false;
    var P = safe(function () { return ivProj(r.projectId); }, null);
    if (!isSvc(P) || done.get(r.doc) === P.id) return false;
    done.set(r.doc, P.id);
    var d = r.doc, a = acc(), cur = safe(function () { return Store.data.accounts.find(function (x) { return x.id === r.revAccount; }); }, null);
    if (a && (!cur || String(cur.code).indexOf(PAR) !== 0)) r.revAccount = a;
    if (!a) ensure().then(function (id) { if (id && IE === r && !r.revAccount) { r.revAccount = id; var s = document.getElementById("ie_revAccount"); if (s) s.value = id; } });
    var before = safe(function () { return Store.data.receivables.some(function (x) { return x.id !== r.id && x.projectId === P.id && x.doc && x.doc.taxPct !== "" && x.doc.taxPct != null; }); }, false);
    if (!before) d.taxPct = rate(P);
    if (!d.taxLabel || d.taxLabel === "Sales tax") d.taxLabel = "Sales tax on services";
    if (dom) { // the full form, which is not drawn again when the project changes
      var set = function (id, v) { var e = document.getElementById(id); if (e && v != null) e.value = v; };
      set("ie_revAccount", r.revAccount); set("id_taxPct", d.taxPct); set("id_taxLabel", d.taxLabel);
      var t = document.getElementById("id_taxPct"); if (t) t.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return true;
  }

  function hook() {
    if (typeof S === "undefined" || !S.projects || !Store || !Store.data || typeof ivDraw !== "function" || typeof addAccount !== "function") return false;
    safe(function () { var f = S.projects.fields.find(function (x) { return x.k === "type"; }); if (f && f.o && f.o.indexOf(SVC) < 0) f.o.push(SVC); }, null);
    var oDraw = ivDraw;
    ivDraw = function () { safe(function () { prefill(IE, false); }, null); return oDraw.apply(this, arguments); }; // eslint-disable-line no-global-assign
    var oSave = Store.save;
    Store.save = function (c, rec) {
      var out = oSave.apply(this, arguments);
      if (c === "projects" && rec && rec.type === SVC && !acc()) Promise.resolve(out).then(function () { ensure(); }, function () {});
      return out;
    };
    document.addEventListener("change", function (e) {
      if (!e.target || e.target.id !== "ie_projectId") return;
      setTimeout(function () { safe(function () { if (IE && !IE.quick) prefill(IE, true); }, null); }, 0);
    });
    window.FS_SVC = { type: SVC, acc: acc, ensure: ensure };
    // a service job saved before this account existed
    setTimeout(function () { safe(function () { if (!acc() && Store.data.projects.some(isSvc)) ensure(); }, null); }, 4000);
    return true;
  }
  (function wait(n) { if (!safe(hook, false) && n < 200) setTimeout(function () { wait(n + 1); }, 150); })(0);
})();
