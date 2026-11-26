// Pay changes apply themselves in payroll (hassan, 2026-11-26: "in probation gross salary is 270,000, after the probation
// your salary will be 300,000", then YES to applying it automatically). When a payroll run is calculated for a month,
// every Approved (not yet applied) HR action of type Confirmation, Salary revision or Promotion for that company whose
// effective date falls on or before the month's last day is applied to the employee record, exactly as the Apply button
// would (new gross with components scaled, designation, grade, department; Confirmation also sets Active and the
// confirmation date) and marked Applied. If the date falls inside the month, the days before it are paid at the old
// rate: a payroll input for the difference is added (a deduction for a raise, arrears for a cut), which you can see and
// change under Payroll inputs. Actions that move the employee to a new position are left for the Apply button.
(function () {
  /* global Store, payAuto, empPay, PAYCOMP, approverName, toast */
  var num = function (x) { return +x || 0; };
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var TYPES = ["Confirmation", "Salary revision", "Promotion"];
  var MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var fd = function (s) { return +s.slice(8, 10) + " " + MN[+s.slice(5, 7) - 1] + " " + s.slice(0, 4); };
  var comps = function () { return safe(function () { return PAYCOMP.map(function (x) { return x[0]; }); }, ["basic", "hra", "utilities", "medical", "conveyance", "otherAllow"]); };
  var grossOf = function (e) { return safe(function () { return num(empPay(e).gross); }, num(e.grossSalary)); };
  var save = function (c, r) { safe(function () { var p = Store.save(c, r); if (p && p.catch) p.catch(function () {}); }); };

  function apply(run) {
    if (!run || !run.month || !run.entity || run.jvId || run.sample || (run.status && run.status !== "Draft")) return 0;
    var m = run.month, y = +m.slice(0, 4), mo = +m.slice(5, 7), dim = new Date(y, mo, 0).getDate(), end = m + "-" + String(dim).padStart(2, "0");
    var done = Array.isArray(run.fsHra) ? run.fsHra : [], E = Store.data.employees || [], I = Store.data.payinputs || (Store.data.payinputs = []), made = [];
    (Store.data.hractions || []).filter(function (a) { return a.status === "Approved" && TYPES.indexOf(a.type) >= 0 && a.date && a.date <= end && !a.position; })
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
      .forEach(function (a) {
        var e0 = E.find(function (x) { return x.id === a.employee; });
        if (!e0 || e0.entity !== run.entity || e0.status === "Left") return;
        var C = comps(), prev = {}, e = e0, old = grossOf(e0);
        ["dept", "designation", "grade", "grossSalary", "status", "confirmDate"].concat(C).forEach(function (k) { prev[k] = e0[k] == null ? "" : e0[k]; });
        prev.grossSalary = old;
        var ng = num(a.newGross);
        if (ng) {
          if (old && C.some(function (k) { return num(e[k]); })) {
            var k2 = ng / old; C.forEach(function (k) { if (num(e[k])) e[k] = Math.round(num(e[k]) * k2); });
            e.basic = num(e.basic) + ng - C.reduce(function (s, k) { return s + num(e[k]); }, 0);
          }
          e.grossSalary = ng;
        }
        if (a.dept) e.dept = a.dept; if (a.designation) e.designation = a.designation; if (a.grade) e.grade = a.grade;
        if (a.type === "Confirmation") { e.status = "Active"; e.confirmDate = a.date; }
        save("employees", e);
        Object.assign(a, { prev: prev, status: "Applied", appliedAt: new Date().toISOString(), appliedBy: safe(function () { return approverName(); }, "") || "Payroll (automatic)", autoApplied: m });
        save("hractions", a);
        // effective inside this month: the days before it stay at the old rate
        if (ng && old && a.date.slice(0, 7) === m && a.date > m + "-01") {
          var from = e.joinDate && e.joinDate.slice(0, 7) === m && e.joinDate > m + "-01" ? +e.joinDate.slice(8, 10) : 1;
          var before = Math.max(0, +a.date.slice(8, 10) - from), diff = Math.round((ng - old) * before / dim), id = "hra-" + a.id;
          if (diff && done.indexOf(id) < 0 && !I.some(function (x) { return x.id === id; })) {
            var rec = { id: id, month: m, employee: e.id, type: diff > 0 ? "Other deduction" : "Salary arrears", amount: Math.abs(diff), taxable: "Yes",
              notes: (a.actNo || a.type) + ": old gross " + old.toLocaleString("en-US") + " for " + before + " day" + (before > 1 ? "s" : "") + " before " + fd(a.date), fsHra: 1 };
            I.push(Object.assign({ createdAt: new Date().toISOString() }, rec)); save("payinputs", rec); done.push(id);
          }
        }
        made.push((e.name || "Employee") + " " + (ng ? ng.toLocaleString("en-US") : a.type));
      });
    run.fsHra = done;
    if (made.length) safe(function () { toast("HR action" + (made.length > 1 ? "s" : "") + " applied for this month: " + made.join(", ")); });
    return made.length;
  }

  function hook() {
    if (typeof payAuto !== "function" || typeof Store === "undefined" || !Store.data) return false;
    if (!payAuto.fsHra) {
      var old = payAuto;
      payAuto = function (r) { safe(function () { apply(r); }); return old.apply(this, arguments); }; // eslint-disable-line no-global-assign
      payAuto.fsHra = 1; payAuto.fsFuel = old.fsFuel;
    }
    window.FS_HRAAUTO = { apply: apply };
    return true;
  }
  if (!hook()) { var n = 0, t = setInterval(function () { if (hook() || ++n > 60) clearInterval(t); }, 500); }
})();
