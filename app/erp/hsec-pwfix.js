// Business cycle › Project workspace: a customer advance no longer ticks "Receipt from customer" (hassan, 2026-11-18:
// "as i have booked the advance payment so why it goes to 13th step"). The app ticks that step when anything has been
// received on the project, advance included, and the workspace then jumps to the step after it (Handover). Here the step
// counts only money received against the project's invoices; the advance stays on step 3. Nothing is saved or posted.
(function () {
  /* global lifeLive, pwSteps, Store, recdAR, outAR, fmt, n */
  var num = function (v) { try { return n(v); } catch (e) { return +v || 0; } };
  var money = function (v) { try { return fmt(v); } catch (e) { return String(Math.round(v)); } };
  function recdOnInvoices(p) {
    var D = Store.data, nm = String(p.name || "");
    var inv = (D.receivables || []).filter(function (r) { return r.projectId === p.id || (r.entity === p.entity && ((nm && r.customer === nm) || (p.code && r.project === p.code))); });
    var got = inv.reduce(function (s, r) {
      if (typeof recdAR === "function") { try { return s + num(recdAR(r)); } catch (e) { /* fall through */ } }
      if (typeof outAR === "function") { try { return s + Math.max(0, num(r.amount) - num(r.retention) - num(r.advAdjust) - num(outAR(r))); } catch (e) { /* none */ } }
      return s;
    }, 0);
    return { n: inv.length, got: got };
  }
  function hook() {
    if (typeof lifeLive !== "function" || typeof pwSteps !== "function" || typeof Store === "undefined") return false;
    var K = -1;
    try { K = pwSteps().findIndex(function (s) { return /^receipt from customer/i.test(s.t || ""); }); } catch (e) { return true; }
    if (K < 0) return true; // a newer app file without this step: leave it alone
    var old = lifeLive;
    lifeLive = function (p) { // eslint-disable-line no-global-assign
      var L = old.apply(this, arguments);
      try {
        if (!p || !Array.isArray(L) || !L[K]) return L;
        var x = recdOnInvoices(p), adv = (Store.data.custadv || []).filter(function (a) { return a.projectId === p.id; }).reduce(function (s, a) { return s + num(a.amount); }, 0);
        L = L.slice();
        L[K] = [x.got > 0 ? "ok" : "todo", "Received " + money(x.got) + " against " + x.n + " invoice" + (x.n === 1 ? "" : "s") + (adv ? " · advance " + money(adv) + " is under step 3" : "")];
      } catch (e) { /* keep the app's own answer */ }
      return L;
    };
    return true;
  }
  var tries = 0;
  (function start() { var ok = false; try { ok = hook(); } catch (e) { ok = true; } if (!ok && ++tries < 400) setTimeout(start, 300); })();
})();
