// Tax-free fuel reimbursement on the employee record (hassan, 2026-11-26: "for some employees there is no tax on fuel",
// "I think it should be managed here in the form"). Employee form › Statutory, tax and bank gets
// "Fuel reimbursement (tax-free)" Yes/No and "Monthly fuel amount". When a payroll run is calculated for a month, each
// such employee of that company gets a payroll input "Fuel allowance", Taxable = No, for that amount, unless one is
// already there. Change the input's amount to match the month's fuel bills and press Recalculate. An input you delete
// is not made again for that run. It is added to gross and net pay but left out of the salary tax.
(function () {
  /* global S, Store, payAuto, curMonth, EARN_TYPES, toast, calcPanel, empPay, F */
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

  // Employee form helper (hassan, 2026-11-26: type the agreement's total as gross; choosing tax-free fuel should take the
  // fuel out of it). On a record that did not have tax-free fuel when opened, choosing Yes and entering the amount takes it
  // off Gross salary on screen (and puts it back if changed or set to No), with a note. Records already on tax-free fuel
  // are left alone. When salary components are typed, nothing is changed and the note says which to reduce.
  var ST = typeof WeakMap === "function" ? new WeakMap() : null;
  var amt = function (v) { return num(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); };
  var fmt = function (x) { return Math.round(x).toLocaleString("en-US"); };
  function note(msg, bad) {
    var lim = document.getElementById("f_fuelLimit"); if (!lim) return;
    var box = lim.closest(".f") || lim.parentNode, el = document.getElementById("fsFuelNote");
    if (!el) { el = document.createElement("div"); el.id = "fsFuelNote"; box.appendChild(el); }
    el.style.cssText = "margin-top:6px;padding:8px 10px;border-radius:8px;font-size:13px;line-height:1.4;" + (bad ? "background:#fef2f2;color:#991b1b;border:1px solid #fecaca" : "background:#eef5fc;color:#13304f;border:1px solid #cfe0f1");
    el.textContent = msg;
  }
  function onFuel(ev) {
    var id = ev.target && ev.target.id;
    if (id !== "f_fuelTaxFree" && id !== "f_fuelLimit") return;
    var F0 = safe(function () { return F; }, null); // eslint-disable-line no-undef
    if (!F0 || F0.c !== "employees" || !F0.rec || !ST) return;
    var saved = F0.rec.id && (Store.data.employees || []).find(function (x) { return x.id === F0.rec.id; });
    var st = ST.get(F0.rec); if (!st) { st = { initYes: !!(saved && saved.fuelTaxFree === "Yes"), sub: 0 }; ST.set(F0.rec, st); }
    var sel = document.getElementById("f_fuelTaxFree"), lim = document.getElementById("f_fuelLimit"), g = document.getElementById("f_grossSalary");
    if (!sel || !lim || !g) return;
    var fuel = sel.value === "Yes" ? amt(lim.value) : 0;
    if (st.initYes) { if (fuel) note("Gross salary not changed: this employee was already on tax-free fuel. Gross salary must not include the fuel."); return; }
    if (fuel === st.sub) return;
    var comps = ["basic", "hra", "utilities", "medical", "conveyance", "otherAllow"].filter(function (k) { var x = document.getElementById("f_" + k); return x && amt(x.value); });
    if (comps.length) { note("Salary components are typed, so take " + fmt(fuel - st.sub) + " off the Basic salary yourself. Fuel is paid separately, tax-free.", true); return; }
    var was = amt(g.value), now = was + st.sub - fuel;
    if (now < 0) { note("The fuel amount is more than the gross salary. Check both figures.", true); return; }
    g.value = now ? fmt(now) : "";
    F0.rec.grossSalary = now || "";
    safe(function () { g.dispatchEvent(new Event("input", { bubbles: true })); });
    st.sub = fuel;
    note(fuel ? "Gross salary changed from " + fmt(was) + " to " + fmt(now) + ". The " + fmt(fuel) + " fuel is paid on top, tax-free, so the total stays " + fmt(now + fuel) + "."
      : "Gross salary put back to " + fmt(now) + ".");
  }
  document.addEventListener("change", function (ev) { safe(function () { onFuel(ev); }); });

  // Employee form "Monthly pay at current rates" box: show the tax-free fuel and the pay including it (hassan, 2026-11-26),
  // and warn when the HR setup split makes a component negative (percentages over 100).
  function panelAdd(html) {
    var F0 = safe(function () { return F; }, null); // eslint-disable-line no-undef
    if (!F0 || F0.c !== "employees" || !F0.rec || typeof html !== "string" || html.indexOf("calc") < 0) return html;
    var r = F0.rec, add = "", fuel = r.fuelTaxFree === "Yes" ? amt(r.fuelLimit) : 0;
    if (fuel > 0) {
      var m = /Net before loans and absences<\/dt><dd>(?:<b>)?([\-0-9,.]+)/.exec(html), c = /Cost to company<\/dt><dd>(?:<b>)?([\-0-9,.]+)/.exec(html);
      add += "<dt>Fuel reimbursement (tax-free, not taxed)</dt><dd>" + fmt(fuel) + "</dd>";
      if (m) add += "<dt>Net salary payable incl. fuel</dt><dd><b>" + fmt(amt(m[1]) + fuel) + "</b></dd>";
      if (c) add += "<dt>Cost to company incl. fuel</dt><dd>" + fmt(amt(c[1]) + fuel) + "</dd>";
    }
    var neg = safe(function () { var p = empPay(r); return ["basic", "hra", "utilities", "medical", "conveyance", "otherAllow"].filter(function (k) { return num(p[k]) < 0; }); }, []); // eslint-disable-line no-undef
    var warn = neg.length ? "<p class=\"err\" style=\"margin:8px 0 0\">A salary component is negative. The percentages in HR setup › Salary structure add up to more than 100. Make Basic + House rent + Utilities + Medical = 100 (for example Basic 90.91, Medical 9.09, the rest 0).</p>" : "";
    if (!add && !warn) return html;
    var at = html.lastIndexOf("</dl>");
    return at < 0 ? html + warn : html.slice(0, at) + add + "</dl>" + warn + html.slice(at + 5);
  }

  function hook() {
    if (typeof S === "undefined" || !S.employees || typeof payAuto !== "function" || typeof Store === "undefined" || !Store.data) return false;
    addFields();
    if (!payAuto.fsFuel) {
      var old = payAuto;
      payAuto = function (r) { safe(function () { ensure(r); }); return old.apply(this, arguments); }; // eslint-disable-line no-global-assign
      payAuto.fsFuel = 1;
    }
    if (typeof calcPanel === "function" && !calcPanel.fsFuel) { // eslint-disable-line no-undef
      var oldP = calcPanel; // eslint-disable-line no-undef
      calcPanel = function () { var h = oldP.apply(this, arguments); return safe(function () { return panelAdd(h); }, h); }; // eslint-disable-line no-global-assign, no-undef
      calcPanel.fsFuel = 1; // eslint-disable-line no-undef
    }
    window.FS_FUEL = { ensure: ensure };
    return true;
  }
  if (!hook()) { var n = 0, t = setInterval(function () { if (hook() || ++n > 60) clearInterval(t); }, 500); }
})();
