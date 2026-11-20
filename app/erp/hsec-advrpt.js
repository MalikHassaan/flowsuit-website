// Advances by person (hassan, 2026-11-20: "if we want to see the advances details, how can we get the details, report
// or ledger"). Reports › "Advances by person": every posted entry on the advance accounts (120401 suppliers, 120403
// employees, and other 1204 advance or loan accounts), grouped by the person or party named on the voucher, with what
// was given, what was settled or returned, the balance still out, and since when (oldest unsettled amount, first in,
// first out). Click a person for their ledger. Entries without a name are listed as "(no name on voucher)".
(function () {
  /* global Store, V, MODS, special, render */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var amt = function (x) { var v = Math.round(Math.abs(x)).toLocaleString("en-US"); return x < -0.5 ? "(" + v + ")" : v; };
  var fd = function (d) { var t = new Date(d + "T00:00:00"); return isNaN(t) ? (d || "") : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  var today = function () { var t = new Date(); return t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2); };
  var S = { acc: "", asAt: "", open: "", only: true };

  function advAccounts() {
    return (Store.data.accounts || []).filter(function (a) {
      var c = String(a.code || "");
      return /^1204/.test(c) && c.length > 4 && (c === "120401" || c === "120403" || /advance|loan|imprest/i.test(a.name || ""));
    }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
  }
  function rows() {
    var accs = advAccounts(), ids = {}, asAt = S.asAt || today();
    accs.forEach(function (a) { if (!S.acc || S.acc === a.id) ids[a.id] = a; });
    var P = {};
    (Store.data.journals || []).forEach(function (j) {
      if (j.status !== "Posted" || !j.date || j.date > asAt) return;
      if (V.ent && V.ent !== "All" && j.entity !== V.ent) return;
      (j.lines || []).forEach(function (l) {
        var a = ids[l.account]; if (!a) return;
        var d = +l.debit || 0, c = +l.credit || 0; if (!d && !c) return;
        var who = String(j.payee || "").trim() || "(no name on voucher)", k = a.id + "|" + who.toLowerCase();
        var p = P[k] || (P[k] = { k: k, who: who, acc: a, ent: {}, list: [], dr: 0, cr: 0 });
        p.dr += d; p.cr += c; p.ent[j.entity] = 1;
        p.list.push({ j: j, d: d, c: c, desc: l.desc || "" });
      });
    });
    return Object.keys(P).map(function (k) {
      var p = P[k]; p.list.sort(function (x, y) { return String(x.j.date).localeCompare(String(y.j.date)) || String(x.j.ref || "").localeCompare(String(y.j.ref || "")); });
      p.bal = p.dr - p.cr;
      // oldest unsettled: settle debits first in, first out with the credits
      var left = p.cr, since = "";
      p.list.forEach(function (x) { if (!x.d) return; if (left >= x.d - 0.5) left -= x.d; else { if (!since) since = x.j.date; left = 0; } });
      p.since = p.bal > 0.5 ? since : "";
      p.days = p.since ? Math.round((new Date(asAt + "T00:00:00") - new Date(p.since + "T00:00:00")) / 864e5) : 0;
      return p;
    }).filter(function (p) { return !S.only || Math.abs(p.bal) > 0.5; })
      .sort(function (a, b) { return b.days - a.days || b.bal - a.bal; });
  }
  function view() {
    if (typeof Store === "undefined" || !Store.data) return "";
    var accs = advAccounts(), R = rows(), tot = R.reduce(function (s, p) { return s + p.bal; }, 0), asAt = S.asAt || today();
    var h = "<div class=\"ctls fs-ar\"><label for=\"fsArAcc\">Account <select id=\"fsArAcc\"><option value=\"\">All advance accounts</option>" +
      accs.map(function (a) { return "<option value=\"" + esc(a.id) + "\"" + (S.acc === a.id ? " selected" : "") + ">" + esc(a.code + " " + a.name) + "</option>"; }).join("") + "</select></label>" +
      "<label for=\"fsArAt\">As at <input type=\"date\" id=\"fsArAt\" value=\"" + esc(asAt) + "\"></label>" +
      "<label class=\"fs-archk\"><input type=\"checkbox\" id=\"fsArOnly\"" + (S.only ? " checked" : "") + "> Only people with a balance</label>" +
      "<span class=\"muted\">" + esc(V.ent === "All" || !V.ent ? "All companies" : V.ent) + " · posted vouchers</span></div>";
    if (!accs.length) return h + "<div class=\"panel empty\"><b>No advance accounts found</b>Advance accounts sit under 1204 (120401 suppliers, 120403 employees).</div>";
    h += "<div class=\"panel tw\"><table class=\"fs-artab\"><thead><tr><th>Person / party</th><th>Account</th><th class=\"num\">Given</th><th class=\"num\">Settled / returned</th><th class=\"num\">Balance out</th><th>Unsettled since</th><th class=\"num\">Days</th></tr></thead><tbody>";
    if (!R.length) h += "<tr><td colspan=\"7\" class=\"muted\">No advances " + (S.only ? "outstanding " : "") + "as at " + esc(fd(asAt)) + ".</td></tr>";
    R.forEach(function (p) {
      var old = p.days > 60 ? "bad" : p.days > 30 ? "warn" : "";
      h += "<tr class=\"click\" data-fsar=\"" + esc(p.k) + "\"><td><b>" + esc(p.who) + "</b>" + (/^\(no name/.test(p.who) ? " <span class=\"pill warn\">name it</span>" : "") + "</td><td>" + esc(p.acc.code) + "</td><td class=\"num\">" + amt(p.dr) + "</td><td class=\"num\">" + amt(p.cr) + "</td><td class=\"num\"><b>" + amt(p.bal) + "</b></td><td>" + esc(p.since ? fd(p.since) : "") + "</td><td class=\"num\">" + (p.since ? "<span class=\"pill " + old + "\">" + p.days + "</span>" : "") + "</td></tr>";
      if (S.open === p.k) {
        var run = 0;
        h += "<tr class=\"fs-arx\"><td colspan=\"7\"><table><thead><tr><th>Date</th><th>Voucher</th><th>Narration</th><th class=\"num\">Given (Dr)</th><th class=\"num\">Settled (Cr)</th><th class=\"num\">Balance</th></tr></thead><tbody>" +
          p.list.map(function (x) { run += x.d - x.c; return "<tr><td>" + esc(fd(x.j.date)) + "</td><td class=\"mono\">" + esc(x.j.ref || "") + "</td><td>" + esc(String(x.desc || x.j.narration || "").slice(0, 90)) + "</td><td class=\"num\">" + (x.d ? amt(x.d) : "") + "</td><td class=\"num\">" + (x.c ? amt(x.c) : "") + "</td><td class=\"num\">" + amt(run) + "</td></tr>"; }).join("") +
          "</tbody></table></td></tr>";
      }
    });
    h += "</tbody><tfoot><tr><td colspan=\"4\">Total out" + (S.acc ? "" : " (all advance accounts)") + "</td><td class=\"num\"><b>" + amt(tot) + "</b></td><td colspan=\"2\"></td></tr></tfoot></table></div>" +
      "<p class=\"muted\">Click a person for their ledger. The total equals the advance accounts' balance in the trial balance at the same date. Days counts from the oldest amount not yet settled; over 30 days is amber, over 60 red. A balance in brackets means more was settled than given (an amount owed to the person).</p>";
    return h;
  }

  function hook() {
    if (typeof MODS === "undefined" || !MODS.rpt || typeof special !== "function" || typeof Store === "undefined") return false;
    if (!MODS.rpt.tabs.some(function (t) { return t[0] === "advbal"; })) MODS.rpt.tabs.push(["advbal", "Advances by person"]);
    special = (function (old) { return function (tab) { return tab === "advbal" ? view() : old.apply(this, arguments); }; })(special); // eslint-disable-line no-global-assign
    var redraw = function () { if (typeof render === "function") render(); };
    document.addEventListener("change", function (e) {
      var t = e.target; if (!t) return;
      if (t.id === "fsArAcc") { S.acc = t.value; S.open = ""; redraw(); }
      else if (t.id === "fsArAt") { S.asAt = t.value; redraw(); }
      else if (t.id === "fsArOnly") { S.only = t.checked; redraw(); }
    });
    document.addEventListener("click", function (e) {
      var tr = e.target.closest && e.target.closest("tr[data-fsar]"); if (!tr) return;
      var k = tr.getAttribute("data-fsar"); S.open = S.open === k ? "" : k; redraw();
    });
    var css = document.createElement("style");
    css.textContent = ".fs-ar{flex-wrap:wrap;gap:12px}.fs-archk{display:inline-flex;align-items:center;gap:6px}.fs-artab tr.click{cursor:pointer}.fs-artab tr.click:hover td{background:#f1f5f9}" +
      ".fs-arx>td{background:#f8fafc;padding:8px 12px}.fs-arx table{width:100%;font-size:12.5px}.fs-artab tfoot td{font-weight:600;border-top:1px solid #e2e8f0}";
    document.head.appendChild(css);
    return true;
  }
  (function start() { if (!hook()) setTimeout(start, 300); })();
})();
