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

// Home page slideshow. Without this script the slides still scroll sideways.
(function () {
  var slider = document.querySelector('[data-slider]');
  if (!slider) return;
  var track = slider.querySelector('[data-track]');
  var slides = track.querySelectorAll('.slide');
  var tabs = slider.querySelectorAll('[role="tab"]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = 0;

  function show(i, scroll) {
    current = (i + slides.length) % slides.length;
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === current); s.inert = n !== current; });
    tabs.forEach(function (t, n) {
      t.setAttribute('aria-selected', String(n === current));
      t.tabIndex = n === current ? 0 : -1;
      // Restart the progress bar on the new tab.
      var bar = t.querySelector('i'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
    });
    var tab = tabs[current];
    tab.parentNode.scrollTo({ left: tab.offsetLeft - 10, behavior: reduce ? 'auto' : 'smooth' });
    if (scroll !== false) track.scrollTo({ left: current * track.clientWidth });
  }

  tabs.forEach(function (t, n) {
    t.addEventListener('click', function () { show(n); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); show(current + (e.key === 'ArrowRight' ? 1 : -1)); tabs[current].focus();
      }
    });
    // When a tab's progress bar fills up, move to the next slide.
    t.querySelector('i').addEventListener('animationend', function () { if (n === current) show(current + 1); });
  });
  slider.querySelector('[data-prev]').addEventListener('click', function () { show(current - 1); });
  slider.querySelector('[data-next]').addEventListener('click', function () { show(current + 1); });
  track.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
  });

  // Swiping on a phone scrolls the track; pick up the slide it settles on.
  var settle;
  track.addEventListener('scroll', function () {
    clearTimeout(settle);
    settle = setTimeout(function () {
      var i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== current) show(i, false);
    }, 120);
  }, { passive: true });

  // Plays only while on screen, and pauses while the visitor is pointing at or using it.
  function pause(on) { slider.classList.toggle('is-paused', on); }
  slider.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') pause(true); });
  slider.addEventListener('pointerleave', function () { pause(false); });
  slider.addEventListener('focusin', function () { pause(true); });
  slider.addEventListener('focusout', function () { pause(false); });
  track.addEventListener('touchstart', function () { pause(true); }, { passive: true });
  window.addEventListener('resize', function () { track.scrollTo({ left: current * track.clientWidth, behavior: 'auto' }); });

  show(0, false);
  if (!reduce && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      slider.classList.toggle('is-playing', entries[0].isIntersecting);
    }, { threshold: 0.4 }).observe(slider);
  }
})();

// Home page video: loads YouTube only when the visitor presses play.
document.querySelectorAll('[data-video]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(btn.getAttribute('data-video')) + '?autoplay=1&rel=0';
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    f.title = 'FlowSuit video';
    btn.replaceChildren(f);
  }, { once: true });
});
