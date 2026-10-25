// Staff chat window (window.FS_CHAT, set by the page): a button in the bottom-right corner opens a list of
// conversations, one-to-one or group, with files. It checks for new messages every few seconds.
(function () {
  var C = window.FS_CHAT;
  if (!C || window.__fsChat) return;
  window.__fsChat = true;
  var OPEN_MS = 4000, SHUT_MS = 12000;
  var S = { max: 0, rooms: [], people: [], msgs: {}, more: {}, room: 0, view: "list", open: false, group: false, picked: {}, file: null, first: true };
  var root, panel, badge, timer, busy = false, baseTitle = document.title;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  function text(s) {
    return esc(s).replace(/https?:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + "</a>"; }).replace(/\n/g, "<br>");
  }
  function size(n) { return n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB"; }
  function when(at) { return String(at).slice(11, 16); }
  function day(at) {
    var d = String(at).slice(0, 10), t = new Date(), y = new Date(Date.now() - 864e5);
    function iso(x) { return x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2); }
    if (d === iso(t)) return "Today";
    if (d === iso(y)) return "Yesterday";
    var p = d.split("-");
    return new Date(+p[0], p[1] - 1, +p[2]).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function initial(n) { return esc(String(n || "?").charAt(0).toUpperCase()); }
  function api(path, body) {
    var o = { credentials: "same-origin", headers: { "X-CSRF-Token": C.csrf } };
    if (body) {
      o.method = "POST";
      if (body instanceof FormData) o.body = body;
      else { o.body = JSON.stringify(body); o.headers["Content-Type"] = "application/json"; }
    }
    return fetch(C.api + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || "Something went wrong. Try again.");
        return j;
      });
    });
  }
  function roomById(id) { for (var i = 0; i < S.rooms.length; i++) if (S.rooms[i].id === id) return S.rooms[i]; return null; }

  // ---- Building the window ----
  function build() {
    root = document.createElement("div");
    root.id = "fs-chat";
    root.innerHTML = '<button type="button" class="fsc-fab" title="Staff chat" aria-label="Staff chat">'
      + '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>'
      + '<b class="fsc-badge" hidden></b></button><section class="fsc-panel" hidden role="dialog" aria-label="Staff chat"></section><input type="file" class="fsc-pick" hidden>';
    document.body.appendChild(root);
    panel = root.querySelector(".fsc-panel");
    badge = root.querySelector(".fsc-badge");
    // Keys typed in the chat must not reach the app's own shortcuts.
    ["keydown", "keyup", "keypress"].forEach(function (t) { root.addEventListener(t, function (e) { e.stopPropagation(); }); });
    root.querySelector(".fsc-fab").addEventListener("click", function () { toggle(!S.open); });
    panel.addEventListener("click", onClick);
    panel.addEventListener("input", onInput);
    panel.addEventListener("change", onChange);
    // The file picker lives outside the redrawn panel, so a new message arriving while it is open does not lose the file.
    root.querySelector(".fsc-pick").addEventListener("change", onChange);
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); if (S.view !== "list") show("list"); else toggle(false); }
      if (e.key === "Enter" && !e.shiftKey && e.target.matches(".fsc-input")) { e.preventDefault(); send(); }
    });
  }

  function toggle(on) {
    S.open = on;
    panel.hidden = !on;
    root.classList.toggle("is-open", on);
    if (on) { render(); if (S.view === "room") markRead(); }
    schedule(0);
  }

  function show(view, room) {
    S.view = view;
    if (room) S.room = room;
    if (view !== "room") S.room = view === "list" ? 0 : S.room;
    if (view === "new") { S.group = false; S.picked = {}; }
    render();
    if (view === "room") {
      if (!S.msgs[S.room]) loadHistory(S.room);
      markRead();
    }
  }

  function head(title, back, extra) {
    return '<header class="fsc-head">' + (back ? '<button type="button" class="fsc-icon" data-act="back" title="Back" aria-label="Back">&#8592;</button>' : "")
      + '<h2>' + title + "</h2>" + (extra || "")
      + '<button type="button" class="fsc-icon" data-act="close" title="Close" aria-label="Close">&#215;</button></header>';
  }

  function render() {
    if (!S.open) return;
    if (S.view === "room" && roomById(S.room)) return renderRoom();
    if (S.view === "new") return renderNew();
    S.view = "list";
    var h = head("Staff chat", false, '<button type="button" class="fsc-new" data-act="new">+ New</button>')
      + '<p class="fsc-note">Messages and files are kept and can be seen by the admin.</p><div class="fsc-list">';
    if (!S.rooms.length) h += '<p class="fsc-empty">No conversations yet. Press <b>+ New</b> to message a colleague or start a group.</p>';
    S.rooms.forEach(function (r) {
      var l = r.last, pre = !l ? "No messages yet" : l.del ? "Message deleted" : (l.uid === C.uid ? "You: " : r.kind === "group" ? l.name.split(" ")[0] + ": " : "") + (l.body || (l.file ? "📎 " + l.file.name : ""));
      h += '<button type="button" class="fsc-row' + (r.unread ? " is-unread" : "") + '" data-room="' + r.id + '"><i class="fsc-av' + (r.kind === "group" ? " is-group" : "") + '">' + (r.kind === "group" ? "#" : initial(r.name)) + "</i>"
        + '<span class="fsc-meta"><b>' + esc(r.name) + "</b><small>" + esc(pre) + "</small></span>"
        + '<span class="fsc-side">' + (l ? "<small>" + (day(l.at) === "Today" ? when(l.at) : esc(day(l.at))) + "</small>" : "") + (r.unread ? "<em>" + r.unread + "</em>" : "") + "</span></button>";
    });
    h += "</div>";
    if (C.admin) h += '<a class="fsc-log" href="/erp/chat-log" target="_top">Open the full Chat log</a>';
    if ("Notification" in window && Notification.permission === "default") h += '<button type="button" class="fsc-alerts" data-act="alerts">Turn on pop-up alerts for new messages</button>';
    panel.innerHTML = h;
  }

  function renderNew() {
    var h = head(S.group ? "New group" : "New chat", true)
      + '<div class="fsc-tabs"><button type="button" data-act="mode" data-g="0" class="' + (S.group ? "" : "is-on") + '">Person</button><button type="button" data-act="mode" data-g="1" class="' + (S.group ? "is-on" : "") + '">Group</button></div>'
      + (S.group ? '<input class="fsc-field fsc-gname" maxlength="60" placeholder="Group name, e.g. Accounts team">' : "")
      + '<input class="fsc-field fsc-find" placeholder="Search people">'
      + '<div class="fsc-list fsc-people">';
    if (!S.people.length) h += '<p class="fsc-empty">There is nobody else in the ERP yet. Add staff under Users and access.</p>';
    S.people.forEach(function (p) {
      h += S.group
        ? '<label class="fsc-row" data-name="' + esc(p.name.toLowerCase()) + '"><input type="checkbox" value="' + p.id + '"' + (S.picked[p.id] ? " checked" : "") + '><i class="fsc-av">' + initial(p.name) + "</i><span class=\"fsc-meta\"><b>" + esc(p.name) + "</b></span></label>"
        : '<button type="button" class="fsc-row" data-person="' + p.id + '" data-name="' + esc(p.name.toLowerCase()) + '"><i class="fsc-av">' + initial(p.name) + "</i><span class=\"fsc-meta\"><b>" + esc(p.name) + "</b></span></button>";
    });
    h += "</div>" + (S.group ? '<div class="fsc-foot"><p class="fsc-err" hidden></p><button type="button" class="fsc-btn" data-act="mkgroup">Create group</button></div>' : "");
    panel.innerHTML = h;
    var f = panel.querySelector(S.group ? ".fsc-gname" : ".fsc-find");
    if (f) f.focus();
  }

  function renderRoom() {
    var r = roomById(S.room), list = S.msgs[S.room], old = panel.querySelector(".fsc-msgs");
    var stick = !old || old.scrollHeight - old.scrollTop - old.clientHeight < 60, draft = panel.querySelector(".fsc-input");
    var keep = draft && panel.getAttribute("data-shown") === String(S.room) ? draft.value : "";
    var sub = r.kind === "group" ? r.members.length + " people" : "One-to-one chat";
    var h = head(esc(r.name) + "<small>" + sub + "</small>", true) + '<div class="fsc-msgs">';
    if (!list) h += '<p class="fsc-empty">Loading…</p>';
    else {
      if (S.more[S.room]) h += '<button type="button" class="fsc-older" data-act="older">Show earlier messages</button>';
      if (!list.length) h += '<p class="fsc-empty">Say hello to ' + esc(r.name) + ".</p>";
      var lastDay = "";
      list.forEach(function (m) {
        var d = day(m.at), mine = m.uid === C.uid;
        if (d !== lastDay) { h += '<p class="fsc-day"><span>' + esc(d) + "</span></p>"; lastDay = d; }
        h += '<div class="fsc-msg' + (mine ? " is-mine" : "") + (m.del ? " is-del" : "") + '">'
          + (!mine && r.kind === "group" ? "<b>" + esc(m.name) + "</b>" : "");
        if (m.del) h += "<p><i>Message deleted</i></p>";
        else {
          if (m.file) {
            var url = C.api + "/file/" + m.file.id;
            h += m.file.image
              ? '<a class="fsc-img" href="' + url + '" target="_blank" rel="noopener"><img src="' + url + '" alt="' + esc(m.file.name) + '" loading="lazy"></a>'
              : '<a class="fsc-file" href="' + url + '?dl=1"><span>📎</span><span><b>' + esc(m.file.name) + "</b><small>" + size(m.file.size) + "</small></span></a>";
          }
          if (m.body) h += "<p>" + text(m.body) + "</p>";
        }
        h += '<small class="fsc-time">' + when(m.at) + (mine && !m.del ? ' · <button type="button" data-del="' + m.id + '">Delete</button>' : "") + "</small></div>";
      });
    }
    h += '</div><div class="fsc-compose"><div class="fsc-chip" hidden></div><p class="fsc-err" hidden></p><div class="fsc-bar">'
      + '<button type="button" class="fsc-icon fsc-attach" data-act="attach" title="Attach a file (up to ' + Math.round(C.max / 1048576) + ' MB)" aria-label="Attach a file">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></button>'
      + '<textarea class="fsc-input" rows="1" maxlength="4000" placeholder="Write a message"></textarea>'
      + '<button type="button" class="fsc-send" data-act="send" title="Send" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.8L3.4 3.6a1 1 0 0 0-1.4 1.1L4 11l9 1-9 1-2 6.3a1 1 0 0 0 1.4 1.1z"/></svg></button></div></div>';
    var focused = document.activeElement && document.activeElement.classList.contains("fsc-input");
    panel.innerHTML = h;
    panel.setAttribute("data-shown", S.room);
    var box = panel.querySelector(".fsc-msgs"), input = panel.querySelector(".fsc-input");
    input.value = keep;
    grow(input);
    showFile();
    if (stick) box.scrollTop = box.scrollHeight; else if (old) box.scrollTop = old.scrollTop;
    if (focused || !keep) input.focus();
  }

  function grow(t) { t.style.height = "auto"; t.style.height = Math.min(120, t.scrollHeight) + "px"; }
  function showFile() {
    var chip = panel.querySelector(".fsc-chip");
    if (!chip) return;
    chip.hidden = !S.file;
    if (S.file) chip.innerHTML = "📎 " + esc(S.file.name) + " <small>" + size(S.file.size) + '</small><button type="button" data-act="unfile" aria-label="Remove file">&#215;</button>';
  }
  function err(msg) {
    var e = panel.querySelector(".fsc-err");
    if (e) { e.textContent = msg || ""; e.hidden = !msg; }
  }

  // ---- Actions ----
  function onClick(e) {
    var t = e.target.closest("button, [data-room]");
    if (!t || !panel.contains(t)) return;
    var act = t.getAttribute("data-act");
    if (act === "close") return toggle(false);
    if (act === "back") return show("list");
    if (act === "new") return show("new");
    if (act === "mode") { S.group = t.getAttribute("data-g") === "1"; S.picked = {}; return renderNew(); }
    if (act === "send") return send();
    if (act === "attach") { root.querySelector(".fsc-pick").click(); return; }
    if (act === "unfile") { S.file = null; showFile(); return; }
    if (act === "older") return loadHistory(S.room, true);
    if (act === "alerts") { Notification.requestPermission().then(render); return; }
    if (act === "mkgroup") {
      var name = panel.querySelector(".fsc-gname").value.trim(), ids = Object.keys(S.picked).filter(function (k) { return S.picked[k]; }).map(Number);
      if (!name) return err("Give the group a name.");
      if (!ids.length) return err("Tick at least one person.");
      t.disabled = true;
      return api("/group", { name: name, members: ids }).then(function (j) { return poll().then(function () { show("room", j.room); }); })
        .catch(function (x) { t.disabled = false; err(x.message); });
    }
    if (t.hasAttribute("data-person")) {
      return api("/open", { user: +t.getAttribute("data-person") }).then(function (j) { return poll().then(function () { show("room", j.room); }); })
        .catch(function (x) { alert(x.message); });
    }
    if (t.hasAttribute("data-del")) {
      if (!confirm("Delete this message for everyone in the chat?")) return;
      var id = +t.getAttribute("data-del");
      return api("/delete", { room: S.room, id: id }).then(function () {
        (S.msgs[S.room] || []).forEach(function (m) { if (m.id === id) { m.del = true; m.body = ""; m.file = null; } });
        renderRoom();
      }).catch(function (x) { alert(x.message); });
    }
    if (t.hasAttribute("data-room")) return show("room", +t.getAttribute("data-room"));
  }

  function onInput(e) {
    if (e.target.matches(".fsc-input")) grow(e.target);
    if (e.target.matches(".fsc-find")) {
      var q = e.target.value.trim().toLowerCase();
      panel.querySelectorAll(".fsc-people [data-name]").forEach(function (r) { r.hidden = q && r.getAttribute("data-name").indexOf(q) < 0; });
    }
  }

  function onChange(e) {
    if (e.target.matches(".fsc-people input[type=checkbox]")) S.picked[e.target.value] = e.target.checked;
    if (e.target.matches(".fsc-pick")) {
      var f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      if (f.size > C.max) { err("That file is too big. The limit is " + Math.round(C.max / 1048576) + " MB."); return; }
      err("");
      S.file = f;
      showFile();
      var input = panel.querySelector(".fsc-input");
      if (input) input.focus();
    }
  }

  function send() {
    var input = panel.querySelector(".fsc-input"), btn = panel.querySelector(".fsc-send");
    if (!input || btn.disabled) return;
    var body = input.value.trim();
    if (!body && !S.file) return;
    var fd = new FormData(), room = S.room;
    fd.append("room", room);
    fd.append("body", body);
    if (S.file) fd.append("file", S.file);
    btn.disabled = true;
    err(S.file ? "Sending " + S.file.name + "…" : "");
    api("/send", fd).then(function (j) {
      btn.disabled = false;
      input.value = "";
      S.file = null;
      err("");
      add(j.msg);
      var r = roomById(room);
      if (r) { r.last = j.msg; S.rooms.sort(function (a, b) { return (b.last ? b.last.id : 0) - (a.last ? a.last.id : 0); }); }
      if (S.view === "room" && S.room === room) { renderRoom(); panel.querySelector(".fsc-msgs").scrollTop = 1e9; }
    }).catch(function (x) { btn.disabled = false; err(x.message); });
  }

  function add(m) {
    var list = S.msgs[m.room];
    if (!list) return;
    for (var i = 0; i < list.length; i++) if (list[i].id === m.id) { list[i] = m; return; }
    list.push(m);
    list.sort(function (a, b) { return a.id - b.id; });
  }

  function loadHistory(room, older) {
    var list = S.msgs[room], before = older && list && list.length ? list[0].id : 0;
    return api("/history?room=" + room + (before ? "&before=" + before : "")).then(function (j) {
      S.msgs[room] = older ? j.msgs.concat(S.msgs[room] || []) : j.msgs;
      S.more[room] = j.msgs.length >= 60;
      if (S.view === "room" && S.room === room) {
        var box = panel.querySelector(".fsc-msgs"), from = box ? box.scrollHeight - box.scrollTop : 0;
        renderRoom();
        if (older) { box = panel.querySelector(".fsc-msgs"); box.scrollTop = box.scrollHeight - from; }
        markRead();
      }
    }).catch(function () {});
  }

  function markRead() {
    var r = roomById(S.room), list = S.msgs[S.room];
    if (!r || !S.open || document.hidden) return;
    var upto = list && list.length ? list[list.length - 1].id : r.last ? r.last.id : 0;
    if (r.unread) { r.unread = 0; updateBadge(); api("/read", { room: r.id, upto: upto }).catch(function () {}); }
  }

  function updateBadge() {
    var n = 0;
    S.rooms.forEach(function (r) { n += r.unread; });
    badge.hidden = !n;
    badge.textContent = n > 99 ? "99+" : n;
    var t = document.title.replace(/^\(\d+\+?\) /, "");
    if (!/^\(\d/.test(document.title)) baseTitle = document.title;
    document.title = n ? "(" + (n > 99 ? "99+" : n) + ") " + t : t;
  }

  function alertFor(msgs) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    msgs.forEach(function (m) {
      if (m.uid === C.uid || m.del) return;
      if (S.open && !document.hidden && S.view === "room" && S.room === m.room) return;
      var r = roomById(m.room);
      try {
        var n = new Notification(r && r.kind === "group" ? m.name + " in " + r.name : m.name, { body: m.body || (m.file ? "📎 " + m.file.name : ""), tag: "fs-chat-" + m.room });
        n.onclick = function () { window.focus(); toggle(true); show("room", m.room); n.close(); };
      } catch (x) {}
    });
  }

  // ---- Checking for new messages ----
  function poll() {
    if (busy) return Promise.resolve();
    busy = true;
    return api("/poll?after=" + S.max).then(function (j) {
      busy = false;
      var fresh = S.first ? [] : j.msgs.filter(function (m) { return !m.del; });
      S.first = false;
      S.max = Math.max(S.max, j.max);
      S.rooms = j.rooms;
      S.people = j.people;
      j.msgs.forEach(add);
      alertFor(fresh);
      if (S.open && S.view === "room" && S.room) {
        if (j.msgs.some(function (m) { return m.room === S.room; })) renderRoom();
        markRead();
      } else if (S.open && S.view === "list") render();
      updateBadge();
    }, function (x) {
      busy = false;
      if (/Signed out/.test(x.message)) { clearTimeout(timer); timer = null; root.hidden = true; throw x; }
    });
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(function tick() {
      if (document.hidden) { timer = setTimeout(tick, SHUT_MS); return; }
      poll().then(function () { timer = setTimeout(tick, S.open ? OPEN_MS : SHUT_MS); }, function () {});
    }, ms);
  }

  function start() {
    if (!document.body) return setTimeout(start, 50);
    build();
    schedule(0);
    document.addEventListener("visibilitychange", function () { if (!document.hidden && timer) schedule(0); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
