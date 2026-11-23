// Regional offices (hassan, 2026-11-13: "JSPL has 6 region offices: Islamabad, Karachi, Lahore, Faisalabad, Multan ...
// how can it be tackled"; chose "Region tag + access"). One company, with its offices listed in settings.regions
// {company: [office, ...]}. Vouchers, bills, invoices, projects and the other business records carry an Office:
// - the form shows an Office picker under the company (a person limited to one office gets it filled in);
// - a voucher made from a document takes the document's office, an invoice or bill its project's office;
// - "Office" at the top, beside Company, narrows the lists and every statement (P&L, balance sheet, trial balance)
//   to one office, or to the records with no office yet;
// - admins add offices there with "+ Add an office".
// Who may see and change which office's records is decided on the server (users.hsec_regions, see hsec-store.php);
// FS_REGIONS is that person's limit, e.g. {"JSPL": ["Karachi"]}, or null.
(function () {
  /* global Store, S, V, F, LEDGER, ledger, drawForm, readForm, submitForm, render, scheduleRender, settings, esc, toast, coLabel */
  var COLLS = ["journals", "payables", "receivables", "crnotes", "requisitions", "pos", "projects", "lcs", "advances", "vadvances",
    "custadv", "invdocs", "quotes", "paydemands", "adminExp", "bgs", "recexp", "recmon"];
  var KEY = "fs-rg", NONE = "-";
  var mine = window.FS_REGIONS || null;
  var pick = (function () { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();
  var keep = function () { try { sessionStorage.setItem(KEY, JSON.stringify(pick)); } catch (e) { /* private window */ } };
  var e$ = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); };

  var list = function (ent) {
    var r = ((typeof settings === "function" ? settings() : {}).regions || {})[ent];
    r = Array.isArray(r) ? r.filter(function (x) { return typeof x === "string" && x; }) : [];
    return mine && mine[ent] ? r.filter(function (x) { return mine[ent].indexOf(x) >= 0; }) : r;
  };
  var limited = function (ent) { return !!(mine && mine[ent]); };
  // the office the lists and statements are narrowed to: "" all, NONE untagged, else a name
  var cur = function () {
    if (!V || V.ent === "All") return "";
    var L = list(V.ent), p = pick[V.ent] || "";
    if (limited(V.ent) && L.length === 1) return ""; // their records are already only that office
    return p === NONE ? (limited(V.ent) ? "" : NONE) : L.indexOf(p) >= 0 ? p : "";
  };
  // Maintenance-side projects (AMC, spare parts supply, service jobs) must say which office they belong to when the
  // company has offices (hassan, 2026-11-23: "while adding the maintenance project in amc the region wise addition is
  // mandatory ... this project is located in Multan, this one pertains to Lahore, so the report can be all or region wise").
  var MUST = ["Maintenance contract (AMC)", "Supply only", "Service job (installation / dismantling / repair)"];
  var must = function (rec) {
    var t = document.getElementById("f_type"), ty = t && F && F.c === "projects" ? t.value : rec && rec.type;
    return !!(rec && MUST.indexOf(ty) >= 0 && list(rec.entity).length);
  };
  var match = function (rec, r) { return r === NONE ? !rec.region : rec.region === r; };
  var find = function (c, id) { return id && Store.data[c] ? Store.data[c].find(function (x) { return x.id === id; }) : null; };

  // the office a new record of this company starts with
  function dflt(ent) {
    var L = list(ent);
    if (!L.length) return "";
    if (L.length === 1 && limited(ent)) return L[0];
    var p = V && V.ent === ent ? pick[ent] : "";
    return L.indexOf(p) >= 0 ? p : "";
  }
  // a record made from another one takes its office
  function inherit(c, rec) {
    var src = rec.source && rec.source.c && rec.source.id ? find(rec.source.c, rec.source.id) : null;
    if (src && src.region) return src.region;
    var proj = find("projects", rec.costCentre) || find("projects", rec.projectId) || find("projects", rec.project);
    if (!proj && rec.project && Store.data.projects) {
      var t = String(rec.project).trim().toLowerCase();
      proj = Store.data.projects.find(function (p) { return p.entity === rec.entity && (String(p.code || "").toLowerCase() === t || String(p.name || "").toLowerCase() === t); });
    }
    if (proj && proj.region) return proj.region;
    var po = find("pos", rec.po); if (po && po.region) return po.region;
    var tpl = c === "recmon" ? find("recexp", rec.tplId) : null; if (tpl && tpl.region) return tpl.region; // a month of a monthly expense
    if (c === "paydemands" && rec.branch && list(rec.entity).indexOf(rec.branch) >= 0) return rec.branch;
    return "";
  }

  function fieldHtml(rec) {
    var ent = rec.entity, L = list(ent), v = rec.region || "";
    if (!L.length) return "";
    var one = limited(ent) && L.length === 1;
    var opts = (one ? "" : "<option value=\"\">" + (limited(ent) ? "Choose your office…" : "Head office / not set") + "</option>") +
      L.concat(v && L.indexOf(v) < 0 ? [v] : []).map(function (x) { return "<option value=\"" + e$(x) + "\"" + (x === v ? " selected" : "") + ">" + e$(x) + "</option>"; }).join("");
    var req = limited(ent) || (F && F.c === "projects" && must(rec));
    if (req && !one) opts = opts.replace(/^<option value=""[^>]*>[^<]*<\/option>/, "<option value=\"\">Choose the office…</option>");
    // admins add a new office right here (hassan, 2026-11-23: "add plus button to add the region if any new region is entered")
    var plus = window.FS_ADMIN && !limited(ent) ? "<button type=\"button\" class=\"btn sm\" id=\"fsRgFPlus\" title=\"Add a new office / region for " + e$(ent) + "\">+</button>" +
      "<span id=\"fsRgFNew\" hidden><input id=\"fsRgFName\" maxlength=\"40\" placeholder=\"New office, e.g. Peshawar\" autocomplete=\"off\"><button type=\"button\" class=\"btn sm pri\" id=\"fsRgFOk\">Add</button><button type=\"button\" class=\"btn sm\" id=\"fsRgFNo\">Cancel</button></span>" : "";
    return "<div class=\"f fs-rgf\"><label for=\"f_region\">Office / region" + (req ? " *" : "") + "</label><div class=\"fs-rgrow\"><select id=\"f_region\"" + (one ? " disabled" : "") + ">" + opts + "</select>" + plus + "</div>" +
      "<span class=\"hint\">" + (one ? "Records you make are for your office." : "Reports can be run for one office from the Office picker at the top.") + "</span></div>";
  }
  function placeField() {
    if (!F || COLLS.indexOf(F.c) < 0) return;
    var old = document.querySelector("#frm .fs-rgf"); if (old) old.remove();
    var ent = document.getElementById("f_entity"), box = ent && ent.closest(".f");
    var h = fieldHtml(F.rec); if (!h || !box) return;
    box.insertAdjacentHTML("afterend", h);
  }

  // Office picker beside Company
  function bar() {
    var es = document.getElementById("entSel"); if (!es || V.ent === "All") return;
    var L = list(V.ent), adm = !!window.FS_ADMIN;
    if ((!L.length && !adm) || (limited(V.ent) && L.length < 2)) return;
    var c = cur(), lab = document.getElementById("fsRgLab");
    var opts = "<option value=\"\">All offices</option>" + L.map(function (x) { return "<option value=\"" + e$(x) + "\"" + (x === c ? " selected" : "") + ">" + e$(x) + "</option>"; }).join("") +
      (limited(V.ent) || !L.length ? "" : "<option value=\"" + NONE + "\"" + (c === NONE ? " selected" : "") + ">No office set</option>") +
      (adm ? "<option value=\"+\">+ Add an office…</option>" : "");
    if (!lab) {
      lab = document.createElement("label"); lab.className = "ctl"; lab.id = "fsRgLab"; lab.htmlFor = "fsRgSel";
      lab.innerHTML = "Office <select id=\"fsRgSel\"></select><span id=\"fsRgNew\" hidden><input id=\"fsRgName\" maxlength=\"40\" placeholder=\"e.g. Karachi\" autocomplete=\"off\"><button type=\"button\" class=\"btn sm pri\" id=\"fsRgOk\">Add</button><button type=\"button\" class=\"btn sm\" id=\"fsRgNo\">Cancel</button></span>";
      (es.closest("label") || es).insertAdjacentElement("afterend", lab);
    }
    var sel = lab.querySelector("select");
    if (sel.getAttribute("data-o") !== opts) { sel.innerHTML = opts; sel.setAttribute("data-o", opts); }
    sel.classList.toggle("on", !!c);
    // the page heading (and its print) says which office the figures are for
    var co = document.querySelector("#main .top .coline"), tag = co && co.querySelector(".fs-rgc"), t = c === NONE ? " · No office set" : c ? " · " + c + " office" : "";
    if (co && (tag ? tag.textContent : "") !== t) { if (!tag) { tag = document.createElement("span"); tag.className = "fs-rgc"; co.appendChild(tag); } tag.textContent = t; }
  }
  async function addOffice(inForm) {
    var inp = document.getElementById(inForm ? "fsRgFName" : "fsRgName"), name = String((inp && inp.value) || "").replace(/[|,]/g, " ").replace(/\s+/g, " ").trim();
    if (!name) { if (inp) inp.focus(); return; }
    var ent = inForm ? (document.getElementById("f_entity") || {}).value || (F && F.rec.entity) : V.ent;
    if (!ent || ent === "All") { toast("Choose the company first."); return; }
    var s = settings(), all = Object.assign({}, s.regions || {}), L = (all[ent] || []).slice();
    var dup = L.find(function (x) { return x.toLowerCase() === name.toLowerCase(); });
    if (dup && !inForm) { toast(name + " is already an office of " + ent + "."); return; }
    if (!dup) {
      L.push(name); all[ent] = L;
      try { await Store.save("settings", Object.assign({}, s, { id: "main", regions: all })); var sm = (Store.data.settings || []).find(function (x) { return x.id === "main"; }); if (sm) sm.regions = all; toast(name + " added as an office of " + coLabel(ent) + "."); }
      catch (e) { toast("Could not add the office: " + (e.message || e)); return; }
    }
    if (inForm) { // pick it on the form, keep everything typed
      if (F) { try { readForm(); } catch (x) { /* keep going */ } F.rec.region = dup || name; placeField(); }
      return;
    }
    pick[ent] = name; keep();
    render();
  }

  // which list rows to hide for the chosen office (used by hsec-stfilter.js, which draws the counts and totals)
  window.FS_RG = {
    out: function (c) {
      var r = cur(); if (!r || COLLS.indexOf(c) < 0 || !Store.data[c]) return null;
      var hide = {};
      Store.data[c].forEach(function (x) { if (x.entity === V.ent && !match(x, r)) hide[x.id] = 1; });
      return function (id) { return !!hide[id]; };
    },
    list: list, cur: cur
  };

  function hook() {
    if (typeof Store === "undefined" || typeof ledger !== "function" || typeof drawForm !== "function" || typeof readForm !== "function" || typeof submitForm !== "function" || typeof V === "undefined" || typeof S === "undefined") return false;

    var oldL = ledger, lc = { base: null, key: "", val: null };
    ledger = function () { // eslint-disable-line no-global-assign
      var r = cur(), base = oldL.apply(this, arguments);
      if (!r) return base;
      var k = V.ent + "|" + r;
      if (lc.base === base && lc.key === k) return lc.val;
      var all = Store.data.journals, held = LEDGER, val;
      try {
        Store.data.journals = all.filter(function (j) { return j.entity !== V.ent || match(j, r); });
        LEDGER = null; // eslint-disable-line no-global-assign
        val = oldL.apply(this, arguments);
      } finally { Store.data.journals = all; LEDGER = held; } // eslint-disable-line no-global-assign
      lc.base = base; lc.key = k; lc.val = val;
      return val;
    };

    drawForm = (function (old) { // eslint-disable-line no-global-assign
      return function () {
        if (F && COLLS.indexOf(F.c) >= 0 && !F.rec.id && !F.rec.region && F.rec.entity) F.rec.region = inherit(F.c, F.rec) || dflt(F.rec.entity);
        var out = old.apply(this, arguments);
        try { placeField(); } catch (e) { /* never break the form */ }
        return out;
      };
    })(drawForm);

    readForm = (function (old) { // eslint-disable-line no-global-assign
      return function () {
        var out = old.apply(this, arguments), el = document.getElementById("f_region");
        if (F && el) F.rec.region = el.value;
        return out;
      };
    })(readForm);

    submitForm = (function (old) { // eslint-disable-line no-global-assign
      return async function () {
        if (F && F.c === "projects") {
          readForm();
          if (must(F.rec) && !F.rec.region) {
            var er = document.getElementById("ferr"), el = document.getElementById("f_region");
            if (er) er.textContent = "Choose the office / region this project belongs to (for example Multan or Lahore). The AMC reports can then be run for all offices or one.";
            if (el) el.focus();
            return false;
          }
        }
        return old.apply(this, arguments);
      };
    })(submitForm);
    document.addEventListener("change", function (e) { // the star follows the project type
      if (e.target && e.target.id === "f_type" && F && F.c === "projects") { var v = document.getElementById("f_region"); var keep = v ? v.value : ""; try { readForm(); placeField(); } catch (x) { /* never break the form */ } v = document.getElementById("f_region"); if (v && keep) v.value = keep; }
    });

    Store.save = (function (old) {
      return function (c, rec) {
        if (COLLS.indexOf(c) >= 0 && rec && rec.entity && !rec.region && list(rec.entity).length) {
          var r = inherit(c, rec) || dflt(rec.entity);
          if (r) rec.region = r;
        }
        return old.apply(this, arguments);
      };
    })(Store.save);

    document.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.id === "f_entity" && F && COLLS.indexOf(F.c) >= 0) { F.rec.entity = t.value; F.rec.region = dflt(t.value); placeField(); }
      if (t && t.id === "fsRgSel") {
        if (t.value === "+") { var n = document.getElementById("fsRgNew"); t.value = cur() || ""; if (n) { n.hidden = false; document.getElementById("fsRgName").focus(); } return; }
        if (t.value) pick[V.ent] = t.value; else delete pick[V.ent];
        keep(); render();
      }
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("#fsRgOk, #fsRgNo, #fsRgFPlus, #fsRgFOk, #fsRgFNo");
      if (!b) return;
      e.preventDefault();
      var fn = document.getElementById("fsRgFNew");
      if (b.id === "fsRgFPlus") { if (fn) { fn.hidden = false; b.hidden = true; document.getElementById("fsRgFName").focus(); } return; }
      if (b.id === "fsRgFOk") { addOffice(true); return; }
      if (b.id === "fsRgFNo") { if (fn) fn.hidden = true; var pb = document.getElementById("fsRgFPlus"); if (pb) pb.hidden = false; return; }
      if (b.id === "fsRgOk") addOffice(); else { var n = document.getElementById("fsRgNew"); if (n) n.hidden = true; }
    });
    document.addEventListener("keydown", function (e) {
      if (e.target && e.target.id === "fsRgFName" && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.key === "Enter") addOffice(true); else { document.getElementById("fsRgFNew").hidden = true; var pb = document.getElementById("fsRgFPlus"); if (pb) pb.hidden = false; }
        return;
      }
      if (e.target && e.target.id === "fsRgName" && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.key === "Enter") addOffice(); else document.getElementById("fsRgNew").hidden = true;
      }
    }, true);
    var busy = false;
    new MutationObserver(function () {
      if (busy) return; busy = true;
      try { bar(); } catch (e) { /* never break the app */ } finally { busy = false; }
    }).observe(document.body, { childList: true, subtree: true });
    bar();
    return true;
  }
  (function wait() { if (!document.body || !hook()) setTimeout(wait, 200); })();

  var css = document.createElement("style");
  css.textContent = "#fsRgSel{padding:4px 6px;border:1px solid #cfd6de;border-radius:6px;font:inherit;background:#fff;color:#222}" +
    "#fsRgSel.on{border-color:#1F6FB8;box-shadow:0 0 0 2px rgba(31,111,184,.18);font-weight:600}#fsRgNew{display:inline-flex;gap:4px;align-items:center}" +
    "#fsRgNew[hidden],#fsRgFNew[hidden],#fsRgFPlus[hidden]{display:none}.fs-rgrow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.fs-rgrow #f_region{flex:1 1 160px;min-width:0}" +
    "#fsRgFPlus{min-width:34px;font-size:18px;font-weight:700;line-height:1}#fsRgFNew{display:inline-flex;gap:4px;align-items:center;flex:1 1 100%}#fsRgFName{flex:1;padding:6px 8px;border:1px solid #cfd6de;border-radius:6px;font:inherit}" +
    "#fsRgName{padding:4px 6px;border:1px solid #cfd6de;border-radius:6px;font:inherit;width:120px}@media print{#fsRgLab{display:none}}";
  (document.head || document.documentElement).appendChild(css);
})();
