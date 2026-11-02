// Quotation templates and letterheads (hassan, 2026-11-02: "we do quotations for SMEC and BLT as well ... the system's
// quotation is for SMEC but we also quote BLT, and its structure is different").
// A template is a whole starting quotation (subject, introduction, price lines with specifications, notes, payment
// terms, terms and conditions, appendices and annexes, sign-off) plus, optionally, its own letterhead (header and
// footer pictures). Templates live in the settings record (settings.qtTpl), so only an administrator can import,
// save or delete them; everyone can start a quotation from one. The built-in SMEC quotation stays the default.
//  * New quotation: "Start from" picks the built-in SMEC quotation or a template.
//  * Every quotation: "Letterhead" picks HSEC or a template's letterhead; print, PDF and Word use it.
//  * Sales › Quotations › Templates: import a template file (.json), download one, delete one.
//  * In the editor, an administrator can "Save as template" to make a new template from the open quotation.
(function () {
  /* global QE, Store, ENTS, V, qtDraw, qtRead, qtDoc, qtPdf, qtList, qtBlank, qtPdfName, h2pLib, dlSave, settings, esc, toast, render, qmoney */
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var say = function (m) { safe(function () { toast(m); }, null); };
  var KEEP = ["id", "entity", "ref", "date", "status", "createdAt", "updatedAt", "createdBy", "refPics", "tpl"]; // never copied from a template
  var list = function () { var L = safe(function () { return settings().qtTpl; }, null); return Array.isArray(L) ? L.filter(function (t) { return t && t.id && t.data; }) : []; };
  var get = function (id) { return id ? list().find(function (t) { return t.id === id; }) || null : null; };
  // company letterheads (settings.coLh, by company code): the default for that company's quotations, vouchers and invoices
  var coMap = function () { var m = safe(function () { return settings().coLh; }, null); return m && typeof m === "object" && !Array.isArray(m) ? m : {}; };
  var coLh = function (e) { var c = e && coMap()[e]; return c && c.head ? { id: "co:" + e, name: c.name || e + " letterhead", head: c.head, foot: c.foot || "", co: e } : null; };
  var lhOf = function (q) { var t = get(q && q.tpl); return t && t.head ? t : coLh(q && q.entity); };
  window.FS_QTPL = { list: list, get: get, letterhead: lhOf, company: coLh, companies: function () { return Object.keys(coMap()).filter(coLh); } };
  var fmtOf = function (src) { return /^data:image\/jpe?g/.test(src) ? "JPEG" : "PNG"; };

  function saveList(L) {
    var st = safe(function () { return settings(); }, {}) || {};
    return Store.save("settings", Object.assign({}, st, { id: "main", qtTpl: L }));
  }
  function content(q) {
    var d = JSON.parse(JSON.stringify(q || {}));
    KEEP.forEach(function (k) { delete d[k]; });
    d.customer = { name: "", title: "", company: "", address: "", phone: "" };
    (d.items || []).forEach(function (it) { it.unit = ""; });
    return d;
  }

  // ---- editor: Start from (new quotations) and Letterhead (all)
  function addPickers() {
    var g = document.querySelector("#qtOv fieldset .qgrid"); if (!g || !QE || document.getElementById("qe_lh")) return;
    var L = list();
    if (!QE.id) {
      var s = document.createElement("label"); s.className = "qf";
      s.innerHTML = "<span>Start from</span><select id=\"qe_from\"><option value=\"\">SMEC standard quotation (built-in)</option>" +
        L.map(function (t) { return "<option value=\"" + h(t.id) + "\"" + (QE.tplFrom === t.id ? " selected" : "") + ">" + h(t.name) + "</option>"; }).join("") +
        "</select><small>" + (L.length ? "Loads that quotation's wording, price lines, terms and annexes." : "No templates yet. An administrator adds them under Sales › Quotations › Templates.") + "</small>";
      g.insertBefore(s, g.firstChild);
    }
    var withLh = L.filter(function (t) { return t.head; });
    var l = document.createElement("label"); l.className = "qf";
    l.innerHTML = "<span>Letterhead</span><select id=\"qe_lh\"><option value=\"\">" + h(coLh(QE.entity) ? "Company letterhead (" + QE.entity + ")" : "HSEC (Hong Kong Shanghai Electric)") + "</option>" +
      withLh.map(function (t) { return "<option value=\"" + h(t.id) + "\"" + (QE.tpl === t.id ? " selected" : "") + ">" + h(t.name) + "</option>"; }).join("") +
      "</select><small>Used for “print on letterhead”, the letterhead PDF and the Word file.</small>";
    g.appendChild(l);
    var act = document.querySelector("#qtOv .qthead");
    if (act && !document.getElementById("qtSaveTpl")) {
      var b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.id = "qtSaveTpl"; b.textContent = "Save as template";
      b.title = "Administrators: make a template from this quotation (prices are left blank)";
      var close = act.lastElementChild; act.insertBefore(b, close && close.tagName === "BUTTON" ? close : null);
    }
  }
  function startFrom(id) {
    var t = get(id), b = safe(function () { return qtBlank(); }, null); if (!b) return;
    var keep = { entity: QE.entity, ref: QE.ref, date: QE.date, status: QE.status || "Draft" };
    Object.keys(QE).forEach(function (k) { delete QE[k]; });
    Object.assign(QE, t ? JSON.parse(JSON.stringify(t.data)) : b, keep, { tpl: t && t.head ? t.id : "", tplFrom: t ? t.id : "" });
    if (!t) { delete QE.tpl; delete QE.tplFrom; }
    qtDraw();
    say(t ? "Started from “" + t.name + "”. Fill in the customer, the [placeholders] and the unit prices." : "Back to the SMEC standard quotation.");
  }
  document.addEventListener("change", function (e) {
    if (!e.target || !QE) return;
    if (e.target.id === "qe_from") {
      var id = e.target.value;
      if (!window.confirm("Replace this quotation's wording, lines, terms and annexes with " + (id ? "“" + (get(id) || {}).name + "”" : "the SMEC standard quotation") + "?")) {
        e.target.value = QE.tplFrom || ""; return;
      }
      safe(qtRead, null); startFrom(id);
    } else if (e.target.id === "qe_lh") { QE.tpl = e.target.value || ""; }
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#qtSaveTpl"); if (!b || !QE) return;
    e.preventDefault(); e.stopImmediatePropagation();
    safe(qtRead, null);
    var name = window.prompt("Name for the new template (for example “BLT Brilliant standard”):", ""); if (!name || !name.trim()) return;
    var cur = get(QE.tpl), L = list(), t = { id: "t" + Date.now().toString(36), name: name.trim().slice(0, 80), head: cur ? cur.head : "", foot: cur ? cur.foot : "", data: content(QE), at: new Date().toISOString() };
    saveList(L.concat([t])).then(function () { say("Template “" + t.name + "” saved."); })
      .catch(function (x) { say("Only an administrator can save templates. " + (x && x.message || "")); });
  }, true);

  // ---- the document: swap the HSEC letterhead for the template's
  function swapLetterhead(html, q, lh) {
    var t = lh && lhOf(q); if (!t) return html;
    var d = document.createElement("template"); d.innerHTML = html;
    d.content.querySelectorAll(".q-lh").forEach(function (x) {
      if (x.classList.contains("blank")) return;
      x.innerHTML = "<img src=\"" + t.head + "\" alt=\"" + h(t.name) + "\" style=\"width:100%;height:auto;max-height:none\">";
    });
    d.content.querySelectorAll(".o-ft, .q-ft").forEach(function (x) {
      if (x.classList.contains("blank")) return;
      x.className = "fs-tplft"; x.innerHTML = t.foot ? "<img src=\"" + t.foot + "\" alt=\"\" style=\"width:100%;height:auto\">" : "";
    });
    return d.innerHTML;
  }

  // ---- PDF on a template letterhead: the same build as the app's, with the template's pictures on every page
  var busy = false;
  function imgSize(src) { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok([i.naturalWidth || 1, i.naturalHeight || 1]); }; i.onerror = function () { ok([1, 0]); }; i.src = src; }); }
  async function pdfTpl(q, t) {
    if (busy) return; busy = true; say("Building the PDF. This takes a few seconds for a long quotation.");
    var host = document.createElement("div"); host.style.cssText = "position:fixed;left:-10000px;top:0;width:182mm;background:#fff;z-index:-1";
    try {
      var lib = await h2pLib(), orig = (q.layout || "original") === "original";
      var el = document.createElement("div"); el.className = "sheet qsheet" + (orig ? " qo" : "");
      el.style.cssText = "box-sizing:border-box;overflow-wrap:break-word;max-width:none;width:182mm;padding:0 1.6mm;margin:0;border-radius:0;box-shadow:none;background:#fff;color:#000";
      el.innerHTML = qtDoc(q, false); el.querySelectorAll("table.q-frame > thead, table.q-frame > tfoot").forEach(function (x) { x.remove(); });
      el.querySelectorAll("section").forEach(function (s, i) { if (i) s.style.paddingTop = "0"; });
      host.appendChild(el); document.body.appendChild(host);
      await Promise.all([].map.call(el.querySelectorAll("img"), function (im) { return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; }); }));
      var hs = await imgSize(t.head), fs = t.foot ? await imgSize(t.foot) : [1, 0];
      var W = 182, hH = Math.min(26, W * hs[1] / hs[0]), fH = Math.min(20, W * fs[1] / fs[0]);
      var opt = { margin: [Math.max(33, 9 + hH + 4), 14, Math.max(24, fH + 12), 14], filename: qtPdfName(q, true), image: { type: "jpeg", quality: 0.86 },
        html2canvas: { scale: 1.8, useCORS: true, backgroundColor: "#ffffff", logging: false, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], before: "section.o-pb, section.q-pb", avoid: ["tr", ".o-term", ".q-term", "figure", ".q-words", ".q-incl", ".q-sum", ".o-note"] } };
      var sx = window.scrollX, sy = window.scrollY; window.scrollTo(0, 0);
      var pdf; try { pdf = await lib().set(opt).from(el).toPdf().get("pdf"); } finally { window.scrollTo(sx, sy); }
      var N = pdf.internal.getNumberOfPages();
      for (var i = 1; i <= N; i++) {
        pdf.setPage(i);
        pdf.addImage(t.head, fmtOf(t.head), 14, 7, W, hH);
        if (t.foot && fH) pdf.addImage(t.foot, fmtOf(t.foot), 14, 297 - 6 - fH, W, fH);
        pdf.setTextColor(110, 110, 110); pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.6);
        pdf.text((q.ref || "") + "  ·  Page " + i + " of " + N, 196, 297 - 6 - fH - 1.5, { align: "right" });
      }
      pdf.setProperties({ title: "Quotation " + (q.ref || ""), subject: q.subject || "", creator: "HSEC Finance ERP" });
      if (await dlSave(qtPdfName(q, true), pdf.output("blob"))) say("PDF of " + q.ref + " downloaded (" + N + " pages).");
    } catch (x) { say(x.message || "Could not build the PDF."); console.error(x); } finally { host.remove(); busy = false; }
  }

  // ---- Sales › Quotations › Templates (import, download, delete)
  function panel() {
    var L = list();
    return "<div class=\"overlay center\" id=\"fsTplOv\"><div class=\"fs-tplbox\"><h3 style=\"margin-top:0\">Quotation templates</h3>" +
      "<p class=\"muted\">A template is a full starting quotation with its own wording, terms, annexes and letterhead. The SMEC standard quotation is built in.</p>" +
      (L.length ? "<div class=\"tw\"><table><thead><tr><th>Name</th><th>Letterhead</th><th>Lines</th><th>Terms</th><th>Annexes</th><th></th></tr></thead><tbody>" +
        L.map(function (t) {
          var d = t.data || {};
          return "<tr><td><b>" + h(t.name) + "</b></td><td>" + (t.head ? "Own letterhead" : "<span class=\"muted\">HSEC</span>") + "</td><td>" + (d.items || []).length + "</td><td>" + (d.terms || []).length +
            "</td><td>" + (d.sections || []).length + "</td><td style=\"white-space:nowrap\"><button class=\"btn sm\" data-tpldl=\"" + h(t.id) + "\">Download</button> <button class=\"btn sm\" data-tpldel=\"" + h(t.id) + "\">Delete</button></td></tr>";
        }).join("") + "</tbody></table></div>" : "<div class=\"panel empty\"><b>No templates yet</b>Import a template file below.</div>") +
      coSection() +
      "<div class=\"bar\" style=\"margin-top:12px\"><label class=\"btn pri\" style=\"cursor:pointer\">Import template or letterhead file (.json)<input type=\"file\" id=\"fsTplFile\" accept=\".json,application/json\" hidden></label>" +
      "<span style=\"flex:1\"></span><button class=\"btn\" id=\"fsTplClose\">Close</button></div><p class=\"err\" id=\"fsTplErr\"></p>" +
      "<p class=\"note\">Only an administrator can import or delete templates. To make one from a quotation, open it and click “Save as template”.</p></div></div>";
  }
  function coSection() {
    var C = window.FS_QTPL.companies();
    return "<h4 style=\"margin:14px 0 6px\">Company letterheads</h4><p class=\"muted\" style=\"margin-top:0\">A company letterhead is used on that company's quotations, vouchers and invoices." +
      " Without one, HSEC uses its built-in letterhead and other companies print their name.</p>" +
      (C.length ? "<div class=\"tw\"><table><thead><tr><th>Company</th><th>Header</th><th>Footer</th><th></th></tr></thead><tbody>" + C.map(function (e) {
        var c = coLh(e);
        return "<tr><td><b>" + h(e) + "</b><br><span class=\"muted\">" + h(c.name) + "</span></td><td><img src=\"" + c.head + "\" alt=\"\" style=\"height:34px;max-width:260px;object-fit:contain\"></td><td>" +
          (c.foot ? "<img src=\"" + c.foot + "\" alt=\"\" style=\"height:26px;max-width:260px;object-fit:contain\">" : "–") + "</td><td><button class=\"btn sm\" data-colhdel=\"" + h(e) + "\">Remove</button></td></tr>";
      }).join("") + "</tbody></table></div>" : "<p class=\"muted\">None yet. Import a letterhead file (.json) below.</p>");
  }
  function openPanel() { var o = document.getElementById("fsTplOv"); if (o) o.remove(); document.body.insertAdjacentHTML("beforeend", panel()); }
  function perr(m) { var e = document.getElementById("fsTplErr"); if (e) e.textContent = m; else say(m); }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("#fsTplBtn, #fsTplClose, [data-tpldl], [data-tpldel], [data-colhdel]"); if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (t.hasAttribute("data-colhdel")) {
      var co = t.getAttribute("data-colhdel");
      if (!window.confirm("Remove the " + co + " letterhead? Its quotations, vouchers and invoices go back to the built-in look.")) return;
      var m = Object.assign({}, coMap()); delete m[co];
      return saveCo(m).then(function () { say(co + " letterhead removed."); openPanel(); }).catch(function (x) { perr("Only an administrator can change letterheads. " + (x && x.message || "")); });
    }
    if (t.id === "fsTplBtn") return openPanel();
    if (t.id === "fsTplClose") { var o = document.getElementById("fsTplOv"); if (o) o.remove(); return; }
    var tp = get(t.getAttribute("data-tpldl") || t.getAttribute("data-tpldel")); if (!tp) return;
    if (t.hasAttribute("data-tpldl")) {
      var data = JSON.stringify({ fsQuoteTemplate: 1, name: tp.name, head: tp.head || "", foot: tp.foot || "", data: tp.data }, null, 1);
      safe(function () { return dlSave(tp.name.replace(/[^\w.-]+/g, "-") + ".json", data); }, null); return;
    }
    if (!window.confirm("Delete the template “" + tp.name + "”? Quotations already made from it keep their content.")) return;
    saveList(list().filter(function (x) { return x.id !== tp.id; })).then(function () { say("Template deleted."); openPanel(); })
      .catch(function (x) { perr("Only an administrator can delete templates. " + (x && x.message || "")); });
  }, true);
  document.addEventListener("change", function (e) {
    if (!e.target || e.target.id !== "fsTplFile" || !e.target.files || !e.target.files[0]) return;
    var f = e.target.files[0];
    if (f.size > 4e6) return perr("That file is too large for a template.");
    f.text().then(function (txt) {
      var j; try { j = JSON.parse(txt); } catch (x) { return perr("That is not a template file."); }
      if (j && j.fsLetterhead === 1) return importCo(j);
      if (!j || j.fsQuoteTemplate !== 1 || !j.data || !Array.isArray(j.data.items)) return perr("That is not a FlowSuit quotation template file.");
      var img = function (s) { return typeof s === "string" && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : ""; };
      var L = list(), name = String(j.name || f.name.replace(/\.json$/i, "")).slice(0, 80), old = L.find(function (x) { return x.name === name; });
      var t = { id: old ? old.id : "t" + Date.now().toString(36), name: name, head: img(j.head), foot: img(j.foot), data: content(j.data), at: new Date().toISOString() };
      if (old && !window.confirm("A template called “" + name + "” exists. Replace it?")) return;
      return saveList(L.filter(function (x) { return x.id !== t.id; }).concat([t])).then(function () { say("Template “" + name + "” imported."); openPanel(); });
    }).catch(function (x) { perr("Only an administrator can import templates. " + (x && x.message || "")); });
  });

  function saveCo(m) { var st = safe(function () { return settings(); }, {}) || {}; return Store.save("settings", Object.assign({}, st, { id: "main", coLh: m })); }
  function importCo(j) {
    var img = function (s) { return typeof s === "string" && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : ""; };
    var ents = safe(function () { return ENTS(); }, []) || [], co = String(j.company || "").trim();
    if (!img(j.head)) return perr("That letterhead file has no header picture.");
    if (ents.indexOf(co) < 0) return perr("That letterhead is for “" + co + "”, which is not a company in this ERP (" + ents.join(", ") + ").");
    var m = Object.assign({}, coMap());
    if (m[co] && !window.confirm("Replace the current " + co + " letterhead?")) return;
    m[co] = { name: String(j.name || co + " letterhead").slice(0, 80), head: img(j.head), foot: img(j.foot), at: new Date().toISOString() };
    return saveCo(m).then(function () { say(co + " letterhead imported. " + co + " quotations, vouchers and invoices now print on it."); openPanel(); });
  }
  function hook() {
    if (typeof qtDraw !== "function" || typeof qtRead !== "function" || typeof qtDoc !== "function" || typeof qtPdf !== "function" || typeof qtList !== "function") return false;
    var oDraw = qtDraw, oRead = qtRead, oDoc = qtDoc, oPdf = qtPdf, oList = qtList;
    qtDraw = function () { oDraw.apply(this, arguments); safe(addPickers, null); }; // eslint-disable-line no-global-assign
    qtRead = function () { oRead.apply(this, arguments); var l = document.getElementById("qe_lh"); if (l && QE && document.getElementById("qtOv")) QE.tpl = l.value || ""; }; // eslint-disable-line no-global-assign
    qtDoc = function (q, lh) { var out = oDoc.apply(this, arguments); return safe(function () { return swapLetterhead(out, q || {}, lh); }, out); }; // eslint-disable-line no-global-assign
    qtPdf = function (q, lh) { var t = lh && lhOf(q); return t ? pdfTpl(q, t) : oPdf.apply(this, arguments); }; // eslint-disable-line no-global-assign
    qtList = function () { // eslint-disable-line no-global-assign
      var s = oList.apply(this, arguments);
      return typeof s === "string" ? s.replace(/(<button class="btn pri" id="qtNew">New quotation<\/button>)/, "$1<button class=\"btn\" id=\"fsTplBtn\">Templates</button>") : s;
    };
    safe(render, null);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-tplft{padding-top:6px}.fs-tplft img{display:block}.fs-tplbox{background:var(--panel,#fff);border-radius:12px;padding:18px 20px;width:100%;max-width:760px;box-shadow:0 20px 50px rgba(0,0,0,.25)}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
