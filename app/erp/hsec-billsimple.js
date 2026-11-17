// Vendor bill: shorter form, and suggestions (hassan, 2026-11-17: "there are too much details in it; if retention is
// checked then retention detail should be shown, if advances are selected then advance terms should be shown, make it
// precise ... and show suggestions as well for entering the entry").
//  * The retention boxes and the advance boxes are hidden behind two ticks: "Retention held back on this bill" and
//    "Advance already paid to this vendor". A bill that already has a figure in them opens with the tick on.
//    Unticking clears the boxes, so nothing hidden is applied.
//  * Choosing the vendor shows the accounts used on that vendor's earlier bills (from their posted vouchers), as
//    buttons that fill the first empty line, and how the bill will post.
// Found by the labels on the form, not by the app's field names, so a newer app file keeps working.
(function () {
  /* global F, Store, fmt */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var e$ = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); };
  var isBill = function () { return safe(function () { return F && F.c === "payables"; }, false) && !!document.getElementById("frm"); };
  var GROUPS = [
    { id: "ret", re: /retention/i, label: "Retention held back on this bill", hint: "Tick when part of this bill is kept back until the work is accepted." },
    { id: "adv", re: /advance/i, label: "Advance already paid to this vendor", hint: "Tick to take an advance paid earlier off this bill. On a PO bill the PO's advance % is still applied on save." }];
  var labelOf = function (f) { var l = f.querySelector(":scope > label"); return l ? l.textContent : ""; };
  // the form's boxes of one group (direct field blocks only, not the lines table)
  function boxes(fm, g) {
    return [].slice.call(fm.querySelectorAll(".f")).filter(function (f) { return !f.closest("table") && !f.classList.contains("fs-bsg") && g.re.test(labelOf(f)); });
  }
  var filled = function (f) { return [].slice.call(f.querySelectorAll("input, select, textarea")).some(function (x) { var v = String(x.value || "").trim(); return x.type !== "checkbox" && v && v !== "0" && !/^no$/i.test(v) && v !== "None"; }); };
  function clear(f) {
    [].slice.call(f.querySelectorAll("input, select, textarea")).forEach(function (x) {
      if (x.type === "checkbox") return;
      var was = x.value; x.value = x.tagName === "SELECT" ? (x.options[0] ? x.options[0].value : "") : "";
      if (was !== x.value) { x.dispatchEvent(new Event("input", { bubbles: true })); x.dispatchEvent(new Event("change", { bubbles: true })); }
    });
  }
  function toggles(fm) {
    GROUPS.forEach(function (g) {
      var B = boxes(fm, g); if (!B.length || fm.querySelector("[data-fsbs=\"" + g.id + "\"]")) return;
      var on = B.some(filled);
      var t = document.createElement("div"); t.className = "f fs-bsg"; t.setAttribute("data-fsbs", g.id);
      t.innerHTML = "<label class=\"fs-bst\"><input type=\"checkbox\"" + (on ? " checked" : "") + "> " + e$(g.label) + "</label><span class=\"hint\">" + e$(g.hint) + "</span>";
      B[0].parentNode.insertBefore(t, B[0]);
      B.forEach(function (b) { b.classList.toggle("fs-bshide", !on); b.setAttribute("data-fsbsg", g.id); });
    });
  }
  document.addEventListener("change", function (e) {
    var cb = e.target, t = cb && cb.closest && cb.closest(".fs-bsg"); if (!t || cb.type !== "checkbox") return;
    var fm = document.getElementById("frm"); if (!fm) return;
    [].slice.call(fm.querySelectorAll("[data-fsbsg=\"" + t.getAttribute("data-fsbs") + "\"]")).forEach(function (b) {
      b.classList.toggle("fs-bshide", !cb.checked);
      if (!cb.checked) clear(b);
    });
  });

  // ---- suggestions from the vendor's earlier bills ----
  var accs = function () { return safe(function () { return Store.data.accounts; }, []) || []; };
  var accById = function (id) { return accs().find(function (a) { return a.id === id; }); };
  function vendorBox(fm) { return fm.querySelector("#f_vendor") || [].slice.call(fm.querySelectorAll(".f")).filter(function (f) { return /^\s*vendor\b/i.test(labelOf(f)); }).map(function (f) { return f.querySelector("select, input"); })[0] || null; }
  function history(v) {
    if (!v) return [];
    var bills = safe(function () { return Store.data.payables; }, []) || [];
    var vname = (function () { var s = vendorBox(document.getElementById("frm")); var o = s && s.selectedOptions && s.selectedOptions[0]; return o ? o.textContent.trim() : ""; })();
    var mine = bills.filter(function (b) { return b.id !== safe(function () { return F.rec.id; }, "") && (b.vendor === v || b.vendorId === v || (vname && b.vendor === vname)); });
    var ids = {}; mine.forEach(function (b) { ids[b.id] = 1; });
    var cnt = {}, last = {};
    (safe(function () { return Store.data.journals; }, []) || []).forEach(function (j) {
      var s = j.source || {}; if (s.c !== "payables" || !ids[s.id] || j.status === "Rejected" || s.ev === "payment") return;
      (j.lines || []).forEach(function (l) {
        var a = accById(l.account); if (!a || !(+l.debit > 0) || /^(22|1204|1209|1206)/.test(String(a.code))) return; // skip the payable, advances and taxes
        cnt[a.id] = (cnt[a.id] || 0) + 1; if (!last[a.id] || String(j.date) > last[a.id]) last[a.id] = String(j.date || "");
      });
    });
    return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || last[b].localeCompare(last[a]); }).slice(0, 4).map(function (id) { return { a: accById(id), n: cnt[id] }; });
  }
  function lineSelect(fm, firstEmpty) {
    var tb = [].slice.call(fm.querySelectorAll("table")).find(function (t) { return /account/i.test((t.tHead && t.tHead.textContent) || ""); }); if (!tb) return null;
    var sels = [].slice.call(tb.querySelectorAll("tbody tr")).map(function (tr) { return tr.querySelector("select"); }).filter(Boolean);
    return firstEmpty ? sels.find(function (s) { return !s.value; }) || null : sels;
  }
  var lastSug = "";
  function suggest(fm) {
    var vb = vendorBox(fm), v = vb ? vb.value : "", h = history(v);
    var key = v + "|" + h.map(function (x) { return x.a.id + x.n; }).join(",");
    var cur = fm.querySelector(".fs-bssug");
    if (cur && key === lastSug) return;
    lastSug = key; if (cur) cur.remove();
    var tb = lineSelect(fm, false); if (!tb || !tb.length) return;
    var where = tb[0].closest("table"); where = where.closest(".tw") || where;
    var html = !v ? "<b>Suggestion:</b> choose the vendor first; the accounts used on their earlier bills appear here."
      : !h.length ? "<b>Suggestion:</b> no earlier bills for this vendor. Imported equipment: 510101; customs, duty and clearing: 510102; freight to site: 510104; spares on a client's lift: 510403; office expense: the matching 61xx head. Pick the project on each line."
      : "<b>Used before for this vendor:</b> " + h.map(function (x) { return "<button type=\"button\" class=\"btn sm\" data-fsbsacc=\"" + e$(x.a.id) + "\">" + e$(x.a.code + " " + x.a.name) + " <span class=\"muted\">×" + x.n + "</span></button>"; }).join(" ") +
        "<div class=\"muted\">Click one to put it on the first empty line.</div>";
    where.insertAdjacentHTML("beforebegin", "<div class=\"fs-bssug\">" + html + "<div class=\"muted\">This bill posts: Dr the line accounts (and input sales tax), Cr the vendor's payable. Retention and advance, when ticked, are taken off what is payable now.</div></div>");
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-fsbsacc]"); if (!b) return;
    e.preventDefault();
    var fm = document.getElementById("frm"), s = fm && lineSelect(fm, true);
    if (!s) { var all = fm && lineSelect(fm, false); s = all && all[all.length - 1]; }
    if (!s) return;
    var id = b.getAttribute("data-fsbsacc");
    if (![].slice.call(s.options).some(function (o) { return o.value === id; })) { var a = accById(id); if (!a) return; var o = document.createElement("option"); o.value = id; o.textContent = a.code + " " + a.name; s.appendChild(o); }
    s.value = id; s.dispatchEvent(new Event("input", { bubbles: true })); s.dispatchEvent(new Event("change", { bubbles: true }));
  });

  function run() {
    if (!isBill()) { lastSug = ""; return; }
    var fm = document.getElementById("frm");
    safe(function () { toggles(fm); }, null);
    safe(function () { suggest(fm); }, null);
  }
  var busy = false;
  function start() {
    if (!document.body) return setTimeout(start, 300);
    new MutationObserver(function () { if (busy) return; busy = true; try { run(); } finally { busy = false; } }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", function (e) { if (isBill() && e.target && e.target.closest && e.target.closest("#frm")) run(); });
    var css = document.createElement("style");
    css.textContent = ".fs-bshide{display:none!important}.fs-bsg .fs-bst{display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer}.fs-bsg .fs-bst input{width:auto;margin:0}" +
      ".fs-bssug{margin:6px 0 8px;padding:8px 10px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;font-size:12.5px;line-height:1.6}.fs-bssug .btn{margin:2px 4px 2px 0}";
    document.head.appendChild(css);
  }
  start();
})();
