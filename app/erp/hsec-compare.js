// Comparative statement on purchase requisitions (hassan, 2026-11-03: "need comparative statement of minimum 3 vendors
// are required"). On a saved requisition, procurement enters each vendor's quotation against the requisition's items
// (unit prices, tax, delivery, payment terms, validity), the sheet works out totals, marks the lowest, and a vendor is
// recommended (a reason is required when it is not the lowest). "Raise purchase order" stays blocked until at least three
// quotations are entered and a vendor is chosen, unless a single / limited-source reason is recorded. The PO then opens
// with that vendor and amount. Stored on the requisition (requisition.cs), so it is kept, backed up and printed with it.
// Each vendor's quotation also prints as its own "Quotation" page (hassan's sample: vendor heading, M/S company,
// quotation no., dates, indent no., items, total, delivery / payment / place / validity / carriage / installation /
// freight, the vendor's scanned quotation, "For <vendor>" and its e-mail and address), after the comparative statement.
// The vendor's scanned quotation is attached to the requisition's supporting documents, named "<vendor> – <file>".
(function () {
  /* global ONLY_V, approverName, approverFor, F, S, Store, esc, fmt, n, toast, openForm, closeForm, sheetOpen, todayStr, coLabel, fdate, readForm */
  var MIN = 3;
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var num = function (v) { return safe(function () { return n(String(v == null ? "" : v).replace(/,/g, "")); }, parseFloat(String(v || "").replace(/,/g, "")) || 0); };
  var money = function (v) { return safe(function () { return fmt(Math.round(v * 100) / 100); }, String(v)); };
  var say = function (m) { safe(function () { toast(m); }, null); };
  var prOf = function (id) { return safe(function () { return Store.data.requisitions.find(function (r) { return r.id === id; }); }, null); };

  function items(r) {
    var rows = Array.isArray(r.descriptionRows) ? r.descriptionRows.filter(function (x) { return x && (x.i || x.q || x.p); }) : [];
    if (!rows.length) rows = String(r.description || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) { return { i: s, q: 1 }; });
    return rows.map(function (x) { return { i: x.i || "", s: x.s || "", q: num(x.q) || 1, u: x.u || "" }; });
  }
  var PR = null; // the requisition, for its delivery / payment terms as each new vendor's starting terms
  function blankV() {
    var r = PR || {}, t = r.payTerms && r.payTerms !== "To be agreed" ? r.payTerms : "";
    return { name: "", ref: "", date: "", expiry: "", prices: [], tax: "", basis: "Cash", delivery: r.deliveryTime || "", terms: t, place: r.deliveryPlace || "",
      validity: r.validityDays ? r.validityDays + " days" : "", carriage: "", installation: r.installation || "", freight: r.freight || "", remarks: "" };
  }
  function cs0(r) {
    PR = r;
    var c = JSON.parse(JSON.stringify(r.cs || {}));
    c.v = Array.isArray(c.v) ? c.v : [];
    while (c.v.length < MIN) c.v.push(blankV());
    return c;
  }
  function totals(v, its) {
    var sub = its.reduce(function (s, it, i) { return s + it.q * num(v.prices && v.prices[i]); }, 0);
    var tax = sub * num(v.tax) / 100;
    return { sub: sub, tax: tax, tot: sub + tax, full: its.every(function (it, i) { return num(v.prices && v.prices[i]) > 0; }) };
  }
  // vendors come only from the vendor list (hassan, 2026-11-03: "make vendor listing mandatory and we can add vendor
  // as well by clicking the + button"); a blocked vendor cannot be chosen
  var key = function (x) { return String(x || "").trim().toLowerCase(); };
  function vendOf(name) { return safe(function () { return Store.data.vendors.find(function (x) { return key(x.name) && key(x.name) === key(name); }); }, null); }
  function vendList() { return safe(function () { return Store.data.vendors.filter(function (x) { return String(x.name || "").trim() && x.status !== "Blocked"; }).map(function (x) { return String(x.name).trim(); }).sort(function (a, b) { return a.localeCompare(b); }); }, []); }
  var listed = function (v) { var x = vendOf(v.name); return !!x && x.status !== "Blocked"; };
  // quotations that count: a listed vendor and a price for every item
  function counted(c, its) { return (c.v || []).filter(function (v) { return listed(v) && totals(v, its).full; }); }
  function state(r) {
    var c = r.cs || {}, its = items(r), q = counted(c, its), pick = c.pick != null && c.v && c.v[c.pick] && q.indexOf(c.v[c.pick]) >= 0;
    if (c.exempt && String(c.exemptWhy || "").trim() && q.length >= 1 && pick) return { ok: true, n: q.length, txt: q.length + " quotation" + (q.length === 1 ? "" : "s") + ", limited source" };
    if (q.length < MIN) return { ok: false, n: q.length, txt: q.length + " of " + MIN + " quotations" };
    if (!pick) return { ok: false, n: q.length, txt: q.length + " quotations, no vendor chosen" };
    return { ok: true, n: q.length, txt: q.length + " quotations, " + c.v[c.pick].name + " chosen" };
  }

  // ---- the vendors' scanned quotations: files on the requisition, named "<vendor> – <file>"
  var B = window.FS_BRIDGE || {}, API = (B.api || "/erp/m/hsec/api") + "/att";
  var fileUrl = function (f) { return API + "/file?id=" + f.id; };
  var FILES = [];
  function filesOf(v) { var nm = String(v && v.name || "").trim().toLowerCase(); return nm ? FILES.filter(function (f) { return String(f.name).toLowerCase().indexOf(nm + " – ") === 0; }) : []; }
  function loadFiles(id) {
    return fetch(API + "?keys=" + encodeURIComponent("requisitions/" + id), { credentials: "same-origin" }).then(function (r) { return r.json(); })
      .then(function (d) { FILES = (d && d.files) || []; }).catch(function () { FILES = []; });
  }
  function shrink(file) {
    if (!/^image\//.test(file.type) || /gif|svg/.test(file.type)) return Promise.resolve(file);
    return new Promise(function (ok) {
      var u = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u);
        cv.toBlob(function (b) { ok(b ? new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(u); ok(file); };
      img.src = u;
    });
  }
  async function attach(k, file) {
    readEd();
    var v = E.c.v[k], nm = String(v && v.name || "").trim(), err = document.getElementById("fsCsErr");
    if (!nm) { if (err) err.textContent = "Choose the vendor first, then attach its quotation."; return; }
    var f = await shrink(file);
    if (f.size > 2 * 1024 * 1024) { if (err) err.textContent = "That file is over 2 MB. Scan it at a lower resolution."; return; }
    var fd = new FormData(); fd.append("path", "requisitions/" + E.id); fd.append("name", nm + " – " + f.name); fd.append("file", f, f.name); fd.append("csrf", B.csrf || "");
    say("Uploading " + nm + "'s quotation…");
    try {
      var r = await fetch(API, { method: "POST", body: fd, credentials: "same-origin" }), d = await r.json();
      if (!r.ok) throw new Error(d.error || "Upload failed");
      await loadFiles(E.id); draw(); say("Attached to " + nm + ".");
    } catch (x) { if (err) err.textContent = x.message || "Upload failed."; }
  }

  // ---- the purchase flow: requisition approved → store vetting → 3 quotations → comparative approved → purchase order
  var STORE = [["none", "Not available in store – purchase needed"], ["part", "Partly available – purchase the balance"], ["all", "Available in store – issue from stock, no purchase"]];
  var me = function () { return safe(function () { return approverName(); }, "") || "ERP user"; };
  var when = function (x) { return x ? safe(function () { return new Date(x).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); }, x) : ""; };
  function stages(r) {
    var tot = safe(function () { var c = r.cs, v = c && c.pick != null && c.v[c.pick]; return v ? totals(v, items(r)).tot : n(r.estAmount); }, 0);
    var fin = safe(function () { return approverFor(tot); }, null) || "GM";
    return ["Checked by (Finance)", "Approved by (" + fin + ")"];
  }
  function apprOf(r, k) { var a = (r.cs && r.cs.appr) || []; return a[k] || null; }
  function flow(r) {
    var off = safe(function () { return ONLY_V(); }, false), st = state(r), S2 = stages(r), sv = r.store || null;
    var steps = [
      { t: "Requisition approved", ok: off || ["Approved", "PO issued", "Closed"].indexOf(r.status) >= 0, d: off ? "approvals off" : (r.status || "Draft") },
      { t: "Store vetting", ok: !!(sv && sv.res && sv.res !== "all"), d: sv ? (STORE.find(function (x) { return x[0] === sv.res; }) || [0, ""])[1] + (sv.by ? " · " + sv.by : "") : "not done", stop: sv && sv.res === "all" },
      { t: MIN + " quotations", ok: st.ok, d: st.txt },
      { t: "Comparative approved", ok: !!(apprOf(r, 0) && apprOf(r, 1)), d: S2.map(function (x, k) { var a = apprOf(r, k); return a ? x.replace(/^\w+ by/, "") + ": " + a.by : ""; }).filter(Boolean).join(" · ") || "waiting" },
      { t: "Purchase order", ok: safe(function () { return Store.data.pos.some(function (p) { return p.prRef === r.id; }); }, false), d: "" }
    ];
    return steps;
  }

  // ---- the editor
  var E = null; // {id, c, its}
  function lowest(c, its) {
    var best = -1, bt = Infinity;
    c.v.forEach(function (v, k) { var t = totals(v, its); if (listed(v) && t.full && t.tot < bt) { bt = t.tot; best = k; } });
    return best;
  }
  function editor() {
    var c = E.c, its = E.its, low = lowest(c, its), vendors = vendList();
    var cell = function (k, f, w, ph) { return "<input data-csv=\"" + k + "\" data-csf=\"" + f + "\" value=\"" + h(c.v[k][f] || "") + "\"" + (ph ? " placeholder=\"" + h(ph) + "\"" : "") + (w ? " style=\"width:" + w + "\"" : "") + ">"; };
    var head = "<tr><th style=\"min-width:220px\">Item</th><th class=\"num\">Qty</th>" + c.v.map(function (v, k) {
      return "<th class=\"fs-csv" + (k === low ? " low" : "") + "\">Vendor " + (k + 1) + (c.v.length > MIN ? " <button type=\"button\" class=\"btn sm\" data-csdel=\"" + k + "\" title=\"Remove this vendor\">×</button>" : "") +
        vSel(k, v, vendors) +
        "<div class=\"fs-cs2\">" + cell(k, "ref", "", "Quote ref") + "<input type=\"date\" data-csv=\"" + k + "\" data-csf=\"date\" value=\"" + h(v.date || "") + "\"></div></th>";
    }).join("") + "</tr>";
    var body = its.map(function (it, i) {
      var best = Infinity; c.v.forEach(function (v) { var p = num(v.prices && v.prices[i]); if (p > 0 && p < best) best = p; });
      return "<tr><td><b>" + h(it.i) + "</b>" + (it.s ? "<br><span class=\"muted\">" + h(it.s) + "</span>" : "") + "</td><td class=\"num\">" + h(it.q) + " " + h(it.u) + "</td>" +
        c.v.map(function (v, k) {
          var p = v.prices && v.prices[i], pv = num(p);
          return "<td class=\"fs-csv" + (k === low ? " low" : "") + (pv > 0 && pv === best ? " best" : "") + "\"><input class=\"num\" inputmode=\"decimal\" data-csv=\"" + k + "\" data-csp=\"" + i + "\" value=\"" + h(p == null ? "" : p) + "\" placeholder=\"Unit price\">" +
            "<small>" + (pv > 0 ? "= " + money(pv * it.q) : "") + "</small></td>";
        }).join("") + "</tr>";
    }).join("");
    var row = function (lbl, f, ph) { return "<tr><td colspan=\"2\"><b>" + lbl + "</b></td>" + c.v.map(function (v, k) { return "<td class=\"fs-csv" + (k === low ? " low" : "") + "\">" + cell(k, f, "", ph) + "</td>"; }).join("") + "</tr>"; };
    var calc = function (lbl, key, b) { return "<tr class=\"fs-cstot\"><td colspan=\"2\">" + (b ? "<b>" + lbl + "</b>" : lbl) + "</td>" + c.v.map(function (v, k) { var t = totals(v, its); return "<td class=\"num fs-csv" + (k === low ? " low" : "") + "\">" + (t[key] ? (b ? "<b>" + money(t[key]) + "</b>" : money(t[key])) : "") + "</td>"; }).join("") + "</tr>"; };
    var st = state(Object.assign({}, prOf(E.id) || {}, { cs: c }));
    return "<div class=\"overlay center\" id=\"fsCsOv\"><div class=\"fs-csbox\">" +
      "<div class=\"fs-cshead\"><div><h3 style=\"margin:0\">Comparative statement</h3><span class=\"muted\">" + h(E.title) + "</span></div><span style=\"flex:1\"></span>" +
      "<button class=\"btn\" id=\"fsCsAdd\" type=\"button\">+ Add vendor</button><button class=\"btn\" id=\"fsCsPrint\" type=\"button\">Save &amp; print</button><button class=\"btn pri\" id=\"fsCsSave\" type=\"button\">Save</button><button class=\"btn\" id=\"fsCsClose\" type=\"button\">Close</button></div>" +
      "<p class=\"muted\" style=\"margin:6px 0 10px\">Enter at least " + MIN + " vendors' quotations: the unit price for every item, then tax and terms. The lowest total is marked green. A purchase order can be raised only after " + MIN + " quotations and a chosen vendor.</p>" +
      "<div class=\"tw fs-cstw\"><table class=\"fs-cst\"><thead>" + head + "</thead><tbody>" + body + calc("Subtotal", "sub") +
      row("Tax %", "tax", "e.g. 18") + calc("Tax", "tax") + calc("Total (PKR)", "tot", 1) +
      "<tr><td colspan=\"2\"><b>Prices are</b></td>" + c.v.map(function (v, k) { return "<td class=\"fs-csv" + (k === low ? " low" : "") + "\"><select data-csv=\"" + k + "\" data-csf=\"basis\">" + ["Cash", "Credit"].map(function (o) { return "<option" + ((v.basis || "Cash") === o ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></td>"; }).join("") + "</tr>" +
      "<tr><td colspan=\"2\"><b>Quotation expiry</b></td>" + c.v.map(function (v, k) { return "<td class=\"fs-csv" + (k === low ? " low" : "") + "\"><input type=\"date\" data-csv=\"" + k + "\" data-csf=\"expiry\" value=\"" + h(v.expiry || "") + "\"></td>"; }).join("") + "</tr>" +
      row("Delivery time", "delivery", "e.g. 10 days") + row("Payment terms", "terms", "e.g. Full advance") + row("Delivery place", "place", "e.g. Ex-shop") + row("Validity", "validity", "e.g. 30 days") +
      row("Carriage", "carriage", "–") + row("Installation", "installation", "–") + row("Freight", "freight", "–") + row("Remarks", "remarks", "") +
      "<tr><td colspan=\"2\"><b>Vendor's quotation (scan / PDF)</b></td>" + c.v.map(function (v, k) {
        var fl = filesOf(v);
        return "<td class=\"fs-csv" + (k === low ? " low" : "") + "\">" + fl.map(function (f) { return "<a href=\"" + fileUrl(f) + "\" target=\"_blank\" rel=\"noopener\">" + h(f.name.replace(/^.*? – /, "")) + "</a>"; }).join("<br>") +
          "<label class=\"btn sm\" style=\"cursor:pointer;margin-top:4px\">Attach<input type=\"file\" data-csfile=\"" + k + "\" accept=\"image/*,.pdf,application/pdf\" hidden></label></td>";
      }).join("") + "</tr>" +
      "<tr><td colspan=\"2\"><b>Recommended</b></td>" + c.v.map(function (v, k) { return "<td class=\"fs-csv" + (k === low ? " low" : "") + "\"><label class=\"fs-cspick\"><input type=\"radio\" name=\"fsCsPick\" value=\"" + k + "\"" + (c.pick === k ? " checked" : "") + "> Choose" + (k === low ? " <span class=\"pill good\">Lowest</span>" : "") + "</label></td>"; }).join("") + "</tr>" +
      "</tbody></table></div>" +
      "<div class=\"fs-csfoot\"><label class=\"fs-csw\"><span>Reason for the choice" + (c.pick != null && c.pick !== low && low >= 0 ? " <b style=\"color:#b0412e\">(required: not the lowest)</b>" : "") + "</span><textarea id=\"fsCsWhy\" rows=\"2\">" + h(c.why || "") + "</textarea></label>" +
      "<label class=\"fs-csw\"><span><input type=\"checkbox\" id=\"fsCsEx\"" + (c.exempt ? " checked" : "") + "> Fewer than " + MIN + " quotations (single or limited source)</span><textarea id=\"fsCsExWhy\" rows=\"2\" placeholder=\"Why three quotations could not be obtained (sole agent, OEM spare, emergency …)\">" + h(c.exemptWhy || "") + "</textarea></label></div>" +
      "<p class=\"" + (st.ok ? "fs-csok" : "fs-csno") + "\">" + (st.ok ? "✓ " : "") + h(st.txt) + (st.ok ? ". A purchase order can be raised." : ". A purchase order cannot be raised yet.") + "</p>" +
      "<p class=\"err\" id=\"fsCsErr\"></p></div></div>";
  }
  function vSel(k, v, vendors) {
    var cur = String(v.name || "").trim(), x = cur && vendOf(cur), opts = vendors.slice();
    var bad = cur && (!x || x.status === "Blocked");
    if (x && !bad) cur = String(x.name).trim();
    return "<div class=\"fs-csvsel\"><select data-csv=\"" + k + "\" data-csf=\"name\"" + (bad ? " class=\"bad\"" : "") + "><option value=\"\">Choose vendor…</option>" +
      (bad ? "<option selected value=\"" + h(cur) + "\">" + h(cur) + (x ? " (blocked)" : " (not in vendor list)") + "</option>" : "") +
      opts.map(function (o) { return "<option" + (o === cur ? " selected" : "") + ">" + h(o) + "</option>"; }).join("") + "</select>" +
      "<button type=\"button\" class=\"btn sm fs-csplus\" data-csnew=\"" + k + "\" title=\"Add a new vendor to the vendor list\">+</button></div>" +
      (bad ? "<small class=\"fs-csbad\">" + (x ? "Blocked vendor: choose another." : "Pick from the list, or click + to add this vendor.") + "</small>" : "");
  }
  // ---- + : add a vendor to the vendor list from the comparative statement
  var NV = -1;
  function nvForm(k) {
    NV = k; var o = document.getElementById("fsCsNv"); if (o) o.remove();
    var f = function (id, l, ph, ta) { return "<label class=\"fs-csw\"><span>" + l + "</span>" + (ta ? "<textarea id=\"" + id + "\" rows=\"2\"></textarea>" : "<input id=\"" + id + "\"" + (ph ? " placeholder=\"" + h(ph) + "\"" : "") + ">") + "</label>"; };
    document.body.insertAdjacentHTML("beforeend", "<div class=\"overlay center\" id=\"fsCsNv\"><div class=\"fs-csbox fs-nvbox\"><h3 style=\"margin:0 0 4px\">Add vendor</h3>" +
      "<p class=\"muted\" style=\"margin:0 0 10px\">Saved to Purchasing › Vendors as \"Under review\". Complete its bank and tax details there later.</p>" +
      f("fsNvName", "Vendor name <b style=\"color:#b0412e\">*</b>", "As on the quotation") + f("fsNvContact", "Contact person") + f("fsNvPhone", "Phone") + f("fsNvEmail", "Email") +
      f("fsNvNtn", "NTN") + f("fsNvAddr", "Address", "", 1) +
      "<p class=\"err\" id=\"fsNvErr\"></p><div class=\"fs-csbtns\"><button class=\"btn pri\" type=\"button\" id=\"fsNvSave\">Save vendor</button><button class=\"btn\" type=\"button\" id=\"fsNvClose\">Cancel</button></div></div></div>");
    var n = document.getElementById("fsNvName"); if (n) n.focus();
  }
  async function nvSave() {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }, err = document.getElementById("fsNvErr");
    var name = g("fsNvName"); if (!name) { if (err) err.textContent = "Type the vendor's name."; return; }
    var ex = vendOf(name), btn = document.getElementById("fsNvSave");
    if (ex && ex.status === "Blocked") { if (err) err.textContent = "“" + ex.name + "” is in the vendor list but Blocked."; return; }
    if (!ex) {
      if (btn) btn.disabled = true;
      try { await Store.save("vendors", { name: name, contact: g("fsNvContact"), phone: g("fsNvPhone"), email: g("fsNvEmail"), ntn: g("fsNvNtn"), address: g("fsNvAddr"), filer: "Not checked", status: "Under review" }); }
      catch (x) { if (btn) btn.disabled = false; if (err) err.textContent = (x && x.message) || "Could not save the vendor."; return; }
      say("Vendor “" + name + "” added to the vendor list.");
    } else say("“" + ex.name + "” is already in the vendor list, so it was picked.");
    var o = document.getElementById("fsCsNv"); if (o) o.remove();
    if (E && E.c.v[NV]) { readEd(); E.c.v[NV].name = ex ? String(ex.name).trim() : name; draw(); }
  }
  function draw() { var o = document.getElementById("fsCsOv"), y = o ? (o.querySelector(".fs-cstw") || {}).scrollLeft : 0; if (o) o.remove(); document.body.insertAdjacentHTML("beforeend", editor()); var t = document.querySelector("#fsCsOv .fs-cstw"); if (t && y) t.scrollLeft = y; }
  function open(id) {
    var r = prOf(id); if (!r) return say("Save the requisition first.");
    var F5 = flow(r);
    if (!F5[0].ok) return say("Step 1 first: the requisition must be approved before quotations are taken.");
    if (!F5[1].ok) return say(F5[1].stop ? "The store has these items: issue them from stock, no quotations needed." : "Step 2 first: the store must check its stock before quotations are taken.");
    E = { id: id, c: cs0(r), its: items(r), title: (r.prNo || "Requisition") + " · " + safe(function () { return coLabel(r.entity); }, r.entity || "") + (r.dept ? " · " + r.dept : "") };
    if (!E.its.length) return say("Add the items needed to the requisition first.");
    FILES = []; draw(); loadFiles(id).then(function () { if (E && E.id === id) draw(); });
  }
  function readEd() {
    if (!E) return;
    document.querySelectorAll("#fsCsOv [data-csv]").forEach(function (el) {
      var v = E.c.v[+el.dataset.csv]; if (!v) return;
      if (el.dataset.csp !== undefined) { v.prices = v.prices || []; v.prices[+el.dataset.csp] = el.value.trim(); } else v[el.dataset.csf] = el.value;
    });
    var p = document.querySelector("#fsCsOv input[name=fsCsPick]:checked"); E.c.pick = p ? +p.value : null;
    var w = document.getElementById("fsCsWhy"); if (w) E.c.why = w.value;
    var x = document.getElementById("fsCsEx"); if (x) E.c.exempt = x.checked;
    var xw = document.getElementById("fsCsExWhy"); if (xw) E.c.exemptWhy = xw.value;
  }
  function clean(c) {
    var out = { by: c.by || me(), v: c.v.filter(function (v, k) { return k < MIN || String(v.name || "").trim() || (v.prices || []).some(function (p) { return num(p) > 0; }); }), pick: c.pick, why: c.why || "", exempt: !!c.exempt, exemptWhy: c.exemptWhy || "", at: new Date().toISOString() };
    if (out.pick != null && out.pick >= out.v.length) out.pick = null;
    return out;
  }
  async function save(print) {
    readEd();
    var r = prOf(E.id); if (!r) return;
    var low = lowest(E.c, E.its), err = document.getElementById("fsCsErr");
    if (E.c.pick != null && low >= 0 && E.c.pick !== low && !String(E.c.why || "").trim()) { if (err) err.textContent = "Give the reason for not choosing the lowest quotation."; return; }
    var bad = E.c.v.filter(function (v) { return String(v.name || "").trim() && !listed(v); });
    if (bad.length) { if (err) err.textContent = "Not in the vendor list (or blocked): " + bad.map(function (v) { return v.name; }).join(", ") + ". Choose from the list or click + to add the vendor."; return; }
    var nm = E.c.v.map(function (v) { return key(v.name); }).filter(Boolean);
    if (nm.some(function (x, i) { return nm.indexOf(x) !== i; })) { if (err) err.textContent = "The same vendor is entered twice. Each column must be a different vendor."; return; }
    if (E.c.exempt && !String(E.c.exemptWhy || "").trim()) { if (err) err.textContent = "Give the reason fewer than " + MIN + " quotations were obtained."; return; }
    var c = clean(E.c), prev = r.cs || {}, sig = function (x) { return JSON.stringify([(x.v || []).map(function (v) { return [v.name, v.prices, v.tax]; }), x.pick, !!x.exempt]); };
    c.appr = sig(clean(cs0(r))) === sig(c) ? (prev.appr || []) : [];
    if ((prev.appr || []).length && !c.appr.length) say("The quotations or the choice changed, so the comparative statement needs approving again.");
    try {
      await Store.save("requisitions", Object.assign({}, r, { cs: c }));
      var fresh = prOf(E.id); if (fresh) fresh.cs = c;
      if (typeof F !== "undefined" && F && F.c === "requisitions" && F.rec && F.rec.id === E.id) F.rec.cs = c;
      E.c = cs0({ cs: c });
      say("Comparative statement saved: " + state(Object.assign({}, r, { cs: c })).txt + ".");
      draw(); refreshBox(true);
      if (print) printCs(Object.assign({}, r, { cs: c }));
    } catch (x) { if (err) err.textContent = (x && x.message) || "Could not save."; }
  }

  // ---- print
  // one vendor's quotation, laid out like the sample hassan sent
  function qPage(r, v, k, its) {
    var vend = vendOf(v.name) || {};
    var t = totals(v, its), fd = function (d) { return d ? safe(function () { return fdate(d); }, d) : ""; }, dash = function (x) { return String(x || "").trim() ? h(x) : "–"; };
    var qno = (r.prNo || "PR") + "/Q" + (k + 1), legal = safe(function () { return coLabel(r.entity); }, r.entity || "");
    var fl = filesOf(v), pics = fl.filter(function (f) { return /^image\//.test(f.mime); });
    return "<section class=\"fs-qpage\"><div class=\"fs-qtop\"><div class=\"fs-qco\">" + h(String(v.name).toUpperCase()) + "</div><div class=\"fs-qr\"><b>" + h(v.name) + "</b><br>Date: " + h(fd(v.date) || "–") + "<br>Ref No: " + h(v.ref || qno) + "</div></div>" +
      "<h2 class=\"fs-qh\">Quotation</h2><p>M/S: " + h(legal) + "</p><p class=\"fs-qc\"><b>Quotation No.:</b> " + h(qno) + "</p>" +
      "<div class=\"fs-qrow\"><span><b>Quotation Date:</b> " + h(fd(v.date) || "–") + "</span><span><b>Expiry Date:</b> " + h(fd(v.expiry) || "__________") + "</span><span><b>Indent No.:</b> " + h(r.prNo || "") + "</span></div>" +
      "<div class=\"fs-qrow\"><span><b>Vendor:</b> " + h(String(v.name).toUpperCase()) + "</span><span><b>Department:</b> " + h(String(r.dept || "").toUpperCase()) + "</span></div>" +
      "<table class=\"fs-qt\"><thead><tr><th style=\"width:40px\">S/No</th><th>Items Description</th><th style=\"width:60px\">Qty.</th><th style=\"width:90px\">Unit Rate</th><th style=\"width:100px\">Total Amount</th></tr></thead><tbody>" +
      its.map(function (it, i) { var p = num(v.prices && v.prices[i]); return "<tr><td>" + (i + 1) + "</td><td>" + h(it.i) + (it.s ? " (" + h(it.s) + ")" : "") + "</td><td class=\"c\">" + h(it.q) + (it.u ? " " + h(it.u) : "") + "</td><td class=\"num\">" + (p ? money(p) : "–") + "</td><td class=\"num\">" + (p ? money(p * it.q) : "–") + "</td></tr>"; }).join("") +
      (t.tax ? "<tr><td colspan=\"3\" class=\"c\">Sub total</td><td></td><td class=\"num\">" + money(t.sub) + "</td></tr><tr><td colspan=\"3\" class=\"c\">Tax " + h(v.tax) + "%</td><td></td><td class=\"num\">" + money(t.tax) + "</td></tr>" : "") +
      "<tr class=\"tot\"><td colspan=\"3\" class=\"c\"><b>Total Amount</b></td><td></td><td class=\"num\"><b>" + money(t.tot) + "</b></td></tr></tbody></table>" +
      "<p>Above prices are " + h(String(v.basis || "Cash").toUpperCase()) + "</p><table class=\"fs-qk\">" +
      [["Delivery", v.delivery], ["Payment", v.terms], ["Delivery Place", v.place], ["Validity", v.validity], ["Carriage", v.carriage], ["Installation", v.installation], ["Freight", v.freight]].concat(v.remarks ? [["Remarks", v.remarks]] : [])
        .map(function (x) { return "<tr><td>" + x[0] + ":</td><td>" + dash(x[1]) + "</td></tr>"; }).join("") + "</table>" +
      "<p><b>Attachments:</b> " + (fl.length ? fl.map(function (f) { return h(f.name.replace(/^.*? – /, "")); }).join(", ") : "–") + "</p>" +
      pics.map(function (f) { return "<img class=\"fs-qscan\" src=\"" + fileUrl(f) + "\" alt=\"" + h(f.name) + "\">"; }).join("") +
      "<p>For further information, please feel free to contact us.</p><p>With regards,<br><b>For " + h(v.name) + "</b>" + (vend.email ? "<br><span class=\"fs-qmail\">Email: " + h(vend.email) + "</span>" : "") + "</p>" +
      ((vend.address || vend.phone) ? "<div class=\"fs-qfoot\">" + h([String(vend.address || "").replace(/\s*\n\s*/g, ", "), vend.phone ? "Cell: " + vend.phone : ""].filter(Boolean).join(" ")) + "</div>" : "") + "</section>";
  }
  async function printCs(r) {
    await loadFiles(r.id);
    var c = r.cs || {}, its = items(r), V = (c.v || []).filter(function (v) { return String(v.name || "").trim(); }), low = -1, bt = Infinity;
    V.forEach(function (v, k) { var t = totals(v, its); if (t.full && t.tot < bt) { bt = t.tot; low = k; } });
    var pick = c.pick != null && c.v[c.pick] ? c.v[c.pick] : null;
    var lh = safe(function () { return window.FS_QTPL && window.FS_QTPL.company(r.entity); }, null);
    var co = safe(function () { return coLabel(r.entity); }, r.entity || "");
    var td = function (v, k, x, cls) { return "<td class=\"" + (cls || "") + (k === low ? " low" : "") + "\">" + x + "</td>"; };
    var html = "<div class=\"sheetwrap\"><div class=\"sheet fs-cssheet\"><div class=\"bar\"><button class=\"btn pri\" id=\"printSheet\">Print</button><button class=\"btn\" id=\"closeSheet\">Close</button></div>" +
      (lh ? "<img src=\"" + lh.head + "\" alt=\"\" style=\"width:100%;height:auto;display:block;margin-bottom:8px\">" : "<div class=\"co\" style=\"text-align:center;font-weight:700;font-size:15px\">" + h(co) + "</div>") +
      "<h2 style=\"text-align:center;margin:6px 0 2px;letter-spacing:.04em\">COMPARATIVE STATEMENT</h2>" +
      "<p style=\"text-align:center;margin:0 0 10px\">" + h(r.prNo || "") + (r.date ? " · " + h(safe(function () { return fdate(r.date); }, r.date)) : "") + (r.dept ? " · " + h(r.dept) : "") + (r.requestedBy ? " · Requested by " + h(r.requestedBy) : "") + (r.project ? " · " + h(r.project) : "") + "</p>" +
      "<table class=\"fs-csp\"><thead><tr><th>#</th><th>Item</th><th>Qty</th>" + V.map(function (v, k) { return "<th colspan=\"2\" class=\"" + (k === low ? "low" : "") + "\">" + h(v.name) + (v.ref || v.date ? "<br><small>" + h([v.ref, v.date ? safe(function () { return fdate(v.date); }, v.date) : ""].filter(Boolean).join(" · ")) + "</small>" : "") + "</th>"; }).join("") + "</tr>" +
      "<tr><th></th><th></th><th></th>" + V.map(function (v, k) { return "<th class=\"" + (k === low ? "low" : "") + "\">Rate</th><th class=\"" + (k === low ? "low" : "") + "\">Amount</th>"; }).join("") + "</tr></thead><tbody>" +
      its.map(function (it, i) {
        return "<tr><td>" + (i + 1) + "</td><td>" + h(it.i) + (it.s ? "<br><small>" + h(it.s) + "</small>" : "") + "</td><td>" + h(it.q) + " " + h(it.u) + "</td>" +
          V.map(function (v, k) { var p = num(v.prices && v.prices[i]); return td(v, k, p ? money(p) : "–", "num") + td(v, k, p ? money(p * it.q) : "–", "num"); }).join("") + "</tr>";
      }).join("") +
      [["Subtotal", "sub"], ["Tax", "tax"], ["Total (PKR)", "tot"]].map(function (x) { return "<tr class=\"tot\"><td colspan=\"3\">" + x[0] + (x[1] === "tax" ? "" : "") + "</td>" + V.map(function (v, k) { var t = totals(v, its); return "<td colspan=\"2\" class=\"num" + (k === low ? " low" : "") + "\">" + (x[1] === "tax" && v.tax ? "<small>" + h(v.tax) + "% </small>" : "") + (x[1] === "tot" ? "<b>" + money(t.tot) + "</b>" : money(t[x[1]])) + "</td>"; }).join("") + "</tr>"; }).join("") +
      [["Delivery time", "delivery"], ["Payment terms", "terms"], ["Delivery place", "place"], ["Validity", "validity"], ["Carriage", "carriage"], ["Installation", "installation"], ["Freight", "freight"], ["Remarks", "remarks"]].map(function (x) { return "<tr><td colspan=\"3\">" + x[0] + "</td>" + V.map(function (v, k) { return "<td colspan=\"2\" class=\"" + (k === low ? "low" : "") + "\">" + h(v[x[1]] || "–") + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</tbody></table>" +
      "<p><b>Lowest total:</b> " + (low >= 0 ? h(V[low].name) + " (Rs " + money(bt) + ")" : "–") + "</p>" +
      "<p><b>Recommended vendor:</b> " + (pick ? h(pick.name) + " (Rs " + money(totals(pick, its).tot) + ")" : "Not chosen yet") + "</p>" +
      (c.why ? "<p><b>Reason:</b> " + h(c.why) + "</p>" : "") +
      (c.exempt ? "<p><b>Fewer than " + MIN + " quotations:</b> " + h(c.exemptWhy || "") + "</p>" : "") +
      (r.store ? "<p><b>Store vetting:</b> " + h((STORE.find(function (x) { return x[0] === r.store.res; }) || [0, ""])[1]) + (r.store.remark ? " · Remark: " + h(r.store.remark) : "") + (r.store.by ? " · By " + h(r.store.by) + ", " + h(when(r.store.at)) : "") + "</p>" : "") +
      "<table class=\"fs-cssign\"><tr>" + [["Prepared by (Procurement)", c.by ? { by: c.by, at: c.at } : null]].concat(stages(r).map(function (x, k) { return [x, apprOf(r, k)]; })).map(function (x) {
        return "<td>" + (x[1] ? "<div class=\"fs-signed\">" + h(x[1].by) + "<br><small>" + h(when(x[1].at)) + "</small></div>" : "<div style=\"height:26px\"></div>") + "<div class=\"ln\"></div>" + h(x[0]) + "<br><small>Name, signature &amp; date</small></td>"; }).join("") + "</tr></table>" +
      (lh && lh.foot ? "<img src=\"" + lh.foot + "\" alt=\"\" style=\"width:100%;height:auto;display:block;margin-top:14px\">" : "") +
      V.map(function (v) { return qPage(r, v, c.v.indexOf(v), its); }).join("") +
      "</div></div>";
    safe(function () { sheetOpen(html); }, null);
  }

  async function saveStore(id) {
    var r = prOf(id); if (!r) return;
    var res = (document.getElementById("fsSvRes") || {}).value || "", rem = (document.getElementById("fsSvRem") || {}).value || "";
    if (!res) return say("Choose what the store found.");
    if (!flow(r)[0].ok) return say("Step 1 first: the requisition must be approved.");
    var sv = { res: res, remark: rem.trim(), by: me(), at: new Date().toISOString() };
    try { await Store.save("requisitions", Object.assign({}, r, { store: sv })); var f = prOf(id); if (f) f.store = sv; if (F && F.rec && F.rec.id === id) F.rec.store = sv; say("Store check saved."); refreshBox(true); }
    catch (x) { say((x && x.message) || "Could not save the store check."); }
  }
  async function approve(id, k) {
    var r = prOf(id); if (!r || !r.cs) return;
    if (!state(r).ok) return say("Complete the quotations first.");
    if (k === 1 && !apprOf(r, 0)) return say("Finance checks it first.");
    var S2 = stages(r);
    if (!window.confirm(S2[k] + ": approve the comparative statement, choosing " + r.cs.v[r.cs.pick].name + "?")) return;
    var cs = JSON.parse(JSON.stringify(r.cs)); cs.appr = (cs.appr || []).slice(0, k); cs.appr[k] = { stage: S2[k], by: me(), at: new Date().toISOString() };
    try { await Store.save("requisitions", Object.assign({}, r, { cs: cs })); var f = prOf(id); if (f) f.cs = cs; if (F && F.rec && F.rec.id === id) F.rec.cs = cs; say("Approved: " + S2[k] + "."); refreshBox(true); }
    catch (x) { say((x && x.message) || "Could not approve."); }
  }

  // ---- on the requisition form: status box and button; Raise purchase order waits for the comparative
  function boxHtml(r) {
    var F5 = flow(r), S2 = stages(r), sv = r.store || {}, st = state(r), at = F5.findIndex(function (x) { return !x.ok; });
    var step = function (x, k) { return "<li class=\"" + (x.ok ? "ok" : x.stop ? "stop" : k === at ? "now" : "") + "\"><i>" + (x.ok ? "✓" : k + 1) + "</i><b>" + h(x.t) + "</b><small>" + h(x.d) + "</small></li>"; };
    var apr = "";
    if (st.ok && !F5[3].ok) {
      var k = apprOf(r, 0) ? 1 : 0;
      apr = "<button type=\"button\" class=\"btn sm pri\" data-csappr=\"" + h(r.id) + "\" data-k=\"" + k + "\">Approve comparative: " + h(S2[k]) + "</button>";
    }
    // one step at a time: only the current step can be worked on; earlier steps show what was recorded
    var svForm = "<div class=\"fs-sv\"><b>Store vetting</b><select id=\"fsSvRes\"><option value=\"\">What did the store find?</option>" + STORE.map(function (x) { return "<option value=\"" + x[0] + "\"" + (sv.res === x[0] ? " selected" : "") + ">" + h(x[1]) + "</option>"; }).join("") + "</select>" +
      "<input id=\"fsSvRem\" placeholder=\"Remark, e.g. Not available in store\" value=\"" + h(sv.remark || "") + "\"><button type=\"button\" class=\"btn sm pri\" data-svsave=\"" + h(r.id) + "\">Save store check and continue</button></div>";
    var printB = r.cs && counted(r.cs, items(r)).length ? "<button type=\"button\" class=\"btn sm\" data-csprint=\"" + h(r.id) + "\">Print comparative + quotations</button>" : "";
    var act = "";
    if (at === 0) act = "<p class=\"fs-csnext\">Next: the requisition must be submitted and approved under the authority matrix. Store vetting opens after that.</p>";
    else if (F5[1].stop) act = svForm + "<p class=\"fs-csno\">The store has the items: issue them from stock. No purchase order is needed. Change the store check if that is wrong.</p>";
    else if (at === 1) act = "<p class=\"fs-csnext\">Next: the store checks its stock.</p>" + svForm;
    else if (at === 2) act = "<p class=\"fs-csnext\">Next: collect at least " + MIN + " vendors' quotations, compare them and choose a vendor.</p>" +
      "<div class=\"fs-csbtns\"><button type=\"button\" class=\"btn sm pri\" data-csopen=\"" + h(r.id) + "\">Enter quotations &amp; compare</button>" + printB + "</div>";
    else if (at === 3) act = "<p class=\"fs-csnext\">Next: approve the comparative statement (" + h(S2.join(", then ")) + ").</p><div class=\"fs-csbtns\">" + apr +
      "<button type=\"button\" class=\"btn sm\" data-csopen=\"" + h(r.id) + "\">View / change quotations</button>" + printB + "</div>";
    else if (at === 4) act = "<p class=\"fs-csnext\">Next: click <b>Raise purchase order</b>. It opens with " + h(r.cs.v[r.cs.pick].name) + " and the approved amount.</p><div class=\"fs-csbtns\">" + printB + "</div>";
    else act = "<div class=\"fs-csbtns\">" + printB + "</div>";
    return "<div id=\"fsCsBox\" class=\"f w fs-csbox2\"><b>Purchase flow</b><ol class=\"fs-flow\">" + F5.map(step).join("") + "</ol>" + act + "</div>";
  }
  function refreshBox(force) {
    if (typeof F === "undefined" || !F || F.c !== "requisitions" || !F.rec || !F.rec.id) return;
    var r = prOf(F.rec.id) || F.rec, cur = document.getElementById("fsCsBox"), html = boxHtml(r);
    if (cur && !force) return;
    var at = document.querySelector("#frm .grid74") || document.querySelector("#frm .f.w"); if (!at) return;
    if (cur) cur.remove();
    at.insertAdjacentHTML("afterend", html);
  }
  new MutationObserver(function () { if (!document.getElementById("fsCsBox")) safe(refreshBox, null); }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-svsave], [data-csappr], [data-csopen], [data-csprint], #fsCsAdd, #fsCsSave, #fsCsPrint, #fsCsClose, [data-csdel], #mkPO, [data-cslist], [data-csnew], #fsNvSave, #fsNvClose");
    if (!t) return;
    if (t.id === "mkPO") {
      if (typeof F === "undefined" || !F || F.c !== "requisitions" || !F.rec) return;
      var r = prOf(F.rec.id) || F.rec, st = state(r);
      e.preventDefault(); e.stopImmediatePropagation();
      var F5 = flow(r), miss = F5.slice(1, 4).filter(function (x) { return !x.ok; });
      if (F5[1].stop) return say("Purchase order blocked: the store has these items. Issue them from stock.");
      if (miss.length) { say("Purchase order blocked. Still to do: " + miss.map(function (x) { return x.t + " (" + x.d + ")"; }).join("; ") + "."); return F5[1].ok && !st.ok ? open(r.id) : null; }
      var c = r.cs, v = c.v[c.pick], its = items(r), tot = Math.round(totals(v, its).tot * 100) / 100;
      var vend = vendOf(v.name);
      closeForm();
      openForm("pos", null, { date: todayStr(), entity: r.entity, prRef: r.id, vendor: vend ? vend.id : "", description: r.description, amount: tot, status: "Open", currency: "PKR", _fromPR: r.id });
      if (!vend) say("“" + v.name + "” is not in the vendor list yet. Add the vendor, then pick it on this PO.");
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    if (t.hasAttribute("data-cslist")) { var lr = prOf(t.getAttribute("data-cslist")); return lr && flow(lr)[1].ok ? open(lr.id) : safe(function () { openForm("requisitions", lr.id); }, null); }
    if (t.hasAttribute("data-svsave")) return saveStore(t.getAttribute("data-svsave"));
    if (t.hasAttribute("data-csappr")) return approve(t.getAttribute("data-csappr"), +t.getAttribute("data-k"));
    if (t.hasAttribute("data-csopen")) return open(t.getAttribute("data-csopen"));
    if (t.hasAttribute("data-csprint")) { var pr = prOf(t.getAttribute("data-csprint")); return pr && printCs(pr); }
    if (t.hasAttribute("data-csnew")) return nvForm(+t.getAttribute("data-csnew"));
    if (t.id === "fsNvSave") return nvSave();
    if (t.id === "fsNvClose") { var nv = document.getElementById("fsCsNv"); if (nv) nv.remove(); return; }
    if (t.id === "fsCsClose") { var o = document.getElementById("fsCsOv"); if (o) o.remove(); E = null; return; }
    if (t.id === "fsCsAdd") { readEd(); E.c.v.push(blankV()); return draw(); }
    if (t.hasAttribute("data-csdel")) { readEd(); var k = +t.getAttribute("data-csdel"); E.c.v.splice(k, 1); if (E.c.pick === k) E.c.pick = null; else if (E.c.pick > k) E.c.pick--; return draw(); }
    if (t.id === "fsCsSave") return save(false);
    if (t.id === "fsCsPrint") return save(true);
  }, true);
  // live totals while typing
  var tm = 0;
  document.addEventListener("input", function (e) {
    if (!E || !e.target.closest || !e.target.closest("#fsCsOv") || e.target.tagName === "TEXTAREA") return;
    clearTimeout(tm); tm = setTimeout(function () { var a = document.activeElement, sel = a && a.dataset ? [a.dataset.csv, a.dataset.csf, a.dataset.csp] : null; readEd(); draw();
      if (sel) { var q = "#fsCsOv [data-csv=\"" + sel[0] + "\"]" + (sel[2] !== undefined ? "[data-csp=\"" + sel[2] + "\"]" : "[data-csf=\"" + sel[1] + "\"]"); var el = document.querySelector(q); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (x) { /* date inputs */ } } } }, 700);
  });
  document.addEventListener("change", function (e) { if (E && e.target.dataset && e.target.dataset.csfile !== undefined && e.target.files && e.target.files[0]) attach(+e.target.dataset.csfile, e.target.files[0]); });
  document.addEventListener("change", function (e) { if (E && e.target.closest && e.target.closest("#fsCsOv") && (e.target.name === "fsCsPick" || e.target.id === "fsCsEx" || e.target.dataset.csf === "name")) { readEd(); draw(); } });

  function hook() {
    if (typeof S === "undefined" || !S.requisitions || typeof Store === "undefined" || !Store.data) return false;
    var cols = S.requisitions.cols;
    if (Array.isArray(cols) && !cols.some(function (c) { return c[0] === "cs"; })) {
      var at = cols.findIndex(function (c) { return c[0] === "status"; });
      cols.splice(at < 0 ? cols.length : at, 0, ["cs", "Quotations", function (r) { var st = state(r); var F5 = flow(r), nx = F5.find(function (x) { return !x.ok; }); return "<button type=\"button\" class=\"btn sm" + (st.ok ? "" : " warn") + "\" data-cslist=\"" + h(r.id) + "\" title=\"" + h(nx ? "Next: " + nx.t : "Done") + "\">" + h(st.ok ? "✓ " + st.n : st.n + " of " + MIN) + "</button>" + (nx ? "<br><small class=\"muted\">Next: " + h(nx.t) + "</small>" : ""); }]);
    }
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-csbox{background:var(--panel,#fff);border-radius:12px;padding:16px 18px;width:min(1200px,96vw);max-height:92vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.25)}" +
    ".fs-cshead{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.fs-cstw{overflow:auto}.fs-cst{border-collapse:collapse;width:100%;font-size:12.5px}" +
    ".fs-cst th,.fs-cst td{border-bottom:1px solid #e3e8ee;padding:5px 6px;vertical-align:top;text-align:left}.fs-cst .num{text-align:right}" +
    ".fs-cst .fs-csv{min-width:170px;background:#fafbfc}.fs-cst .fs-csv.low{background:#eaf7ee}.fs-cst td.best input{border-color:#2e9c58;font-weight:700}" +
    ".fs-cst input{width:100%;box-sizing:border-box;margin-top:3px}.fs-cst small{display:block;color:#667;text-align:right}.fs-cs2{display:flex;gap:4px}.fs-cs2 input{flex:1;min-width:0}" +
    ".fs-cst tr.fs-cstot td{background:#f3f6f9}.fs-cst tr.fs-cstot td.low{background:#dff2e5}.fs-cspick{display:flex;gap:6px;align-items:center;font-weight:600}" +
    ".fs-csfoot{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.fs-csw{display:flex;flex-direction:column;gap:4px}.fs-csw textarea{width:100%;box-sizing:border-box}" +
    ".fs-csvsel{display:flex;gap:4px;margin-top:3px}.fs-csvsel select{flex:1;min-width:0}.fs-csvsel select.bad{border-color:#c62828;color:#b0412e}" +
    ".fs-csplus{background:#2e9c58!important;color:#fff!important;border-color:#2e9c58!important;font-weight:700;padding:0 9px}.fs-csbad{color:#b0412e!important;text-align:left!important}" +
    ".fs-nvbox{width:min(460px,94vw)}.fs-nvbox .fs-csw{margin-bottom:8px}.fs-nvbox input,.fs-nvbox textarea{width:100%;box-sizing:border-box}#fsCsNv{z-index:10001}" +
    ".fs-csok{color:#1b7a3d;font-weight:600}.fs-csno{color:#b0412e;font-weight:600}" +
    ".fs-csbox2{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid #cfe0f1;background:#f6faff;border-radius:8px;padding:10px 12px;margin-top:10px}.fs-csbox2.ok{border-color:#9fd3b0;background:#effaf2}" +
    ".fs-flow{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;width:100%}.fs-flow li{flex:1;min-width:120px;display:flex;flex-direction:column;border:1px solid #dde3ea;border-radius:8px;padding:6px 8px;background:#fff;position:relative;padding-left:34px}" +
    ".fs-flow li i{position:absolute;left:8px;top:8px;width:20px;height:20px;border-radius:50%;background:#cfd6de;color:#fff;font-style:normal;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}" +
    ".fs-flow li.ok{border-color:#9fd3b0;background:#f2fbf5}.fs-flow li.ok i{background:#2e9c58}.fs-flow li.now{border-color:#e0a84a;background:#fff8ec}.fs-flow li.now i{background:#d08a00}.fs-flow li.stop{border-color:#c62828}.fs-flow li.stop i{background:#c62828}" +
    ".fs-flow small{color:#667;font-size:11px}.fs-sv{display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%}.fs-sv select{max-width:340px}.fs-sv input{flex:1;min-width:160px}.fs-csbtns{display:flex;gap:8px;flex-wrap:wrap;width:100%}" +
    ".fs-csnext{margin:0;width:100%;font-weight:600;color:#1f4f80}.fs-signed{font-weight:600;font-size:11px;min-height:26px}.fs-qk{width:auto!important}.fs-qk td{border:0!important}" +
    ".fs-csbox2 span{flex:1;min-width:180px}.btn.warn{border-color:#e0a84a;color:#9a5b00}" +
    ".fs-cssheet{font-size:11.5px}.fs-csp{width:100%;border-collapse:collapse;margin-top:6px}.fs-csp th,.fs-csp td{border:1px solid #bbb;padding:4px 5px;vertical-align:top}.fs-csp th{background:#f1f3f5;text-align:center}" +
    ".fs-csp .num{text-align:right}.fs-csp .low{background:#e7f6ec}.fs-csp tr.tot td{font-weight:600;background:#fafafa}.fs-csp tr.tot td.low{background:#dff2e5}" +
    ".fs-cssign{width:100%;margin-top:34px;border-collapse:collapse}.fs-cssign td{width:25%;text-align:center;padding:0 8px;font-size:11px;border:0}.fs-cssign .ln{border-top:1px solid #333;margin-bottom:4px;height:1px}" +
    ".fs-qpage{break-before:page;page-break-before:always;padding-top:18px;font-size:12px;color:#222}.fs-qtop{display:flex;justify-content:space-between;align-items:flex-start}.fs-qco{font-weight:700;color:#555;letter-spacing:.03em;font-size:13px}" +
    ".fs-qr{text-align:right;font-size:11px;line-height:1.6}.fs-qh{text-align:center;text-decoration:underline;margin:14px 0 10px;font-size:20px}.fs-qc{text-align:center}.fs-qrow{display:flex;gap:28px;flex-wrap:wrap;margin:4px 0}" +
    ".fs-qt{width:100%;border-collapse:collapse;margin:12px 0}.fs-qt th,.fs-qt td{border:1px solid #333;padding:5px 6px}.fs-qt th{text-align:left;font-weight:600}.fs-qt .num{text-align:right}.fs-qt .c{text-align:center}" +
    ".fs-qk td{padding:2px 14px 2px 0;border:0;background:none}.fs-qk td:first-child{font-weight:600;min-width:110px}.fs-qscan{display:block;max-width:60%;max-height:120mm;margin:8px 0;border:1px solid #ddd}" +
    ".fs-qmail{color:#1f6fb8}.fs-qfoot{border-top:1px solid #ccc;margin-top:30px;padding-top:8px;text-align:center;font-size:11px}" +
    "@media print{.fs-csp th,.fs-csp td{font-size:10px}}@media (max-width:760px){.fs-csfoot{grid-template-columns:1fr}}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 400); }
  start();
})();
