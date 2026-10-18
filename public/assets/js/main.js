// Scroll-in animations, scroll progress, card spotlight and the dashboard counters. The page works without this file.
(function () {
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Header shadow and the thin progress bar at the top of the page.
  var ticking = false;
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    root.style.setProperty('--progress', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    root.classList.toggle('is-scrolled', window.scrollY > 8);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // Soft spotlight on cards that follows the mouse.
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });
  var items = document.querySelectorAll('.reveal');

  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  // Stagger siblings so cards in a row appear one after another.
  items.forEach(function (el) {
    var index = Array.prototype.indexOf.call(el.parentNode.children, el);
    el.style.transitionDelay = Math.min(index, 6) * 80 + 'ms';
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      entry.target.querySelectorAll('[data-count]').forEach(countUp);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  items.forEach(function (el) { observer.observe(el); });

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    var start = performance.now();
    function tick(now) {
      var t = Math.min((now - start) / 1200, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))).toLocaleString('en-US');
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();

// Website chat assistant (talks to /api/chat).
(function () {
  var root = document.querySelector('[data-chat]');
  if (!root) return;
  var panel = root.querySelector('.chat-panel');
  var toggles = root.querySelectorAll('[data-chat-toggle]');
  var log = root.querySelector('[data-chat-log]');
  var form = root.querySelector('[data-chat-form]');
  var input = form.querySelector('input');
  var chips = root.querySelector('[data-chat-chips]');
  var history = [];
  var busy = false;

  try { history = JSON.parse(sessionStorage.getItem('flowsuit-chat') || '[]'); } catch (e) { history = []; }
  history.forEach(function (m) { addMessage(m.role, m.content); });
  if (history.length) chips.hidden = true;

  function save() {
    try { sessionStorage.setItem('flowsuit-chat', JSON.stringify(history.slice(-20))); } catch (e) {}
  }

  function setOpen(open) {
    panel.hidden = !open;
    root.classList.toggle('is-open', open);
    toggles[0].setAttribute('aria-expanded', String(open));
    if (open) { input.focus(); log.scrollTop = log.scrollHeight; }
  }
  toggles.forEach(function (b) { b.addEventListener('click', function () { setOpen(panel.hidden); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

  // Text only; links to our own site and email become clickable.
  function addMessage(role, text) {
    var p = document.createElement('p');
    p.className = 'msg ' + (role === 'user' ? 'msg-user' : 'msg-bot');
    var parts = String(text).split(/(https:\/\/flowsuit\.net[^\s),]*|[\w.+-]+@flowsuit\.net)/);
    parts.forEach(function (part, i) {
      if (i % 2 === 1) {
        var a = document.createElement('a');
        var link = part.replace(/[.]+$/, '');
        a.href = link.indexOf('@') > -1 ? 'mailto:' + link : link;
        a.textContent = link;
        p.appendChild(a);
        if (link.length < part.length) p.appendChild(document.createTextNode(part.slice(link.length)));
      } else if (part) {
        p.appendChild(document.createTextNode(part));
      }
    });
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  function send(text) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    chips.hidden = true;
    history.push({ role: 'user', content: text });
    addMessage('user', text);
    input.value = '';
    var typing = document.createElement('p');
    typing.className = 'msg msg-bot typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { return data.reply || data.error; })
      .catch(function () { return 'Sorry, the chat is not reachable right now. Please email ' + document.querySelector('.chat-foot a').textContent + '.'; })
      .then(function (reply) {
        typing.remove();
        history.push({ role: 'assistant', content: reply });
        addMessage('assistant', reply);
        save();
        busy = false;
      });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  chips.addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') send(e.target.textContent); });
})();
