// Report basis: Accrual or Cash (hassan, 2026-10-29: "give option of cash and accrual basis accounting while finalizing it").
// Accrual (the default, and what IFRS requires) uses the posted vouchers as they are. Cash basis works the way QuickBooks
// does: an invoice or bill counts only when it is paid. A voucher that only charges a customer or supplier (debit to trade
// debts, or credit to trade creditors, with no cash or bank line) is held back; when a receipt or payment settles the
// customer's or supplier's balance, the held invoices are taken first-in first-out, and the share paid of each invoice's
// revenue, cost and tax lines counts on the payment date instead of the trade debts / creditors line. Vouchers without
// trade debts or creditors (salaries, depreciation, accruals, IFRS 15) count as they are. The books are not changed: the
// switch only changes how the statements and the trial balance are drawn, and it shows on those screens.
(function () {
  /* global ledger, LEDGER, V, Store, n, esc, render, special */
  var TABS = { sofp: 1, pl: 1, socie: 1, cfs: 1, notes: 1, tb: 1 };
  var cache = { src: null, val: null };
  function sets(acc) {
    var ctl = {}, cash = {};
    Object.keys(acc).forEach(function (id) {
      var c = String(acc[id].code || "");
      if (/^1203/.test(c) && !/allowance/i.test(acc[id].name || "")) ctl[id] = "ar";
      if (/^2201/.test(c)) ctl[id] = "ap";
      if (/^1210/.test(c) || /^2208/.test(c)) cash[id] = 1;
    });
    return { ctl: ctl, cash: cash };
  }
  // the cash-basis version of ledger(): same shape {acc, lines:[{acc, ent, date, amt}]}
  function cashLedger(base) {
    var acc = base.acc, S = sets(acc), out = [], queue = {};
    var js = Store.data.journals.filter(function (j) { return j.status === "Posted"; }).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.ref || "").localeCompare(String(b.ref || "")); });
    js.forEach(function (j) {
      var L = (j.lines || []).filter(function (l) { return acc[l.account]; }).map(function (l) { return { acc: l.account, amt: n(l.debit) - n(l.credit), party: String(l.party || "").trim().toLowerCase() }; });
      var ctl = L.filter(function (l) { return S.ctl[l.acc]; }), other = L.filter(function (l) { return !S.ctl[l.acc]; });
      var charge = function (l) { return S.ctl[l.acc] === "ar" ? l.amt > 0 : l.amt < 0; };
      var push = function (a, amt, date) { if (Math.abs(amt) > 0.004) out.push({ acc: a, ent: j.entity, date: date || j.date, amt: amt }); };
      if (!ctl.length) { L.forEach(function (l) { push(l.acc, l.amt); }); return; }
      var hasCash = L.some(function (l) { return S.cash[l.acc]; });
      if (!hasCash && ctl.every(charge)) {
        // an invoice or bill: held until paid, one queue entry per trade debts / creditors line
        var tot = ctl.reduce(function (s, l) { return s + Math.abs(l.amt); }, 0);
        ctl.forEach(function (l) {
          var share = Math.abs(l.amt) / tot, k = j.entity + "|" + l.acc + "|" + l.party;
          (queue[k] = queue[k] || []).push({ left: Math.abs(l.amt), full: Math.abs(l.amt), lines: other.map(function (o) { return { acc: o.acc, amt: o.amt * share }; }) });
        });
        return;
      }
      other.forEach(function (l) { push(l.acc, l.amt); });
      ctl.forEach(function (l) {
        if (charge(l)) { push(l.acc, l.amt); return; }
        // a receipt, payment, credit note or advance adjusted: settles the oldest held invoices of that party
        // that party's invoices first, then invoices with no party; a receipt with no party takes the oldest of any party
        var pre = j.entity + "|" + l.acc + "|", rest = Math.abs(l.amt), qs = [queue[pre + l.party] || [], l.party ? queue[pre] || [] : []];
        if (!l.party) qs.push(Object.keys(queue).filter(function (k) { return k.indexOf(pre) === 0; }).map(function (k) { return queue[k]; })
          .reduce(function (a, q) { return a.concat(q.map(function (d) { return { d: d, q: q }; })); }, []));
        qs.forEach(function (q, qi) {
          while (rest > 0.004 && q.length) {
            var it = qi === 2 ? q[0] : { d: q[0], q: q }, d = it.d;
            if (d.left <= 0.004) { q.shift(); continue; }
            var take = Math.min(rest, d.left), f = take / d.full;
            d.lines.forEach(function (o) { push(o.acc, o.amt * f); });
            d.left -= take; rest -= take; if (d.left <= 0.004) q.shift();
          }
        });
        if (rest > 0.004) push(l.acc, l.amt > 0 ? rest : -rest); // paid ahead of any invoice: stays as an advance
      });
    });
    return { acc: acc, lines: out };
  }
  function hook() {
    if (typeof ledger !== "function" || typeof special !== "function" || typeof V === "undefined") return false;
    var old = ledger;
    ledger = function () { // eslint-disable-line no-global-assign
      var base = old.apply(this, arguments);
      if (V.basis !== "cash" || !TABS[V.tab && V.tab[V.mod]]) return base; // other screens always show the books as posted
      if (cache.src !== base) { cache.src = base; cache.val = cashLedger(base); }
      return cache.val;
    };
    var oldS = special;
    special = function (tab) { // eslint-disable-line no-global-assign
      var h = oldS(tab);
      if (!TABS[tab] || typeof h !== "string") return h;
      var cash = V.basis === "cash";
      return '<div class="ctls fs-basis" style="margin-bottom:8px"><span class="muted">Report basis</span>' +
        '<div class="seg" role="radiogroup" aria-label="Report basis"><button type="button" role="radio" aria-checked="' + !cash + '" class="btn sm' + (cash ? "" : " pri") + '" data-basis="accrual">Accrual</button>' +
        '<button type="button" role="radio" aria-checked="' + cash + '" class="btn sm' + (cash ? " pri" : "") + '" data-basis="cash">Cash</button></div>' +
        '<span class="muted">' + (cash ? "<b>Cash basis:</b> invoices and bills count only when paid, on the payment date. For management review; IFRS statements are on the accrual basis."
          : "Accrual basis (IFRS): invoices and bills count on their date, paid or not.") + "</span></div>" + h;
    };
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-basis]"); if (!b) return;
      V.basis = b.dataset.basis; cache.src = null; render();
    });
    var css = document.createElement("style");
    css.textContent = ".fs-basis{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.fs-basis .seg{display:inline-flex;gap:4px}";
    document.head.appendChild(css);
    return true;
  }
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
