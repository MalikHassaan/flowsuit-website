// Tax-free fuel reimbursement on the employee record (hassan, 2026-11-26: "for some employees there is no tax on fuel",
// "I think it should be managed here in the form"). Employee form › Statutory, tax and bank gets
// "Fuel reimbursement (tax-free)" Yes/No and "Monthly fuel amount". When a payroll run is calculated for a month, each
// such employee of that company gets a payroll input "Fuel allowance", Taxable = No, for that amount, unless one is
// already there. Change the input's amount to match the month's fuel bills and press Recalculate. An input you delete
// is not made again for that run. It is added to gross and net pay but left out of the salary tax.
(function () {
  /* global S, Store, payAuto, curMonth, EARN_TYPES, toast */
  var num = function (x) { return +x || 0; };
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var TYPE = function () { return safe(function () { return EARN_TYPES.indexOf("Fuel allowance") >= 0 ? "Fuel allowance" : "Other allowance"; }, "Other allowance"); };

  function addFields() {
    var F = S.employees.fields;
    if (F.some(function (f) { return f.k === "fuelTaxFree"; })) return;
    var at = F.findIndex(function (f) { return f.k === "taxExempt"; });
    if (at < 0) at = F.findIndex(function (f) { return f.k === "payMode"; }) - 1;
    if (at < 0) at = F.length - 1;
    F.splice(at + 1, 0,
      { k: "fuelTaxFree", l: "Fuel reimbursement (tax-free)?", t: "select", o: ["No", "Yes"], hint: "Yes: each payroll month gets a tax-free fuel line for this employee. Adjust it to the bills under Payroll inputs." },
      { k: "fuelLimit", l: "Monthly fuel amount (PKR)", t: "money", hint: "Used as the starting amount each month. Leave blank or 0 to add nothing." });
  }

  // make the month's fuel inputs before the payroll is calculated (payCalc reads Store.data.payinputs at once)
  function ensure(r) {
    if (!r || !r.month || !r.entity || r.jvId || r.sample || (r.status && r.status !== "Draft")) return 0;
    var done = Array.isArray(r.fsFuel) ? r.fsFuel : [], made = 0, I = Store.data.payinputs || (Store.data.payinputs = []);
    (Store.data.employees || []).forEach(function (e) {
      if (e.entity !== r.entity || e.fuelTaxFree !== "Yes" || !(num(e.fuelLimit) > 0) || e.status === "Left") return;
      if (e.leaveDate && e.leaveDate.slice(0, 7) < r.month) return;
      if (e.joinDate && e.joinDate.slice(0, 7) > r.month) return;
      var id = "fuel-" + e.id + "-" + r.month;
      if (done.indexOf(id) >= 0) return; // made before for this run; deleted on purpose
      done.push(id);
      if (I.some(function (x) { return x.id === id || (x.employee === e.id && x.month === r.month && /fuel/i.test((x.type || "") + " " + (x.notes || ""))); })) return;
      var rec = { id: id, month: r.month, employee: e.id, type: TYPE(), amount: Math.round(num(e.fuelLimit)), taxable: "No", notes: "Fuel reimbursement (tax-free), change to the month's bills", fsFuel: 1 };
      I.push(Object.assign({ createdAt: new Date().toISOString() }, rec));
      safe(function () { var p = Store.save("payinputs", rec); if (p && p.catch) p.catch(function () {}); });
      made++;
    });
    r.fsFuel = done;
    if (made) safe(function () { toast(made + " tax-free fuel line" + (made > 1 ? "s" : "") + " added under Payroll inputs. Change the amounts to the bills, then recalculate."); });
    return made;
  }

  function hook() {
    if (typeof S === "undefined" || !S.employees || typeof payAuto !== "function" || typeof Store === "undefined" || !Store.data) return false;
    addFields();
    if (!payAuto.fsFuel) {
      var old = payAuto;
      payAuto = function (r) { safe(function () { ensure(r); }); return old.apply(this, arguments); }; // eslint-disable-line no-global-assign
      payAuto.fsFuel = 1;
    }
    window.FS_FUEL = { ensure: ensure };
    return true;
  }
  if (!hook()) { var n = 0, t = setInterval(function () { if (hook() || ++n > 60) clearInterval(t); }, 500); }
})();
