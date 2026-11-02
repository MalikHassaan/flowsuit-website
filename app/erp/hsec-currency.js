// Currencies module (hassan, 2026-11-02: "as there can be multiple currencies add currencies as full module").
// Setup & maintenance › Currencies & exchange rates: one list of currencies for the whole ERP, kept in the settings
// record (settings.currencies, so only an administrator can change it). Each currency has its code, name and the
// words used for amounts in words ("US Dollars ... and ... Cents Only"). The list feeds every currency box: quotations,
// projects, LCs, purchase orders and bank guarantees, and the Exchange rates screen (live rate + your own rate).
// PKR is the base currency and always stays. A currency still used by a record cannot be removed.
(function () {
  /* global MODS, NAV, TITLE, TAB_HOME, NS_ALIAS, S, Store, FX_CUR, FX_WORDS, fxRate, fxFetch, fmtRate, settings, special, render, esc, toast */
  var DEF = [
    ["PKR", "Pakistani rupee", "Rupees", "Paisa"], ["USD", "US dollar", "US Dollars", "Cents"], ["EUR", "Euro", "Euros", "Cents"],
    ["GBP", "British pound", "Pounds Sterling", "Pence"], ["CNY", "Chinese yuan", "Chinese Yuan", "Fen"], ["AED", "UAE dirham", "UAE Dirhams", "Fils"],
    ["SAR", "Saudi riyal", "Saudi Riyals", "Halalas"], ["JPY", "Japanese yen", "Japanese Yen", "Sen"], ["HKD", "Hong Kong dollar", "Hong Kong Dollars", "Cents"],
    ["TRY", "Turkish lira", "Turkish Lira", "Kurus"], ["KRW", "South Korean won", "Korean Won", "Jeon"], ["CHF", "Swiss franc", "Swiss Francs", "Rappen"]
  ].map(function (c) { return { code: c[0], name: c[1], words: c[2], frac: c[3] }; });
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var say = function (m) { safe(function () { toast(m); }, null); };

  function list() {
    var s = safe(function () { return settings().currencies; }, null);
    var L = Array.isArray(s) && s.length ? s.filter(function (c) { return c && /^[A-Z]{3}$/.test(c.code); }) : DEF.slice();
    if (!L.some(function (c) { return c.code === "PKR"; })) L.unshift(DEF[0]);
    L.sort(function (a, b) { return a.code === "PKR" ? -1 : b.code === "PKR" ? 1 : 0; });
    return L;
  }
  function get(code) { return list().find(function (c) { return c.code === code; }) || null; }
  function codes() { return list().map(function (c) { return c.code; }); }

  // Records that use a currency, by register.
  var REG = { quotes: "Quotations", projects: "Projects", lcs: "LCs", pos: "Purchase orders", bgs: "Bank guarantees" };
  function uses(code) {
    var out = [];
    safe(function () {
      Object.keys(Store.data).forEach(function (k) {
        var a = Store.data[k]; if (!Array.isArray(a) || k === "settings") return;
        var n = a.filter(function (r) { return r && r.currency === code; }).length;
        if (n) out.push([REG[k] || k, n]);
      });
    }, null);
    return out;
  }

  // Push the list into the app: FX_CUR (Exchange rates, project form), FX_WORDS, and every currency box in the forms.
  var sig = "";
  function apply() {
    var L = list(), s = JSON.stringify(L); if (s === sig) return false; sig = s;
    safe(function () { FX_CUR.splice.apply(FX_CUR, [0, FX_CUR.length].concat(L.map(function (c) { return [c.code, c.name]; }))); }, null);
    safe(function () { L.forEach(function (c) { if (c.code !== "PKR") FX_WORDS[c.code] = c.words || c.code; }); }, null);
    safe(function () {
      Object.keys(S).forEach(function (k) {
        (S[k].fields || []).forEach(function (f) {
          if (f.k !== "currency" || f.t !== "select" || !Array.isArray(f.o)) return;
          var pairs = Array.isArray(f.o[0]);
          if (f._fsFirst === undefined) {
            var orig = f.o.map(function (o) { return pairs ? o[0] : o; });
            f._fsFirst = orig[0]; f._fsNoPkr = orig.indexOf("PKR") < 0;
          }
          var cs = L.filter(function (c) { return !(f._fsNoPkr && c.code === "PKR"); });
          cs.sort(function (a, b) { return a.code === f._fsFirst ? -1 : b.code === f._fsFirst ? 1 : 0; });
          var o = cs.map(function (c) { return pairs ? [c.code, c.code + " – " + c.name] : c.code; });
          f.o.splice.apply(f.o, [0, f.o.length].concat(o));
        });
      });
    }, null);
    return true;
  }
  window.FS_CUR = { list: list, get: get, codes: codes };

  // ---- screen
  var ED = null; // code being edited
  function view() {
    apply();
    var L = list(), e = ED ? get(ED) : null;
    var rows = L.map(function (c) {
      var u = uses(c.code), r = c.code === "PKR" ? 1 : safe(function () { return fxRate(c.code); }, 0);
      var rate = c.code === "PKR" ? "Base currency" : r ? safe(function () { return fmtRate(r); }, String(r)) : "<span class=\"muted\">no rate</span>";
      var used = u.length ? u.map(function (x) { return h(x[0]) + " " + x[1]; }).join(", ") : "<span class=\"muted\">Not used yet</span>";
      var del = c.code === "PKR" ? "" : u.length ? "<button class=\"btn sm\" disabled title=\"Used by records, so it stays\">Remove</button>"
        : "<button class=\"btn sm\" data-curdel=\"" + h(c.code) + "\">Remove</button>";
      return "<tr><td><b>" + h(c.code) + "</b></td><td>" + h(c.name) + "</td><td>" + h(c.words) + " … " + h(c.frac) + " Only</td><td class=\"num\">" + rate
        + "</td><td>" + used + "</td><td style=\"white-space:nowrap\"><button class=\"btn sm\" data-curedit=\"" + h(c.code) + "\">Edit</button> " + del + "</td></tr>";
    }).join("");
    var v = function (k, d) { return h(e ? e[k] : d || ""); };
    return "<div class=\"fscur\"><div class=\"panel fscur-form\"><h3>" + (e ? "Edit " + h(e.code) : "Add a currency") + "</h3><div class=\"fscur-grid\">"
      + "<label><span>Code</span><input id=\"cur_code\" maxlength=\"3\" placeholder=\"e.g. QAR\" value=\"" + v("code") + "\"" + (e ? " readonly" : "") + "><small>3-letter ISO code. The live rate is fetched for it.</small></label>"
      + "<label><span>Name</span><input id=\"cur_name\" placeholder=\"e.g. Qatari riyal\" value=\"" + v("name") + "\"></label>"
      + "<label><span>Amount in words</span><input id=\"cur_words\" placeholder=\"e.g. Qatari Riyals\" value=\"" + v("words") + "\"><small>Printed as “Qatari Riyals One Thousand Only”.</small></label>"
      + "<label><span>Fraction in words</span><input id=\"cur_frac\" placeholder=\"e.g. Dirhams\" value=\"" + v("frac") + "\"><small>For amounts with decimals, e.g. Cents.</small></label>"
      + "</div><div class=\"bar\"><button class=\"btn pri\" id=\"curSave\">" + (e ? "Save changes" : "Add currency") + "</button>"
      + (e ? "<button class=\"btn\" id=\"curCancel\">Cancel</button>" : "") + "<span class=\"err\" id=\"curErr\"></span></div></div>"
      + "<div class=\"panel tw\"><table><thead><tr><th>Code</th><th>Name</th><th>Amount in words</th><th class=\"num\">Rate used (PKR per 1)</th><th>Used in</th><th></th></tr></thead><tbody>"
      + rows + "</tbody></table></div>"
      + "<p class=\"note\">These currencies appear in every currency box: quotations, projects, LCs, purchase orders and bank guarantees. "
      + "Set or check today's rates on <a href=\"#s_fx/fxrates\">Exchange rates</a>. Only an administrator can change this list. "
      + "A currency used by any record cannot be removed.</p></div>";
  }

  function save(L) {
    var st = safe(function () { return settings(); }, {}) || {};
    return Store.save("settings", Object.assign({}, st, { id: "main", currencies: L })).then(function () {
      apply(); safe(function () { return fxFetch(true); }, null);
    });
  }
  function err(m) { var el = document.getElementById("curErr"); if (el) el.textContent = m; }
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("#curSave, #curCancel, [data-curedit], [data-curdel]"); if (!t) return;
    ev.preventDefault();
    if (t.id === "curCancel") { ED = null; render(); return; }
    if (t.dataset.curedit) { ED = t.dataset.curedit; render(); var f = document.getElementById("cur_name"); if (f) f.focus(); return; }
    if (t.dataset.curdel) {
      var c = t.dataset.curdel; if (uses(c).length) { say(c + " is used by records, so it stays."); return; }
      if (!window.confirm("Remove " + c + " from the currency list?")) return;
      save(list().filter(function (x) { return x.code !== c; })).then(function () { say(c + " removed."); render(); })
        .catch(function (x) { say("Only an administrator can change currencies. " + (x && x.message || "")); });
      return;
    }
    var g = function (id) { var el = document.getElementById(id); return el ? String(el.value).trim() : ""; };
    var rec = { code: g("cur_code").toUpperCase(), name: g("cur_name"), words: g("cur_words"), frac: g("cur_frac") };
    if (!/^[A-Z]{3}$/.test(rec.code)) return err("Enter a 3-letter code, for example QAR.");
    if (!rec.name) return err("Enter the currency name.");
    if (!rec.words) return err("Enter the amount in words, for example Qatari Riyals.");
    var L = list();
    if (!ED && L.some(function (x) { return x.code === rec.code; })) return err(rec.code + " is already in the list.");
    var i = L.findIndex(function (x) { return x.code === rec.code; });
    if (i >= 0) L[i] = rec; else L.push(rec);
    t.disabled = true;
    save(L).then(function () { say(ED ? rec.code + " saved." : rec.code + " added."); ED = null; render(); })
      .catch(function (x) { t.disabled = false; err("Only an administrator can change currencies. " + (x && x.message || "")); });
  }, true);

  function hook() {
    if (typeof MODS === "undefined" || typeof NAV === "undefined" || typeof special !== "function" || typeof Store === "undefined"
      || typeof FX_CUR === "undefined" || typeof render !== "function") return false;
    if (!MODS.s_fx) {
      MODS.s_fx = { sub: "The currencies used across the ERP, their amount-in-words wording, and exchange rates", tabs: [["currencies", "Currencies"], ["fxrates", "Exchange rates"]] };
      var g = NAV.find(function (x) { return x[0] === "Setup & maintenance"; }) || NAV[NAV.length - 1];
      if (!g[1].some(function (i) { return i[0] === "s_fx"; })) g[1].push(["s_fx", "Currencies & exchange rates"]);
      safe(function () { TITLE.s_fx = "Currencies & exchange rates"; TAB_HOME.currencies = "s_fx"; }, null);
      safe(function () { NS_ALIAS.s_fx = "currency currencies usd dollar euro riyal dirham yuan exchange rate fx forex"; }, null);
      var old = special;
      special = function (tab) { return tab === "currencies" ? safe(view, "<div class=\"panel empty\"><b>Could not show currencies</b>Reload the page.</div>") : old(tab); }; // eslint-disable-line no-global-assign
      var oRender = render;
      render = function () { safe(apply, null); return oRender.apply(this, arguments); }; // eslint-disable-line no-global-assign
    }
    apply();
    render();
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fscur-form{padding:14px 16px;margin-bottom:14px}.fscur-form h3{margin:0 0 10px}"
    + ".fscur-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-bottom:10px}"
    + ".fscur-grid label{display:flex;flex-direction:column;gap:4px}.fscur-grid label span{font-weight:600;font-size:13px}.fscur-grid small{color:var(--muted,#64748b);font-size:12px}"
    + ".fscur .bar .err{color:#b91c1c}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
