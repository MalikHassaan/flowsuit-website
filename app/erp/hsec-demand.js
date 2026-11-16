// Payment demands from branches and head offices (hassan, 2026-10-31: "payment demands come from Rawalpindi, Lahore,
// Faisalabad, Multan or any other branch, and from the head office of each company ... while creating the demand the
// JV should also be posted, once the JV is created it routes to the BPV, we select the bank, both move to approval and
// get printed at once: first the JV, then the BPV, then the supporting documents ... and a report of how many demands
// are paid and how many pending"). Under Payables › Payment demands:
//  * A demand: company, branch, who asked, who is to be paid, one or more lines (account, what for, project,
//    department, qty × rate) and the payable account. Saving it posts the demand JV (Dr each line, Cr the payable) at
//    once, with no approval (hassan, 2026-10-31); after that its amounts change only through Reverse and correct.
//  * Choosing "Pay from bank" on the demand and saving creates the bank payment voucher (Dr the payable, Cr the bank),
//    which goes through Senior Manager and Group GM Finance like every voucher.
//  * "Print JV + BPV + documents" prints the JV, the BPV and every attached document in one go.
//  * The list opens with a summary: demands paid and pending, in number and amount, by branch.
//  * From / To dates filter the summary, the list and the export; Export CSV asks for demand JVs, BPVs or both
//    and gives their voucher lines (hassan, 2026-11-02).
//  * Export now gives the demands list itself on the report template, to print or save as PDF, or as Excel (CSV);
//    the JV / BPV voucher lines moved to Reports › Demand vouchers (hassan, 2026-11-16: "when we click export I want
//    the report in this template and just this detail, and the JV and BPV posting should be shown in the reports module").
//  * The GM decides which demands are paid (hassan, 2026-11-16: "once the demand is created the GM has the option which
//    demands should be paid and approved ... once it's approved by the GM, date and comments should be shown to the
//    maker"). A demand whose JV is posted waits for the GM; the GM (Group GM Finance approval role, or an ERP admin)
//    ticks demands in the list, or opens one, writes a comment and clicks Approve or Not approved. Pay appears only on
//    approved demands, and the server refuses a bank payment for any other (hsec_pd_paycheck). The decision, the GM's
//    name, the date and the comment show in the list and on the demand for the person who made it.
(function () {
  /* global S, MODS, TAB_HOME, POSTERS, DOCNAME, LABEL, COLLS, Store, F, V, LEDGER, openForm, submitForm, readForm,
     fieldHtml, accOptsGrouped, refName, DEPTS, ssEnhance, nextNo, fmt, n, esc, fdate, pill, mono, liveJv, srcJvs,
     scheduleRender, todayStr, accByCode, approverName, isLocked, lockTxt, jvTot, nextVoucherNo, jvSheet, sheetOpen,
     listView, byEnt, toast, drawForm, special, legal */
  var DEM = "paydemands", BRANCHES = ["Head office", "Rawalpindi", "Islamabad", "Lahore", "Faisalabad", "Multan", "Karachi", "Peshawar"];
  var D = function (c) { return Store.data[c] || []; };
  var byId = function (c, id) { return D(c).find(function (r) { return r.id === id; }) || null; };
  // the app's helpers, or the same worked out here when a newer app file names them differently
  var vouchersOf = function (id) {
    if (typeof srcJvs === "function") return srcJvs(DEM, id);
    return D("journals").filter(function (j) { return j.source && j.source.c === DEM && j.source.id === id; });
  };
  var live = function (id, ev) {
    if (typeof liveJv === "function") return liveJv(DEM, id, ev);
    return vouchersOf(id).find(function (j) { return j.source.ev === ev && j.status !== "Rejected"; });
  };
  var lineTot = function (it) { return Math.round((it || []).reduce(function (s, l) { return s + n(l.amount); }, 0) * 100) / 100; };

  // where a demand stands
  function state(r) {
    var jv = r.id && live(r.id, "accrue"), bp = r.id && live(r.id, "pay");
    if (bp && bp.status === "Posted") return { k: "paid", l: "Paid", c: "good", jv: jv, bp: bp };
    if (bp) return { k: "payappr", l: "Payment in approval", c: "acc", jv: jv, bp: bp };
    if (jv && jv.status === "Posted") {
      var g = r.gm && r.gm.status;
      if (g === "Approved") return { k: "topay", l: "To be paid", c: "warn", jv: jv };
      if (g === "Not approved") return { k: "gmno", l: "Not approved by GM", c: "bad", jv: jv };
      return { k: "gm", l: "Waiting for GM approval", c: "warn", jv: jv };
    }
    if (jv) return { k: "appr", l: "Demand in approval", c: "warn", jv: jv };
    var back = r.id && vouchersOf(r.id).some(function (j) { return j.status === "Rejected"; });
    return back ? { k: "back", l: "Returned", c: "bad" } : { k: "none", l: "Not posted", c: "" };
  }
  var isGm = function () { return !!(window.FS_ADMIN || window.FS_JV === "gmf"); };
  // the GM's decision, its date and comment, for the list and the demand
  function gmTxt(r, long) {
    var g = r.gm; if (!g || !g.status) return "";
    var ok = g.status === "Approved";
    return "<div class=\"fs-pdgm " + (ok ? "ok" : "no") + "\">" + (ok ? "Approved" : "Not approved") + " by " + esc(g.name || "GM") + (g.at ? " on " + esc(fdate(String(g.at).slice(0, 10))) : "") +
      (g.note ? (long ? "<br>" : ": ") + "<q>" + esc(g.note) + "</q>" : "") + "</div>";
  }
  // ---- date range (hassan, 2026-11-02: "there should be date filtration from and to date") ----
  var R = (function () { try { return JSON.parse(sessionStorage.getItem("fs-pd-range")) || { from: "", to: "" }; } catch (e) { return { from: "", to: "" }; } })();
  var keepR = function () { try { sessionStorage.setItem("fs-pd-range", JSON.stringify(R)); } catch (e) { /* private window */ } };
  var inRange = function (r) { var d = String(r.date || ""); return (!R.from || d >= R.from) && (!R.to || d <= R.to); };
  var ranged = function () { return !!(R.from || R.to); };
  var rangeTxt = function () { return R.from && R.to ? fdate(R.from) + " to " + fdate(R.to) : R.from ? "from " + fdate(R.from) : R.to ? "up to " + fdate(R.to) : "all dates"; };
  function rangeBar() {
    return "<div class=\"fs-pdrange\"><label>From <input type=\"date\" id=\"pdFrom\" value=\"" + esc(R.from) + "\"></label>" +
      "<label>To <input type=\"date\" id=\"pdTo\" value=\"" + esc(R.to) + "\"></label>" +
      (ranged() ? "<button type=\"button\" class=\"btn sm\" id=\"pdClr\">Show all dates</button>" : "") +
      "<span class=\"muted\">Demands dated " + esc(rangeTxt()) + ". The figures, the list, Export and Reports › Demand vouchers follow these dates.</span></div>";
  }

  // ---- Export CSV asks which vouchers (hassan, 2026-11-02: "when we click export it should ask JV, BPV or both") ----
  var EXST = [["paid", "Paid", ["paid"]], ["topay", "To be paid (approved by GM, not paid)", ["topay"]], ["payappr", "Payment in approval", ["payappr"]],
    ["gm", "Waiting for GM approval", ["gm"]], ["gmno", "Not approved by GM", ["gmno"]],
    ["appr", "Demand in approval", ["appr"]], ["draft", "Draft / not posted", ["none"]], ["back", "Returned", ["back"]]];
  // the status ticks, with how many demands of the chosen dates each has
  function stBoxes() {
    var cnt = {}; (typeof byEnt === "function" ? byEnt(D(DEM).slice()) : D(DEM)).filter(inRange).forEach(function (r) { var k = state(r).k; cnt[k] = (cnt[k] || 0) + 1; });
    return "<fieldset class=\"fs-pdexst\"><legend>Status</legend>" + EXST.map(function (x) {
      var c = x[2].reduce(function (t, k) { return t + (cnt[k] || 0); }, 0);
      return "<label><input type=\"checkbox\" data-pdst=\"" + x[0] + "\" checked> " + esc(x[1]) + " <span class=\"muted\">(" + c + ")</span></label>";
    }).join("") + "</fieldset>";
  }
  function exportMenu(btn) {
    var old = document.getElementById("fsPdExp"); if (old) { old.remove(); return; }
    var m = document.createElement("div"); m.id = "fsPdExp"; m.className = "fs-pdexp"; m.setAttribute("role", "menu");
    m.innerHTML = "<b>What do you want to export?</b><span class=\"muted\">Demands dated " + esc(rangeTxt()) + "</span>" + stBoxes() +
      "<button type=\"button\" class=\"btn pri\" data-pdexp=\"rpt\">Report: print or save as PDF</button>" +
      "<button type=\"button\" class=\"btn\" data-pdexp=\"list\">Excel (CSV) of this list</button>" +
      "<span class=\"muted\">The JV and BPV voucher lines are under Reports › Demand vouchers.</span>";
    var r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + window.scrollY + 6) + "px"; m.style.left = Math.max(8, r.right + window.scrollX - 300) + "px";
    document.body.appendChild(m);
  }
  // ---- the demands list itself: on the report template, or as CSV ----
  var CO = function () { var e = V && V.ent; return !e || e === "All" ? "HSEC Group – all companies" : (typeof legal === "function" ? legal(e) : e); }; // eslint-disable-line no-undef
  function listRows(ks) {
    return (typeof byEnt === "function" ? byEnt(D(DEM).slice()) : D(DEM).slice()).filter(inRange).filter(function (r) { return !ks || ks.indexOf(state(r).k) >= 0; })
      .sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")) || String(a.demandNo || "").localeCompare(String(b.demandNo || "")); })
      .map(function (r) { var s = state(r), a = n(r.amount), paid = s.k === "paid" ? a : 0;
        return { r: r, s: s, a: a, paid: paid, bal: a - paid }; });
  }
  var stTxt = function (ks) { var L = EXST.filter(function (x) { return x[2].some(function (k) { return ks.indexOf(k) >= 0; }); }).map(function (x) { return x[1].replace(/ \(.*\)$/, ""); }); return L.length === EXST.length ? "all statuses" : L.join(", "); };
  function listReport(ks) {
    var R0 = listRows(ks); if (!R0.length) { toast("No demands with those statuses dated " + rangeTxt() + "."); return; }
    var t = { a: 0, p: 0, b: 0 }; R0.forEach(function (x) { t.a += x.a; t.p += x.paid; t.b += x.bal; });
    // more than one company: how many demands and how much for each, above the list (hassan, 2026-11-16: "once we
    // extract the combined report it should say how many are of HSEC and how many of JSPL and the total amount")
    var byCo = {}; R0.forEach(function (x) { var e = x.r.entity || "–", c = byCo[e] = byCo[e] || { n: 0, a: 0, p: 0, b: 0 }; c.n++; c.a += x.a; c.p += x.paid; c.b += x.bal; });
    var cos = Object.keys(byCo).sort(), coName = function (e) { var l = typeof legal === "function" ? legal(e) : ""; return l && l !== e ? e + " – " + l : e; }; // eslint-disable-line no-undef
    var sumT = cos.length < 2 ? "" : "<h3 style=\"margin:10px 0 6px\">Summary by company</h3><table class=\"fs-rt-sum\" style=\"width:auto;min-width:60%;margin-bottom:14px\"><thead><tr><th>Company</th><th class=\"num\">No. of demands</th><th class=\"num\">Amount</th><th class=\"num\">Paid</th><th class=\"num\">To be paid</th></tr></thead><tbody>" +
      cos.map(function (e) { var c = byCo[e]; return "<tr><td>" + esc(coName(e)) + "</td><td class=\"num\">" + c.n + "</td><td class=\"num\">" + fmt(c.a) + "</td><td class=\"num\">" + (c.p ? fmt(c.p) : "–") + "</td><td class=\"num\">" + (c.b ? fmt(c.b) : "–") + "</td></tr>"; }).join("") +
      "</tbody><tfoot><tr><td>Total</td><td class=\"num\">" + R0.length + "</td><td class=\"num\">" + fmt(t.a) + "</td><td class=\"num\">" + (t.p ? fmt(t.p) : "–") + "</td><td class=\"num\">" + (t.b ? fmt(t.b) : "–") + "</td></tr></tfoot></table>";
    var html = "<div class=\"co\">" + esc(CO()) + "</div><h2>PAYMENT DEMANDS STATEMENT</h2><p>Demands dated " + esc(rangeTxt()) + " · " + esc(stTxt(ks)) + "</p>" + sumT + (sumT ? "<h3 style=\"margin:10px 0 6px\">Demands</h3>" : "") +
      "<table><thead><tr><th>Sr.</th><th>Demand</th><th>Date</th><th>Company</th><th>Branch</th><th>Pay to</th><th>For</th><th class=\"num\">Amount</th><th class=\"num\">Paid</th><th class=\"num\">To be paid</th><th>Demand JV</th><th>Bank payment</th><th>Status</th></tr></thead><tbody>" +
      R0.map(function (x, i) { var r = x.r;
        return "<tr><td>" + (i + 1) + "</td><td style=\"white-space:nowrap\">" + esc(r.demandNo || "") + "</td><td style=\"white-space:nowrap\">" + esc(fdate(r.date)) + "</td><td>" + esc(r.entity || "") + "</td><td>" + esc(r.region || r.branch || "") + "</td><td>" + esc(r.payee || "") +
          "</td><td>" + esc(r.description || "") + "</td><td class=\"num\">" + fmt(x.a) + "</td><td class=\"num\">" + (x.paid ? fmt(x.paid) : "–") + "</td><td class=\"num\">" + (x.bal ? fmt(x.bal) : "–") +
          "</td><td style=\"white-space:nowrap\">" + esc(x.s.jv ? x.s.jv.ref || "" : "–") + "</td><td style=\"white-space:nowrap\">" + esc(x.s.bp ? x.s.bp.ref || "" : "–") + "</td><td>" + esc(x.s.l) + "</td></tr>"; }).join("") +
      "</tbody><tfoot><tr><td></td><td colspan=\"6\">Grand Total</td><td class=\"num\">" + fmt(t.a) + "</td><td class=\"num\">" + fmt(t.p) + "</td><td class=\"num\">" + fmt(t.b) + "</td><td colspan=\"3\"></td></tr></tfoot></table>";
    sheetOpen(html);
  }
  async function listCsv(ks) {
    var R0 = listRows(ks); if (!R0.length) { toast("No demands with those statuses dated " + rangeTxt() + "."); return; }
    var q = function (v) { var t = String(v == null ? "" : v); return /[",\n]/.test(t) ? "\"" + t.replace(/"/g, "\"\"") + "\"" : t; };
    var out = [["Demand no.", "Date", "Company", "Branch", "Pay to", "For", "Amount", "Paid", "To be paid", "Demand JV", "Bank payment", "Status"]], t = [0, 0, 0];
    R0.forEach(function (x) { var r = x.r; t[0] += x.a; t[1] += x.paid; t[2] += x.bal;
      out.push([r.demandNo, r.date, r.entity, r.region || r.branch, r.payee, r.description, x.a, x.paid, x.bal, x.s.jv ? x.s.jv.ref : "", x.s.bp ? x.s.bp.ref : "", x.s.l]); });
    out.push(["Total", R0.length + " demands", "", "", "", "", t[0], t[1], t[2], "", "", ""]);
    var csv = "\ufeff" + out.map(function (row) { return row.map(q).join(","); }).join("\r\n"), name = "Payment_demands_" + (R.from || "start") + "_to_" + (R.to || todayStr()) + ".csv";
    var a2 = document.createElement("a"); a2.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a2.download = name;
    document.body.appendChild(a2); a2.click(); setTimeout(function () { URL.revokeObjectURL(a2.href); a2.remove(); }, 1000);
  }
  // ---- Reports › Demand vouchers: the JV and BPV voucher lines ----
  function vouchersView() {
    return "<div class=\"panel fs-pdvrep\" style=\"padding:14px 16px;max-width:760px\"><p style=\"margin:0 0 10px\">The voucher lines of payment demands (account, debit, credit) as Excel (CSV), for the company chosen at the top.</p>" +
      rangeBar() + stBoxes() + "<div style=\"display:flex;flex-wrap:wrap;gap:8px;margin-top:10px\">" +
      "<button type=\"button\" class=\"btn\" data-pdexp=\"jv\">Demand JVs only</button>" +
      "<button type=\"button\" class=\"btn\" data-pdexp=\"bp\">Bank payment vouchers (BPV) only</button>" +
      "<button type=\"button\" class=\"btn pri\" data-pdexp=\"both\">Both JV and BPV</button></div></div>";
  }
  async function exportVouchers(kind, ks) {
    var q = function (v) { var t = String(v == null ? "" : v); return /[",\n]/.test(t) ? "\"" + t.replace(/"/g, "\"\"") + "\"" : t; };
    var acc = {}; D("accounts").forEach(function (a) { acc[a.id] = a; });
    var rows = (typeof byEnt === "function" ? byEnt(D(DEM).slice()) : D(DEM).slice()).filter(inRange).filter(function (r) { return !ks || ks.indexOf(state(r).k) >= 0; })
      .sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")) || String(a.demandNo || "").localeCompare(String(b.demandNo || "")); });
    var out = [["Demand no.", "Demand date", "Company", "Branch", "Pay to", "For", "Demand status", "Demand amount", "Voucher", "Voucher no.", "Voucher date", "Voucher status", "Cheque / transfer no.", "Account code", "Account name", "Line description", "Debit", "Credit"]];
    var dr = 0, cr = 0, nv = 0, nd = 0, amt = 0;
    rows.forEach(function (r) {
      var s = state(r), list = [];
      if (kind !== "bp" && s.jv) list.push(["JV", s.jv]);
      if (kind !== "jv" && s.bp) list.push(["BPV", s.bp]);
      var first = true, head = function () { var h0 = [r.demandNo, r.date, r.entity, r.branch, r.payee, r.description, s.l, first ? n(r.amount) : ""]; if (first) { first = false; amt += n(r.amount); } return h0; };
      nd++;
      if (!list.length) out.push(head().concat([kind === "bp" ? "No BPV yet" : kind === "jv" ? "No JV yet" : "No voucher yet", "", "", "", r.chequeNo || "", "", "", "", "", ""]));
      list.forEach(function (x) {
        var j = x[1]; nv++;
        (j.lines || []).forEach(function (l) {
          var a = acc[l.account] || {}; dr += n(l.debit); cr += n(l.credit);
          out.push(head().concat([x[0], j.ref || "", j.date || "", j.status || "", j.chequeNo || r.chequeNo || "",
            a.code || "", a.name || "", l.desc || j.narration || "", n(l.debit) || "", n(l.credit) || ""]));
        });
      });
    });
    if (!nd) { toast("No demands with those statuses dated " + rangeTxt() + "."); return; }
    out.push(["Total", nd + " demand" + (nd === 1 ? "" : "s"), "", "", "", "", "", Math.round(amt * 100) / 100, "", nv + " voucher" + (nv === 1 ? "" : "s"), "", "", "", "", "", "", Math.round(dr * 100) / 100, Math.round(cr * 100) / 100]);
    var csv = "\ufeff" + out.map(function (row) { return row.map(q).join(","); }).join("\r\n");
    var name = "HSEC_payment_demands_" + (kind === "jv" ? "JV" : kind === "bp" ? "BPV" : "JV_and_BPV") + "_" + (R.from || "start") + "_to_" + (R.to || todayStr()) + ".csv";
    var dl = null; try { dl = window.claude && await window.claude.use("downloads"); } catch (e) { dl = null; }
    if (dl) { try { await dl.save({ filename: name, data: csv }); } catch (e) { if (e && e.code !== "declined") toast("Download failed."); } return; }
    var a2 = document.createElement("a"); a2.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a2.download = name;
    document.body.appendChild(a2); a2.click(); setTimeout(function () { URL.revokeObjectURL(a2.href); a2.remove(); }, 1000);
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
        ["jv", "Demand JV", function (r) { return tag(state(r).jv); }], ["bp", "Bank payment", function (r) { var s = state(r); return s.k === "topay" ? "<button type=\"button\" class=\"btn sm pri\" data-pdpay=\"" + esc(r.id) + "\">Pay</button>" : s.k === "gm" && isGm() ? "<label class=\"fs-pdtick\"><input type=\"checkbox\" data-pdgm=\"" + esc(r.id) + "\"> Approve?</label>" : tag(s.bp); }],
        ["st", "Status", function (r) { var s = state(r); return pill(s.l, s.c) + gmTxt(r); }],
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
        ready: function (r) { return !live(r.id, "accrue") ? "save the demand so its JV is made first" : !r.bank ? "choose the bank it is paid from" : true; },
        build: function (r) {
          var a = Math.round(n(r.amount));
          return { vtype: "Bank payment voucher", date: r.payDate || todayStr(), entity: r.entity, payee: r.payee || "", chequeNo: r.chequeNo || "", dept: ((r.items || [])[0] || {}).dept || "",
            narration: "Payment of demand " + r.demandNo + " (" + (r.branch || "") + ") to " + (r.payee || "") + ": " + (r.description || ""),
            lines: [{ account: r.payAcc, debit: a, credit: 0, desc: "Demand " + r.demandNo + " – " + (r.payee || "") }, { account: r.bank, debit: 0, credit: a, desc: r.chequeNo ? "Cheque / transfer " + r.chequeNo : "" }] };
        } } };
    if (typeof DOCNAME !== "undefined") DOCNAME[DEM] = "payment demand";
    if (typeof LABEL !== "undefined") LABEL[DEM] = "demandNo";
    var m = MODS.e_ap;
    if (m && !m.tabs.some(function (t) { return t[0] === DEM; })) m.tabs.unshift([DEM, "Payment demands"]);
    if (typeof TAB_HOME !== "undefined") TAB_HOME[DEM] = "e_ap";
    if (MODS.rpt && !MODS.rpt.tabs.some(function (t) { return t[0] === "pdvouch"; })) MODS.rpt.tabs.push(["pdvouch", "Demand vouchers (JV / BPV)"]);
  }

  function subscribe() {
    // offices added with + are shared with everyone (hassan, 2026-10-31: "anything entered by the maker should be shown to everyone")
    if (COLLS.indexOf("fsbranches") < 0) COLLS.push("fsbranches");
    if (!Array.isArray(Store.data.fsbranches)) Store.data.fsbranches = [];
    if (Store.db) Store.db.collection("fsbranches").onSnapshot(function (s) {
      Store.data.fsbranches = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    });
    if (COLLS.indexOf(DEM) < 0) COLLS.push(DEM);
    if (!Array.isArray(Store.data[DEM])) Store.data[DEM] = [];
    if (Store.db) Store.db.collection(DEM).onSnapshot(function (s) {
      Store.data[DEM] = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      LEDGER = null; scheduleRender(); // eslint-disable-line no-global-assign
    });
  }

  // The demand JV posts at once; only the bank payment voucher goes to approval (hassan, 2026-10-31: "JV doesn't need
  // approval process, only once the payment is made").
  async function post(r, ev) {
    var P = POSTERS[DEM][ev], ok = P.ready(r); if (ok !== true) throw new Error("Cannot make the " + P.label + ": " + ok + ".");
    if (live(r.id, ev)) return null;
    var name = approverName() || "ERP user", now = new Date().toISOString();
    var j = Object.assign({}, P.build(r), { opening: "No", status: ev === "accrue" ? "Posted" : "Pending approval", source: { c: DEM, id: r.id, ev: ev, key: ev }, maker: { name: name, at: now }, approvals: [] });
    if (ev === "accrue") j.postedBy = { name: name, at: now };
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
    var saved = typeof settings === "function" && Array.isArray(settings().pdBranches) ? settings().pdBranches : [];
    saved = saved.concat(D("fsbranches").map(function (b) { return b.name; }));
    var seen = {}; BRANCHES.concat(saved, D(DEM).map(function (r) { return r.branch; })).forEach(function (b) { if (b) seen[b] = 1; });
    return Object.keys(seen);
  }

  // + next to Branch / office (hassan, 2026-10-31: "there should be + button to add more location as transaction can be
  // made on other office behalf as well"). A new office is saved for everyone, whoever adds it.
  function branchBtn(id) {
    var box = document.querySelector(".fs-pdbnew"), inp = document.getElementById("fsPdBrNew"), fld = document.getElementById("f_branch");
    if (!box || !fld) return;
    if (id === "fsPdBrAdd") { box.hidden = false; fld.hidden = true; inp.value = ""; inp.focus(); return; }
    box.hidden = true; fld.hidden = false;
    if (id === "fsPdBrNo") return fld.focus();
    var name = inp.value.replace(/\s+/g, " ").trim().slice(0, 60); if (!name) return fld.focus();
    var have = branches().find(function (x) { return x.toLowerCase() === name.toLowerCase(); });
    fld.value = have || name; fld.dispatchEvent(new Event("change", { bubbles: true }));
    if (have) return;
    var dl = document.getElementById("fsPdBranches"); if (dl) { var o = document.createElement("option"); o.value = name; dl.appendChild(o); }
    var slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || ("b" + Date.now());
    Store.save("fsbranches", { id: slug, name: name, by: (typeof approverName === "function" && approverName()) || "", at: new Date().toISOString() })
      .then(function () { if (typeof toast === "function") toast(name + " added to the branch list for everyone"); },
        function (x) { if (typeof toast === "function") toast("Kept on this demand only: " + ((x && x.message) || "could not save the branch list")); });
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
    // Once its JV is in the books, what was demanded can only change by reversing it.
    var was = r.id && byId(DEM, r.id), jv = r.id && live(r.id, "accrue");
    if (was && jv && jv.status === "Posted") {
      var key = function (x) { return JSON.stringify([x.entity, x.payAcc, x.date, (x.items || []).map(function (l) { return [l.account, n(l.amount), l.project || "", l.dept || ""]; })]); };
      if (key(was) !== key(r)) return err("The demand JV " + (jv.ref || "") + " is already posted, so the lines, amounts, accounts, company and date cannot change. Use Reverse and correct to change them.");
    }
    if (r.bank && jv && jv.status === "Posted" && !live(r.id, "pay")) {
      var g0 = was && was.gm && was.gm.status;
      if (g0 !== "Approved") return err(g0 === "Not approved" ? "The GM did not approve this demand, so it cannot be paid. Clear Pay from bank to save other changes." : "The GM has not approved this demand yet. It can be paid once the GM approves it. Clear Pay from bank to save other changes.");
    }
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
    var rows = (typeof byEnt === "function" ? byEnt(D(DEM).slice()) : D(DEM).slice()).filter(inRange);
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
    return "<div class=\"fs-pdsum\">" + rangeBar() + "<div class=\"fs-pdcards\">" + card("All demands", tot) + card("Paid", f("paid"), "good") + card("Pending", pend, "warn") +
      (f("appr").n ? card("Demand in approval", f("appr")) : "") + (f("gm").n ? card("Waiting for GM", f("gm"), "warn") : "") + (f("gmno").n ? card("Not approved by GM", f("gmno"), "bad") : "") + card("To be paid", f("topay")) + card("Payment in approval", f("payappr")) + (f("back").n ? card("Returned", f("back"), "bad") : "") + "</div>" +
      (bk.length ? "<div class=\"tw\"><table><thead><tr><th>Branch · company</th><th class=\"num\">Demands</th><th class=\"num\">Amount</th><th class=\"num\">Paid</th><th class=\"num\">Paid amount</th><th class=\"num\">Pending</th><th class=\"num\">Pending amount</th></tr></thead><tbody>" +
        bk.map(function (k) { var x = by[k]; return "<tr><td>" + esc(k) + "</td><td class=\"num\">" + x.n + "</td><td class=\"num\">" + fmt(x.a) + "</td><td class=\"num\">" + x.dn + "</td><td class=\"num\">" + fmt(x.da) + "</td><td class=\"num\">" + x.pn + "</td><td class=\"num\">" + fmt(x.pa) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" : "") + gmBar(f("gm")) + "<p class=\"muted\" style=\"margin:6px 0 0\">Type Paid, Pending approval or a branch name in Search to filter the list below.</p></div>";
  }

  // the GM's bar above the list: tick the demands to pay, comment, approve or not
  function gmBar(x) {
    if (!isGm() || !x.n) return "";
    return "<div class=\"fs-pdgmbar\"><b>" + x.n + " demand" + (x.n === 1 ? "" : "s") + " (Rs " + fmt(x.a) + ") waiting for your approval.</b> Tick the ones to pay in the Bank payment column, or tick all, then approve." +
      "<div class=\"fs-pdgmrow\"><label><input type=\"checkbox\" id=\"pdGmAll\"> Tick all waiting</label>" +
      "<input id=\"pdGmNote\" maxlength=\"500\" placeholder=\"Comment for the person who made the demand (optional)\" autocomplete=\"off\">" +
      "<button type=\"button\" class=\"btn pri\" data-pdgmgo=\"Approved\">Approve ticked</button><button type=\"button\" class=\"btn\" data-pdgmgo=\"Not approved\">Not approved</button></div></div>";
  }
  async function gmDecide(ids, st, note) {
    var done = 0, fail = "";
    for (var i = 0; i < ids.length; i++) {
      var r = byId(DEM, ids[i]); if (!r) continue;
      var k = state(r).k; if (k !== "gm" && k !== "gmno" && k !== "topay") continue;
      try { await Store.save(DEM, Object.assign({}, r, { gm: { status: st, note: note, name: (typeof approverName === "function" && approverName()) || "GM", at: new Date().toISOString() } })); done++; } catch (x) { fail = (x && x.message) || String(x); }
    }
    toast(done ? done + " demand" + (done === 1 ? "" : "s") + (st === "Approved" ? " approved for payment." : " marked not approved.") + (fail ? " Some failed: " + fail : "") : "Nothing saved" + (fail ? ": " + fail : "."));
    scheduleRender();
    return done;
  }
  // on the demand itself: the decision for everyone, the buttons for the GM
  function gmPanel() {
    var r = F && F.rec, s = r && r.id && state(byId(DEM, r.id) || r); if (!s || !s.jv || s.bp) return "";
    var live0 = byId(DEM, r.id) || r, can = isGm() && (s.k === "gm" || s.k === "gmno" || s.k === "topay");
    if (!can && !live0.gm) return "<div class=\"fs-pdgmbox\"><b>GM approval</b><div class=\"muted\">Waiting for the GM to approve this demand. It can be paid once approved.</div></div>";
    return "<div class=\"fs-pdgmbox\"><b>GM approval</b>" + (gmTxt(live0, true) || "<div class=\"muted\">Waiting for your approval.</div>") +
      (can ? "<div class=\"fs-pdgmrow\"><input id=\"pdGmNote1\" maxlength=\"500\" placeholder=\"Comment for the person who made the demand (optional)\" value=\"" + esc((live0.gm && live0.gm.note) || "") + "\" autocomplete=\"off\">" +
        "<button type=\"button\" class=\"btn pri\" data-pdgm1=\"Approved\">Approve for payment</button><button type=\"button\" class=\"btn\" data-pdgm1=\"Not approved\">Not approved</button></div>" : "") + "</div>";
  }

  function hook() {
    if (typeof S === "undefined" || !S.payables || typeof MODS === "undefined" || !MODS.e_ap || typeof POSTERS === "undefined" || typeof Store === "undefined" || !Store.ready ||
      typeof submitForm !== "function" || typeof openForm !== "function" || typeof fieldHtml !== "function" || typeof readForm !== "function" ||
      typeof jvSheet !== "function") return false;
    defs();
    subscribe();
    special = (function (old) { return function (tab) { return tab === "pdvouch" ? vouchersView() : old.apply(this, arguments); }; })(special); // eslint-disable-line no-global-assign

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
          return "<div class=\"f\"><label for=\"f_branch\" class=\"fs-pdbl\">" + esc(f.l) + " *<button type=\"button\" class=\"fs-pdbplus\" id=\"fsPdBrAdd\" title=\"Add a branch or office\" aria-label=\"Add a branch or office\">+</button></label>" +
            "<span class=\"fs-pdbnew\" hidden><input id=\"fsPdBrNew\" maxlength=\"60\" placeholder=\"New branch or office, e.g. Sialkot\" autocomplete=\"off\"><button type=\"button\" class=\"btn pri\" id=\"fsPdBrOk\">Add</button><button type=\"button\" class=\"btn\" id=\"fsPdBrNo\">Cancel</button></span><input id=\"f_branch\" list=\"fsPdBranches\" value=\"" + esc(v || "") + "\" autocomplete=\"off\" required>" +
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

    if (typeof listView === "function") listView = (function (old) { // eslint-disable-line no-global-assign
      return function (c) {
        if (c !== DEM) return old.apply(this, arguments);
        var all = Store.data[DEM], out;
        if (ranged() && Array.isArray(all)) {
          Store.data[DEM] = all.filter(inRange);
          try { out = old.apply(this, arguments); } finally { Store.data[DEM] = all; }
          if (typeof out === "string" && !Store.data[DEM].filter(inRange).length && all.length)
            out = out.replace(/<div class="panel empty">[\s\S]*$/, "<div class=\"panel empty\"><b>No payment demands dated " + esc(rangeTxt()) + "</b>Change the dates above, or click Show all dates.</div>");
        } else out = old.apply(this, arguments);
        return typeof out === "string" ? summary() + out : out;
      };
    })(listView);
    // without listView (newer app files), the summary goes above the list when the tab is open
    var sumLast = "";
    new MutationObserver(function () {
      if (!/\/paydemands$/.test(location.hash)) return;
      if (typeof listView !== "function") document.querySelectorAll("tr[data-edit=\"paydemands\"][data-id]").forEach(function (tr) {
        var r = byId(DEM, tr.getAttribute("data-id")), hide = !!(r && !inRange(r)); if (tr.hidden !== hide) tr.hidden = hide;
      });
      if (document.querySelector(".fs-pdsum")) return;
      var q = document.querySelector("#q"), bar = q && q.closest(".bar"); if (!bar) return;
      var h = summary(); if (h === sumLast && document.querySelector(".fs-pdsum")) return;
      sumLast = h; bar.insertAdjacentHTML("beforebegin", h);
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener("keydown", function (e) {
      if (e.target && e.target.id === "fsPdBrNew" && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault(); e.stopImmediatePropagation(); branchBtn(e.key === "Enter" ? "fsPdBrOk" : "fsPdBrNo");
      }
    }, true);
    document.addEventListener("click", function (e) {
      // Pay: open the demand at its bank part (hassan, 2026-10-31: "now I want to pay that, how can I post that")
      var ex = e.target.closest && e.target.closest("[data-csv=\"paydemands\"], [data-pdexp], #pdClr");
      if (ex) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (ex.id === "pdClr") { R = { from: "", to: "" }; keepR(); scheduleRender(); return; }
        if (ex.hasAttribute("data-pdexp")) {
          var mm = ex.closest(".fs-pdvrep") || document.getElementById("fsPdExp"), ks = [], kd = ex.getAttribute("data-pdexp");
          if (mm) mm.querySelectorAll("[data-pdst]:checked").forEach(function (c) { EXST.forEach(function (x) { if (x[0] === c.getAttribute("data-pdst")) ks = ks.concat(x[2]); }); });
          if (!ks.length) { toast("Tick at least one status."); return; }
          if (mm && mm.id === "fsPdExp") mm.remove();
          if (kd === "rpt") listReport(ks); else if (kd === "list") listCsv(ks); else exportVouchers(kd, ks);
          return;
        }
        exportMenu(ex); return;
      }
      if (!(e.target.closest && e.target.closest("#fsPdExp"))) { var om = document.getElementById("fsPdExp"); if (om) om.remove(); }
      var gall = e.target.closest && e.target.closest("#pdGmAll");
      if (gall) { document.querySelectorAll("[data-pdgm]").forEach(function (c) { c.checked = gall.checked; }); return; }
      var gtick = e.target.closest && e.target.closest(".fs-pdtick");
      if (gtick) { e.stopImmediatePropagation(); return; } // ticking a demand does not open it
      var gg = e.target.closest && e.target.closest("[data-pdgmgo], [data-pdgm1]");
      if (gg) {
        e.preventDefault(); e.stopImmediatePropagation();
        var one = gg.hasAttribute("data-pdgm1"), st = gg.getAttribute(one ? "data-pdgm1" : "data-pdgmgo");
        var ids = one ? [F.rec.id] : [].slice.call(document.querySelectorAll("[data-pdgm]:checked")).map(function (c) { return c.getAttribute("data-pdgm"); });
        if (!ids.length) { toast("Tick the demands first, in the Bank payment column."); return; }
        var nt = document.getElementById(one ? "pdGmNote1" : "pdGmNote"), note = nt ? nt.value.trim() : "";
        if (st === "Not approved" && !note) { toast("Write a comment saying why, so the person who made it knows."); if (nt) nt.focus(); return; }
        gg.disabled = true;
        gmDecide(ids, st, note).then(function () {
          gg.disabled = false;
          if (one) { var bx = document.querySelector(".fs-pdgmbox"); if (bx) bx.outerHTML = gmPanel(); }
        });
        return;
      }
      var pay = e.target.closest && e.target.closest("[data-pdpay]");
      if (pay) {
        e.preventDefault(); e.stopImmediatePropagation();
        openForm(DEM, pay.getAttribute("data-pdpay"));
        setTimeout(function () {
          var b = document.getElementById("f_bank"); if (!b) return;
          b.scrollIntoView({ block: "center", behavior: "smooth" });
          var w = b.closest(".f"); if (w) { w.classList.add("fs-pdpayhl"); setTimeout(function () { w.classList.remove("fs-pdpayhl"); }, 2500); }
          var ss = w && w.querySelector(".ssb, input:not([type=hidden])"); (b.offsetParent || !ss ? b : ss).focus();
          var pd = document.getElementById("f_payDate"); if (pd && !pd.value) pd.value = todayStr();
        }, 900);
        return;
      }
      var p = e.target.closest && e.target.closest("[data-pdprint], #fsPdPrint");
      if (p) {
        e.preventDefault(); e.stopImmediatePropagation();
        var r = byId(DEM, p.id === "fsPdPrint" ? F.rec.id : p.getAttribute("data-pdprint")); if (r) printSet(r);
        return;
      }
      var b = e.target.closest && e.target.closest("#fsPdBrAdd, #fsPdBrOk, #fsPdBrNo");
      if (b) { e.preventDefault(); e.stopImmediatePropagation(); branchBtn(b.id); return; }
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
      if (e.target && (e.target.id === "pdFrom" || e.target.id === "pdTo")) {
        R[e.target.id === "pdFrom" ? "from" : "to"] = e.target.value || "";
        if (R.from && R.to && R.from > R.to) { var t = R.from; R.from = R.to; R.to = t; }
        keepR(); scheduleRender(); return;
      }
      if (typeof F === "undefined" || !F || F.c !== DEM || !e.target) return;
      if (e.target.id === "f_entity") { F.rec.items = readLines(); redraw(); } // the company sets which accounts are offered
      else if (e.target.closest && e.target.closest("#pdBox")) totals();
    });
    // the form is wide for the lines, and has the print button once the JV exists
    new MutationObserver(function () {
      if (typeof F === "undefined" || !F || F.c !== DEM) return;
      var fm = document.getElementById("frm"); if (!fm) return;
      if (!fm.classList.contains("wide")) fm.classList.add("wide");
      if (F.rec.id && !fm.querySelector(".fs-pdgmbox")) {
        var gp = gmPanel(), at = fm.querySelector("#f_bank"); at = at && at.closest(".f");
        if (gp) { if (at) at.insertAdjacentHTML("beforebegin", gp); else { var a0 = fm.querySelector(".actions"); if (a0) a0.insertAdjacentHTML("beforebegin", gp); } }
      }
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
      ".fs-pdbreak{height:0;margin:18px 0;border-top:1px dashed #ccc}@media print{.fs-pdbreak{break-before:page;page-break-before:always;border:0;margin:0}}" +
      ".fs-pdbl{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
      ".fs-pdbplus{width:26px;height:26px;padding:0;border:1px solid #16a34a;border-radius:6px;background:#ecfdf3;color:#15803d;font-size:18px;line-height:1;cursor:pointer}" +
      ".fs-pdbplus:hover{background:#16a34a;color:#fff}.fs-pdbnew{display:flex;gap:6px}.fs-pdbnew[hidden]{display:none}.fs-pdbnew input{flex:1;min-width:0}" +
      ".fs-pdrange{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:10px}.fs-pdrange label{display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px}" +
      ".fs-pdexp{position:absolute;z-index:60;width:300px;display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--line,#e3e6eb);border-radius:10px;background:var(--panel,#fff);box-shadow:0 12px 30px rgba(15,23,42,.18)}" +
      ".fs-pdexp .btn{text-align:left}.fs-pdexp span{font-size:12px}.fs-pdexst{border:1px solid var(--line,#e3e6eb);border-radius:8px;padding:6px 10px;margin:0;display:flex;flex-direction:column;gap:4px}" +
      ".fs-pdexst legend{font-weight:700;font-size:13px;padding:0 4px}.fs-pdexst label{font-size:13px;display:flex;align-items:center;gap:6px}" +
      ".fs-pdgm{font-size:12px;margin-top:4px;line-height:1.35}.fs-pdgm.ok{color:#15803d}.fs-pdgm.no{color:#b91c1c}.fs-pdgm q{color:#334155;font-style:italic}" +
      ".fs-pdgmbar{margin:10px 0 0;padding:10px 12px;border:1px solid #f59e0b;border-radius:10px;background:#fffbeb;font-size:13px}" +
      ".fs-pdgmrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px}.fs-pdgmrow input:not([type=checkbox]){flex:1 1 260px;min-width:0}" +
      ".fs-pdtick{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}" +
      ".fs-pdgmbox{grid-column:1/-1;margin:6px 0;padding:10px 12px;border:1px solid var(--line,#e3e6eb);border-radius:10px;background:#f8fafc}" +
      ".fs-pdpayhl{outline:3px solid #16a34a;outline-offset:4px;border-radius:6px;transition:outline-color 1s}";
    document.head.appendChild(css);
    scheduleRender();
    return true;
  }
  var tries = 0;
  function start() {
    var ok = false;
    try { ok = hook(); } catch (e) { console.error("Payment demands could not start", e); return; }
    if (!ok && ++tries < 400) setTimeout(start, 300);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
