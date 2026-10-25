// What a bank guarantee is secured by. Basis says whether it uses a bank limit or a one-time (OTT) approval;
// the bank may also take security for it: cash margin, a property mortgage, a lien on customer receivables or
// a counter-guarantee. Adds those fields to the guarantee form and a "Securities pledged" tab under Trade finance.
(function () {
  /* global S, MODS, TAB_HOME, V, Store, byEnt, bgCalc, esc, fmt, n, refName, fdate */
  var SEC = ["Cash margin only", "Property pledged (mortgage)", "Customer receivables (lien / assignment)", "Counter-guarantee", "Other"];
  var PROP = SEC[1], RECV = SEC[2];

  function addFields() {
    var f = S.bgs.fields;
    if (f.some(function (x) { return x.k === "secBy"; })) return;
    var at = f.findIndex(function (x) { return x.k === "marginPct"; });
    f.splice(at < 0 ? f.length : at + 1, 0,
      { k: "secBy", l: "Secured by", t: "select", o: SEC, hint: "What the bank holds against this guarantee, besides any cash margin." },
      { k: "secDetail", l: "Security details", hint: "Property: title / khasra or plot no. and owner. Receivables: customer, invoices or contract assigned." },
      { k: "secValue", l: "Security value (PKR)", t: "money", hint: "Forced-sale value of the property, or the receivables under lien." },
      { k: "secRef", l: "Charge / lien reference", hint: "Mortgage deed, letter of lien or assignment number." });
    var c = S.bgs.cols, i = c.findIndex(function (x) { return x[0] === "mgn"; });
    c.splice(i + 1, 0, ["secBy", "Secured by", function (r) { return r.secBy && r.secBy !== SEC[0] ? esc(r.secBy.replace(/ \(.*\)$/, "")) : ""; }]);
  }

  // Only the boxes that apply to the chosen security show.
  function trim() {
    var sel = document.getElementById("f_secBy");
    if (!sel) return;
    var v = sel.value, other = v && v !== SEC[0];
    ["secDetail", "secValue", "secRef"].forEach(function (k) {
      var el = document.getElementById("f_" + k), box = el && el.closest(".f");
      if (box && box.hidden === !!other) box.hidden = !other;
    });
    if (!sel.dataset.fsSec) { sel.dataset.fsSec = "1"; sel.addEventListener("change", trim); }
  }

  function view() {
    var bgs = byEnt(Store.data.bgs || []).filter(function (r) { return bgCalc(r).live; });
    if (!bgs.length) return '<div class="panel empty"><b>No live guarantees</b>Guarantees that are requested, issued or extended show here with what secures them.</div>';
    var g = {};
    bgs.forEach(function (r) {
      var k = (r.bank || "(no bank)") + "\u0001" + (r.secBy || SEC[0]), x = g[k] = g[k] || { bank: r.bank || "(no bank)", sec: r.secBy || SEC[0], n: 0, amt: 0, margin: 0, value: 0 };
      var c = bgCalc(r);
      x.n++; x.amt += c.pkr; x.margin += c.margin; x.value += n(r.secValue);
    });
    var rows = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return a.bank.localeCompare(b.bank) || SEC.indexOf(a.sec) - SEC.indexOf(b.sec); });
    var T = rows.reduce(function (t, r) { t.amt += r.amt; t.margin += r.margin; t.value += r.value; return t; }, { amt: 0, margin: 0, value: 0 });
    var list = bgs.filter(function (r) { return r.secBy === PROP || r.secBy === RECV; }).sort(function (a, b) { return String(a.expiry || "9").localeCompare(String(b.expiry || "9")); });
    return '<p class="muted">What each bank holds against your live guarantees. Property and receivables under charge cannot be sold or collected freely until the guarantee is released, so check this before pledging the same asset twice.</p>'
      + '<div class="panel tw"><table><thead><tr><th>Bank</th><th>Secured by</th><th class="num">Guarantees</th><th class="num">Amount (PKR)</th><th class="num">Cash margin</th><th class="num">Security value</th><th class="num">Cover</th></tr></thead><tbody>'
      + rows.map(function (r) {
        return '<tr><td>' + esc(r.bank) + '</td><td>' + esc(r.sec) + '</td><td class="num">' + r.n + '</td><td class="num">' + fmt(r.amt) + '</td><td class="num">' + fmt(r.margin) + '</td><td class="num">' + (r.value ? fmt(r.value) : "–") + '</td><td class="num">' + (r.value && r.amt ? Math.round((r.value + r.margin) / r.amt * 100) + "%" : "–") + '</td></tr>';
      }).join("")
      + '<tr><td><b>Total</b></td><td></td><td class="num"><b>' + bgs.length + '</b></td><td class="num"><b>' + fmt(T.amt) + '</b></td><td class="num"><b>' + fmt(T.margin) + '</b></td><td class="num"><b>' + fmt(T.value) + '</b></td><td></td></tr></tbody></table></div>'
      + (list.length ? '<div class="card" style="margin-top:14px"><h3>Property and receivables under charge</h3><div class="tw"><table><thead><tr><th>Guarantee</th><th>Bank</th><th>Secured by</th><th>Details</th><th>Reference</th><th class="num">Security value</th><th class="num">Guarantee (PKR)</th><th>Expiry</th></tr></thead><tbody>'
        + list.map(function (r) {
          return '<tr><td>' + esc(r.ref || r.bgNo || "") + (r.project ? ' <span class="muted">' + esc(refName("projects", r.project)) + '</span>' : '') + '</td><td>' + esc(r.bank || "") + '</td><td>' + esc(r.secBy === PROP ? "Property" : "Receivables") + '</td><td>' + esc(r.secDetail || "") + '</td><td>' + esc(r.secRef || "") + '</td><td class="num">' + (n(r.secValue) ? fmt(r.secValue) : "–") + '</td><td class="num">' + fmt(bgCalc(r).pkr) + '</td><td>' + fdate(r.expiry) + '</td></tr>';
        }).join("") + '</tbody></table></div><p class="note">The charge stays until the bank releases the guarantee. Mark the guarantee Released when you get the bank\'s release letter, and ask for the property papers or the lien to be released at the same time.</p></div>' : '');
  }

  function hook() {
    if (typeof S === "undefined" || !S.bgs || typeof MODS === "undefined" || !MODS.e_lc || typeof special !== "function") return false; // eslint-disable-line no-undef
    addFields();
    if (!MODS.e_lc.tabs.some(function (t) { return t[0] === "bgsec"; })) {
      var i = MODS.e_lc.tabs.findIndex(function (t) { return t[0] === "bgs"; });
      MODS.e_lc.tabs.splice(i < 0 ? MODS.e_lc.tabs.length : i + 1, 0, ["bgsec", "Securities pledged"]);
    }
    TAB_HOME.bgsec = "e_lc";
    var old = special; // eslint-disable-line no-undef
    special = function (tab) { return tab === "bgsec" ? view() : old(tab); }; // eslint-disable-line no-global-assign, no-undef
    new MutationObserver(trim).observe(document.body, { childList: true, subtree: true });
    if (/bgsec/.test(location.hash) && typeof render === "function") render(); // eslint-disable-line no-undef
    return true;
  }
  var tries = 0;
  function start() { if (!hook() && ++tries < 60) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
