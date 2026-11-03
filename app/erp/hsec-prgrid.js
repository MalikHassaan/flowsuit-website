// Purchase requisition rows laid out like a quotation's item rows (hassan, 2026-11-03, screenshot of an item block with
// Description, Specification, Quantity, Unit "pcs", Unit price, Brand, Amount). The app's requisition table (GRIDS) gets
// Specification and Brand columns, a Unit list that starts at "pcs", and "Unit price" instead of "Est. rate".
// Same row keys as before (i, q, u, p) plus s (specification) and b (brand), so older requisitions open unchanged.
// Also (hassan, same day, screenshot of quotation terms): validity, delivery time, payment terms, delivery place,
// freight / carriage and installation on the requisition, so the buyer knows what to ask the vendors for.
// Tax and discount are left to the vendor's quotation and the purchase order: a requisition is an internal estimate.
(function () {
  /* global GRIDS, fmt, n, S, F, TERM_TYPES */
  var UNITS = ["pcs", "set", "nos", "pair", "box", "pack", "roll", "kg", "m", "sq m", "ltr", "lot", "job", "month"];
  function hook() {
    if (typeof GRIDS === "undefined" || typeof S === "undefined" || !GRIDS.requisitions || !GRIDS.requisitions.description) return false;
    var g = GRIDS.requisitions.description;
    g.cols = [
      { k: "i", l: "Description" },
      { k: "s", l: "Specification" },
      { k: "b", l: "Brand", w: 110 },
      { k: "q", l: "Qty", t: "number", w: 64 },
      { k: "u", l: "Unit", t: "select", o: UNITS, w: 84, def: "pcs" },
      { k: "p", l: "Unit price (PKR)", t: "money", w: 116 },
      { k: "a", l: "Amount", calc: 1, w: 110 }
    ];
    g.hint = "One row per item: what it is, its specification and brand if it matters, how many, the unit (pcs, set, kg …) and the estimated price of ONE unit. The total fills the estimated amount.";
    g.text = function (r) {
      var f = function (v) { try { return fmt(v); } catch (e) { return String(v); } }, num = function (v) { try { return n(v); } catch (e) { return +v || 0; } };
      return ((r.i || "") + (r.s ? " (" + r.s + ")" : "") + (r.b ? " – " + r.b : "") + (r.q ? " – " + f(r.q) + " " + (r.u || "") : "") +
        (num(r.p) ? " @ " + f(r.p) + " = " + f(num(r.q || 1) * num(r.p)) : "")).trim();
    };
    var fl = S.requisitions.fields;
    if (!fl.some(function (f) { return f.k === "validityDays"; })) {
      var terms = ["To be agreed"].concat(typeof TERM_TYPES !== "undefined" ? TERM_TYPES : ["100% advance", "Payment on delivery", "Credit – pay N days after invoice"]);
      var add = [
        { k: "validityDays", l: "Quotation validity (days)", t: "number", hint: "How long the vendor's prices must stay valid, e.g. 30." },
        { k: "deliveryTime", l: "Delivery time", hint: "e.g. 2 weeks from PO, or ex-stock." },
        { k: "payTerms", l: "Payment terms", t: "select", o: terms },
        { k: "deliveryPlace", l: "Delivery place", hint: "Site, office or warehouse the goods go to." },
        { k: "freight", l: "Freight / carriage", t: "textarea", w: 1, hint: "Who arranges and pays transport, e.g. included in price, or at actual." },
        { k: "installation", l: "Installation", t: "textarea", w: 1, hint: "Whether installation, testing and commissioning are needed and who does them." }
      ];
      var at = fl.findIndex(function (f) { return f.k === "status"; });
      Array.prototype.splice.apply(fl, [at < 0 ? fl.length : at, 0].concat(add));
    }
    return true;
  }
  // a new row starts at "pcs" (the app adds the first empty row without defaults)
  new MutationObserver(function () {
    if (typeof F === "undefined" || !F || F.c !== "requisitions") return;
    document.querySelectorAll('select[data-gk="description"][data-gc="u"]').forEach(function (el) {
      if (el.value || el.dataset.fsDef) return; el.dataset.fsDef = "1"; el.value = "pcs"; el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  function start() { if (!hook()) setTimeout(start, 300); }
  start();
})();
