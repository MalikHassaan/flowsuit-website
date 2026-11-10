// E-mail AMC invoices (hassan, 2026-11-10: "in AMC once the project is created there should be email address of the
// relevant person to whom invoices can be sent ... once invoices are created it can also be emailed on that address
// from our system; email should be sent customersupport@hsecpak.com", "with the subject of AMC INVOICE FOR THE MONTH OF
// <month>").
//  * The AMC project form has "Invoice e-mail" (hsec-amcinv.js); several addresses are separated by commas.
//  * Every invoice in AMC billing's lists gets "✉ Email", and the list gets "✉ Email ticked". A window shows each
//    invoice with its address (taken from the project, can be changed), the subject and the message; Send builds the
//    invoice PDF on its letterhead (the same PDF as the PDF button) and the server mails it from the customer support
//    address (hsec-mail.php). A lump-sum invoice goes as one e-mail.
//  * A sent invoice records who it went to and when (doc.mailed), shown under its Email button.
(function () {
  /* global Store, S, toast, fmt, fdate, ivPdf, dlSave, ivCo, esc */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; })); };
  var C = window.FS_BRIDGE || {}, API = (C.api || "/erp/m/hsec/api") + "/amcmail";
  var MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  var B = function () { return window.FS_AMCB; };
  var proj = function (r) { var id = String(r.amcKey || "").split("|")[0] || r.projectId; return safe(function () { return Store.data.projects.find(function (p) { return p.id === id; }); }, null); };
  var group = function (r) { return r.amcGroup ? safe(function () { return Store.data.receivables.filter(function (x) { return x.amcGroup === r.amcGroup && x.status !== "Void"; }); }, [r]) : [r]; };
  var money = function (v) { return safe(function () { return fmt(v); }, Math.round(v).toLocaleString()); };
  var day = function (d) { return safe(function () { return fdate(d); }, d || ""); };
  var coName = function (e) { return safe(function () { return ivCo(e); }, e || ""); };

  // "2026-11" -> "NOVEMBER 2026"; invoices covering several months -> "OCTOBER TO DECEMBER 2026"
  function monthText(r) {
    var m = String(r.amcKey || "").split("|")[1] || String(r.invoiceDate || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return { one: true, t: "" };
    var y = +m.slice(0, 4), i = +m.slice(5) - 1, k = Math.max(1, +(((r.doc || {}).amcDef || {}).months) || 1);
    if (k < 2) return { one: true, t: MONTHS[i] + " " + y };
    var j = i + k - 1, y2 = y + Math.floor(j / 12); j %= 12;
    return { one: false, t: MONTHS[i] + (y2 !== y ? " " + y : "") + " TO " + MONTHS[j] + " " + y2 };
  }
  function subject(r) { var t = monthText(r); return "AMC INVOICE FOR THE " + (t.one ? "MONTH" : "MONTHS") + " OF " + t.t; }
  function message(r, G) {
    var t = monthText(r), amt = G.reduce(function (a, x) { return a + (+x.amount || 0); }, 0), nos = G.map(function (x) { return x.invoiceNo; }).join(", ");
    var cap = function (s) { return s.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }).replace(/\bTo\b/, "to"); };
    return "Dear Sir / Madam,\n\nPlease find attached our invoice" + (G.length > 1 ? "s " : " ") + nos + " dated " + day(r.invoiceDate) + " for the maintenance of elevators (AMC) for the " +
      (t.one ? "month" : "months") + " of " + cap(t.t) + ", amount Rs " + money(amt) + "." + (r.dueDate ? "\n\nKindly arrange the payment by " + day(r.dueDate) + "." : "") +
      "\n\nRegards,\nCustomer Support\n" + coName(r.entity) +
      "\n\n---\nThis is a system-generated e-mail. Please do not reply to this e-mail.";
  }

  // the invoice PDF as a Blob: the app's own PDF builder, with its download step caught instead of saving a file
  async function pdfOf(r) {
    var got = null, keep = dlSave;
    dlSave = async function (name, data) { got = { name: name, data: data }; return false; }; // eslint-disable-line no-global-assign
    try { await ivPdf(r, true); } finally { dlSave = keep; } // eslint-disable-line no-global-assign
    if (!got || !(got.data instanceof Blob)) throw new Error("The invoice PDF could not be made (check the internet connection and try again).");
    return got;
  }

  async function send(row) {
    var r = row.r, f = await pdfOf(B().printable(r)), fd = new FormData();
    fd.append("csrf", C.csrf || ""); fd.append("rid", r.id); fd.append("to", row.to); fd.append("subject", row.subject); fd.append("body", row.body);
    fd.append("from_name", "Customer Support - " + coName(r.entity)); fd.append("file", f.data, f.name || ("Invoice " + r.invoiceNo + ".pdf"));
    var res = await fetch(API, { method: "POST", body: fd, credentials: "same-origin" });
    var d = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(d.error || "Not sent");
    var stamp = { to: (d.to || [row.to]).join(", "), at: d.at || new Date().toISOString(), by: safe(function () { return C.name; }, "") || "" };
    for (var i = 0; i < row.G.length; i++) {
      try { var x = JSON.parse(JSON.stringify(row.G[i])); x.doc = x.doc || {}; x.doc.mailed = (x.doc.mailed || []).concat([stamp]).slice(-10); await Store.save("receivables", x); } catch (e) { /* the e-mail went; only the note failed */ }
    }
    return d;
  }

  function open(ids) {
    var seen = {}, rows = [];
    ids.map(function (id) { return B().find(id); }).filter(Boolean).forEach(function (r) {
      var G = group(r).sort(function (a, b) { return String(a.invoiceNo).localeCompare(String(b.invoiceNo)); }), k = r.amcGroup || r.id; if (seen[k]) return; seen[k] = 1;
      var p = proj(G[0]) || {};
      rows.push({ r: G[0], G: G, p: p, to: String(p.custEmail || "").trim(), subject: subject(G[0]), body: message(G[0], G) });
    });
    if (!rows.length) return;
    var old = document.getElementById("fsAmPick"); if (old) old.remove();
    var one = rows.length === 1, w = document.createElement("div"); w.id = "fsAmPick"; w.className = "fs-pk";
    w.innerHTML = "<div class=\"fs-pk-b fs-am\" role=\"dialog\" aria-modal=\"true\"><h3>E-mail " + rows.length + " invoice" + (one ? "" : "s") + "</h3>" +
      "<p class=\"muted\">Sent from the customer support address with the invoice PDF attached (on its letterhead). A copy goes to that mailbox.</p>" +
      rows.map(function (x, i) {
        return "<div class=\"fs-am-r\" data-i=\"" + i + "\"><div class=\"fs-am-h\"><b class=\"mono\">" + h(x.G.map(function (g) { return g.invoiceNo; }).join(", ")) + "</b> · " + h(x.p.name || x.r.customer || "") + " · Rs " + h(money(x.G.reduce(function (a, g) { return a + (+g.amount || 0); }, 0))) + "</div>" +
          "<label>To <input type=\"text\" class=\"fs-am-to\" value=\"" + h(x.to) + "\" placeholder=\"name@company.com\"></label>" +
          (x.to ? "" : "<small class=\"err\">No invoice e-mail on this AMC yet. Type one here, and add it to the project so next time it fills in.</small>") +
          "<label>Subject <input type=\"text\" class=\"fs-am-su\" value=\"" + h(x.subject) + "\"></label>" +
          (one ? "<label>Message <textarea class=\"fs-am-bo\" rows=\"9\">" + h(x.body) + "</textarea></label>" : "") +
          "<div class=\"fs-am-st muted\"></div></div>";
      }).join("") +
      "<div class=\"actions\"><button type=\"button\" class=\"btn pri\" data-amgo=\"1\">✉ Send</button> <button type=\"button\" class=\"btn\" data-amno=\"1\">Close</button></div></div>";
    document.body.appendChild(w);
    w.addEventListener("click", async function (e) {
      if (e.target === w || e.target.closest("[data-amno]")) { w.remove(); return; }
      var go = e.target.closest("[data-amgo]"); if (!go || go.disabled) return;
      go.disabled = true; var ok = 0, bad = 0;
      for (var i = 0; i < rows.length; i++) {
        var el = w.querySelector(".fs-am-r[data-i=\"" + i + "\"]"), st = el.querySelector(".fs-am-st");
        if (el.getAttribute("data-done")) continue;
        rows[i].to = el.querySelector(".fs-am-to").value.trim(); rows[i].subject = el.querySelector(".fs-am-su").value.trim();
        var bo = el.querySelector(".fs-am-bo"); if (bo) rows[i].body = bo.value;
        if (!rows[i].to) { st.className = "fs-am-st err"; st.textContent = "Type an e-mail address."; bad++; continue; }
        st.className = "fs-am-st muted"; st.textContent = "Making the PDF and sending…";
        try { var d = await send(rows[i]); st.className = "fs-am-st fs-am-ok"; st.textContent = "✓ Sent to " + (d.to || [rows[i].to]).join(", ") + "."; el.setAttribute("data-done", "1"); ok++; }
        catch (x) { st.className = "fs-am-st err"; st.textContent = (x && x.message) || "Not sent."; bad++; }
      }
      go.disabled = false; if (!bad) go.textContent = "Sent";
      safe(function () { toast(ok + " invoice e-mail" + (ok === 1 ? "" : "s") + " sent" + (bad ? ", " + bad + " not sent (see the window)" : "") + "."); }, null);
      if (!bad) setTimeout(function () { w.remove(); }, 1500);
    });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-abmail],[data-abmailt]"); if (!b || !B()) return;
    e.preventDefault(); e.stopPropagation();
    if (b.hasAttribute("data-abmail")) { open([b.getAttribute("data-abmail")]); return; }
    var box = b.closest(".card") || document, ids = [].map.call(box.querySelectorAll(".fsAbCk:checked"), function (c) { return c.value; });
    if (!ids.length) { safe(function () { toast("Tick the invoices to e-mail first."); }, null); return; }
    open(ids);
  }, true);

  // under each Email button: when it was last sent and to whom
  function marks() {
    if (!B()) return;
    document.querySelectorAll("[data-abmail]:not([data-ammk])").forEach(function (b) {
      b.setAttribute("data-ammk", "1");
      var r = B().find(b.getAttribute("data-abmail")), m = r && r.doc && r.doc.mailed; if (!m || !m.length) return;
      var l = m[m.length - 1], s = document.createElement("small"); s.className = "fs-am-mk";
      s.textContent = "✉ Sent " + day(String(l.at).slice(0, 10)); s.title = "Last e-mailed to " + l.to + (l.by ? " by " + l.by : "") + " (" + m.length + " time" + (m.length === 1 ? "" : "s") + ")";
      b.textContent = "✉ Email again"; b.parentNode.appendChild(s);
    });
  }
  (function watch() { if (!document.body) { setTimeout(watch, 300); return; } new MutationObserver(function () { marks(); }).observe(document.body, { childList: true, subtree: true }); marks(); })();

  var css = document.createElement("style");
  css.textContent = ".fs-am{max-width:640px;width:100%;max-height:88vh;overflow:auto}.fs-am-r{border-top:1px solid #e3e8ee;padding:10px 0;display:flex;flex-direction:column;gap:6px}" +
    ".fs-am-r label{display:flex;flex-direction:column;gap:3px;font-size:12.5px}.fs-am-r input,.fs-am-r textarea{font:inherit;padding:6px 8px;border:1px solid #cfd8e3;border-radius:6px}" +
    ".fs-am-ok{color:#2e7d32;font-weight:600}.fs-am-mk{display:block;font-size:11px;color:#2e7d32;margin-top:2px}";
  (document.head || document.documentElement).appendChild(css);
})();
