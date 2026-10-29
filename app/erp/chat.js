// Staff chat window (window.FS_CHAT, set by the page): a button in the bottom-right corner opens a list of
// conversations, one-to-one or group, with files. It checks for new messages every few seconds.
(function () {
  var C = window.FS_CHAT;
  if (!C || window.__fsChat) return;
  window.__fsChat = true;
  var OPEN_MS = 4000, SHUT_MS = 6000;
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
  // Monogram: first letters of the first and last name, on a colour that stays the same for each person.
  function initial(n) {
    var w = String(n || "?").trim().split(/\s+/).filter(Boolean);
    return esc(((w[0] || "?").charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : "")).toUpperCase());
  }
  function hue(n) { var h = 0; String(n || "").split("").forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 360; }); return ' style="background:hsl(' + h + ',55%,40%)"'; }
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
    // Drag a file onto an open conversation to attach it.
    var depth = 0;
    function canDrop(e) { return S.view === "room" && panel.querySelector(".fsc-compose") && e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0; }
    panel.addEventListener("dragenter", function (e) { if (!canDrop(e)) return; e.preventDefault(); depth++; panel.classList.add("is-drop"); });
    panel.addEventListener("dragover", function (e) { if (!canDrop(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    panel.addEventListener("dragleave", function () { if (--depth <= 0) { depth = 0; panel.classList.remove("is-drop"); } });
    panel.addEventListener("drop", function (e) {
      depth = 0; panel.classList.remove("is-drop");
      if (!canDrop(e)) return;
      e.preventDefault();
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) takeFile(f);
      if (f && e.dataTransfer.files.length > 1) err("One file at a time: " + f.name + " is attached.");
    });
    // Sound and pop-up alerts need one click on the page first (browser rule); the first click turns them on.
    document.addEventListener("pointerdown", function once() {
      document.removeEventListener("pointerdown", once, true);
      Tone.unlock();
      try { if ("Notification" in window && Notification.permission === "default" && !localStorage.getItem("fs-chat-asked")) { localStorage.setItem("fs-chat-asked", "1"); Notification.requestPermission(); } } catch (x) {}
    }, true);
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
      h += '<button type="button" class="fsc-row' + (r.unread ? " is-unread" : "") + '" data-room="' + r.id + '"><i class="fsc-av' + (r.kind === "group" ? " is-group" : r.kind === "system" ? " is-sys" : "") + '"' + (r.kind === "dm" ? hue(r.name) : "") + '>' + (r.kind === "group" ? "#" : r.kind === "system" ? "⏱" : initial(r.name)) + "</i>"
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
        ? '<label class="fsc-row" data-name="' + esc(p.name.toLowerCase()) + '"><input type="checkbox" value="' + p.id + '"' + (S.picked[p.id] ? " checked" : "") + '><i class="fsc-av"' + hue(p.name) + '>' + initial(p.name) + "</i><span class=\"fsc-meta\"><b>" + esc(p.name) + "</b></span></label>"
        : '<button type="button" class="fsc-row" data-person="' + p.id + '" data-name="' + esc(p.name.toLowerCase()) + '"><i class="fsc-av"' + hue(p.name) + '>' + initial(p.name) + "</i><span class=\"fsc-meta\"><b>" + esc(p.name) + "</b></span></button>";
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
    var sub = r.kind === "group" ? r.members.length + " people" : r.kind === "system" ? "Messages from FlowSuit ERP" : "One-to-one chat";
    var calls = r.kind === "dm" && window.RTCPeerConnection && navigator.mediaDevices
      ? '<button type="button" class="fsc-icon" data-act="call" data-video="0" title="Voice call" aria-label="Voice call">' + ICON.phone + '</button>'
        + '<button type="button" class="fsc-icon" data-act="call" data-video="1" title="Video call" aria-label="Video call">' + ICON.video + "</button>" : "";
    var h = head(esc(r.name) + "<small>" + sub + "</small>", true, calls) + '<div class="fsc-msgs">';
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
            h += m.file.audio
              ? '<div class="fsc-voice"><audio controls preload="metadata" src="' + url + '"></audio><small>' + (/^Voice note/.test(m.file.name) ? "🎤 Voice note" : esc(m.file.name)) + " · " + size(m.file.size) + "</small></div>"
              : m.file.image
              ? '<a class="fsc-img" href="' + url + '" target="_blank" rel="noopener"><img src="' + url + '" alt="' + esc(m.file.name) + '" loading="lazy"></a>'
              : '<a class="fsc-file" href="' + url + '?dl=1"><span>📎</span><span><b>' + esc(m.file.name) + "</b><small>" + size(m.file.size) + "</small></span></a>";
          }
          if (m.body) h += "<p>" + text(m.body) + "</p>";
        }
        h += '<small class="fsc-time">' + (mine && !m.del ? '<button type="button" data-del="' + m.id + '">Delete ·</button> ' : "") + when(m.at) + (mine && !m.del ? tick(m.id, r) : "") + "</small></div>";
      });
    }
    h += r.kind === "system" ? '</div><p class="fsc-note">Automatic messages. Questions about them go to HR.</p>' : '</div><div class="fsc-compose"><div class="fsc-chip" hidden></div><p class="fsc-err" hidden></p><div class="fsc-bar">'
      + '<button type="button" class="fsc-icon fsc-attach" data-act="attach" title="Attach a file (up to ' + Math.round(C.max / 1048576) + ' MB)" aria-label="Attach a file">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></button>'
      + '<button type="button" class="fsc-icon fsc-mic' + (S.rec ? " is-rec" : "") + '" data-act="voice" title="' + (S.rec ? "Stop and send the voice note" : "Record a voice note") + '" aria-label="' + (S.rec ? "Stop and send the voice note" : "Record a voice note") + '">'
      + '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg></button>'
      + '<textarea class="fsc-input" rows="1" maxlength="4000" placeholder="Write a message"></textarea>'
      + '<button type="button" class="fsc-send" data-act="send" title="Send" aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.8L3.4 3.6a1 1 0 0 0-1.4 1.1L4 11l9 1-9 1-2 6.3a1 1 0 0 0 1.4 1.1z"/></svg></button></div></div>';
    var focused = document.activeElement && document.activeElement.classList.contains("fsc-input");
    panel.innerHTML = h;
    panel.setAttribute("data-shown", S.room);
    var box = panel.querySelector(".fsc-msgs"), input = panel.querySelector(".fsc-input");
    if (stick) box.scrollTop = box.scrollHeight; else if (old) box.scrollTop = old.scrollTop;
    if (!input) return;
    input.value = keep;
    grow(input);
    showFile();
    showRec();
    if (focused || !keep) input.focus();
  }

  // ✓ sent, ✓✓ grey delivered to their ERP, ✓✓ blue read (in a group: by everyone).
  function tick(id, r) {
    var seen = r.seen || { d: 0, r: 0 };
    if (id <= seen.r) return ' <i class="fsc-tick is-read" title="Read">✓✓</i>';
    if (id <= Math.max(seen.d, seen.r)) return ' <i class="fsc-tick" title="Delivered">✓✓</i>';
    return ' <i class="fsc-tick" title="Sent">✓</i>';
  }
  var ICON = {
    phone: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    video: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>'
  };

  function grow(t) { t.style.height = "auto"; t.style.height = Math.min(120, t.scrollHeight) + "px"; }
  function showFile() {
    var chip = panel.querySelector(".fsc-chip");
    if (!chip) return;
    chip.hidden = !S.file;
    if (S.file) chip.innerHTML = "📎 " + esc(S.file.name) + " <small>" + size(S.file.size) + '</small><button type="button" data-act="unfile" aria-label="Remove file">&#215;</button>';
  }
  // ---- Voice notes: click the microphone to record, click it again to send ----
  var REC_MAX = 300000;
  function recType() {
    var t = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (var i = 0; i < t.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t[i])) return t[i];
    return "";
  }
  function showRec() {
    var chip = panel.querySelector(".fsc-rec");
    if (!S.rec) { if (chip) chip.remove(); return; }
    if (!chip) {
      var bar = panel.querySelector(".fsc-compose"); if (!bar) return;
      chip = document.createElement("div"); chip.className = "fsc-rec"; bar.insertBefore(chip, bar.firstChild);
    }
    var sec = Math.floor((Date.now() - S.rec.at) / 1000);
    chip.innerHTML = '<span class="fsc-dot"></span> Recording ' + Math.floor(sec / 60) + ":" + ("0" + sec % 60).slice(-2)
      + ' <small>Click the microphone again to send</small><button type="button" data-act="voicecancel">Cancel</button>';
  }
  function recStart() {
    if (!window.MediaRecorder || !navigator.mediaDevices) { err("This browser cannot record voice notes. Use Chrome or Edge."); return; }
    err("");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var type = recType(), mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined), chunks = [];
      mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var rec = S.rec; S.rec = null; clearInterval(rec.tick); clearTimeout(rec.cap);
        var b = panel.querySelector(".fsc-mic"); if (b) b.classList.remove("is-rec");
        showRec();
        if (rec.cancel || !chunks.length) return;
        var mt = (mr.mimeType || type || "audio/webm").split(";")[0], ext = /mp4/.test(mt) ? "m4a" : /ogg/.test(mt) ? "ogg" : "webm", d = new Date();
        var f = new File(chunks, "Voice note " + d.getHours() + "-" + ("0" + d.getMinutes()).slice(-2) + "." + ext, { type: mt });
        if (f.size > C.max) { err("That voice note is too long to send."); return; }
        S.file = f; showFile(); send();
      };
      S.rec = { mr: mr, at: Date.now(), cancel: false };
      S.rec.tick = setInterval(showRec, 500);
      S.rec.cap = setTimeout(function () { if (S.rec && S.rec.mr === mr) mr.stop(); }, REC_MAX);
      mr.start();
      var b = panel.querySelector(".fsc-mic"); if (b) b.classList.add("is-rec");
      showRec();
    }).catch(function (x) { Perm.help(false, x, recStart); });
  }
  function recStop(cancel) { if (!S.rec) return; S.rec.cancel = !!cancel; S.rec.mr.stop(); }

  // ---- Microphone and camera permission: say what is wrong and how to allow it ----
  // A website cannot open the browser's own settings, so this asks again where the browser still allows asking,
  // and otherwise shows where the switch is (the icon left of the address).
  var Perm = (function () {
    var box = null;
    function close() { if (box) { box.remove(); box = null; } }
    function help(video, x, retry) {
      var name = x && x.name || "", what = video ? "camera and microphone" : "microphone";
      var q = navigator.permissions && navigator.permissions.query ? Promise.all([navigator.permissions.query({ name: "microphone" }).catch(function () { return null; }),
        video ? navigator.permissions.query({ name: "camera" }).catch(function () { return null; }) : null]) : Promise.resolve([]);
      q.then(function (st) {
        var denied = (st || []).some(function (p) { return p && p.state === "denied"; });
        var h = "";
        if (name === "NotFoundError" || name === "OverconstrainedError") h = "<h3>No " + what + " found</h3><p>Plug in a headset or " + (video ? "webcam" : "microphone") + ", then try again.</p>";
        else if (name === "NotReadableError") h = "<h3>Your " + what + " is busy</h3><p>Another program (Zoom, Teams, WhatsApp) is using it. Close that program, then try again.</p>";
        else if (denied || name === "NotAllowedError" || name === "SecurityError") h = "<h3>Allow your " + what + "</h3>"
          + "<p>Your browser is blocking the " + what + " for flowsuit.net. Turn it on once:</p><ol>"
          + "<li>Click the <b>icon left of flowsuit.net</b> in the address bar at the top (a lock or two sliders).</li>"
          + "<li>Set <b>Microphone</b>" + (video ? " and <b>Camera</b>" : "") + " to <b>Allow</b>.</li>"
          + "<li>Click <b>Reload page</b> below.</li></ol>"
          + "<p class=\"fsp-small\">On a phone: browser menu, then Settings, Site settings, flowsuit.net, " + (video ? "Camera and Microphone" : "Microphone") + ", Allow.</p>";
        else h = "<h3>Allow your " + what + "</h3><p>Click <b>Allow " + what + "</b>, then choose <b>Allow</b> in the box your browser shows.</p>";
        close();
        box = document.createElement("div"); box.className = "fsp-perm"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
        box.innerHTML = '<div class="fsp-card">' + h + '<div class="fsp-act">'
          + (denied || name === "NotAllowedError" || name === "SecurityError" ? '<button type="button" class="fsp-pri" data-p="reload">Reload page</button><button type="button" data-p="retry">Try again</button>'
            : '<button type="button" class="fsp-pri" data-p="retry">' + (name === "NotFoundError" || name === "NotReadableError" ? "Try again" : "Allow " + what) + "</button>")
          + '<button type="button" data-p="close">Close</button></div></div>';
        box.addEventListener("click", function (e) {
          var b = e.target.closest("[data-p]"); if (!b && e.target !== box) return;
          var a = b ? b.getAttribute("data-p") : "close";
          if (a === "reload") location.reload();
          else if (a === "retry") { close(); retry && retry(); }
          else close();
        });
        document.body.appendChild(box);
        var p = box.querySelector(".fsp-pri"); if (p) p.focus();
      });
    }
    return { help: help };
  })();

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
    if (act === "call") return Call.start(S.room, t.getAttribute("data-video") === "1");
    if (act === "attach") { root.querySelector(".fsc-pick").click(); return; }
    if (act === "unfile") { S.file = null; showFile(); return; }
    if (act === "voice") { if (S.rec) recStop(false); else recStart(); return; }
    if (act === "voicecancel") { recStop(true); return; }
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
      if (f) takeFile(f);
    }
  }
  function takeFile(f) {
    if (f.size > C.max) { err("That file is too big. The limit is " + Math.round(C.max / 1048576) + " MB."); return; }
    err("");
    S.file = f;
    showFile();
    var input = panel.querySelector(".fsc-input");
    if (input) input.focus();
  }

  // ---- New-message sound (two short notes) ----
  var Tone = (function () {
    var ctx = null;
    function unlock() { try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); } catch (x) {} }
    function play() {
      if (!ctx) return;
      try {
        [[880, 0], [1320, 0.12]].forEach(function (n) {
          var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + n[1];
          o.type = "sine"; o.frequency.value = n[0]; o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          o.start(t); o.stop(t + 0.2);
        });
      } catch (x) {}
    }
    return { unlock: unlock, play: play };
  })();

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
    var loud = msgs.some(function (m) { return m.uid !== C.uid && !m.del && !(S.open && !document.hidden && S.view === "room" && S.room === m.room); });
    // One tab plays the sound, so several open ERP tabs do not all ring at once.
    if (loud) { try { var last = +localStorage.getItem("fs-chat-tone") || 0; if (Date.now() - last > 3000) { localStorage.setItem("fs-chat-tone", Date.now()); Tone.play(); } } catch (x) { Tone.play(); } }
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    msgs.forEach(function (m) {
      if (m.uid === C.uid || m.del) return;
      if (!document.hidden) return; // on screen: the badge, sound and open chat are enough
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
      var before = roomById(S.room), was = before && JSON.stringify(before.seen);
      S.rooms = j.rooms;
      var now = roomById(S.room), seenMoved = now && JSON.stringify(now.seen) !== was;
      S.people = j.people;
      j.msgs.forEach(add);
      alertFor(fresh);
      if (S.open && S.view === "room" && S.room) {
        if (seenMoved || j.msgs.some(function (m) { return m.room === S.room; })) renderRoom();
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

  // ---- Voice and video calls (one-to-one) ----
  // The browsers talk directly (WebRTC). The server only passes the set-up messages: ring, accept, offer/answer,
  // network details. Those are polled every 2.5 seconds, so a call rings only where the ERP is open.
  var Call = (function () {
    var SIG_MS = 2500, FAST_MS = 700, RING_MS = 40000;
    var last = -1, c = null, sigTimer, ui, ringTone;
    function sig(kind, payload) {
      if (!c) return Promise.resolve();
      return api("/signal", { room: c.room, call: c.id, kind: kind, payload: payload ? JSON.stringify(payload) : "" }).catch(function () {});
    }
    function pollSig() {
      clearTimeout(sigTimer);
      api("/sig?after=" + last).then(function (j) {
        last = j.last;
        j.sigs.forEach(handle);
      }).catch(function () {}).then(function () { sigTimer = setTimeout(pollSig, c ? FAST_MS : document.hidden ? SIG_MS * 2 : SIG_MS); });
    }
    function handle(g) {
      var p = g.payload ? JSON.parse(g.payload) : {};
      if (g.kind === "ring") {
        if (c) { api("/signal", { room: g.room, call: g.call, kind: "busy" }); return; }
        c = { id: g.call, room: g.room, peer: g.name, video: !!p.video, incoming: true, state: "ringing", queue: [] };
        draw();
        ring(true);
        notify(g.name + (c.video ? " is video calling you" : " is calling you"));
        c.timeout = setTimeout(function () { if (c && c.state === "ringing") end("Missed call", false); }, RING_MS);
        return;
      }
      if (!c || g.call !== c.id) return;
      if (g.kind === "accept") { c.state = "connecting"; ring(false); draw(); offer(); }
      else if (g.kind === "decline") end("Call declined", true, "declined");
      else if (g.kind === "busy") end(c.peer + " is on another call", true, "busy");
      else if (g.kind === "hangup") end(c.state === "ringing" && c.incoming ? "Missed call" : "Call ended", false);
      else if (g.kind === "offer") answer(p);
      else if (g.kind === "answer") c.pc.setRemoteDescription(p).then(flush).catch(fail);
      else if (g.kind === "ice") { if (c.pc && c.pc.remoteDescription) c.pc.addIceCandidate(p).catch(function () {}); else c.queue.push(p); }
    }
    function flush() { c.queue.splice(0).forEach(function (x) { c.pc.addIceCandidate(x).catch(function () {}); }); }
    function media() {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: c.video ? { facingMode: "user", width: { ideal: 640 } } : false }).then(function (s) {
        c.local = s;
        return s;
      });
    }
    function peer() {
      var pc = new RTCPeerConnection({ iceServers: C.ice || [] });
      c.pc = pc;
      c.local.getTracks().forEach(function (t) { pc.addTrack(t, c.local); });
      pc.onicecandidate = function (e) { if (e.candidate) sig("ice", e.candidate.toJSON()); };
      pc.ontrack = function (e) {
        c.remote = e.streams[0];
        var v = ui && ui.querySelector(".fsk-remote");
        if (v) v.srcObject = c.remote;
      };
      pc.onconnectionstatechange = function () {
        if (!c) return;
        if (pc.connectionState === "connected" && c.state !== "live") { c.state = "live"; c.began = Date.now(); draw(); }
        if (pc.connectionState === "failed") end("The call could not connect. One of the networks blocks direct calls.", true, "failed");
      };
      return pc;
    }
    function offer() {
      peer();
      c.pc.createOffer().then(function (o) { return c.pc.setLocalDescription(o); }).then(function () { sig("offer", c.pc.localDescription.toJSON()); }).catch(fail);
    }
    function answer(o) {
      c.pc.setRemoteDescription(o).then(flush).then(function () { return c.pc.createAnswer(); })
        .then(function (a) { return c.pc.setLocalDescription(a); }).then(function () { sig("answer", c.pc.localDescription.toJSON()); }).catch(fail);
    }
    function fail() { end("The call could not connect.", true, "failed"); }

    function start(room, video) {
      if (c) return;
      var r = roomById(room);
      c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), room: room, peer: r ? r.name : "", video: video, incoming: false, state: "calling", queue: [] };
      draw();
      media().then(function () {
        draw();
        return sig("ring", { video: video });
      }).then(function () {
        pollSig();
        c.timeout = setTimeout(function () { if (c && c.state === "calling") { sig("hangup"); end("No answer", true, "missed"); } }, RING_MS);
      }).catch(function (x) {
        end(video ? "Your camera or microphone is not allowed yet." : "Your microphone is not allowed yet.", false);
        Perm.help(video, x, function () { start(room, video); });
      });
    }
    function accept() {
      ring(false);
      c.state = "connecting";
      draw();
      media().then(function () { peer(); sig("accept"); pollSig(); })
        .catch(function (x) { var v = c.video; sig("decline"); end("Your microphone or camera is not allowed yet.", false); Perm.help(v, x, null); });
    }

    // Ends the call. The caller writes one line in the chat, so both sides and the Chat log see it.
    function end(msg, log, how) {
      if (!c) return;
      var call = c;
      c = null;
      ring(false);
      clearTimeout(call.timeout);
      clearInterval(call.clock);
      if (call.pc) call.pc.close();
      if (call.local) call.local.getTracks().forEach(function (t) { t.stop(); });
      var kind = call.video ? "video call" : "voice call";
      if (!call.incoming && (log || call.began)) {
        var line = call.began ? (call.video ? "🎥 " : "📞 ") + kind.charAt(0).toUpperCase() + kind.slice(1) + ", " + dur(Date.now() - call.began)
          : (call.video ? "🎥 " : "📞 ") + (how === "declined" ? "Declined " : how === "failed" ? "Failed " : "Missed ") + kind;
        var fd = new FormData();
        fd.append("room", call.room);
        fd.append("body", line);
        api("/send", fd).then(function () { schedule(0); }).catch(function () {});
      }
      if (ui) {
        ui.innerHTML = '<div class="fsk-box"><p class="fsk-end">' + esc(msg) + '</p></div>';
        setTimeout(function () { if (!c && ui) { ui.remove(); ui = null; } }, 2200);
      }
    }
    function hang() {
      if (!c) return;
      if (c.incoming && c.state === "ringing") { sig("decline"); end("Call declined", false); return; }
      sig("hangup");
      end("Call ended", c.state !== "live");
    }
    function dur(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

    function draw() {
      if (!c) return;
      if (!ui) {
        ui = document.createElement("div");
        ui.id = "fs-call";
        document.body.appendChild(ui);
        ui.addEventListener("click", function (e) {
          var b = e.target.closest("[data-k]");
          if (!b || !c) return;
          var k = b.getAttribute("data-k");
          if (k === "accept") accept();
          if (k === "hang") hang();
          if (k === "mute" && c.local) { var a = c.local.getAudioTracks()[0]; a.enabled = !a.enabled; b.classList.toggle("is-off", !a.enabled); }
          if (k === "cam" && c.local) { var v = c.local.getVideoTracks()[0]; if (v) { v.enabled = !v.enabled; b.classList.toggle("is-off", !v.enabled); } }
        });
      }
      var label = { calling: "Calling…", ringing: c.video ? "Incoming video call" : "Incoming voice call", connecting: "Connecting…", live: "" }[c.state];
      ui.className = (c.video ? "is-video " : "") + "is-" + c.state;
      ui.innerHTML = '<div class="fsk-box">'
        + (c.video ? '<video class="fsk-remote" autoplay playsinline></video><video class="fsk-local" autoplay playsinline muted></video>' : '<audio class="fsk-remote" autoplay></audio>')
        + '<div class="fsk-who"><i>' + esc(String(c.peer).charAt(0).toUpperCase()) + "</i><b>" + esc(c.peer) + '</b><span class="fsk-state">' + esc(label) + "</span></div>"
        + '<div class="fsk-bar">'
        + (c.state === "ringing" ? '<button type="button" class="fsk-btn is-go" data-k="accept" title="Answer">' + ICON.phone + "</button>" : '<button type="button" class="fsk-btn" data-k="mute" title="Mute">🎤</button>' + (c.video ? '<button type="button" class="fsk-btn" data-k="cam" title="Camera on/off">' + ICON.video + "</button>" : ""))
        + '<button type="button" class="fsk-btn is-end" data-k="hang" title="' + (c.state === "ringing" ? "Decline" : "Hang up") + '">' + ICON.phone + "</button></div></div>";
      if (c.local && c.video) ui.querySelector(".fsk-local").srcObject = c.local;
      if (c.remote) ui.querySelector(".fsk-remote").srcObject = c.remote;
      clearInterval(c.clock);
      if (c.state === "live") {
        var st = ui.querySelector(".fsk-state");
        c.clock = setInterval(function () { if (c && c.began) st.textContent = dur(Date.now() - c.began); }, 1000);
      }
    }

    // A soft two-tone ring while a call is waiting to be answered.
    function ring(on) {
      if (ringTone) { clearInterval(ringTone.t); try { ringTone.ctx.close(); } catch (x) {} ringTone = null; }
      if (!on) return;
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var beep = function () {
          [0, 0.25].forEach(function (d, i) {
            var o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.value = i ? 480 : 440;
            g.gain.setValueAtTime(0.12, ctx.currentTime + d);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.22);
            o.connect(g); g.connect(ctx.destination);
            o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.24);
          });
        };
        beep();
        ringTone = { ctx: ctx, t: setInterval(beep, 2000) };
      } catch (x) {}
    }
    function notify(text) {
      if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
      try { var n = new Notification(text, { tag: "fs-call", requireInteraction: true }); n.onclick = function () { window.focus(); n.close(); }; } catch (x) {}
    }
    addEventListener("beforeunload", function () {
      if (!c || !navigator.sendBeacon) return;
      var fd = new FormData();
      [["room", c.room], ["call", c.id], ["kind", "hangup"], ["csrf", C.csrf]].forEach(function (x) { fd.append(x[0], x[1]); });
      navigator.sendBeacon(C.api + "/signal", fd);
    });
    return { init: function () { pollSig(); }, start: start };
  })();

  function start() {
    if (!document.body) return setTimeout(start, 50);
    build();
    schedule(0);
    Call.init();
    document.addEventListener("visibilitychange", function () { if (!document.hidden && timer) schedule(0); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
