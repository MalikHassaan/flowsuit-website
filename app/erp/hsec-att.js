// Supporting documents (hassan, 2026-10-30: "add attachment option ... save the files on the server ... in KB not MB ...
// on each voucher there should be an eye option where we can see the voucher along with the supporting documents, on
// all vouchers in the system").
// * Every form (vouchers, bills, petty cash slips, advances, any record) gets "Supporting documents": attach photos or
//   PDFs. Photos are shrunk here before they are sent (longest side 1600 px, JPEG), so a receipt is about 100-300 KB.
//   Files picked on a new record wait and go up when it is saved.
// * Next to every voucher number on screen (hsec-vlink.js links) there is an eye; it opens the printable voucher with
//   the documents of the voucher and of the bill, slip or invoice it came from shown under it (photos inline, PDFs in
//   a viewer). The journal form has the same "View with documents" button.
(function () {
  /* global Store, F, jvSheet, sheetOpen, drawForm, openForm */
  var C = window.FS_BRIDGE || {}, API = (C.api || "/erp/m/hsec/api") + "/att";
  var cache = {}, counts = {}, pending = null, busy = false;
  var EYE = "<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-2.3a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z\"/></svg>";
  var h = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); };
  var kb = function (b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; };
  var url = function (f, dl) { return API + "/file?id=" + f.id + (dl ? "&dl=1" : ""); };

  function getJson(u) { return fetch(u, { credentials: "same-origin" }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Request failed"); return d; }); }); }
  function post(u, fd) { fd.append("csrf", C.csrf || ""); return fetch(u, { method: "POST", body: fd, credentials: "same-origin" }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Request failed"); return d; }); }); }
  function loadCounts() { return getJson(API + "/index").then(function (d) { counts = d.counts || {}; paintEyes(true); }).catch(function () {}); }
  function files(keys) {
    var miss = keys.filter(function (k) { return !cache[k]; });
    var p = miss.length ? getJson(API + "?keys=" + encodeURIComponent(miss.join(","))).then(function (d) {
      miss.forEach(function (k) { cache[k] = []; });
      d.files.forEach(function (f) { cache[f.key].push(f); });
    }) : Promise.resolve();
    return p.then(function () { return keys.reduce(function (a, k) { return a.concat(cache[k] || []); }, []); });
  }
  function forget(key) { delete cache[key]; }

  // Photos: drawn again at most 1600 px on the long side as JPEG, a little smaller if still over 300 KB. PDFs as they are.
  function shrink(file) {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      if (file.size > 2 * 1048576) return Promise.reject(new Error(file.name + " is " + kb(file.size) + ". PDFs can be up to 2 MB; scan it at a lower quality (150 dpi, black and white) or take a photo instead."));
      return Promise.resolve({ blob: file, name: file.name });
    }
    if (!/^image\//.test(file.type)) return Promise.reject(new Error(file.name + ": only photos and PDF files can be attached."));
    return new Promise(function (ok, bad) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(u);
        var tries = [[1600, 0.72], [1400, 0.6], [1200, 0.5]], i = 0;
        (function next() {
          var max = tries[i][0], s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          var cv = document.createElement("canvas"); cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
          var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
          cv.toBlob(function (b) {
            if (!b) { bad(new Error(file.name + " could not be read.")); return; }
            if (b.size > 300 * 1024 && ++i < tries.length) { next(); return; }
            ok({ blob: b.size < file.size || file.type !== "image/jpeg" ? b : file, name: file.name.replace(/\.[^.]+$/, "") + ".jpg" });
          }, "image/jpeg", tries[i][1]);
        })();
      };
      img.onerror = function () { URL.revokeObjectURL(u); bad(new Error(file.name + " is not a photo this browser can open (HEIC photos: set the phone camera to 'Most compatible').")); };
      img.src = u;
    });
  }
  function upload(key, list, say) {
    var done = 0, errs = [];
    return list.reduce(function (p, file) {
      return p.then(function () {
        say("Uploading " + (++done) + " of " + list.length + "…");
        return shrink(file).then(function (s) {
          var fd = new FormData(); fd.append("path", key); fd.append("name", s.name); fd.append("file", s.blob, s.name);
          return post(API, fd);
        }).catch(function (e) { errs.push(e.message); });
      });
    }, Promise.resolve()).then(function () { forget(key); return loadCounts().then(function () { return errs; }); });
  }

  // ---- the panel on every form
  function keysOf(c, r) {
    var k = r && r.id ? [c + "/" + r.id] : [];
    if (c === "journals" && r && r.source && r.source.c && r.source.id) k.push(r.source.c + "/" + r.source.id);
    return k;
  }
  function tile(f, own) {
    var pic = /^image\//.test(f.mime);
    var rm = own && C.edit && (C.owner || String(C.uid) === "u" + f.uid) ? "<button type=\"button\" class=\"fs-attrm\" data-attrm=\"" + f.id + "\" data-attkey=\"" + h(f.key) + "\" title=\"Remove\">×</button>" : "";
    return "<div class=\"fs-atttile\"><a href=\"" + url(f) + "\" target=\"_blank\" rel=\"noopener\" title=\"" + h(f.name) + " · " + kb(f.size) + " · " + h(f.by) + "\">" +
      (pic ? "<img src=\"" + url(f) + "\" alt=\"\" loading=\"lazy\">" : "<span class=\"fs-attpdf\">PDF</span>") +
      "<span class=\"fs-attnm\">" + h(f.name) + "</span><span class=\"fs-attsz\">" + kb(f.size) + "</span></a>" + rm + "</div>";
  }
  function panel() {
    var frm = document.getElementById("frm"); if (!frm || typeof F === "undefined" || !F || !F.c) return;
    var box = document.getElementById("fsAtt");
    if (!box) {
      box = document.createElement("div"); box.id = "fsAtt"; box.className = "fs-attbox";
      var act = frm.querySelector(".actions"); if (!act) return;
      act.parentNode.insertBefore(box, act);
    }
    var r = F.rec || {}, own = r.id ? F.c + "/" + r.id : "", keys = keysOf(F.c, r);
    var head = "<div class=\"fs-atthd\"><b>Supporting documents</b>" + (C.edit ? "<label class=\"btn sm\">Attach photo or PDF<input type=\"file\" id=\"fsAttPick\" accept=\"image/*,application/pdf\" multiple hidden></label>" : "") +
      (F.c === "journals" && r.id ? "<button type=\"button\" class=\"btn sm\" id=\"fsAttView\">" + EYE + " View with documents</button>" : "") + "<span class=\"fs-attmsg\" id=\"fsAttMsg\"></span></div>";
    var wait = pending && pending.c === F.c && !r.id ? pending.files : [];
    var paint = function (list) {
      if (!document.body.contains(box)) return;
      var mine = list.filter(function (f) { return f.key === own; }), src = list.filter(function (f) { return f.key !== own; });
      box.innerHTML = head + "<div class=\"fs-attgrid\">" + mine.map(function (f) { return tile(f, true); }).join("") +
        wait.map(function (f) { return "<div class=\"fs-atttile wait\"><span class=\"fs-attpdf\">" + (/pdf/i.test(f.type) ? "PDF" : "Photo") + "</span><span class=\"fs-attnm\">" + h(f.name) + "</span><span class=\"fs-attsz\">Uploads when you save</span></div>"; }).join("") +
        (!mine.length && !wait.length ? "<p class=\"muted fs-attnone\">" + (C.edit ? "No files yet. Attach the receipt, bill or approval here; photos are made small automatically." : "No files attached.") + "</p>" : "") + "</div>" +
        (src.length ? "<p class=\"muted\" style=\"margin:8px 0 4px\">From the document this voucher came from</p><div class=\"fs-attgrid\">" + src.map(function (f) { return tile(f, false); }).join("") + "</div>" : "");
    };
    paint([]);
    if (keys.length) files(keys).then(paint).catch(function () {});
  }

  // ---- the eye on voucher numbers, and the voucher sheet with its documents
  function jvKeys(j) { return keysOf("journals", j); }
  function nOf(j) { return jvKeys(j).reduce(function (a, k) { return a + (counts[k] || 0); }, 0); }
  function byRef(ref) { return Store.data.journals.find(function (j) { return j.ref === ref; }); }
  function view(j) { if (j && typeof jvSheet === "function" && typeof sheetOpen === "function") sheetOpen(jvSheet(j)); }
  function paintEyes(all) {
    if (typeof Store === "undefined" || !Store.data || !Store.data.journals) return;
    document.querySelectorAll(".fs-vlink[data-vref]").forEach(function (a) {
      var eye = a.nextElementSibling && a.nextElementSibling.classList.contains("fs-veye") ? a.nextElementSibling : null;
      if (eye && !all) return;
      var j = byRef(a.getAttribute("data-vref")); if (!j) return;
      if (!eye) {
        eye = document.createElement("button"); eye.type = "button"; eye.className = "fs-veye"; eye.setAttribute("data-veye", a.getAttribute("data-vref"));
        a.parentNode.insertBefore(eye, a.nextSibling);
      }
      var n = nOf(j), html = EYE + (n ? "<sup>" + n + "</sup>" : "");
      if (eye.innerHTML !== html) eye.innerHTML = html;
      eye.title = "View voucher " + j.ref + (n ? " with " + n + " supporting document" + (n > 1 ? "s" : "") : " (no documents attached)");
    });
  }
  function sheetBlock(list) {
    if (!list.length) return "<h4>Supporting documents</h4><p class=\"muted\">No supporting documents attached in the ERP.</p>";
    return "<h4>Supporting documents (" + list.length + ")</h4>" + list.map(function (f) {
      var cap = "<figcaption>" + h(f.name) + " · " + kb(f.size) + (f.by ? " · attached by " + h(f.by) : "") + " · <a href=\"" + url(f) + "\" target=\"_blank\" rel=\"noopener\">open</a> · <a href=\"" + url(f, 1) + "\">download</a></figcaption>";
      return /^image\//.test(f.mime) ? "<figure class=\"fs-attfig\"><a href=\"" + url(f) + "\" target=\"_blank\" rel=\"noopener\"><img src=\"" + url(f) + "\" alt=\"" + h(f.name) + "\"></a>" + cap + "</figure>"
        : "<figure class=\"fs-attfig pdf\" data-pdf=\"" + url(f) + "\" data-name=\"" + h(f.name) + "\"><div class=\"fs-pdfpages\"><p class=\"muted\">Loading " + h(f.name) + "…</p></div>" + cap + "</figure>";
    }).join("");
  }
  // A PDF in a frame is left out when the voucher is printed (hassan, 2026-10-30: "in print preview it shows blank"), so
  // its pages are drawn as pictures with pdf.js: they show on screen and print with the voucher. Up to 20 pages.
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/", pdfLib = null, pdfBusy = 0, printGo = false;
  function loadPdfJs() {
    if (!pdfLib) pdfLib = new Promise(function (ok, bad) {
      if (window.pdfjsLib) { ok(window.pdfjsLib); return; }
      var sc = document.createElement("script"); sc.src = PDFJS + "pdf.min.js";
      sc.onload = function () { if (!window.pdfjsLib) { bad(new Error("pdf.js")); return; } window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); };
      sc.onerror = function () { pdfLib = null; bad(new Error("pdf.js")); };
      document.head.appendChild(sc);
    });
    return pdfLib;
  }
  function pdfPages(fig) {
    var box = fig.querySelector(".fs-pdfpages"), src = fig.getAttribute("data-pdf");
    var frame = function () { box.innerHTML = "<iframe src=\"" + src + "#view=FitH\" title=\"" + h(fig.getAttribute("data-name")) + "\"></iframe><p class=\"muted fs-noprint-note\">This PDF could not be drawn for printing; use open to print it.</p>"; };
    pdfBusy++;
    var done = function () { pdfBusy = Math.max(0, pdfBusy - 1); };
    loadPdfJs().then(function (lib) { return lib.getDocument({ url: src, withCredentials: true }).promise; }).then(function (doc) {
      var max = Math.min(doc.numPages, 20), out = [];
      var one = function (i) {
        if (i > max) return Promise.resolve();
        return doc.getPage(i).then(function (pg) {
          var v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(2.5, 1400 / v1.width) });
          var cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
          var g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
          return pg.render({ canvasContext: g, viewport: vp }).promise.then(function () {
            out.push("<img src=\"" + cv.toDataURL("image/jpeg", 0.85) + "\" alt=\"Page " + i + "\">"); return one(i + 1);
          });
        });
      };
      return one(1).then(function () {
        box.innerHTML = out.join("") + (doc.numPages > max ? "<p class=\"muted\">Showing the first " + max + " of " + doc.numPages + " pages; use open for the rest.</p>" : "");
      });
    }).catch(frame).then(done, done);
  }
  function fillSheets() {
    document.querySelectorAll(".fs-attsheet[data-keys]:not([data-done])").forEach(function (el) {
      el.setAttribute("data-done", "1");
      files(el.getAttribute("data-keys").split(",").filter(Boolean)).then(function (list) { el.innerHTML = sheetBlock(list); el.querySelectorAll("[data-pdf]").forEach(pdfPages); })
        .catch(function () { el.innerHTML = "<p class=\"muted fs-atterr\">Supporting documents could not be loaded.</p>"; });
    });
  }

  function hook() {
    if (typeof Store === "undefined" || !Store.data || typeof drawForm !== "function" || typeof openForm !== "function" || typeof jvSheet !== "function") return false;

    openForm = (function (old) { // eslint-disable-line no-global-assign
      return function () { pending = null; return old.apply(this, arguments); };
    })(openForm);

    drawForm = (function (old) { // eslint-disable-line no-global-assign
      return function () { var out = old.apply(this, arguments); try { panel(); } catch (e) { console.warn(e); } return out; };
    })(drawForm);

    jvSheet = (function (old) { // eslint-disable-line no-global-assign
      return function (j) {
        var html = old.apply(this, arguments);
        try {
          if (!j || !j.id) return html;
          var d = document.createElement("div"); d.innerHTML = html;
          var sh = d.querySelector(".sheet");
          if (sh && !sh.querySelector(".fs-attsheet")) {
            var b = document.createElement("div"); b.className = "fs-attsheet"; b.setAttribute("data-keys", jvKeys(j).join(","));
            b.innerHTML = "<p class=\"muted\">Loading supporting documents…</p>"; sh.appendChild(b); html = d.innerHTML;
          }
        } catch (e) { console.warn(e); }
        return html;
      };
    })(jvSheet);

    // files picked on a new record go up once the save has given it an id
    Store.save = (function (old) {
      return async function (c, rec) {
        var id = await old.apply(this, arguments);
        if (pending && pending.c === c && !pending.sent && id && (!rec || !rec.id || rec.id === id)) {
          var p = pending; p.sent = true; pending = null;
          upload(c + "/" + id, p.files, function () {}).then(function (errs) { if (errs.length) alert("Saved, but some files were not attached:\n" + errs.join("\n")); });
        }
        return id;
      };
    })(Store.save);

    document.addEventListener("change", function (e) {
      if (!e.target || e.target.id !== "fsAttPick" || !e.target.files.length || typeof F === "undefined" || !F) return;
      var list = Array.prototype.slice.call(e.target.files), msg = document.getElementById("fsAttMsg");
      var say = function (t) { if (msg) msg.textContent = t; };
      if (!F.rec.id) {
        if (!pending || pending.c !== F.c) pending = { c: F.c, files: [] };
        pending.files = pending.files.concat(list); panel(); return;
      }
      if (busy) return; busy = true;
      upload(F.c + "/" + F.rec.id, list, say).then(function (errs) { busy = false; panel(); var m = document.getElementById("fsAttMsg"); if (m) m.textContent = errs.length ? errs.join(" ") : "Attached."; });
    });
    // Print waits until the attached PDFs are drawn, so they are not left out (up to 20 seconds). On window, so it runs
    // before the app's own click handlers.
    window.addEventListener("click", function (e) {
      var p = e.target.closest && e.target.closest("#printSheet");
      if (!p || printGo) return;
      var loading = function () { return pdfBusy > 0 || !!document.querySelector("#printLayer .fs-attsheet[data-keys]:not([data-done]), #printLayer .fs-attsheet p.muted:only-child:not(.fs-atterr)"); };
      if (!loading()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var label = p.textContent, t0 = Date.now(); p.textContent = "Preparing attachments…"; p.disabled = true;
      (function wait() {
        if (loading() && Date.now() - t0 < 20000) { setTimeout(wait, 250); return; }
        p.textContent = label; p.disabled = false; printGo = true;
        try { p.click(); } finally { printGo = false; }
      })();
    }, true);
    document.addEventListener("click", function (e) {
      var t = e.target.closest && e.target.closest("[data-attrm],#fsAttView,[data-veye],#cancelBtn");
      if (!t) return;
      if (t.id === "cancelBtn") { pending = null; return; }
      if (t.id === "fsAttView") { e.preventDefault(); var j = F && F.rec && Store.data.journals.find(function (x) { return x.id === F.rec.id; }); view(j || F.rec); return; }
      if (t.hasAttribute("data-veye")) { e.preventDefault(); e.stopImmediatePropagation(); view(byRef(t.getAttribute("data-veye"))); return; }
      e.preventDefault();
      if (!confirm("Remove this file from the record? The ERP keeps a note of who removed it.")) return;
      var fd = new FormData(); fd.append("id", t.getAttribute("data-attrm"));
      post(API + "/delete", fd).then(function () { forget(t.getAttribute("data-attkey")); return loadCounts(); }).then(panel).catch(function (er) { alert(er.message); });
    }, true);

    var queued = false;
    new MutationObserver(function () {
      if (queued) return; queued = true;
      requestAnimationFrame(function () { queued = false; try { paintEyes(false); fillSheets(); } catch (e) { console.warn(e); } });
    }).observe(document.body, { childList: true, subtree: true });
    loadCounts(); setInterval(function () { if (!document.hidden) loadCounts(); }, 120000);
    return true;
  }
  var css = document.createElement("style");
  css.textContent = ".fs-attbox{grid-column:1/-1;margin:14px 0 4px;padding:12px;border:1px dashed var(--line,#d6dbe3);border-radius:10px;background:var(--panel,#fff)}" +
    ".fs-atthd{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px}.fs-atthd b{margin-right:auto}.fs-atthd label.btn{cursor:pointer}.fs-atthd svg{vertical-align:-3px}.fs-attmsg{font-size:12px;color:#64748b;width:100%}" +
    ".fs-attgrid{display:flex;flex-wrap:wrap;gap:8px}.fs-atttile{position:relative;width:112px;border:1px solid var(--line,#e3e6eb);border-radius:8px;overflow:hidden;background:#f8fafc;font-size:11px}" +
    ".fs-atttile a{display:block;color:inherit;text-decoration:none}.fs-atttile img{display:block;width:100%;height:80px;object-fit:cover;background:#fff}" +
    ".fs-attpdf{display:grid;place-items:center;height:80px;background:#fdecec;color:#b42318;font-weight:700;font-size:15px}.fs-atttile.wait .fs-attpdf{background:#eef2f7;color:#475569}" +
    ".fs-attnm{display:block;padding:4px 6px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fs-attsz{display:block;padding:0 6px 5px;color:#64748b}" +
    ".fs-attrm{position:absolute;top:3px;right:3px;width:22px;height:22px;border:0;border-radius:50%;background:rgba(15,23,42,.7);color:#fff;font-size:15px;line-height:1;cursor:pointer}" +
    ".fs-attnone{margin:0}.fs-veye{display:inline-flex;align-items:center;gap:1px;margin-left:4px;padding:1px 4px;border:1px solid var(--line,#d6dbe3);border-radius:6px;background:var(--panel,#fff);color:var(--acc,#1F6FB8);cursor:pointer;vertical-align:middle;line-height:1}" +
    ".fs-veye:hover{background:#eaf2fb}.fs-veye sup{font-size:10px;font-weight:700;margin-left:1px}" +
    ".fs-attsheet{margin-top:14px}.fs-attfig{margin:10px 0;page-break-inside:avoid;break-inside:avoid}.fs-attfig img{display:block;max-width:100%;max-height:900px;margin:0 auto;border:1px solid #ddd}" +
    ".fs-attfig iframe{display:block;width:100%;height:720px;border:1px solid #ddd}.fs-pdfpages img{display:block;width:100%;margin:0 0 8px;border:1px solid #ddd;break-inside:avoid;page-break-inside:avoid}.fs-attfig figcaption{font-size:11px;color:#555;margin-top:4px}" +
    "@media print{.fs-veye,.fs-attbox{display:none!important}.fs-attfig img{max-height:24cm}.fs-attfig.pdf iframe,.fs-noprint-note{display:none}.fs-pdfpages img{max-height:25cm;object-fit:contain}.fs-attfig a{color:inherit;text-decoration:none}}";
  document.head.appendChild(css);
  function start() { if (!hook()) setTimeout(start, 300); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
