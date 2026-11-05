// Home: Collections & payments (hassan, 2026-11-05: "need this kind of dashboard on home screen", with a screen recording
// of another ERP's finance home). One band at the top of Home, for the company picked at the top (or the whole group):
//  * Receivables and Payables: outstanding, overdue, an ageing bar (not due, 1-30, 31-60, 61-90, 90+) and the top 5
//    customers owing / vendors to pay, each with documents and overdue.
//  * Due this week: what to collect and pay in the next 7 days plus anything already overdue, and the invoices / bills
//    behind it, oldest first.
//  * Needs action: receivables over 90 days, vouchers waiting for approval, payables past due, receivables past due,
//    vouchers still in draft and customer invoices not posted, most urgent first, each opening its register.
// Read only: every figure comes from the open invoices and bills (outAR / outAP) and the vouchers already in the ERP.
(function () {
  /* global homeDash, Store, byEnt, outAR, outAP, bucket, esc, fdate, render, V, jvOf, jvTot, TODAY */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var num = function (x) { return +x || 0; };
  var e = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var full = function (x) { return Math.round(num(x)).toLocaleString("en-US"); };
  // short PKR figure: 1.16 Cr, 41.6 Lac, 7,559
  var short = function (x) {
    var a = Math.abs(num(x)), s = num(x) < 0 ? "-" : "";
    if (a >= 1e7) return s + (a / 1e7).toFixed(2) + " Cr";
    if (a >= 1e5) return s + (a / 1e5).toFixed(1) + " Lac";
    return s + Math.round(a).toLocaleString("en-US");
  };
  var iso = function (d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var now = function () { var t = safe(function () { return TODAY; }, null) || new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  var late = function (due) { if (!due) return 0; var d = new Date(due + "T00:00:00"); return Math.round((now() - d) / 864e5); };
  var D = function (c) { return (Store.data && Store.data[c]) || []; };
  var mine = function (c) { return safe(function () { return byEnt(D(c)); }, D(c)); };
  var BK = [["Not due", "#94a3b8"], ["1–30", "#facc15"], ["31–60", "#fb923c"], ["61–90", "#f97316"], ["90+", "#dc2626"]];
  var bk = function (due) { return safe(function () { return bucket(due); }, 0); };

  function side(isAP) {
    var out = isAP ? outAP : outAR, key = isAP ? "vendor" : "customer";
    var rows = mine(isAP ? "payables" : "receivables").filter(function (r) { return safe(function () { return out(r); }, 0) > 0; });
    var b = [0, 0, 0, 0, 0], who = {}, tot = 0, over = 0;
    rows.forEach(function (r) {
      var o = out(r), k = bk(r.dueDate), nm = String(r[key] || "(no name)").trim();
      b[k] += o; tot += o; if (k > 0) over += o;
      var w = who[nm] = who[nm] || { n: nm, amt: 0, docs: 0, over: 0 };
      w.amt += o; w.docs++; if (k > 0) w.over += o;
    });
    var top = Object.keys(who).map(function (k) { return who[k]; }).sort(function (a, c) { return c.amt - a.amt; }).slice(0, 5);
    return { rows: rows, b: b, tot: tot, over: over, top: top };
  }

  function ageCard(isAP, x) {
    var title = isAP ? "Payables" : "Receivables", link = isAP ? "#r_party/apaging" : "#r_party/araging";
    var bar = x.tot ? x.b.map(function (v, i) { return v ? '<i style="width:' + (v / x.tot * 100).toFixed(2) + "%;background:" + BK[i][1] + '" title="' + BK[i][0] + ": PKR " + full(v) + '"></i>' : ""; }).join("") : '<i style="width:100%;background:#e2e8f0"></i>';
    var legend = BK.map(function (k, i) { return '<span><em style="background:' + k[1] + '"></em>' + k[0] + "<b>" + short(x.b[i]) + "</b></span>"; }).join("");
    var mx = x.top.length ? x.top[0].amt : 1;
    var list = x.top.map(function (w) {
      return '<div class="cp-who"><div class="cp-wl"><span>' + e(w.n) + "</span><b>" + short(w.amt) + '</b></div><div class="cp-wbar"><i class="' + (isAP ? "ap" : "ar") + '" style="width:' + (w.amt / mx * 100).toFixed(1) + '%"></i></div>' +
        '<small>' + w.docs + " document" + (w.docs === 1 ? "" : "s") + " · " + (w.over ? '<span class="cp-red">' + short(w.over) + " overdue</span>" : "nothing overdue") + "</small></div>";
    }).join("") || '<p class="muted">Nothing outstanding.</p>';
    return '<div class="cp-card"><div class="cp-h"><b>' + title + '</b><a class="cp-chip" href="' + link + '">→ Ageing</a></div>' +
      '<div class="cp-sub">PKR ' + full(x.tot) + " outstanding · PKR " + full(x.over) + " overdue</div>" +
      '<div class="cp-bar">' + bar + '</div><div class="cp-leg">' + legend + "</div>" +
      '<div class="cp-th">Top 5 ' + (isAP ? "vendors to pay" : "customers owing") + "</div>" + list + "</div>";
  }

  function dueCard(ar, ap) {
    var wk = iso(new Date(now().getTime() + 7 * 864e5)), t = iso(now());
    var pick = function (x, isAP) {
      return x.rows.filter(function (r) { return r.dueDate && r.dueDate <= wk; }).map(function (r) {
        return { r: r, ap: isAP, amt: (isAP ? outAP : outAR)(r), due: r.dueDate, nm: isAP ? r.vendor : r.customer,
          ref: isAP ? (r.billNo || r.invoiceNo) : (r.invoiceNo || r.ref) };
      });
    };
    var A = pick(ar, false), P = pick(ap, true);
    var sum = function (L, od) { return L.filter(function (i) { return !od || i.due < t; }).reduce(function (s, i) { return s + i.amt; }, 0); };
    var list = A.concat(P).sort(function (a, b) { return String(a.due).localeCompare(String(b.due)); }).slice(0, 30).map(function (i) {
      var d = late(i.due), when = d > 0 ? d + " day" + (d === 1 ? "" : "s") + " overdue" : d === 0 ? "due today" : "due " + safe(function () { return fdate(i.due); }, i.due);
      return '<div class="cp-due click" data-edit="' + (i.ap ? "payables" : "receivables") + '" data-id="' + e(i.r.id) + '"><span class="cp-arrow ' + (i.ap ? "out" : "in") + '">' + (i.ap ? "↗" : "↙") + "</span>" +
        '<div><b>' + e(i.nm || "") + "</b><small class=\"" + (d > 0 ? "cp-red" : "") + "\">" + e(i.ref || "") + (i.ref ? " · " : "") + when + '</small></div><span class="cp-amt">' + full(i.amt) + "</span></div>";
    }).join("") || '<p class="muted">Nothing due in the next 7 days.</p>';
    return '<div class="cp-card"><div class="cp-h"><b>Due this week</b></div><div class="cp-sub">Next 7 days, and anything already overdue</div>' +
      '<div class="cp-two"><div class="cp-in"><small>TO COLLECT</small><b>' + short(sum(A)) + '</b><span class="cp-red">' + short(sum(A, 1)) + ' already overdue</span></div>' +
      '<div class="cp-out"><small>TO PAY</small><b>' + short(sum(P)) + '</b><span class="cp-red">' + short(sum(P, 1)) + " already overdue</span></div></div>" +
      '<div class="cp-list">' + list + "</div></div>";
  }

  function actCard(ar, ap) {
    var J = mine("journals"), I = [];
    var add = function (lvl, n, title, text, href) { if (n) I.push({ lvl: lvl, title: title, text: text, href: href }); };
    var r90 = ar.rows.filter(function (r) { return bk(r.dueDate) === 4; }), r90a = r90.reduce(function (s, r) { return s + outAR(r); }, 0);
    add(0, r90.length, "Receivables over 90 days", "PKR " + full(r90a) + " · chase or provide for it", "#r_party/araging");
    var pend = J.filter(function (j) { return j.status === "Pending approval"; });
    var pa = pend.reduce(function (s, j) { return s + safe(function () { return jvTot(j).dr; }, 0); }, 0);
    var oldest = pend.reduce(function (m, j) { return Math.max(m, late(String(j.createdAt || j.date || "").slice(0, 10))); }, 0);
    add(0, pend.length, pend.length + " voucher" + (pend.length === 1 ? "" : "s") + " waiting for approval", "PKR " + full(pa) + (oldest > 0 ? " · oldest " + oldest + " day" + (oldest === 1 ? "" : "s") : ""), "#e_jv/journals");
    var apo = ap.rows.filter(function (r) { return bk(r.dueDate) > 0; }), vend = {};
    apo.forEach(function (r) { vend[r.vendor || ""] = 1; });
    add(1, apo.length, "Payables past due date", "PKR " + full(apo.reduce(function (s, r) { return s + outAP(r); }, 0)) + " across " + Object.keys(vend).length + " vendor" + (Object.keys(vend).length === 1 ? "" : "s"), "#r_party/apaging");
    var aro = ar.rows.filter(function (r) { var k = bk(r.dueDate); return k > 0 && k < 4; });
    add(1, aro.length, "Receivables past due date", "PKR " + full(aro.reduce(function (s, r) { return s + outAR(r); }, 0)) + " overdue up to 90 days", "#r_party/araging");
    var dr = J.filter(function (j) { return j.status === "Draft"; });
    add(1, dr.length, dr.length + " voucher" + (dr.length === 1 ? "" : "s") + " still in draft", "PKR " + full(dr.reduce(function (s, j) { return s + safe(function () { return jvTot(j).dr; }, 0); }, 0)) + " not yet in the ledger", "#e_jv/journals");
    var np = mine("receivables").filter(function (r) { return !(r.jvId && safe(function () { return jvOf(r.jvId); }, null)); });
    add(2, np.length, np.length + " customer invoice" + (np.length === 1 ? "" : "s") + " not posted", "PKR " + full(np.reduce(function (s, r) { return s + num(r.amount); }, 0)) + " not in receivables yet", "#e_ar/receivables");
    I.sort(function (a, b) { return a.lvl - b.lvl; });
    var body = I.map(function (i) {
      return '<a class="cp-act l' + i.lvl + '" href="' + i.href + '"><span class="cp-ic">' + (i.lvl === 0 ? "!" : i.lvl === 1 ? "▲" : "i") + "</span><div><b>" + e(i.title) + "</b><small>" + e(i.text) + "</small></div><span>→</span></a>";
    }).join("") || '<p class="muted">Nothing needs action.</p>';
    return '<div class="cp-card"><div class="cp-h"><b>Needs action</b></div><div class="cp-sub">' + I.length + " item" + (I.length === 1 ? "" : "s") + ", most urgent first</div>" + body + "</div>";
  }

  function band() {
    var ar = side(false), ap = side(true);
    var who = safe(function () { return V.ent === "All" ? "whole group" : V.ent; }, "");
    return '<section class="cp"><div class="cp-top"><h3>Collections &amp; payments</h3><span>Who owes us, who we owe, and what needs doing' + (who ? " · " + e(who) : "") + "</span></div>" +
      '<div class="cp-grid">' + ageCard(false, ar) + ageCard(true, ap) + dueCard(ar, ap) + actCard(ar, ap) + "</div></section>";
  }
  window.FS_HOMECP = { band: band };

  var hooked = false;
  function hook() {
    if (hooked) return true;
    if (typeof homeDash !== "function" || !Store || !Store.data) return false;
    hooked = true;
    var old = homeDash;
    homeDash = function () { return safe(band, "") + old.apply(this, arguments); }; // eslint-disable-line no-global-assign
    safe(function () { if (V.mod === "dashboard" || !location.hash || location.hash === "#dashboard") render(); }, null);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".cp{margin:0 0 16px}.cp-top{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 10px}.cp-top h3{margin:0;font-size:17px}.cp-top span{color:var(--muted,#64748b);font-size:12.5px}" +
    ".cp-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}@media(max-width:1250px){.cp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.cp-grid{grid-template-columns:1fr}}" +
    ".cp-card{background:var(--panel,#fff);border:1px solid var(--line,#e2e8f0);border-radius:12px;padding:14px 16px;min-width:0;display:flex;flex-direction:column}" +
    ".cp-h{display:flex;justify-content:space-between;align-items:center}.cp-h b{font-size:15px}.cp-chip{font-size:12px;background:#f1f5f9;border-radius:999px;padding:3px 10px;text-decoration:none;color:inherit;font-weight:600}" +
    ".cp-sub{color:var(--muted,#64748b);font-size:12px;margin:3px 0 10px}.cp-bar{display:flex;height:10px;border-radius:6px;overflow:hidden;background:#e2e8f0}.cp-bar i{display:block;height:100%}" +
    ".cp-leg{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11px;color:var(--muted,#64748b);margin:7px 0 4px}.cp-leg span{display:flex;flex-direction:column}.cp-leg em{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px}.cp-leg b{color:var(--ink,#0f172a);font-size:12px}" +
    ".cp-th{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted,#64748b);margin:12px 0 6px;padding-top:10px;border-top:1px solid var(--line,#e2e8f0)}" +
    ".cp-who{margin:0 0 9px}.cp-wl{display:flex;justify-content:space-between;gap:8px;font-size:13px}.cp-wl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}.cp-wbar{height:4px;background:#f1f5f9;border-radius:3px;margin:4px 0 2px}.cp-wbar i{display:block;height:100%;border-radius:3px}.cp-wbar i.ar{background:#15803d}.cp-wbar i.ap{background:#c2410c}.cp-who small{font-size:11px;color:var(--muted,#64748b)}" +
    ".cp-red{color:#dc2626}.cp-two{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.cp-two>div{border-radius:8px;padding:8px 10px;display:flex;flex-direction:column}.cp-two small{font-size:10.5px;font-weight:700;letter-spacing:.05em}.cp-two b{font-size:19px}.cp-two span{font-size:11px}.cp-in{background:#ecfdf5}.cp-in small{color:#15803d}.cp-out{background:#fffbeb}.cp-out small{color:#b45309}" +
    ".cp-list{max-height:330px;overflow:auto}.cp-due{display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid #f1f5f9;cursor:pointer}.cp-due:hover{background:#f8fafc}.cp-due>div{flex:1;min-width:0;display:flex;flex-direction:column}.cp-due b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cp-due small{font-size:11px;color:var(--muted,#64748b)}.cp-due small.cp-red{color:#dc2626}.cp-amt{font-weight:700;font-size:13px}.cp-arrow{font-weight:700}.cp-arrow.in{color:#15803d}.cp-arrow.out{color:#c2410c}" +
    ".cp-act{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;margin:0 0 8px;text-decoration:none;color:inherit}.cp-act>div{flex:1;min-width:0;display:flex;flex-direction:column}.cp-act b{font-size:13px}.cp-act small{font-size:11.5px;color:var(--muted,#64748b)}" +
    ".cp-act.l0{background:#fef2f2}.cp-act.l1{background:#fffbeb}.cp-act.l2{background:#eff6ff}.cp-ic{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex:none}.l0 .cp-ic{background:#dc2626}.l1 .cp-ic{background:#d97706}.l2 .cp-ic{background:#2563eb}" +
    "@media print{.cp{display:none}}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
