// Salary payments (hassan, 2026-11-26: "once the salary is payable I go to the HR module where each employee is listed,
// there is a button to pay salary, I select and the system asks from which bank, I select the bank and the salary is
// paid; through that we know how much salary is paid and how much is pending"). Payroll › Salary payments lists every
// employee of a posted payroll run with net pay, paid, in approval and still to pay. Tick one or more (or press Pay on
// a row), choose the bank, the date and the cheque / transfer no., and the bank payment voucher is made:
// Dr Net salaries payable (one line per employee) / Cr the bank. It goes through approval like every voucher; it counts
// as paid once posted. A rejected voucher frees the amount again. Nothing is booked to expense here: the payroll run
// already did that.
(function () {
  /* global MODS, TAB_HOME, Store, byEnt, jvOf, esc, fdate, render, special, ppId, nextVoucherNo, isLocked, lockTxt,
     jvTot, approverName, todayStr, toast, coName */
  var SRC = "fssalpay";
  var num = function (x) { return +x || 0; };
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var e = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var money = function (x) { return Math.round(num(x)).toLocaleString("en-US"); };
  var D = function (c) { return (Store.data && Store.data[c]) || []; };
  var mine = function (c) { return safe(function () { return byEnt(D(c)); }, D(c)); };
  var co = function (x) { return safe(function () { return coName(x); }, x); };
  var MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var monthName = function (m) { return /^\d{4}-\d{2}/.test(m || "") ? MN[+m.slice(5, 7) - 1] + " " + m.slice(0, 4) : (m || ""); };
  var pick = null; // the run shown
  var jv = function (id) { return safe(function () { return jvOf(id); }, null) || D("journals").find(function (j) { return j.id === id; }); };

  // payroll runs whose payroll voucher is posted, newest month first
  function runs() {
    return mine("payroll").filter(function (r) { var j = r.jvId && jv(r.jvId); return (r.slips || []).length && j && j.status === "Posted"; })
      .sort(function (a, b) { return String(b.month).localeCompare(String(a.month)) || String(a.entity).localeCompare(String(b.entity)); });
  }
  // what each employee of a run has been paid: posted, and still in approval
  function paidOf(run) {
    var out = {};
    D("journals").forEach(function (j) {
      if (!j.source || j.source.c !== SRC || j.source.id !== run.id || j.reversalOf || j.reversedBy || /Rejected|Cancelled|Void/.test(j.status || "")) return; // a reversed payment does not count
      (j.fsSal || []).forEach(function (x) { var o = out[x.emp] = out[x.emp] || { posted: 0, appr: 0, refs: [] }; if (j.status === "Posted") o.posted += num(x.amt); else o.appr += num(x.amt); if (o.refs.indexOf(j.ref) < 0) o.refs.push(j.ref); });
    });
    return out;
  }
  function rows(run) {
    var P = paidOf(run);
    return (run.slips || []).map(function (s) {
      var p = P[s.emp] || { posted: 0, appr: 0, refs: [] }, net = Math.round(num(s.net));
      return { emp: s.emp, code: s.code || "", name: s.name || "", dept: s.dept || "", bank: [s.bank, s.acct].filter(Boolean).join(" · "), payMode: s.payMode || "",
        net: net, paid: Math.round(p.posted), appr: Math.round(p.appr), left: Math.max(0, net - Math.round(p.posted) - Math.round(p.appr)), refs: p.refs };
    }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code), undefined, { numeric: true }) || a.name.localeCompare(b.name); });
  }
  function banks(ent) {
    var K = window.FS_ACCKIND && window.FS_ACCKIND.bank;
    return D("accounts").filter(function (a) { return a.posting !== "Header" && a.hidden !== "Yes" && (!a.entity || a.entity === ent) && (K ? K(a) : /bank|cash/i.test(a.name || "")); })
      .sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
  }

  function view() {
    var R = runs();
    if (!R.length) return "<div class=\"panel empty\"><b>No posted payroll run yet</b>Run and post the month's payroll under Payroll runs first. Its employees then show here to be paid.</div>";
    var run = R.find(function (r) { return r.id === pick; }) || R[0]; pick = run.id;
    var L = rows(run), T = L.reduce(function (t, r) { t.net += r.net; t.paid += r.paid; t.appr += r.appr; t.left += r.left; if (r.left > 0) t.n++; return t; }, { net: 0, paid: 0, appr: 0, left: 0, n: 0 });
    var opts = R.map(function (r) { return "<option value=\"" + e(r.id) + "\"" + (r.id === run.id ? " selected" : "") + ">" + e(monthName(r.month) + " · " + co(r.entity)) + "</option>"; }).join("");
    var B = banks(run.entity);
    var pill = function (r) { return r.left <= 0 && !r.appr ? "<span class=\"fssp-pill ok\">Paid</span>" : r.left <= 0 ? "<span class=\"fssp-pill warn\">In approval</span>" : r.paid || r.appr ? "<span class=\"fssp-pill part\">Part paid</span>" : "<span class=\"fssp-pill no\">Not paid</span>"; };
    return "<div class=\"fssp\"><div class=\"fssp-top\"><label>Payroll month <select id=\"fsspRun\">" + opts + "</select></label>" +
      "<span class=\"muted\">Net pay from the posted payroll run. Paying makes a bank payment voucher (Dr Net salaries payable, Cr bank) that goes for approval.</span></div>" +
      "<div class=\"fssp-kpis\"><div><span>Employees</span><b>" + L.length + "</b></div><div><span>Net salaries</span><b>" + money(T.net) + "</b></div>" +
      "<div class=\"ok\"><span>Paid</span><b>" + money(T.paid) + "</b></div><div class=\"warn\"><span>In approval</span><b>" + money(T.appr) + "</b></div>" +
      "<div class=\"no\"><span>Still to pay</span><b>" + money(T.left) + "</b><i>" + T.n + " employee" + (T.n === 1 ? "" : "s") + "</i></div></div>" +
      "<div class=\"fssp-bar\"><label><input type=\"checkbox\" id=\"fsspAll\"> Select all not paid</label><button type=\"button\" class=\"btn pri\" id=\"fsspPaySel\" disabled>Pay selected</button><span id=\"fsspSelTot\" class=\"muted\"></span></div>" +
      "<div id=\"fsspDlg\" hidden><div class=\"fssp-dlg\"><b id=\"fsspDlgT\"></b><div class=\"fssp-f\"><label>Pay from bank *<select id=\"fsspBank\"><option value=\"\">Choose…</option>" +
        B.map(function (a) { return "<option value=\"" + e(a.id) + "\">" + e(a.code + " " + a.name) + "</option>"; }).join("") + "</select></label>" +
      "<label>Payment date *<input type=\"date\" id=\"fsspDate\" value=\"" + e(safe(todayStr, new Date().toISOString().slice(0, 10))) + "\"></label>" +
      "<label>Cheque / transfer no.<input id=\"fsspRef\" placeholder=\"Cheque or online transfer reference\"></label></div>" +
      "<div class=\"fssp-dlgb\"><button type=\"button\" class=\"btn pri\" id=\"fsspGo\">Make bank payment</button><button type=\"button\" class=\"btn\" id=\"fsspX\">Cancel</button><span id=\"fsspErr\" class=\"fssp-err\"></span></div></div></div>" +
      "<div class=\"tw\"><table class=\"fssp-t\"><thead><tr><th></th><th>Code</th><th>Employee</th><th>Department</th><th>Bank account</th><th class=\"num\">Net salary</th><th class=\"num\">Paid</th><th class=\"num\">In approval</th><th class=\"num\">Still to pay</th><th>Status</th><th></th></tr></thead><tbody>" +
      L.map(function (r) {
        return "<tr><td>" + (r.left > 0 ? "<input type=\"checkbox\" class=\"fsspTick\" data-emp=\"" + e(r.emp) + "\" data-amt=\"" + r.left + "\">" : "") + "</td><td>" + e(r.code) + "</td><td>" + e(r.name) + (r.refs.length ? "<br><span class=\"muted small\">" + e(r.refs.join(", ")) + "</span>" : "") + "</td><td>" + e(r.dept) + "</td><td class=\"small\">" + e(r.bank || r.payMode) + "</td>" +
          "<td class=\"num\">" + money(r.net) + "</td><td class=\"num\">" + money(r.paid) + "</td><td class=\"num\">" + money(r.appr) + "</td><td class=\"num\"><b>" + money(r.left) + "</b></td><td>" + pill(r) + "</td>" +
          "<td>" + (r.left > 0 ? "<button type=\"button\" class=\"btn sm pri\" data-fsspone=\"" + e(r.emp) + "\">Pay</button>" : "") + "</td></tr>";
      }).join("") +
      "</tbody><tfoot><tr><td colspan=\"5\">Total</td><td class=\"num\">" + money(T.net) + "</td><td class=\"num\">" + money(T.paid) + "</td><td class=\"num\">" + money(T.appr) + "</td><td class=\"num\">" + money(T.left) + "</td><td colspan=\"2\"></td></tr></tfoot></table></div></div>";
  }

  var chosen = []; // [{emp, amt}] waiting for the bank
  function selTot() {
    var t = [].slice.call(document.querySelectorAll(".fsspTick:checked")), s = t.reduce(function (a, x) { return a + num(x.getAttribute("data-amt")); }, 0);
    var b = document.getElementById("fsspPaySel"), l = document.getElementById("fsspSelTot");
    if (b) b.disabled = !t.length; if (l) l.textContent = t.length ? t.length + " selected, " + money(s) : "";
  }
  function ask(list) {
    chosen = list; var d = document.getElementById("fsspDlg"); if (!d || !list.length) return;
    var run = runs().find(function (r) { return r.id === pick; }), names = list.map(function (x) { var s = (run.slips || []).find(function (y) { return y.emp === x.emp; }) || {}; return s.name; });
    document.getElementById("fsspDlgT").textContent = "Pay " + (list.length === 1 ? names[0] : list.length + " employees") + ": " + money(list.reduce(function (a, x) { return a + x.amt; }, 0)) + " (" + monthName(run.month) + ", " + co(run.entity) + ")";
    document.getElementById("fsspErr").textContent = ""; d.hidden = false; d.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  async function pay() {
    var er = document.getElementById("fsspErr"), go = document.getElementById("fsspGo"), bank = document.getElementById("fsspBank").value, date = document.getElementById("fsspDate").value, ref = document.getElementById("fsspRef").value.trim();
    var run = runs().find(function (r) { return r.id === pick; }); if (!run) return;
    if (!bank) { er.textContent = "Choose the bank the salary is paid from."; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { er.textContent = "Enter the payment date."; return; }
    var left = {}; rows(run).forEach(function (r) { left[r.emp] = r.left; });
    var list = chosen.map(function (x) { return { emp: x.emp, amt: Math.min(x.amt, left[x.emp] || 0) }; }).filter(function (x) { return x.amt > 0; });
    if (!list.length) { er.textContent = "Nothing left to pay for the selected employees."; return; }
    var acc = safe(function () { return ppId("netSalary"); }, ""); if (!acc) { er.textContent = "Set \"Net salaries payable\" in Setup › Posting profiles first."; return; }
    var nm = function (id) { return ((run.slips || []).find(function (s) { return s.emp === id; }) || {}).name || ""; }, tot = list.reduce(function (a, x) { return a + x.amt; }, 0);
    var who = list.length === 1 ? nm(list[0].emp) : list.length + " employees", user = safe(approverName, "") || "ERP user", now = new Date().toISOString();
    var j = { vtype: "Bank payment voucher", entity: run.entity, date: date, dept: "Human resources", opening: "No", payee: list.length === 1 ? nm(list[0].emp) : "Salaries " + monthName(run.month), chequeNo: ref,
      narration: "Salary " + monthName(run.month) + " paid to " + who + (list.length > 1 ? ": " + list.map(function (x) { return nm(x.emp); }).join(", ") : "") + (ref ? ". Cheque / transfer " + ref : ""),
      status: "Pending approval", maker: { name: user, at: now }, approvals: [], source: { c: SRC, id: run.id, ev: "pay", key: "pay-" + Date.now() }, fsSal: list,
      lines: list.map(function (x) { return { account: acc, debit: x.amt, credit: 0, desc: "Net salary " + monthName(run.month) + " – " + nm(x.emp) }; }).concat([{ account: bank, debit: 0, credit: tot, desc: ref ? "Cheque / transfer " + ref : "" }]) };
    if (safe(function () { return isLocked(j); }, false)) { er.textContent = co(run.entity) + " " + safe(function () { return lockTxt(run.entity); }, "is closed for that date") + ". Use a later date."; return; }
    if (!safe(function () { return jvTot(j).ok; }, true)) { er.textContent = "The voucher would not balance."; return; }
    go.disabled = true; er.textContent = "Saving…";
    try { j.ref = nextVoucherNo(j); j.id = await Store.save("journals", j); }
    catch (x) { go.disabled = false; er.textContent = "Could not save: " + (x.message || x); return; }
    safe(function () { toast(j.ref + ": salary of " + who + " (" + money(tot) + ") sent for approval."); });
    chosen = []; safe(render);
  }

  document.addEventListener("change", function (ev) {
    var t = ev.target; if (!t) return;
    if (t.id === "fsspRun") { pick = t.value; safe(render); return; }
    if (t.id === "fsspAll") { document.querySelectorAll(".fsspTick").forEach(function (x) { x.checked = t.checked; }); selTot(); return; }
    if (t.classList && t.classList.contains("fsspTick")) selTot();
  });
  document.addEventListener("click", function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest("#fsspPaySel, [data-fsspone], #fsspGo, #fsspX") : null; if (!t) return;
    ev.preventDefault();
    if (t.id === "fsspPaySel") ask([].slice.call(document.querySelectorAll(".fsspTick:checked")).map(function (x) { return { emp: x.getAttribute("data-emp"), amt: num(x.getAttribute("data-amt")) }; }));
    else if (t.hasAttribute("data-fsspone")) { var b = document.querySelector(".fsspTick[data-emp=\"" + t.getAttribute("data-fsspone").replace(/"/g, "") + "\"]"); ask(b ? [{ emp: b.getAttribute("data-emp"), amt: num(b.getAttribute("data-amt")) }] : []); }
    else if (t.id === "fsspGo") pay();
    else if (t.id === "fsspX") { var d = document.getElementById("fsspDlg"); if (d) d.hidden = true; chosen = []; }
  });

  window.FS_SALPAY = { rows: function (run) { return safe(function () { return rows(run); }, []); }, runs: function () { return safe(runs, []); } };

  function hook() {
    if (typeof MODS === "undefined" || !MODS.payroll || !Array.isArray(MODS.payroll.tabs) || typeof special !== "function" || typeof Store === "undefined" || !Store.data) return false;
    if (!MODS.payroll.tabs.some(function (t) { return t[0] === "salpay"; })) {
      var at = MODS.payroll.tabs.findIndex(function (t) { return t[0] === "payroll"; });
      MODS.payroll.tabs.splice(at < 0 ? 1 : at + 1, 0, ["salpay", "Salary payments"]);
      try { TAB_HOME.salpay = "payroll"; } catch (x) { /* older app */ }
      var old = special; // eslint-disable-line no-undef
      special = function (tab) { return tab === "salpay" ? safe(view, "<div class=\"panel empty\"><b>Could not build the salary payments</b>Reload the page.</div>") : old.apply(this, arguments); }; // eslint-disable-line no-global-assign
    }
    safe(render);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fssp-top{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin:4px 0 12px}.fssp-top select{margin-left:6px;min-width:220px}" +
    ".fssp-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin:0 0 12px}.fssp-kpis>div{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border:1px solid var(--line,#e2e8f0);border-left:4px solid #1F6FB8;border-radius:10px;background:var(--panel,#fff)}" +
    ".fssp-kpis span{font-size:12px;color:var(--muted,#64748b);font-weight:600;text-transform:uppercase;letter-spacing:.03em}.fssp-kpis b{font-size:22px}.fssp-kpis i{font-style:normal;font-size:12px;color:var(--muted,#64748b)}" +
    ".fssp-kpis .ok{border-left-color:#16a34a}.fssp-kpis .warn{border-left-color:#f59e0b}.fssp-kpis .no{border-left-color:#dc2626}" +
    ".fssp-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:0 0 10px}" +
    ".fssp-dlg{border:1px solid #cfe0f1;background:#eef5fc;border-radius:10px;padding:14px 16px;margin:0 0 12px}.fssp-dlg>b{display:block;margin-bottom:10px;color:#13304f}" +
    ".fssp-f{display:flex;flex-wrap:wrap;gap:12px}.fssp-f label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600;min-width:220px}.fssp-dlgb{display:flex;gap:10px;align-items:center;margin-top:12px}.fssp-err{color:#b91c1c;font-size:13px}" +
    ".fssp-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700}.fssp-pill.ok{background:#dcfce7;color:#166534}.fssp-pill.warn{background:#fef3c7;color:#92400e}.fssp-pill.part{background:#dbeafe;color:#1e40af}.fssp-pill.no{background:#fee2e2;color:#991b1b}" +
    ".fssp .small{font-size:12px}.fssp-t tfoot td{font-weight:700}";
  (document.head || document.documentElement).appendChild(css);
  (function wait(t) { if (hook()) return; if (t < 600) setTimeout(function () { wait(t + 1); }, 100); })(0);
})();
