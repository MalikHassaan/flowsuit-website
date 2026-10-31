// Bank reconciliation: cheque / transfer reference on every book entry (hassan, 2026-10-31: "payments are made through
// online portal or some through cheque"). The bank statement shows the cheque number or the portal's transaction
// reference, so each uncleared entry shows the voucher's "Cheque / TT / instrument no.", and a Find box narrows the list
// by reference, payee or amount.
(function () {
  /* global Store */
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var lastQ = "";
  var jv = function (id) { return ((Store && Store.data && Store.data.journals) || []).find(function (j) { return j.id === id; }); };

  function enhance() {
    if (typeof Store === "undefined" || !Store.data) return;
    var box = document.querySelector("input[data-brk]"); if (!box) return;
    var table = box.closest("table"); if (!table || table.dataset.fsRef) return;
    table.dataset.fsRef = "1";
    var head = table.querySelector("thead tr");
    if (head && head.children[2]) head.children[2].insertAdjacentHTML("afterend", "<th>Cheque / transfer ref</th>");
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      var cb = tr.querySelector("input[data-brk]"); if (!cb || !tr.children[2]) return;
      var j = jv(String(cb.getAttribute("data-brk")).split(":")[0]) || {};
      var ref = String(j.chequeNo || "").trim();
      tr.children[2].insertAdjacentHTML("afterend", "<td class=\"fs-bref\">" + (ref ? "<b>" + esc(ref) + "</b>" + (j.chequeDate ? "<br><span class=\"muted\">" + esc(j.chequeDate) + "</span>" : "") : "<span class=\"muted\">–</span>") + "</td>");
    });
    var wrap = table.closest(".panel") || table.parentNode;
    if (wrap && !document.getElementById("fsBrFind")) {
      wrap.insertAdjacentHTML("beforebegin", "<div class=\"fs-brfind\"><label for=\"fsBrFind\">Find on the list</label><input id=\"fsBrFind\" type=\"search\" autocomplete=\"off\" placeholder=\"Cheque no., portal reference, payee or amount\"><span class=\"muted\" id=\"fsBrCount\"></span></div>");
      var inp = document.getElementById("fsBrFind");
      inp.value = lastQ; if (lastQ) filter(table, lastQ);
      inp.addEventListener("input", function () { lastQ = inp.value; filter(table, inp.value); });
      inp.addEventListener("keydown", function (e) { e.stopPropagation(); });
    }
  }
  function filter(table, q) {
    q = String(q || "").toLowerCase().replace(/,/g, "").trim();
    var shown = 0, all = 0;
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      if (!tr.querySelector("input[data-brk]")) return;
      all++;
      var ok = !q || tr.textContent.toLowerCase().replace(/,/g, "").indexOf(q) >= 0;
      tr.style.display = ok ? "" : "none"; if (ok) shown++;
    });
    var c = document.getElementById("fsBrCount"); if (c) c.textContent = q ? shown + " of " + all : "";
  }

  function start() {
    if (!document.body) return setTimeout(start, 50);
    new MutationObserver(function () { try { enhance(); } catch (x) { /* never break the page */ } })
      .observe(document.body, { childList: true, subtree: true });
    var css = document.createElement("style");
    css.textContent = ".fs-bref{font-family:Consolas,monospace;font-size:12.5px;white-space:nowrap}.fs-bref .muted{font-family:inherit;font-size:11px}" +
      ".fs-brfind{display:flex;align-items:center;gap:8px;margin:8px 0}.fs-brfind label{font-weight:600;font-size:13px}.fs-brfind input{flex:0 1 360px;padding:6px 9px;font:inherit}";
    document.head.appendChild(css);
  }
  start();
})();
