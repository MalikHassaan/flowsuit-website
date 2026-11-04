// AMC billed in advance (hassan, 2026-11-04: "yes" to spreading quarterly / half-yearly / annual AMC invoices over the
// months they cover, and "I need to give user right of project creation and AMC billing").
//  * An AMC invoice that covers more than one month (Quarterly, Half-yearly, Annually) now posts its fee to
//    Deferred AMC income (found or opened under 2206) (a contract liability, IFRS 15) instead of 410201 AMC revenue. The invoice remembers
//    the months it covers (amcDef).
//  * Receivables › AMC billing gains "Deferred AMC income": for the chosen month it lists every month still to move to
//    revenue (up to and including that month) and "Release" makes one journal per invoice: Dr Deferred AMC income / Cr 410201,
//    one month's share per month, the last month taking the rounding.
//  * Monthly AMC is unchanged (billed and earned in the same month).
//  * AMC billing is also under Projects (Project financial management), so a person given only that area in
//    Users and access can create projects and bill AMC without the rest of Receivables.
(function () {
  /* global Store, MODS, AMC_STEP, amcView, ensureAcc, accByCode, autoMode, nextVoucherNo, approverName, byEnt, V, todayStr, esc, fmt, toast, render, armed, armOn, monthB, iso, idc */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var num = function (v) { return parseFloat(String(v == null ? "" : v).replace(/,/g, "")) || 0; };
  var REV = "410201";
  // the deferred AMC income account: one already named so under 2206 contract liabilities, else the next free 2206xx
  function defAcc() {
    var A = safe(function () { return Store.data.accounts; }, []), mine = A.find(function (a) { return /^2206/.test(String(a.code)) && /deferred\s+amc|amc.*deferred|unearned\s+amc/i.test(String(a.name)); });
    if (mine) return Promise.resolve(mine.id);
    var used = A.map(function (a) { return String(a.code); }), k = 1, code;
    do { code = "2206" + String(k).padStart(2, "0"); k++; } while (used.indexOf(code) >= 0 && k < 99);
    return ensureAcc([code, "DEFERRED AMC INCOME", "2206"]);
  }
  var defId = function () { var a = safe(function () { return Store.data.accounts.find(function (x) { return /^2206/.test(String(x.code)) && /deferred\s+amc|amc.*deferred|unearned\s+amc/i.test(String(x.name)); }); }, null); return a ? a.id : ""; };
  var addM = function (m, k) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + k; return new Date(y, mo, 1).getFullYear() + "-" + String(new Date(y, mo, 1).getMonth() + 1).padStart(2, "0"); };
  var hooked = false;

  function wrapSave() {
    var orig = Store.save;
    Store.save = async function (c, rec) {
      if (c === "receivables" && rec && rec.amcKey && !rec.id && !rec.amcDef) {
        var parts = String(rec.amcKey).split("|"), p = safe(function () { return Store.data.projects.find(function (x) { return x.id === parts[0]; }); }, null);
        var k = p ? safe(function () { return AMC_STEP[p.amcFreq]; }, 1) || 1 : 1;
        if (k > 1) {
          try {
            var def = await defAcc(), net = Math.round(num(rec.amount) - num(rec.outputTax));
            rec.revAccount = def;
            rec.amcDef = { from: parts[1], months: k, net: net, rel: [] };
          } catch (e) { safe(function () { toast("AMC invoice posted to revenue in full: " + (e.message || "the Deferred AMC income account could not be opened") + "."); }, null); }
        }
      }
      return orig.apply(this, arguments);
    };
  }

  // months of an invoice still to release, up to month m
  function pending(r, m) {
    var d = r.amcDef, out = [];
    for (var i = 0; i < d.months; i++) { var mm = addM(d.from, i); if (mm > m) break; if ((d.rel || []).indexOf(mm) < 0) out.push({ m: mm, i: i }); }
    return out;
  }
  var share = function (d, i) { var per = Math.floor(d.net / d.months); return i === d.months - 1 ? d.net - per * (d.months - 1) : per; };
  function rows(m) {
    return safe(function () { return byEnt(Store.data.receivables); }, []).filter(function (r) { return r.amcDef && r.status !== "Void" && r.jvId; })
      .map(function (r) { return { r: r, p: pending(r, m) }; }).filter(function (x) { return x.p.length; });
  }
  function card() {
    var m = safe(function () { return V.amcM; }, "") || todayStr().slice(0, 7), R = rows(m);
    var all = safe(function () { return byEnt(Store.data.receivables); }, []).filter(function (r) { return r.amcDef && r.status !== "Void"; });
    var held = all.reduce(function (s, r) { var d = r.amcDef, rel = 0; (d.rel || []).forEach(function (mm) { var i = 0; while (i < d.months && addM(d.from, i) !== mm) i++; rel += share(d, i); }); return s + d.net - rel; }, 0);
    var tot = R.reduce(function (s, x) { return s + x.p.reduce(function (t, q) { return t + share(x.r.amcDef, q.i); }, 0); }, 0);
    return "<div class=\"card fs-amcdef\"><h3>Deferred AMC income (billed in advance)</h3><p class=\"muted\" style=\"margin-top:0\">Quarterly, half-yearly and annual AMC invoices post the fee to Deferred AMC income (under 2206 contract liabilities). Each month's share moves to 410201 AMC revenue when it is released. Balance still deferred: <b>" + fmt(held) + "</b></p>" +
      (R.length ? "<table><thead><tr><th>Invoice</th><th>Customer</th><th>Covers</th><th>Months to release (up to " + h(m) + ")</th><th class=\"num\">Amount</th></tr></thead><tbody>" +
        R.map(function (x) { var d = x.r.amcDef; return "<tr><td class=\"mono\">" + h(x.r.invoiceNo || "") + "</td><td>" + h(x.r.customer || "") + "</td><td>" + h(d.from + " to " + addM(d.from, d.months - 1)) + "</td><td>" + h(x.p.map(function (q) { return q.m; }).join(", ")) + "</td><td class=\"num\">" + fmt(x.p.reduce(function (t, q) { return t + share(d, q.i); }, 0)) + "</td></tr>"; }).join("") +
        "</tbody></table><button class=\"btn pri\" id=\"amcRel\">" + (safe(function () { return armOn("amcRel"); }, false) ? "Click again to post " + R.reduce(function (s, x) { return s + x.p.length; }, 0) + " month(s), " + fmt(tot) : "Release " + fmt(tot) + " to AMC revenue up to " + h(m)) + "</button><p class=\"err\" id=\"amcRelErr\"></p>"
        : "<p class=\"muted\">Nothing to release up to " + h(m) + ".</p>") + "</div>";
  }
  async function release() {
    var m = safe(function () { return V.amcM; }, "") || todayStr().slice(0, 7), R = rows(m), name = safe(function () { return approverName(); }, "") || "Accounts", made = [];
    var def = defId(), rev = safe(function () { return idc(REV); }, "");
    if (!def || !rev) throw new Error("The Deferred AMC income account (under 2206) and 410201 must both be in the chart of accounts.");
    for (var a = 0; a < R.length; a++) {
      var r = R[a].r;
      for (var b = 0; b < R[a].p.length; b++) {
        var q = R[a].p[b], amt = share(r.amcDef, q.i), now = new Date().toISOString(), st = safe(function () { return autoMode(); }, "Pending approval");
        var date = safe(function () { return iso(monthB(q.m).e); }, q.m + "-28");
        var L = function (acc, d, c) { return { account: acc, debit: Math.round(d), credit: Math.round(c), ptype: "Customer", party: r.customer, ref: r.invoiceNo || "" }; };
        var j = { vtype: "Journal voucher", entity: r.entity, date: date, dept: "Finance & Accounts", opening: "No", status: st, costCentre: r.projectId || "", payee: r.customer,
          narration: "AMC income earned for " + q.m + " on invoice " + (r.invoiceNo || "") + " (month " + (q.i + 1) + " of " + r.amcDef.months + ")",
          source: { c: "receivables", id: r.id, ev: "amcrel", key: "amcrel-" + q.m }, maker: { name: name, at: now }, approvals: [], lines: [L(def, amt, 0), L(rev, 0, amt)] };
        if (st === "Posted") j.postedBy = { name: name, at: now, auto: true };
        j.ref = nextVoucherNo(j); j.id = await Store.save("journals", j); made.push(j.ref);
        r = Object.assign({}, r, { amcDef: Object.assign({}, r.amcDef, { rel: (r.amcDef.rel || []).concat([q.m]) }) });
        await Store.save("receivables", r);
      }
    }
    return made;
  }
  document.addEventListener("click", async function (e) {
    var t = e.target.closest && e.target.closest("#amcRel"); if (!t) return;
    if (!safe(function () { return armed("amcRel"); }, true)) return;
    try { var made = await release(); safe(function () { toast(made.length + " AMC income voucher" + (made.length === 1 ? "" : "s") + " made: " + made.join(", ") + "."); render(); }, null); }
    catch (er) { var el = document.getElementById("amcRelErr"); if (el) el.textContent = er.message || "Could not release."; }
  });

  function hook() {
    if (hooked) return true;
    if (typeof Store === "undefined" || !Store.save || typeof amcView !== "function" || typeof MODS === "undefined" || !MODS.proj) return false;
    hooked = true;
    wrapSave();
    var orig = amcView;
    amcView = function () { return orig.apply(this, arguments) + safe(card, ""); }; // eslint-disable-line no-global-assign
    if (!MODS.proj.tabs.some(function (t) { return t[0] === "amc"; })) MODS.proj.tabs.push(["amc", "AMC billing"]);
    safe(function () { render(); }, null);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-amcdef{margin-top:14px}.fs-amcdef table{width:100%;margin:6px 0 10px}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 400); }
  start();
})();
