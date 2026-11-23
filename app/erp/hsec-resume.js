// HSEC: an unsaved form survives the 10-minute sign-out (hassan, 2026-11-23: "system should save the progress of every
// user before pushing them logout and once a person relogin it should be relogin as where he left the work").
// idle.js asks window.FS_DRAFT for what is open but not saved (a record form, or the invoice editor) shortly before the
// sign-out; after signing in again it hands it back to window.FS_DRAFT_PUT, which reopens the same form with the typed
// values. Nothing is saved for them: they check it and press Save as usual (all the normal checks apply then).
(function () {
  /* global F, IE, Store, readForm, openForm, drawForm, ivRead, ivDraw, toast */
  var safe = function (f, d) { try { var v = f(); return v === undefined ? d : v; } catch (e) { return d; } };
  var copy = function (x) { return JSON.parse(JSON.stringify(x)); };

  window.FS_DRAFT = function () {
    var out = { sys: "hsec" };
    safe(function () {
      if (!F || !F.c || !document.getElementById("frm")) return;
      readForm();
      out.form = { c: F.c, id: (F.rec && F.rec.id) || "", rec: copy(F.rec || {}), lines: copy(F.lines || []) };
    }, null);
    safe(function () {
      if (!IE || !document.getElementById("ivOv")) return;
      ivRead();
      out.inv = copy(IE);
    }, null);
    return out.form || out.inv ? out : null;
  };

  var ready = function () { return safe(function () { return typeof openForm === "function" && Store && Store.data && Array.isArray(Store.data.accounts) && Store.data.accounts.length > 0 && !!document.getElementById("layer"); }, false); };
  var say = function (t) { safe(function () { toast(t); }, null); };

  window.FS_DRAFT_PUT = function (d) {
    if (!d || d.sys !== "hsec" || (!d.form && !d.inv)) return;
    var n = 0;
    (function go() {
      if (!ready()) { if (++n < 80) setTimeout(go, 500); return; }
      setTimeout(function () { // let the page finish drawing first
        var back = false;
        safe(function () {
          var f = d.form; if (!f || !f.c || !Store.data[f.c]) return;
          if (f.id && !Store.data[f.c].some(function (r) { return r.id === f.id; })) return; // deleted since
          if (f.id) openForm(f.c, f.id); else { var pre = copy(f.rec); delete pre.id; openForm(f.c, null, pre); }
          if (!F || F.c !== f.c) return;
          Object.assign(F.rec, f.rec);
          if (!f.id) delete F.rec.id;
          F.lines = f.lines || F.lines;
          drawForm();
          var t = document.getElementById("f_type"); if (t) t.dispatchEvent(new Event("change", { bubbles: true }));
          back = true;
        }, null);
        safe(function () {
          var v = d.inv; if (!v || back) return;
          if (v.id && !Store.data.receivables.some(function (r) { return r.id === v.id; })) return;
          IE = v; ivDraw(); // eslint-disable-line no-global-assign
          back = true;
        }, null);
        if (back) say("You were signed out for being idle. What you were typing is back: check it and press Save.");
      }, 800);
    })();
  };
})();
