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
  /* global Store, S, V, F, LEDGER, ledger, drawForm, readForm, render, scheduleRender, settings, esc, toast, coLabel */
  var COLLS = ["journals", "payables", "receivables", "crnotes", "requisitions", "pos", "projects", "lcs", "advances", "vadvances",
    "custadv", "invdocs", "quotes", "paydemands", "adminExp", "bgs"];
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
    if (c === "paydemands" && rec.branch && list(rec.entity).indexOf(rec.branch) >= 0) return rec.branch;
    return "";
  }

  function fieldHtml(rec) {
    var ent = rec.entity, L = list(ent), v = rec.region || "";
    if (!L.length) return "";
    var one = limited(ent) && L.length === 1;
    var opts = (one ? "" : "<option value=\"\">" + (limited(ent) ? "Choose your office…" : "Head office / not set") + "</option>") +
      L.concat(v && L.indexOf(v) < 0 ? [v] : []).map(function (x) { return "<option value=\"" + e$(x) + "\"" + (x === v ? " selected" : "") + ">" + e$(x) + "</option>"; }).join("");
    return "<div class=\"f fs-rgf\"><label for=\"f_region\">Office / region" + (limited(ent) ? " *" : "") + "</label><select id=\"f_region\"" + (one ? " disabled" : "") + ">" + opts + "</select>" +
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
  async function addOffice() {
    var inp = document.getElementById("fsRgName"), name = String((inp && inp.value) || "").replace(/[|,]/g, " ").replace(/\s+/g, " ").trim();
    if (!name) { if (inp) inp.focus(); return; }
    var s = settings(), all = Object.assign({}, s.regions || {}), L = (all[V.ent] || []).slice();
    if (L.some(function (x) { return x.toLowerCase() === name.toLowerCase(); })) { toast(name + " is already an office of " + V.ent + "."); return; }
    L.push(name); all[V.ent] = L;
    try { await Store.save("settings", Object.assign({}, s, { id: "main", regions: all })); pick[V.ent] = name; keep(); toast(name + " added as an office of " + coLabel(V.ent) + "."); }
    catch (e) { toast("Could not add the office: " + (e.message || e)); return; }
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
    if (typeof Store === "undefined" || typeof ledger !== "function" || typeof drawForm !== "function" || typeof readForm !== "function" || typeof V === "undefined" || typeof S === "undefined") return false;

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
      if (t && t.id === "f_entity" && F) { F.rec.entity = t.value; F.rec.region = dflt(t.value); placeField(); }
      if (t && t.id === "fsRgSel") {
        if (t.value === "+") { var n = document.getElementById("fsRgNew"); t.value = cur() || ""; if (n) { n.hidden = false; document.getElementById("fsRgName").focus(); } return; }
        if (t.value) pick[V.ent] = t.value; else delete pick[V.ent];
        keep(); render();
      }
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("#fsRgOk, #fsRgNo");
      if (!b) return;
      e.preventDefault();
      if (b.id === "fsRgOk") addOffice(); else { var n = document.getElementById("fsRgNew"); if (n) n.hidden = true; }
    });
    document.addEventListener("keydown", function (e) {
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
    "#fsRgNew[hidden]{display:none}#fsRgName{padding:4px 6px;border:1px solid #cfd6de;border-radius:6px;font:inherit;width:120px}@media print{#fsRgLab{display:none}}";
  (document.head || document.documentElement).appendChild(css);
})();
