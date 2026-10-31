// FlowSuit ERP bridge for the dashboards built on claude.ai (TAJ Receivables, HSEC Finance).
// Each was built to save through window.claude.use("db" | "assets" | "user" | "downloads").
// This file provides those with the ERP server behind them, so uploads, follow-ups, history and
// targets are saved once and seen by every ERP user with access. It is inlined by erp.php with
// window.FS_BRIDGE (or FS_TAJ) = { api, csrf, uid, edit, owner, assets, name } set just before it.
(function () {
  var C = window.FS_BRIDGE || window.FS_TAJ; if (!C) return;
  var docs = {};          // "coll/id" -> data object
  var listeners = [];     // { kind: "doc"|"query", path|coll, order, dir, max, cb }
  var version = 0, loaded = false, names = {}, members = null, synced = null, ended = false;

  function err(code, message) { var e = new Error(message || code); e.code = code; return e; }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function collOf(path) { return path.split("/")[0]; }
  function idOf(path) { return path.split("/")[1]; }
  function newId() { var a = new Uint8Array(10), s = ""; crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) s += ("0" + a[i].toString(16)).slice(-2); return s; }

  function docSnap(path) {
    var d = docs[path];
    return { id: idOf(path), exists: d !== undefined, data: function () { return clone(d); } };
  }
  function querySnap(l) {
    var list = Object.keys(docs).filter(function (p) { return collOf(p) === l.coll; }).map(docSnap);
    if (l.order) list.sort(function (a, b) {
      var x = a.data()[l.order], y = b.data()[l.order], c = x < y ? -1 : x > y ? 1 : 0;
      return l.dir === "desc" ? -c : c;
    });
    if (l.max) list = list.slice(0, l.max);
    return { docs: list, size: list.length, empty: !list.length, forEach: function (f) { list.forEach(f); } };
  }
  function fire(changed) {
    listeners.forEach(function (l) {
      if (changed && !changed.some(function (p) { return l.kind === "doc" ? p === l.path : collOf(p) === l.coll; })) return;
      try { l.cb(l.kind === "doc" ? docSnap(l.path) : querySnap(l)); } catch (x) { setTimeout(function () { throw x; }); }
    });
  }

  function api(method, sub, body, headers) {
    var h = Object.assign({ "X-CSRF-Token": C.csrf }, headers || {});
    if (body && !(body instanceof Blob)) { h["Content-Type"] = "application/json"; body = JSON.stringify(body); }
    return fetch(C.api + sub, { method: method, headers: h, body: body, credentials: "same-origin" }).then(function (r) {
      if (r.status === 401) { ended = true; throw err("unauthenticated", "Your ERP session has ended. Reload the page and sign in again"); }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw err(j.code || "error", j.error || ("server error " + r.status));
        return j;
      });
    });
  }

  // Pull every document changed since the last pull. The first pull also brings the user list.
  function sync() {
    if (ended) return Promise.resolve();
    return api("GET", "/sync?v=" + version).then(function (j) {
      if (j.names) names = j.names;
      if (j.members) members = j.members;
      var changed = [];
      (j.docs || []).forEach(function (d) {
        if (d.data === null) delete docs[d.path]; else docs[d.path] = d.data;
        changed.push(d.path);
      });
      version = j.v;
      if (!loaded) { loaded = true; fire(); } else if (changed.length) fire(changed);
    });
  }
  function ready() { return synced || (synced = sync().catch(function (e) { synced = null; throw e; })); }
  setInterval(function () { if (loaded && !document.hidden) sync().catch(function () {}); }, 15000);
  document.addEventListener("visibilitychange", function () { if (loaded && !document.hidden) sync().catch(function () {}); });

  function write(op, path, data) {
    var before = docs[path];
    if (op === "update") {
      if (before === undefined) return Promise.reject(err("invalid_argument", "No document to update"));
      docs[path] = Object.assign({}, before, clone(data));
    } else if (op === "set") docs[path] = clone(data);
    else delete docs[path];
    fire([path]);
    return api("POST", "/doc", { op: op, path: path, data: data || null }).then(function (j) {
      if (j.v && j.v === version + 1) version = j.v;   // nothing else changed in between
      if (j.data && op !== "delete") { docs[path] = j.data; fire([path]); }   // the server changed it (e.g. a renumbered voucher)
    }, function (e) {
      if (before === undefined) delete docs[path]; else docs[path] = before;
      fire([path]); throw e;
    });
  }

  function docRef(path) {
    return {
      id: idOf(path), path: path,
      get: function () { return ready().then(function () { return docSnap(path); }); },
      set: function (d) { return write("set", path, d); },
      update: function (d) { return write("update", path, d); },
      delete: function () { return write("delete", path); },
      onSnapshot: function (cb) {
        var l = { kind: "doc", path: path, cb: cb }; listeners.push(l);
        if (loaded) cb(docSnap(path)); else ready().catch(function () {});
        return function () { listeners.splice(listeners.indexOf(l), 1); };
      }
    };
  }
  function query(coll, order, dir, max) {
    return {
      doc: function (id) { return docRef(coll + "/" + (id || newId())); },
      orderBy: function (f, d) { return query(coll, f, d || "asc", max); },
      limit: function (n) { return query(coll, order, dir, n); },
      get: function () { return ready().then(function () { return querySnap({ coll: coll, order: order, dir: dir, max: max }); }); },
      onSnapshot: function (cb) {
        var l = { kind: "query", coll: coll, order: order, dir: dir, max: max, cb: cb }; listeners.push(l);
        if (loaded) cb(querySnap(l)); else ready().catch(function () {});
        return function () { listeners.splice(listeners.indexOf(l), 1); };
      }
    };
  }
  var db = { doc: docRef, collection: function (c) { return query(c); } };

  // Saved exports are gzipped in the browser when it can, so large files stay small on the way up.
  function gzip(blob) {
    if (typeof CompressionStream === "undefined") return Promise.resolve(null);
    return new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).blob().catch(function () { return null; });
  }
  var assets = {
    upload: function (blob) {
      return gzip(blob).then(function (gz) {
        return api("POST", "/asset", gz || blob, { "Content-Type": "application/octet-stream", "X-Body-Gzip": gz ? "1" : "0" });
      }).then(function (j) { return { id: j.id, sizeBytes: j.sizeBytes }; });
    }
  };

  var user = {
    id: function () { return Promise.resolve(C.uid); },
    canEdit: function () { return Promise.resolve(!!C.edit); },
    me: function () { return Promise.resolve({ id: C.uid, name: C.name, isOwner: !!C.owner, canEdit: !!C.edit }); },
    isOwner: function () { return !!C.owner; },
    profiles: function (ids) {
      return ready().then(function () { var o = {}; (ids || []).forEach(function (id) { if (names[id]) o[id] = { id: id, name: names[id] }; }); return o; });
    },
    // People with access to this module, for screens that pick users (HSEC Users & roles).
    search: function (q) {
      q = String(q || "").toLowerCase();
      return ready().then(function () {
        return (members || []).filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0 || (m.email || "").toLowerCase().indexOf(q) >= 0; })
          .slice(0, 20).map(function (m) { return { id: m.id, name: m.name }; });
      });
    }
  };

  var downloads = {
    save: function (o) {
      // Apps pass either a Blob or plain text (HSEC's backup is a JSON string); createObjectURL needs a Blob.
      var name = o.filename || "download", data = o.data instanceof Blob ? o.data
        : new Blob([o.data == null ? "" : o.data], { type: /\.json$/i.test(name) ? "application/json" : /\.csv$/i.test(name) ? "text/csv" : "text/plain" });
      var url = URL.createObjectURL(data), a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return Promise.resolve();
    }
  };

  var caps = { db: db, assets: C.edit && C.assets !== false ? assets : null, user: user, downloads: downloads };
  window.claude = {
    use: function (n) { return caps[n] ? ready().then(function () { return caps[n]; }) : Promise.reject(err("unavailable", n + " is not available")); }
  };

  // The dashboard reads saved exports from /_blob/<id>; they live behind the ERP login.
  var realFetch = window.fetch.bind(window);
  window.fetch = function (u, o) {
    if (typeof u === "string" && u.indexOf("/_blob/") === 0) u = C.api + "/blob/" + encodeURIComponent(u.slice(7));
    return realFetch(u, o);
  };
})();
