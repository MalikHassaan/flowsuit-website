// Payment demands from branches and head offices (hassan, 2026-10-31: "payment demands come from Rawalpindi, Lahore,
// Faisalabad, Multan or any other branch, and from the head office of each company ... while creating the demand the
// JV should also be posted, once the JV is created it routes to the BPV, we select the bank, both move to approval and
// get printed at once: first the JV, then the BPV, then the supporting documents ... and a report of how many demands
// are paid and how many pending"). Under Payables › Payment demands:
//  * A demand: company, branch, who asked, who is to be paid, one or more lines (account, what for, project,
//    department, qty × rate) and the payable account. Saving it creates the demand JV (Dr each line, Cr the payable)
//    and sends it for approval.
//  * Choosing "Pay from bank" on the demand and saving creates the bank payment voucher (Dr the payable, Cr the bank),
//    also sent for approval. The two go through Senior Manager and Group GM Finance like every voucher.
//  * "Print JV + BPV + documents" prints the JV, the BPV and every attached document in one go.
//  * The list opens with a summary: demands paid and pending, in number and amount, by branch.
(function () {
  /* global S, MODS, TAB_HOME, POSTERS, DOCNAME, LABEL, COLLS, Store, F, V, LEDGER, openForm, submitForm, readForm,
     fieldHtml, accOptsGrouped, refName, DEPTS, ssEnhance, nextNo, fmt, n, esc, fdate, pill, mono, liveJv, srcJvs,
     scheduleRender, todayStr, accByCode, approverName, isLocked, lockTxt, jvTot, nextVoucherNo, jvSheet, sheetOpen,
     listView, byEnt, toast, drawForm */
  var DEM = "paydemands", BRANCHES = ["Head office", "Rawalpindi", "Islamabad", "Lahore", "Faisalabad", "Multan", "Karachi", "Peshawar"];
  var D = function (c) { return Store.data[c] || []; };
  var byId = function (c, id) { return D(c).find(function (r) { return r.id === id; }) || null; };
  var lineTot = function (it) { return Math.round((it || []).reduce(function (s, l) { return s + n(l.amount); }, 0) * 100) / 100; };

  // where a demand stands
  function state(r) {
    var jv = r.id && liveJv(DEM, r.id, "accrue"), bp = r.id && liveJv(DEM, r.id, "pay");
    if (bp && bp.status === "Posted") return { k: "paid", l: "Paid", c: "good", jv: jv, bp: bp };
    if (bp) return { k: "payappr", l: "Payment in approval", c: "acc", jv: jv, bp: bp };
    if (jv && jv.status === "Posted") return { k: "topay", l: "Approved, to be paid", c: "warn", jv: jv };
    if (jv) return { k: "appr", l: "Demand in approval", c: "warn", jv: jv };
    var back = r.id && srcJvs(DEM, r.id).some(function (j) { return j.status === "Rejected"; });
    return back ? { k: "back", l: "Returned", c: "bad" } : { k: "none", l: "Not posted", c: "" };
  }
  var tag = function (j) { return j ? mono(j.ref || "") + " " + pill(j.status === "Posted" ? "Posted" : "In approval", j.status === "Posted" ? "good" : "warn") : "<span class=\"muted\">–</span>"; };

  function defs() {
    S[DEM] = { title: "Payment demand", fields: [
      { k: "demandNo", l: "Demand no.", req: 1 }, { k: "date", l: "Date", t: "date", req: 1 }, { k: "entity", l: "Company", t: "entity", req: 1 },
      { k: "branch", l: "Branch / office", t: "pdbranch", req: 1, hint: "Where the demand comes from: Head office, Lahore, Multan ..." },
      { k: "requestedBy", l: "Requested by", req: 1 }, { k: "payee", l: "Pay to", req: 1, hint: "The supplier, landlord, staff member or party to be paid." },
      { k: "dueDate", l: "Needed by", t: "date" },
      { k: "payAcc", l: "Payable account (credit in the demand JV)", t: "acc", af: "payable", req: 1, hint: "Usually 220204 Other accrued expenses, or the creditors account for a supplier." },
      { k: "items", l: "Lines", t: "pdlines" },
      { k: "bank", l: "Pay from bank", t: "acc", af: "bank", hint: "Choose when it is to be paid. Saving with a bank creates the bank payment voucher and sends it for approval." },
      { k: "chequeNo", l: "Cheque / transfer no." }, { k: "payDate", l: "Payment date", t: "date" },
      { k: "notes", l: "Notes", t: "textarea" }],
      cols: [["demandNo", "Demand", function (r) { return mono(r.demandNo); }], ["date", "Date", function (r) { return fdate(r.date); }],
        ["entity", "Company"], ["branch", "Branch"], ["payee", "Pay to", function (r) { return esc(r.payee || "") + (r.requestedBy ? "<br><span class=\"muted\">by " + esc(r.requestedBy) + "</span>" : ""); }],
        ["description", "For"], ["amount", "Amount", null, "num"],
        ["jv", "Demand JV", function (r) { return tag(state(r).jv); }], ["bp", "Bank payment", function (r) { return tag(state(r).bp); }],
        ["st", "Status", function (r) { var s = state(r); return pill(s.l, s.c); }],
        ["pr", "", function (r) { return state(r).jv ? "<button type=\"button\" class=\"btn sm\" data-pdprint=\"" + esc(r.id) + "\">Print</button>" : ""; }]],
      sort: function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.demandNo).localeCompare(String(a.demandNo)); } };

    POSTERS[DEM] = {
      accrue: { label: "demand journal voucher", keys: ["items", "amount", "payAcc", "date", "entity"],
        ready: function (r) { return !r.payAcc ? "choose the payable account" : (r.items || []).some(function (l) { return !l.account; }) ? "every line needs an account" : n(r.amount) > 0 ? true : "enter the amounts"; },
        build: function (r) {
          var lines = (r.items || []).map(function (x) {
            var l = { account: x.account, debit: Math.round(n(x.amount)), credit: 0, desc: (String(x.desc || "") + (n(x.qty) && n(x.qty) !== 1 ? " (" + x.qty + " × " + fmt(x.rate) + ")" : "")).slice(0, 200) };
            if (x.project) l.project = x.project; if (x.dept) l.dept = x.dept;
            return l;
          }).filter(function (l) { return l.debit > 0; });
          var tot = lines.reduce(function (s, l) { return s + l.debit; }, 0);
          lines.push({ account: r.payAcc, debit: 0, credit: tot, desc: "Payable to " + (r.payee || "") });
          return { vtype: "Journal voucher", date: r.date, entity: r.entity, payee: r.payee || "", dept: ((r.items || [])[0] || {}).dept || "",
            narration: "Payment demand " + r.demandNo + " from " + (r.branch || "") + " for " + (r.payee || "") + ": " + (r.description || ""), lines: lines };
        } },
      pay: { label: "bank payment voucher", keys: ["bank", "amount", "payAcc"],
        ready: function (r) { return !liveJv(DEM, r.id, "accrue") ? "save the demand so its JV is made first" : !r.bank ? "choose the bank it is paid from" : true; },
        build: function (r) {
          var a = Math.round(n(r.amount));
          return { vtype: "Bank payment voucher", date: r.payDate || todayStr(), entity: r.entity, payee: r.payee || "", chequeNo: r.chequeNo || "", dept: ((r.items || [])[0] || {}).dept || "",
            narration: "Payment of demand " + r.demandNo + " (" + (r.branch || "") + ") to " + (r.payee || "") + ": " + (r.description || ""),
            lines: [{ account: r.payAcc, debit: a, credit: 0, desc: "Demand " + r.demandNo + " – " + (r.payee || "") }, { account: r.bank, debit: 0, credit: a, desc: r.chequeNo ? "Cheque / transfer " + r.chequeNo : "" }] };
        } } };
    DOCNAME[DEM] = "payment demand"; LABEL[DEM] = "demandNo";
    var m = MODS.e_ap;
    if (m && !m.tabs.some(function (t) { return t[0] === DEM; })) m.tabs.unshift([DEM, "Payment demands"]);
    TAB_HOME[DEM] = "e_ap";
  }

  function subscribe() {
    if (COLLS.indexOf(DEM) < 0) COLLS.push(DEM);
    if (!Array.isArray(Store.data[DEM])) Store.data[DEM] = [];
    if (Store.db) Store.db.collection(DEM).onSnapshot(function (s) {
      Store.data[DEM] = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      LEDGER = null; scheduleRender(); // eslint-disable-line no-global-assign
    });
  }

  // a voucher made from a demand always goes to approval
  async function post(r, ev) {
    var P = POSTERS[DEM][ev], ok = P.ready(r); if (ok !== true) throw new Error("Cannot make the " + P.label + ": " + ok + ".");
    if (liveJv(DEM, r.id, ev)) return null;
    var name = approverName() || "ERP user", now = new Date().toISOString();
    var j = Object.assign({}, P.build(r), { opening: "No", status: "Pending approval", source: { c: DEM, id: r.id, ev: ev, key: ev }, maker: { name: name, at: now }, approvals: [] });
    if (!j.dept) j.dept = "Finance & Accounts";
    if (isLocked(j)) throw new Error(j.entity + " " + lockTxt(j.entity) + ". Date it after that.");
    if ((j.lines || []).some(function (l) { return !l.account; })) throw new Error("An account is missing on the demand.");
    if (!jvTot(j).ok) throw new Error("The voucher would not balance. Check the amounts.");
    j.ref = nextVoucherNo(j); j.id = await Store.save("journals", j);
    return j;
  }

  // ---- the lines table ----
  function accOpts(v, ent) {
    var all = Store.data.accounts;
    Store.data.accounts = all.filter(function (a) { return a.posting === "Header" || a.id === v || (!/^1210/.test(a.code) && (!a.entity || !ent || a.entity === ent)); });
    try { return accOptsGrouped(v, ent); } finally { Store.data.accounts = all; }
  }
  function curEnt() { var e = document.getElementById("f_entity"); return (e && e.value) || (F && F.rec && F.rec.entity) || ""; }
  function linesHtml(it) {
    var ent = curEnt(), pj = Store.data.projects || [], dp = DEPTS();
    var sel = function (o, v) { return o.map(function (x) { return "<option value=\"" + esc(x[0]) + "\"" + (x[0] === v ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join(""); };
    return "<div id=\"pdBox\"><div class=\"jhead\"><b>What the payment is for</b><button type=\"button\" class=\"btn sm\" id=\"pdAdd\">+ Add line</button></div>" +
      "<div class=\"tw\"><table class=\"bitab\"><thead><tr><th style=\"min-width:180px\">What for *</th><th style=\"min-width:280px\">Account (debit) *</th><th style=\"min-width:160px\">Project</th><th>Department</th><th class=\"num\">Qty *</th><th class=\"num\">Rate (PKR) *</th><th class=\"num\">Amount (PKR)</th><th></th></tr></thead><tbody>" +
      it.map(function (x, i) {
        var a = " data-di=\"" + i + "\" aria-label=\"";
        return "<tr><td><input" + a + "What for, line " + (i + 1) + "\" data-dk=\"desc\" value=\"" + esc(x.desc || "") + "\" placeholder=\"For example: office rent October\"></td>" +
          "<td><select" + a + "Account, line " + (i + 1) + "\" data-dk=\"account\">" + accOpts(x.account || "", ent) + "</select></td>" +
          "<td><select" + a + "Project, line " + (i + 1) + "\" data-dk=\"project\"><option value=\"\">None</option>" + sel(pj.map(function (p) { return [p.id, refName("projects", p.id)]; }), x.project || "") + "</select></td>" +
          "<td><select" + a + "Department, line " + (i + 1) + "\" data-dk=\"dept\"><option value=\"\">Choose…</option>" + sel(dp.concat(x.dept && dp.indexOf(x.dept) < 0 ? [x.dept] : []).map(function (d) { return [d, d]; }), x.dept || "") + "</select></td>" +
          "<td><input" + a + "Quantity, line " + (i + 1) + "\" data-dk=\"qty\" type=\"number\" step=\"any\" min=\"0\" class=\"num\" style=\"width:80px\" value=\"" + esc(x.qty != null && x.qty !== "" ? x.qty : 1) + "\"></td>" +
          "<td><input" + a + "Rate, line " + (i + 1) + "\" data-dk=\"rate\" type=\"text\" inputmode=\"decimal\" autocomplete=\"off\" class=\"num amt\" style=\"width:120px\" value=\"" + esc(n(x.rate) ? x.rate : "") + "\"></td>" +
          "<td class=\"num\" id=\"pdAmt" + i + "\">" + (n(x.amount) ? fmt(x.amount) : "–") + "</td>" +
          "<td>" + (it.length > 1 ? "<button type=\"button\" class=\"btn sm\" data-pdrm=\"" + i + "\" aria-label=\"Remove line " + (i + 1) + "\">×</button>" : "") + "</td></tr>";
      }).join("") +
      "</tbody><tfoot><tr><td colspan=\"6\">Total</td><td class=\"num\" id=\"pdTot\">" + fmt(lineTot(it)) + "</td><td></td></tr></tfoot></table></div></div>";
  }
  function readLines() {
    var box = document.getElementById("pdBox"); if (!box) return (F && F.rec && F.rec.items) || [];
    var rows = {};
    box.querySelectorAll("[data-di]").forEach(function (el) { (rows[+el.getAttribute("data-di")] = rows[+el.getAttribute("data-di")] || {})[el.getAttribute("data-dk")] = el.value; });
    return Object.keys(rows).sort(function (a, b) { return a - b; }).map(function (i) {
      var r = rows[i], qty = r.qty === "" || r.qty == null ? 1 : n(r.qty), rate = n(r.rate);
      return { desc: String(r.desc || "").trim(), account: r.account || "", project: r.project || "", dept: r.dept || "", qty: qty, rate: rate, amount: Math.round(qty * rate * 100) / 100 };
    });
  }
  function redraw() {
    var box = document.getElementById("pdBox"); if (!box) return;
    box.outerHTML = linesHtml(F.rec.items && F.rec.items.length ? F.rec.items : [{}]);
    if (typeof ssEnhance === "function") ssEnhance(document.getElementById("frm"));
  }
  function totals() {
    var it = readLines(), t = document.getElementById("pdTot"); if (t) t.textContent = fmt(lineTot(it));
    it.forEach(function (l, i) { var c = document.getElementById("pdAmt" + i); if (c) c.textContent = l.amount ? fmt(l.amount) : "–"; });
  }
  function branches() {
    var seen = {}; BRANCHES.concat(D(DEM).map(function (r) { return r.branch; })).forEach(function (b) { if (b) seen[b] = 1; });
    return Object.keys(seen);
  }

  function err(m) { var e = document.getElementById("ferr"); if (e) e.textContent = m; return false; }
  function check() {
    var r = F.rec;
    r.items = (r.items || []).filter(function (l) { return l.account || n(l.amount) || l.desc; });
    if (!r.items.length) return err("Add at least one line.");
    for (var i = 0; i < r.items.length; i++) {
      if (!r.items[i].account) return err("Line " + (i + 1) + ": choose the account.");
      if (!(n(r.items[i].amount) > 0)) return err("Line " + (i + 1) + ": enter the quantity and rate.");
      if (!String(r.items[i].desc || "").trim()) return err("Line " + (i + 1) + ": say what it is for.");
    }
    r.amount = lineTot(r.items);
    r.description = r.items.map(function (l) { return l.desc; }).join("; ").slice(0, 200);
    if (r.bank && !r.payDate) r.payDate = todayStr();
    return true;
  }

  // ---- JV, then BPV, then the documents, printed together ----
  function printSet(r) {
    var s = state(r); if (!s.jv) return;
    var part = function (j) {
      var d = document.createElement("div"); d.innerHTML = jvSheet(j);
      var sh = d.querySelector(".sheet"); if (!sh) return "";
      sh.querySelectorAll(".bar, .fs-attsheet").forEach(function (x) { x.remove(); });
      return sh.innerHTML;
    };
    var keys = [DEM + "/" + r.id, "journals/" + s.jv.id].concat(s.bp ? ["journals/" + s.bp.id] : []);
    sheetOpen("<div class=\"sheetwrap\"><div class=\"sheet\"><div class=\"bar\"><button class=\"btn pri\" id=\"printSheet\">Print</button><button class=\"btn\" id=\"closeSheet\">Close</button></div>" +
      part(s.jv) + (s.bp ? "<div class=\"fs-pdbreak\"></div>" + part(s.bp) : "<p class=\"muted\" style=\"margin-top:12px\">No bank payment voucher yet: choose the bank on the demand and save.</p>") +
      "<div class=\"fs-pdbreak\"></div><div class=\"fs-attsheet\" data-keys=\"" + esc(keys.join(",")) + "\"><p class=\"muted\">Loading supporting documents…</p></div></div></div>");
  }

  // ---- the summary above the list: paid and pending, by branch ----
  function summary() {
    var rows = typeof byEnt === "function" ? byEnt(D(DEM).slice()) : D(DEM);
    var tot = { n: 0, a: 0 }, g = {}, by = {};
    rows.forEach(function (r) {
      var k = state(r).k, a = n(r.amount), b = (r.branch || "No branch") + " · " + (r.entity || "");
      tot.n++; tot.a += a;
      (g[k] = g[k] || { n: 0, a: 0 }); g[k].n++; g[k].a += a;
      var x = by[b] = by[b] || { n: 0, a: 0, pn: 0, pa: 0, dn: 0, da: 0 };
      x.n++; x.a += a; if (k === "paid") { x.dn++; x.da += a; } else { x.pn++; x.pa += a; }
    });
    var f = function (k) { return g[k] || { n: 0, a: 0 }; }, pend = { n: tot.n - f("paid").n, a: tot.a - f("paid").a };
    var card = function (t, x, c) { return "<div class=\"fs-pdcard " + (c || "") + "\"><span>" + t + "</span><b>" + x.n + "</b><em>Rs " + fmt(x.a) + "</em></div>"; };
    var bk = Object.keys(by).sort();
    return "<div class=\"fs-pdsum\"><div class=\"fs-pdcards\">" + card("All demands", tot) + card("Paid", f("paid"), "good") + card("Pending", pend, "warn") +
      card("Demand in approval", f("appr")) + card("Approved, to be paid", f("topay")) + card("Payment in approval", f("payappr")) + (f("back").n ? card("Returned", f("back"), "bad") : "") + "</div>" +
      (bk.length ? "<div class=\"tw\"><table><thead><tr><th>Branch · company</th><th class=\"num\">Demands</th><th class=\"num\">Amount</th><th class=\"num\">Paid</th><th class=\"num\">Paid amount</th><th class=\"num\">Pending</th><th class=\"num\">Pending amount</th></tr></thead><tbody>" +
        bk.map(function (k) { var x = by[k]; return "<tr><td>" + esc(k) + "</td><td class=\"num\">" + x.n + "</td><td class=\"num\">" + fmt(x.a) + "</td><td class=\"num\">" + x.dn + "</td><td class=\"num\">" + fmt(x.da) + "</td><td class=\"num\">" + x.pn + "</td><td class=\"num\">" + fmt(x.pa) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : "") + "<p class=\"muted\" style=\"margin:6px 0 0\">Type Paid, Pending approval or a branch name in Search to filter the list below.</p></div>";
  }

  function hook() {
    if (typeof S === "undefined" || !S.payables || typeof MODS === "undefined" || !MODS.e_ap || typeof POSTERS === "undefined" || typeof Store === "undefined" || !Store.ready ||
      typeof submitForm !== "function" || typeof openForm !== "function" || typeof fieldHtml !== "function" || typeof readForm !== "function" ||
      typeof listView !== "function" || typeof liveJv !== "function" || typeof jvSheet !== "function") return false;
    defs();
    subscribe();

    openForm = (function (old) { // eslint-disable-line no-global-assign
      return function (c, id, pre) {
        if (c === DEM && !id) {
          var pa = (accByCode()["220204"] || {}).id || "";
          pre = Object.assign({ demandNo: nextNo(DEM, "demandNo", "PD-"), requestedBy: approverName() || "", payAcc: pa, branch: "Head office" }, pre || {});
        }
        return old.call(this, c, id, pre);
      };
    })(openForm);

    fieldHtml = (function (old) { // eslint-disable-line no-global-assign
      return function (f, v) {
        if (f && f.t === "pdlines") {
          var it = Array.isArray(v) && v.length ? v : [{}];
          return "<div class=\"f w lines\">" + linesHtml(it) + "</div>";
        }
        if (f && f.t === "pdbranch") {
          return "<div class=\"f\"><label for=\"f_branch\">" + esc(f.l) + " *</label><input id=\"f_branch\" list=\"fsPdBranches\" value=\"" + esc(v || "") + "\" autocomplete=\"off\" required>" +
            "<datalist id=\"fsPdBranches\">" + branches().map(function (b) { return "<option value=\"" + esc(b) + "\">"; }).join("") + "</datalist>" +
            (f.hint ? "<span class=\"hint\">" + esc(f.hint) + "</span>" : "") + "</div>";
        }
        return old.apply(this, arguments);
      };
    })(fieldHtml);

    readForm = (function (old) { // eslint-disable-line no-global-assign
      return function () {
        var r = old.apply(this, arguments);
        if (F && F.c === DEM && document.getElementById("pdBox")) { F.rec.items = readLines(); F.rec.amount = lineTot(F.rec.items); }
        return r;
      };
    })(readForm);

    // saving makes the demand JV, and the BPV once a bank is chosen; both go to approval
    submitForm = (function (old) { // eslint-disable-line no-global-assign
      return async function () {
        if (!F || F.c !== DEM) return old.apply(this, arguments);
        readForm(); if (check() !== true) return false;
        var save = Store.save, saved = null, why = null;
        Store.save = function (c, rec) { return save.apply(this, arguments).then(function (id) { if (c === DEM) saved = Object.assign({}, rec, { id: id }); return id; }, function (e) { why = e; throw e; }); };
        var ok;
        try { ok = await old.apply(this, arguments); } finally { Store.save = save; }
        if (ok === false) { if (why) err("Could not save: " + (why.message || why) + "."); return ok; }
        if (!saved) return ok;
        try {
          var made = [], a = await post(saved, "accrue"); if (a) made.push(a.ref);
          if (saved.bank) { var b = await post(saved, "pay"); if (b) made.push(b.ref); }
          if (made.length) toast(saved.demandNo + ": " + made.join(" and ") + " sent for approval.");
        } catch (x) { toast(saved.demandNo + " saved, but " + (x.message || x)); }
        return ok;
      };
    })(submitForm);

    listView = (function (old) { // eslint-disable-line no-global-assign
      return function (c) { var out = old.apply(this, arguments); return c === DEM && typeof out === "string" ? summary() + out : out; };
    })(listView);

    document.addEventListener("click", function (e) {
      var p = e.target.closest && e.target.closest("[data-pdprint], #fsPdPrint");
      if (p) {
        e.preventDefault(); e.stopImmediatePropagation();
        var r = byId(DEM, p.id === "fsPdPrint" ? F.rec.id : p.getAttribute("data-pdprint")); if (r) printSet(r);
        return;
      }
      var t = e.target.closest && e.target.closest("#pdAdd, [data-pdrm]");
      if (!t || typeof F === "undefined" || !F || F.c !== DEM) return;
      var it = readLines();
      if (t.id === "pdAdd") it.push({ dept: (it[it.length - 1] || {}).dept || "" });
      else { it.splice(+t.getAttribute("data-pdrm"), 1); if (!it.length) it.push({}); }
      F.rec.items = it; redraw();
      if (t.id === "pdAdd") { var el = document.querySelector("[data-di=\"" + (it.length - 1) + "\"][data-dk=\"desc\"]"); if (el) el.focus(); }
    }, true);
    document.addEventListener("input", function (e) { if (typeof F !== "undefined" && F && F.c === DEM && e.target.closest && e.target.closest("#pdBox")) totals(); });
    document.addEventListener("change", function (e) {
      if (typeof F === "undefined" || !F || F.c !== DEM || !e.target) return;
      if (e.target.id === "f_entity") { F.rec.items = readLines(); redraw(); } // the company sets which accounts are offered
      else if (e.target.closest && e.target.closest("#pdBox")) totals();
    });
    // the form is wide for the lines, and has the print button once the JV exists
    new MutationObserver(function () {
      if (typeof F === "undefined" || !F || F.c !== DEM) return;
      var fm = document.getElementById("frm"); if (!fm) return;
      if (!fm.classList.contains("wide")) fm.classList.add("wide");
      var act = fm.querySelector(".actions");
      if (act && F.rec.id && !act.querySelector("#fsPdPrint") && state(F.rec).jv) {
        var b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.id = "fsPdPrint"; b.textContent = "Print JV + BPV + documents";
        var cancel = act.querySelector("#cancelBtn"); act.insertBefore(b, cancel ? cancel.nextSibling : null);
      }
    }).observe(document.body, { childList: true, subtree: true });

    var css = document.createElement("style");
    css.textContent = ".fs-pdsum{margin:0 0 14px}.fs-pdcards{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px}" +
      ".fs-pdcard{flex:1 1 150px;padding:10px 12px;border:1px solid var(--line,#e3e6eb);border-radius:10px;background:var(--panel,#fff)}" +
      ".fs-pdcard span{display:block;font-size:12px;color:#64748b}.fs-pdcard b{display:block;font-size:22px}.fs-pdcard em{font-style:normal;font-size:12px;color:#475569}" +
      ".fs-pdcard.good b{color:#15803d}.fs-pdcard.warn b{color:#b45309}.fs-pdcard.bad b{color:#b91c1c}" +
      ".fs-pdbreak{height:0;margin:18px 0;border-top:1px dashed #ccc}@media print{.fs-pdbreak{break-before:page;page-break-before:always;border:0;margin:0}}";
    document.head.appendChild(css);
    scheduleRender();
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
