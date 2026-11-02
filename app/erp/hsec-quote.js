// Sales › Quotations additions (hassan, 2026-11-02):
// 1. "Sometimes I need to prepare quotations in USD instead of PKR, but the currency option is not editable."
//    A Currency box (PKR / USD) next to the exchange rate; printed and PDF quotations then show (USD), "USD:" and
//    "US Dollars ... Only" wherever they showed PKR / Rupees. The exchange-rate wording in the notes and terms is left
//    as typed.
// 2. "We upload pictures of reference car designs, but in the PDF the pictures displayed are incorrect."
//    The design brief tick box always printed the fixed sample pictures (cabin ZCD-032G etc.). Each quotation now has
//    "Reference car designs": upload your own pictures with a caption; they print, and go into the PDF and Word file,
//    on their own pages. Files are kept on the server like supporting documents (hsec-att.php, record quotes/<id>).
// 3. "I share quotations with Sir in Word format for pricing." The PDF ▾ menu gets "Word (editable)": a .doc file
//    Word opens with the text, tables and pictures, ready to edit.
(function () {
  /* global QE, Store, qtDraw, qtRead, qtDoc, qtLive, qtPdfMenu, qtPdfName, QT_LOGO, toast, esc */
  var C = window.FS_BRIDGE || {}, API = (C.api || "/erp/m/hsec/api") + "/att";
  // The currency list comes from Setup & maintenance › Currencies & exchange rates (hsec-currency.js).
  var CDEF = [{ code: "PKR", name: "Pakistani rupee", words: "Rupees", frac: "Paisa", sym: "Rs" }, { code: "USD", name: "US dollar", words: "US Dollars", frac: "Cents", sym: "$" }];
  var CLIST = function () { var L = window.FS_CUR && safe(function () { return window.FS_CUR.list(); }, null); return L && L.length ? L : CDEF; };
  var CURS = { filter: function (f) { return CLIST().map(function (c) { return c.code; }).filter(f); } };
  var cinfo = function (c) { return CLIST().find(function (x) { return x.code === c; }) || { code: c, name: c, words: c, frac: "" }; };
  var safe = function (f, d) { try { return f(); } catch (e) { return d; } };
  var say = function (m) { safe(function () { toast(m); }, null); };
  var h = function (s) { return safe(function () { return esc(s); }, String(s == null ? "" : s)); };
  var cur = function (q) { var c = q && q.currency; return /^[A-Z]{3}$/.test(c || "") ? c : "PKR"; };
  var fileUrl = function (id) { return API + "/file?id=" + encodeURIComponent(id); };
  function post(u, fd) {
    fd.append("csrf", C.csrf || "");
    return fetch(u, { method: "POST", body: fd, credentials: "same-origin" }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Upload failed"); return d; });
    });
  }

  // ---- 1. currency
  function relabel(html, c) {
    if (c === "PKR") return html;
    return html.replace(/\(PKR\)/g, "(" + c + ")").replace(/\(PKR,/g, "(" + c + ",").replace(/PKR: /g, c + ": ")
      .replace(/\bRupees (?=[A-Z])/g, function () { return (cinfo(c).words || c) + " "; })
      .replace(/(\w) Paisa Only/g, function (m, a) { var f = cinfo(c).frac; return a + (f ? " " + f : "") + " Only"; });
  }
  // currency sign before every amount of a foreign currency quotation ("$ 2,000,000"); PKR quotations keep their format
  var MONEY = /^-?\d[\d,]*(\.\d+)?(\/-)?$/;
  function signDoc(html, c) {
    if (c === "PKR") return html;
    var sym = cinfo(c).sym || c, t = document.createElement("template"); t.innerHTML = html;
    t.content.querySelectorAll("td.q-n, td.o-n, .q-sum b").forEach(function (el) {
      var w = el.querySelector("b") || el, x = w.textContent.trim();
      if (el.classList.contains("o-n") && !/\/-$/.test(x)) return; // the quantity column of the original layout
      if (MONEY.test(x)) w.textContent = sym + " " + x;
    });
    t.content.querySelectorAll("td, b, div").forEach(function (el) {
      if (el.children.length) return;
      var x = el.textContent, y = x.replace(new RegExp("^" + c + ": (?=\\d)"), sym + " ").replace(new RegExp("^" + c + ": (?=[A-Z])"), (cinfo(c).words || c) + " ");
      if (y !== x) el.textContent = y;
    });
    return t.innerHTML;
  }
  function signEditor() {
    var c = QE ? cur(QE) : "PKR", sym = cinfo(c).sym || c;
    document.querySelectorAll("#qtOv [data-qamt], #qTot b").forEach(function (el) {
      var x = el.textContent.replace(/^\S+ (?=-?\d)/, "").trim();
      el.textContent = c === "PKR" || !MONEY.test(x) ? x : sym + " " + x;
    });
  }
  function relabelEditor() {
    var ov = document.getElementById("qtOv"); if (!ov || !QE) return;
    var c = cur(QE);
    ov.querySelectorAll("th, small").forEach(function (el) {
      if (!el.dataset.fsOrig) el.dataset.fsOrig = el.innerHTML;
      el.innerHTML = relabel(el.dataset.fsOrig, c);
    });
    var w = document.getElementById("qWords"); if (w) { var t = w.textContent; CLIST().forEach(function (x) { if (x.code === "PKR") return; if (x.words && t.indexOf(x.words + " ") === 0) t = "Rupees " + t.slice(x.words.length + 1); if (x.frac && / Only$/.test(t) && t.slice(-(x.frac.length + 6)) === " " + x.frac + " Only") t = t.slice(0, -(x.frac.length + 6)) + " Paisa Only"; }); w.textContent = relabel(t, c); }
    var fx = document.getElementById("qe_fx"), lab = fx && fx.closest("label");
    if (lab) { var sm = lab.querySelector("small"); if (sm && !sm.dataset.fsFx) { sm.dataset.fsFx = "1"; sm.textContent += " For a quotation in another currency, prices are entered in that currency; the rate stays for reference."; } }
  }
  function addCurrency() {
    var fx = document.getElementById("qe_fx"), lab = fx && fx.closest("label");
    if (!lab || document.getElementById("qe_cur")) return;
    var l = document.createElement("label"); l.className = "qf";
    l.innerHTML = "<span>Currency</span><select id=\"qe_cur\">" + CLIST().map(function (x) { var c = x.code;
      return "<option value=\"" + h(c) + "\"" + (cur(QE) === c ? " selected" : "") + ">" + h(c + " (" + x.name + ")") + "</option>";
    }).join("") + "</select><small>The currency of every price in this quotation.</small>";
    lab.parentNode.insertBefore(l, lab);
    l.querySelector("select").addEventListener("change", function (e) { QE.currency = e.target.value; relabelEditor(); safe(signEditor); });
  }

  // ---- 2. reference car designs
  function pics(q) { return Array.isArray(q && q.refPics) ? q.refPics.filter(function (p) { return p && p.id; }) : []; }
  function picsSection(q) {
    var P = pics(q); if (!P.length) return "";
    var orig = (q.layout || "original") === "original", rows = [];
    for (var i = 0; i < P.length; i += 2) rows.push(P.slice(i, i + 2));
    var cell = function (p) {
      return "<td style=\"width:50%;vertical-align:top;text-align:center;padding:6px 8px 14px\"><img src=\"" + h(fileUrl(p.id)) + "\" alt=\"" + h(p.cap || "Reference design")
        + "\" style=\"max-width:100%;max-height:430px\">" + (p.cap ? "<p style=\"margin:6px 0 0;text-align:center\"><b>" + h(p.cap) + "</b></p>" : "") + "</td>";
    };
    var head = orig ? "<p><b><u>Reference Car Designs:</u></b></p>" : "<h2 class=\"q-sec\">Reference car designs</h2>";
    return "<section class=\"" + (orig ? "o-pb" : "q-pb") + " fs-refpics\">" + head + "<table class=\"o-two fs-reft\" style=\"width:100%;table-layout:fixed\">"
      + rows.map(function (r) { return "<tr>" + r.map(cell).join("") + (r.length < 2 ? "<td style=\"width:50%\"></td>" : "") + "</tr>"; }).join("") + "</table></section>";
  }
  function insertPics(html, q) {
    var s = picsSection(q); if (!s) return html;
    // at the end of the main document cell (letter, schedule, annexes), so the letterhead frame repeats on its pages
    var t = document.createElement("template"); t.innerHTML = html;
    var cell = t.content.querySelector("table.q-frame > tbody > tr > td");
    if (!cell) return html + s;
    cell.insertAdjacentHTML("beforeend", s);
    return t.innerHTML;
  }
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(u);
        var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
        var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) { b ? ok({ blob: b, name: file.name.replace(/\.[^.]+$/, "") + ".jpg" }) : bad(new Error(file.name + " could not be read.")); }, "image/jpeg", 0.8);
      };
      img.onerror = function () { URL.revokeObjectURL(u); bad(new Error(file.name + " is not a picture this browser can open.")); };
      img.src = u;
    });
  }
  function storeRefPics(id, list) {
    // keep the saved quotation in step, so pictures are not lost if the editor is closed without saving
    var rec = safe(function () { return Store.data.quotes.find(function (x) { return x.id === id; }); }, null);
    if (!rec) return Promise.resolve();
    return Promise.resolve(Store.save("quotes", Object.assign({}, rec, { refPics: list.slice() }))).catch(function () {});
  }
  function picsBox() {
    var q = QE, P = pics(q), saved = q && q.id && safe(function () { return Store.data.quotes.some(function (x) { return x.id === q.id; }); }, false);
    return "<div class=\"fsref-h\"><b>Reference car designs</b> <span class=\"muted\">Your own pictures of the car designs for this customer. They print on their own pages after the annexes, in the PDF and in the Word file.</span></div>"
      + (P.length ? "<div class=\"fsref-grid\">" + P.map(function (p, i) {
        return "<div class=\"fsref-it\"><img src=\"" + h(fileUrl(p.id)) + "\" alt=\"\"><input data-refcap=\"" + i + "\" placeholder=\"Caption, e.g. Cabin design ZCD-032G\" value=\"" + h(p.cap || "") + "\">"
          + "<button type=\"button\" class=\"btn sm\" data-refdel=\"" + i + "\">Remove</button></div>";
      }).join("") + "</div>" : "")
      + (saved ? "<label class=\"btn sm fsref-add\">+ Add pictures<input type=\"file\" accept=\"image/*\" multiple hidden data-refadd=\"1\"></label> <span class=\"muted\" id=\"fsRefMsg\"></span>"
        : "<p class=\"muted\" style=\"margin:6px 0 0\">Save this quotation once, then open it again to add pictures.</p>");
  }
  function paintPics() { var b = document.getElementById("fsRefBox"); if (b) b.innerHTML = picsBox(); }
  function addPicsBox() {
    var d = document.getElementById("qe_design"), lab = d && d.closest("label");
    if (!lab || document.getElementById("fsRefBox")) return;
    if (!lab.dataset.fsNote) { lab.dataset.fsNote = "1"; lab.appendChild(document.createTextNode(" (fixed sample pictures, not your own; for your pictures use Reference car designs below)")); }
    var b = document.createElement("div"); b.id = "fsRefBox"; b.className = "fsref"; lab.after(b); paintPics();
  }
  document.addEventListener("change", function (e) {
    var t = e.target; if (!t || !t.dataset || !t.dataset.refadd || !QE || !QE.id) return;
    var files = [].slice.call(t.files || []), id = QE.id, msg = document.getElementById("fsRefMsg"), errs = [], n = 0;
    if (!files.length) return;
    files.reduce(function (p, f) {
      return p.then(function () {
        if (msg) msg.textContent = "Uploading " + (++n) + " of " + files.length + "…";
        return shrink(f).then(function (s) {
          var fd = new FormData(); fd.append("path", "quotes/" + id); fd.append("name", s.name); fd.append("file", s.blob, s.name);
          return post(API, fd);
        }).then(function (d) {
          if (!QE || QE.id !== id || !d.file) return;
          qtRead(); QE.refPics = pics(QE).concat([{ id: d.file.id, cap: "", name: d.file.name }]);
        }).catch(function (er) { errs.push(er.message); });
      });
    }, Promise.resolve()).then(function () {
      if (QE && QE.id === id) { paintPics(); storeRefPics(id, pics(QE)); }
      var m = document.getElementById("fsRefMsg"); if (m) m.textContent = errs.length ? errs.join(" ") : "";
      if (errs.length) alert(errs.join("\n"));
    });
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-refdel]");
    if (!t || !QE) return;
    qtRead(); var P = pics(QE), i = +t.dataset.refdel, p = P[i]; if (!p) return;
    if (!confirm("Remove this picture from the quotation?")) return;
    P.splice(i, 1); QE.refPics = P; paintPics(); storeRefPics(QE.id, P);
    var fd = new FormData(); fd.append("id", p.id); post(API + "/delete", fd).catch(function () {});
  });

  // ---- 3. Word (.doc, MHTML: the format Word itself saves as "Single File Web Page")
  function b64lines(s) { return s.replace(/.{76}/g, "$&\r\n"); }
  function blobB64(b) { return new Promise(function (ok, bad) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(",")[1] || ""); }; r.onerror = bad; r.readAsDataURL(b); }); }
  function wordFile(q) {
    var orig = (q.layout || "original") === "original";
    var host = document.createElement("div"); host.style.cssText = "position:fixed;left:-10000px;top:0;width:182mm;background:#fff;z-index:-1";
    var el = document.createElement("div"); el.className = "sheet qsheet" + (orig ? " qo" : ""); el.style.cssText = "width:182mm;max-width:none;padding:0;margin:0;background:#fff;color:#000";
    el.innerHTML = qtDoc(q, false);
    var css = [].map.call(el.querySelectorAll("style"), function (s) { var t = s.textContent; s.remove(); return t; }).join("\n");
    el.querySelectorAll("table.q-frame > thead, table.q-frame > tfoot").forEach(function (x) { x.remove(); });
    host.appendChild(el); document.body.appendChild(host);
    var cssEl = document.createElement("style"); cssEl.textContent = css; document.head.appendChild(cssEl);
    var imgs = [].slice.call(el.querySelectorAll("img"));
    return Promise.all(imgs.map(function (im) { return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; }); })).then(function () {
      imgs.forEach(function (im) {
        var r = im.getBoundingClientRect(), w = Math.round(Math.min(r.width || im.naturalWidth || 300, 640)), ht = im.naturalWidth ? Math.round(w * im.naturalHeight / im.naturalWidth) : Math.round(r.height);
        if (w && ht) { im.setAttribute("width", w); im.setAttribute("height", ht); im.style.width = w + "px"; im.style.height = ht + "px"; im.style.maxWidth = ""; im.style.maxHeight = ""; }
      });
      // Word reads page breaks from paragraphs and divs, not <section>
      // the letterhead frame table is for the browser's print; Word gets the document cell's content directly
      el.querySelectorAll("table.q-frame").forEach(function (t) {
        var cell = t.querySelector(":scope > tbody > tr > td"); if (!cell) return;
        while (cell.firstChild) t.parentNode.insertBefore(cell.firstChild, t); t.remove();
      });
      // Word does not lay out flex rows: Ref / Date and similar two-sided lines become a two-cell table
      el.querySelectorAll(".o-ref, .q-meta").forEach(function (row) {
        var kids = [].slice.call(row.children); if (kids.length < 2) return;
        var t = document.createElement("table"); t.setAttribute("width", "100%"); t.setAttribute("style", "width:100%;border-collapse:collapse;margin:4px 0 14px");
        var tr = t.insertRow();
        kids.forEach(function (k, i) { var td = tr.insertCell(); td.setAttribute("style", "padding:0;font-weight:700;" + (i === kids.length - 1 ? "text-align:right" : "")); td.appendChild(k); });
        row.replaceWith(t);
      });
      [].slice.call(el.querySelectorAll("section")).forEach(function (s) {
        var d = document.createElement("div"); d.className = s.className;
        while (s.firstChild) d.appendChild(s.firstChild); s.replaceWith(d);
        var r = document.createRange(); r.setStart(el, 0); r.setEndBefore(d);
        var first = d.firstElementChild;
        if (/\b(o-pb|q-pb)\b/.test(d.className) && r.toString().trim() && first) first.setAttribute("style", (first.getAttribute("style") || "") + ";page-break-before:always"); // as text: Chrome rewrites the property to break-before, which Word ignores
      });
      el.removeAttribute("style");
      if (typeof QT_LOGO === "string") el.insertAdjacentHTML("afterbegin", "<p align=\"center\" style=\"text-align:center;margin:0 0 10px\"><img src=\"" + QT_LOGO + "\" width=\"420\" height=\"89\" style=\"width:420px;height:89px\" alt=\"HSEC\"></p>");
      var parts = [], seen = {}, k = 0;
      return Promise.all([].slice.call(el.querySelectorAll("img")).map(function (im) {
        var src = im.getAttribute("src") || ""; if (!src) return null;
        if (!seen[src]) {
          var name = "image" + (++k);
          seen[src] = { loc: "file:///C:/fsquote/" + name, p: src.indexOf("data:") === 0
            ? Promise.resolve({ mime: (src.match(/^data:([^;,]+)/) || [])[1] || "image/png", b64: src.slice(src.indexOf(",") + 1) })
            : fetch(src, { credentials: "same-origin" }).then(function (r) { if (!r.ok) throw new Error("A picture could not be loaded."); return r.blob(); })
              .then(function (b) { return blobB64(b).then(function (x) { return { mime: b.type || "image/jpeg", b64: x }; }); }) };
          seen[src].p = seen[src].p.then(function (d) { parts.push({ loc: seen[src].loc, mime: d.mime, b64: d.b64 }); });
        }
        var loc = seen[src].loc; im.setAttribute("src", loc);
        return seen[src].p;
      })).then(function () {
        css = css.replace(/@page\s*\{[^}]*\}/g, "") + "\n@page WordSection1{size:595.3pt 841.9pt;margin:56pt 40pt 56pt 40pt}\ndiv.WordSection1{page:WordSection1}\nbody{font-family:Verdana,Arial,sans-serif}";
        var html = "<html xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\" xmlns:w=\"urn:schemas-microsoft-com:office:word\" xmlns=\"http://www.w3.org/TR/REC-html40\">"
          + "<head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\"><title>" + h(q.ref || "Quotation") + "</title>"
          + "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->"
          + "<style>" + css + "</style></head><body><div class=\"WordSection1\">" + el.outerHTML + "</div></body></html>";
        var B = "----=_NextPart_FlowSuit_" + Date.now();
        var out = ["MIME-Version: 1.0", "Content-Type: multipart/related; boundary=\"" + B + "\"; type=\"text/html\"", "", "--" + B,
          "Content-Type: text/html; charset=\"utf-8\"", "Content-Transfer-Encoding: base64", "Content-Location: file:///C:/fsquote/quotation.htm", "",
          b64lines(btoa(unescape(encodeURIComponent(html))))];
        parts.forEach(function (p) { out.push("", "--" + B, "Content-Type: " + p.mime, "Content-Transfer-Encoding: base64", "Content-Location: " + p.loc, "", b64lines(p.b64)); });
        out.push("", "--" + B + "--", "");
        return new Blob([out.join("\r\n")], { type: "application/msword" });
      });
    }).finally(function () { host.remove(); cssEl.remove(); });
  }
  var busy = false;
  function downloadWord(q) {
    if (busy) return; busy = true; say("Building the Word file…");
    wordFile(q).then(function (blob) {
      var a = document.createElement("a"), u = URL.createObjectURL(blob);
      a.href = u; a.download = safe(function () { return qtPdfName(q, true); }, (q.ref || "Quotation") + ".pdf").replace(/\.pdf$/i, ".doc");
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      say("Word file downloaded. Open it in Word, edit, then File › Save As › Word Document (.docx) to keep it as a normal Word file.");
    }).catch(function (er) { alert("Could not build the Word file: " + er.message); }).finally(function () { busy = false; });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-qtword]");
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    var m = document.getElementById("qtPdfMenu"); if (m) m.remove();
    var q = safe(function () { return Store.data.quotes.find(function (x) { return x.id === t.dataset.qtword; }); }, null);
    if (q) downloadWord(q);
  }, true);

  // ---- quotations list (hassan, 2026-11-02: "also apply changes on this one"): the list said "Total (PKR)" and
  // "Rs" for every quotation; a USD quotation now shows "USD" in front of its total, and the Open / Accepted figures
  // are split by currency instead of adding dollars to rupees.
  /* global byEnt, qtTot, qtExpired, mn */
  function sums(list) {
    var by = {}; list.forEach(function (r) { var c = cur(r); by[c] = (by[c] || 0) + qtTot(r); });
    var parts = CURS.filter(function (c) { return by[c] != null; }).map(function (c) { return (c === "PKR" ? "Rs " : c + " ") + mn(by[c]) + " Mn"; });
    return parts.length ? parts.join(" + ") : "Rs " + mn(0) + " Mn";
  }
  function relabelList(html) {
    var all = safe(function () { return byEnt(Store.data.quotes); }, null); if (!all) return html;
    if (!all.some(function (r) { return cur(r) !== "PKR"; })) return html;
    var open = all.filter(function (r) { return (r.status || "Draft") === "Sent" && !qtExpired(r); }), won = all.filter(function (r) { return r.status === "Accepted"; });
    html = html.replace(/Open: (\d+) · Rs [^<]*? Mn/, function (m, k) { return "Open: " + k + " · " + sums(open); })
      .replace(/Accepted: (\d+) · Rs [^<]*? Mn/, function (m, k) { return "Accepted: " + k + " · " + sums(won); })
      .replace("<th class=\"num\">Total (PKR)</th>", "<th class=\"num\">Total</th>");
    var t = document.createElement("template"); t.innerHTML = html;
    t.content.querySelectorAll("tr[data-qted]").forEach(function (tr) {
      var q = Store.data.quotes.find(function (x) { return x.id === tr.dataset.qted; }), td = tr.children[5];
      if (td) td.textContent = (q && cur(q) !== "PKR" ? cinfo(cur(q)).sym || cur(q) : "Rs") + " " + td.textContent.trim();
    });
    return t.innerHTML;
  }

  // ---- hooks into the app's quotation functions
  function hook() {
    if (typeof qtDraw !== "function" || typeof qtRead !== "function" || typeof qtDoc !== "function" || typeof qtPdfMenu !== "function") return false;
    var oDraw = qtDraw, oRead = qtRead, oDoc = qtDoc, oMenu = qtPdfMenu, oLive = typeof qtLive === "function" ? qtLive : null;
    qtDraw = function () { oDraw.apply(this, arguments); if (!QE) return; safe(addCurrency); safe(addPicsBox); safe(relabelEditor); safe(signEditor); }; // eslint-disable-line no-global-assign
    qtRead = function () { // eslint-disable-line no-global-assign
      oRead.apply(this, arguments); if (!QE || !document.getElementById("qtOv")) return;
      var c = document.getElementById("qe_cur"); if (c) QE.currency = c.value;
      var P = pics(QE); document.querySelectorAll("#qtOv [data-refcap]").forEach(function (el) { var p = P[+el.dataset.refcap]; if (p) p.cap = el.value; });
      if (P.length || QE.refPics) QE.refPics = P;
    };
    if (typeof qtList === "function") { var oList = qtList; qtList = function () { var s = oList.apply(this, arguments); return safe(function () { return relabelList(s); }, s); }; } // eslint-disable-line no-global-assign
    if (oLive) qtLive = function () { oLive.apply(this, arguments); safe(relabelEditor); safe(signEditor); }; // eslint-disable-line no-global-assign
    qtDoc = function (q, lh) { var c = cur(q); return signDoc(relabel(insertPics(oDoc.apply(this, arguments), q || {}), c), c); }; // eslint-disable-line no-global-assign
    qtPdfMenu = function (btn, id) { // eslint-disable-line no-global-assign
      oMenu.apply(this, arguments);
      var m = document.getElementById("qtPdfMenu");
      if (m && !m.querySelector("[data-qtword]")) m.insertAdjacentHTML("beforeend", "<button type=\"button\" role=\"menuitem\" data-qtword=\"" + h(id) + "\">Word (editable .doc)</button>");
    };
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fsref{margin:10px 0 4px;padding:10px 12px;border:1px dashed var(--line,#cbd5e1);border-radius:8px}.fsref-h{margin-bottom:8px;font-size:13px}"
    + ".fsref-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:8px}"
    + ".fsref-it{display:flex;flex-direction:column;gap:5px;border:1px solid var(--line,#e2e8f0);border-radius:6px;padding:6px;background:var(--panel,#fff)}"
    + ".fsref-it img{width:100%;height:130px;object-fit:contain;background:#f8fafc}.fsref-it input{font-size:12.5px}.fsref-add{cursor:pointer}";
  (document.head || document.documentElement).appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
