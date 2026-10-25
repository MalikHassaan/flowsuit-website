// Scroll-in animations, scroll progress, card spotlight and the dashboard counters. The page works without this file.
(function () {
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  var reduce = false;   // animations play everywhere, even with Windows "Animation effects" off (owner's choice)

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
  var reduce = false;   // animations play everywhere, even with Windows "Animation effects" off (owner's choice)
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

// Product tour: plays a short scripted sale on a mock screen, like a looping video.
(function () {
  var demo = document.querySelector('[data-demo]');
  if (!demo) return;
  var screen = demo.querySelector('.demo-screen');
  var cursor = demo.querySelector('[data-cursor]');
  var toast = demo.querySelector('[data-toast]');
  var caption = demo.querySelector('[data-caption]');
  var bar = demo.querySelector('[data-progress]');
  var fields = demo.querySelectorAll('[data-type]');
  var save = demo.querySelector('[data-save]');
  var growBar = demo.querySelector('[data-bar]');
  var kpi = {};
  demo.querySelectorAll('[data-k]').forEach(function (el) { kpi[el.getAttribute('data-k')] = el; });
  var reduce = false;   // animations play everywhere, even with Windows "Animation effects" off (owner's choice)
  var TOTAL = 13000, elapsed = 0, paused = false, onScreen = false, running = false;

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function setKpi(k, v) { kpi[k].textContent = fmt(v); }
  // A wait that stands still while the demo is paused or scrolled away.
  function wait(ms) {
    return new Promise(function (done) {
      (function tick() {
        if (!paused && onScreen) { ms -= 50; elapsed += 50; bar.style.width = Math.min(elapsed / TOTAL * 100, 100) + '%'; }
        if (ms <= 0) done(); else setTimeout(tick, 50);
      })();
    });
  }
  function moveTo(el) {
    var s = screen.getBoundingClientRect(), r = el.getBoundingClientRect();
    cursor.style.left = (r.left - s.left + Math.min(r.width * 0.6, 60)) + 'px';
    cursor.style.top = (r.top - s.top + r.height * 0.55) + 'px';
    return wait(900);
  }
  function click() { cursor.classList.remove('is-click'); void cursor.offsetWidth; cursor.classList.add('is-click'); return wait(250); }
  function type(el) {
    var text = el.getAttribute('data-type'), i = 0;
    el.classList.add('is-typing');
    return (function next() {
      el.textContent = text.slice(0, ++i);
      return i < text.length ? wait(70).then(next) : wait(200).then(function () { el.classList.remove('is-typing'); });
    })();
  }
  function countTo(k, from, to) {
    var steps = 12, n = 0;
    kpi[k].classList.add(to > from ? 'is-up' : 'is-down');
    return (function next() {
      setKpi(k, from + (to - from) * (++n / steps));
      return n < steps ? new Promise(function (r) { setTimeout(r, 40); }).then(next) : Promise.resolve();
    })();
  }
  function reset() {
    elapsed = 0; bar.style.width = '0%';
    fields.forEach(function (f) { f.textContent = ''; });
    toast.classList.remove('is-on');
    Object.keys(kpi).forEach(function (k) { setKpi(k, +kpi[k].getAttribute('data-v')); kpi[k].classList.remove('is-up', 'is-down'); });
    growBar.style.setProperty('--h', '48%');
  }
  function play() {
    reset();
    caption.textContent = '1. The cashier enters a sale';
    var p = wait(400);
    fields.forEach(function (f) { p = p.then(function () { return moveTo(f); }).then(click).then(function () { return type(f); }); });
    return p
      .then(function () { caption.textContent = '2. One click to save'; return moveTo(save); })
      .then(function () { save.classList.add('is-pressed'); return click(); })
      .then(function () { save.classList.remove('is-pressed'); toast.classList.add('is-on'); caption.textContent = '3. Stock, cash and today\'s sales update at once'; })
      .then(function () {
        growBar.style.setProperty('--h', '78%');
        countTo('sales', 184500, 201900); countTo('stock', 82, 76); countTo('cash', 96200, 113600);
        return wait(Math.max(TOTAL - elapsed, 3500));
      })
      .then(play);
  }
  if (reduce) {
    fields.forEach(function (f) { f.textContent = f.getAttribute('data-type'); });
    toast.classList.add('is-on'); bar.style.width = '100%';
    caption.textContent = 'One sale updates stock, cash and reports at once';
    demo.querySelector('[data-demo-toggle]').hidden = true;
    return;
  }
  demo.querySelector('[data-demo-toggle]').addEventListener('click', function () {
    paused = !paused;
    demo.classList.toggle('is-paused', paused);
    this.setAttribute('aria-label', paused ? 'Play the demo' : 'Pause the demo');
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      onScreen = e[0].isIntersecting;
      if (onScreen && !running) { running = true; play(); }
    }, { threshold: 0.35 }).observe(demo);
  } else { onScreen = true; running = true; play(); }
})();

// Live stock table: a sale or a delivery every couple of seconds (sample data).
(function () {
  var card = document.querySelector('[data-live]');
  if (!card) return;
  var rows = card.querySelectorAll('tbody tr');
  var note = card.querySelector('[data-live-note]');
  var visible = false;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(card);
  function paint(tr, qty) {
    var max = +tr.getAttribute('data-max'), low = qty < 25, pill = tr.querySelector('[data-status]');
    var cell = tr.querySelector('[data-qty]');
    if (+cell.textContent !== qty) { cell.classList.remove('is-changed'); void cell.offsetWidth; cell.classList.add('is-changed'); }
    cell.textContent = qty;
    tr.querySelector('.level i').style.width = Math.round(qty / max * 100) + '%';
    tr.classList.toggle('is-low', low);
    pill.textContent = low ? 'Reorder' : 'OK';
    pill.className = 'pill ' + (low ? 'pill-low' : 'pill-ok');
  }
  rows.forEach(function (tr) { paint(tr, +tr.querySelector('[data-qty]').textContent); });
  setInterval(function () {
    if (!visible || document.hidden) return;
    var tr = rows[Math.floor(Math.random() * rows.length)];
    var name = tr.cells[0].textContent, qty = +tr.querySelector('[data-qty]').textContent, cls;
    if (qty < 12) {
      var add = +tr.getAttribute('data-max') - qty;
      qty += add; cls = 'is-restock'; note.textContent = 'Delivery received: ' + add + ' x ' + name;
    } else {
      var sold = 1 + Math.floor(Math.random() * 6);
      qty -= sold; cls = 'is-flash'; note.textContent = 'Sold ' + sold + ' x ' + name + ' at the counter';
    }
    paint(tr, qty);
    tr.classList.remove('is-flash', 'is-restock'); void tr.offsetWidth; tr.classList.add(cls);
  }, 2200);
})();

// Count clicks that usually mean a new lead (WhatsApp, email) for the ERP's Website visitors page.
document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('a, button');
  if (!el || !navigator.sendBeacon) return;
  var href = el.getAttribute('href') || '';
  var name = el.getAttribute('data-track') || (href.indexOf('mailto:') === 0 ? 'email' : href.indexOf('wa.me/') > -1 ? 'whatsapp' : '');
  if (!name) return;
  navigator.sendBeacon('/api/event', new Blob([JSON.stringify({ name: name, path: location.pathname })], { type: 'application/json' }));
});

// Tables look alive: rows slide in one after another, then a soft highlight moves down the rows of every
// table on screen, a row at a time.
(function () {
  var tables = Array.prototype.slice.call(document.querySelectorAll('.data-table, .compare'));
  document.querySelectorAll('.reveal table').forEach(function (t) {
    Array.prototype.forEach.call(t.rows, function (tr, i) { tr.style.setProperty('--r', i); });
  });
  if (!tables.length) return;
  var onScreen = new Set();
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) onScreen.add(e.target); else onScreen.delete(e.target); });
    }, { threshold: 0.3 });
    tables.forEach(function (t) { io.observe(t); });
  } else {
    tables.forEach(function (t) { onScreen.add(t); });
  }
  var step = 0;
  setInterval(function () {
    if (document.hidden) return;
    step++;
    onScreen.forEach(function (t) {
      var rows = Array.prototype.filter.call(t.rows, function (r) { return !r.querySelector('th'); });
      if (!rows.length) return;
      rows.forEach(function (r) { r.classList.remove('is-hot'); });
      rows[step % rows.length].classList.add('is-hot');
    });
  }, 1400);
})();

// Dashboard mock-ups look live: every couple of seconds the figures tick up, the bars move and the
// highlighted menu item changes, but only while the mock-up is on screen.
(function () {
  var dashes = Array.prototype.slice.call(document.querySelectorAll('.dash'));
  if (!dashes.length) return;
  var onScreen = new Set();
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) onScreen.add(e.target); else onScreen.delete(e.target); });
    }, { threshold: 0.2 });
    dashes.forEach(function (d) { io.observe(d); });
  } else {
    dashes.forEach(function (d) { onScreen.add(d); });
  }
  dashes.forEach(function (d) {
    var line = d.querySelector('.dash-line'), donut = d.querySelector('.dash-donut');
    if (line) d._line = dashLine(line);
    if (donut) d._donut = dashDonut(donut);
  });
  var step = 0;
  setTimeout(function () {
    setInterval(function () {
      if (document.hidden) return;
      step++;
      onScreen.forEach(function (d) {
        d.querySelectorAll('.dash-kpis b').forEach(function (b, i) {
          if ((step + i) % 2) return;   // not every figure moves every time
          var n = parseInt(b.textContent.replace(/,/g, ''), 10) || 0;
          b.textContent = (n + Math.ceil(n * (0.002 + Math.random() * 0.01))).toLocaleString('en-US');
          b.classList.remove('is-up'); void b.offsetWidth; b.classList.add('is-up');
        });
        if (d._line) d._line.next();
        if (d._donut) d._donut.next(step);
        var nav = d.querySelectorAll('.dash-nav i');
        nav.forEach(function (n, i) { n.classList.toggle('is-on', i === step % nav.length); });
      });
    }, 2200);
  }, 1500);
})();

// Sales line with a forecast: 9 past points in solid blue up to "today", then 5 forecast points as a
// dashed amber line inside a range that widens with time. Each tick a new day arrives and everything
// slides smoothly to the left.
function dashLine(card) {
  var W = 300, H = 120, PAST = 9, AHEAD = 5, N = PAST + AHEAD, X = W / (N - 1);
  var act = card.querySelector('.dl-act'), area = card.querySelector('.dl-area'), fc = card.querySelector('.dl-fc'),
    band = card.querySelector('.dl-band'), today = card.querySelector('.dl-today'), dot = card.querySelector('.dl-dot'),
    tag = card.querySelector('.dl-tag'), svg = card.querySelector('svg');
  var v = [], level = 52;
  for (var i = 0; i < PAST; i++) { level = walk(level); v.push(level); }
  var shown = forecast(v), from = shown, t0 = 0;
  function walk(l) { return Math.max(22, Math.min(88, l + (Math.random() - .42) * 16)); }
  // Forecast: carry on the recent trend, flattened a little, plus a range that grows each day.
  function forecast(past) {
    var n = past.length, slope = (past[n - 1] - past[n - 4]) / 3 * .6, out = past.slice();
    for (var k = 1; k <= AHEAD; k++) out.push(Math.max(15, Math.min(95, past[n - 1] + slope * k)));
    return out;
  }
  function y(val) { return H - 8 - val / 100 * (H - 16); }
  function smooth(pts) {
    var dd = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p2 = pts[i], p3 = pts[i + 1] || p2;
      dd += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)
        + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)
        + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return dd;
  }
  function draw(vals) {
    var pts = vals.map(function (val, i) { return [i * X, y(val)]; });
    var past = pts.slice(0, PAST), ahead = pts.slice(PAST - 1), tx = (PAST - 1) * X;
    act.setAttribute('d', smooth(past));
    area.setAttribute('d', smooth(past) + ' L' + tx.toFixed(1) + ' ' + H + ' L0 ' + H + ' Z');
    fc.setAttribute('d', smooth(ahead));
    var up = [], down = [];
    ahead.forEach(function (p, k) { var w = k * 4.2; up.push([p[0], p[1] - w]); down.unshift([p[0], p[1] + w]); });
    band.setAttribute('d', smooth(up) + ' L' + down.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + ' Z');
    today.setAttribute('x1', tx); today.setAttribute('x2', tx);
    var box = svg.getBoundingClientRect(), cb = card.getBoundingClientRect();
    if (box.width) {
      var left = box.left - cb.left + tx / W * box.width;
      dot.style.left = left + 'px'; tag.style.left = left + 'px';
      dot.style.top = (box.top - cb.top + past[PAST - 1][1] / H * box.height) + 'px';
    }
  }
  function frame(now) {
    if (!t0) t0 = now;
    var k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3);
    // Slide left by one day while the values ease from the old shape to the new one.
    var vals = shown.map(function (val, i) { return from[i + 1] === undefined ? val : from[i + 1] + (val - from[i + 1]) * e; });
    draw(vals);
    if (k < 1) requestAnimationFrame(frame);
  }
  draw(shown);
  window.addEventListener('resize', function () { draw(shown); });
  return {
    next: function () {
      from = shown;
      v.shift(); v.push(walk(v[v.length - 1]));
      shown = forecast(v);
      // "from" is the old picture moved one day left, so the line slides in rather than jumping.
      t0 = 0; requestAnimationFrame(frame);
    }
  };
}

// Revenue-mix donut: the shares shift a little each tick, one slice is highlighted in turn and the
// "collected" figure in the middle moves with them.
function dashDonut(card) {
  var segs = Array.prototype.slice.call(card.querySelectorAll('.dd-seg')), labels = card.querySelectorAll('.dd-legend b'),
    mid = card.querySelector('.dd-mid b'), base = segs.map(function (s) { return parseFloat(s.style.getPropertyValue('--p')); });
  return {
    next: function (step) {
      var raw = base.map(function (b) { return Math.max(4, b + (Math.random() - .5) * 10); }), sum = raw.reduce(function (a, b) { return a + b; }, 0);
      var pct = raw.map(function (r) { return Math.round(r / sum * 100); });
      pct[0] += 100 - pct.reduce(function (a, b) { return a + b; }, 0);
      var off = 0;
      segs.forEach(function (s, i) {
        s.style.setProperty('--p', pct[i]); s.style.setProperty('--o', off); off += pct[i];
        s.classList.toggle('is-hot', i === step % segs.length);
        if (labels[i]) labels[i].textContent = pct[i] + '%';
      });
      if (mid) mid.textContent = (72 + Math.round(Math.random() * 14)) + '%';
    }
  };
}

// Slideshow pictures look live too: stock goes down with sales and up with deliveries, invoices get paid
// and new ones arrive, and the till rings up items and takes payment. Each runs only while it is on screen.
(function () {
  var mocks = Array.prototype.slice.call(document.querySelectorAll('.slide-visual .mock-app'));
  if (!mocks.length) return;
  var onScreen = new Set();
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) onScreen.add(e.target); else onScreen.delete(e.target); });
    }, { threshold: 0.4 });
    mocks.forEach(function (m) { io.observe(m); });
  } else {
    mocks.forEach(function (m) { onScreen.add(m); });
  }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function num(el) { return parseInt(el.textContent.replace(/[^\d]/g, ''), 10) || 0; }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function flash(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function setPill(pill, ok, okText, lowText) {
    pill.className = 'pill ' + (ok ? 'pill-ok' : 'pill-low');
    pill.textContent = ok ? okText : lowText;
  }

  function inventory(m) {
    var rows = Array.prototype.filter.call(m.querySelectorAll('tr'), function (r) { return !r.querySelector('th'); });
    if (!rows.length) return;
    var row = pick(rows), cells = row.cells, qty = num(cells[1]);
    var delivery = qty < 15 || Math.random() < 0.15;
    qty = delivery ? qty + 40 + Math.floor(Math.random() * 30) : Math.max(0, qty - 1 - Math.floor(Math.random() * 4));
    cells[1].textContent = qty;
    var pill = cells[2].querySelector('.pill');
    if (pill) setPill(pill, qty >= 20, 'OK', 'Reorder');
    flash(row, delivery ? 'is-restock' : 'is-flash');
  }

  var invNo = 1046;
  function finance(m) {
    var donut = m.querySelector('.donut'), ul = m.querySelector('ul');
    if (!donut || !ul) return;
    var p = parseInt(donut.style.getPropertyValue('--p'), 10) || 72;
    var due = Array.prototype.filter.call(ul.children, function (li) { return li.querySelector('.pill-low'); });
    var li;
    if (due.length > 1 || (due.length && Math.random() < 0.5)) {
      li = due[0];
      setPill(li.querySelector('.pill'), true, 'Paid', 'Due');
      p = Math.min(96, p + 5 + Math.floor(Math.random() * 5));
    } else {
      li = document.createElement('li');
      invNo++;
      li.innerHTML = '<span>INV-' + invNo + '</span><b>' + fmt(15000 + Math.floor(Math.random() * 170) * 1000) + '</b><span class="pill pill-low">Due</span>';
      ul.appendChild(li);
      if (ul.children.length > 4) ul.removeChild(ul.firstElementChild);
      p = Math.max(55, p - 6);
    }
    donut.style.setProperty('--p', p);
    donut.querySelector('b').textContent = p + '%';
    flash(li, 'is-flash');
  }

  var prices = { Tea: [990, 'Tea 950g'], Rice: [3450, 'Rice 10kg'], Oil: [2900, 'Oil 5L'], Sugar: [160, 'Sugar 1kg'], Flour: [2400, 'Flour 20kg'], Soap: [120, 'Soap'] };
  var taps = 0;
  function store(m) {
    var cart = m.querySelector('.pos-cart'), total = m.querySelector('.pos-total'), pay = m.querySelector('.pos-pay');
    if (!cart || !total || !pay) return;
    if (pay.classList.contains('is-paid')) {   // start the next customer
      Array.prototype.slice.call(cart.querySelectorAll('p:not(.pos-total)')).forEach(function (p) { p.remove(); });
      total.querySelector('b').textContent = '0';
      pay.classList.remove('is-paid'); pay.textContent = 'Pay';
      taps = 0;
      return;
    }
    if (taps >= 5) {
      pay.classList.add('is-paid'); pay.textContent = 'Paid ✓  Receipt printed';
      return;
    }
    taps++;
    var tile = pick(m.querySelectorAll('.pos-items i')), item = prices[tile.textContent.trim()];
    if (!item) return;
    flash(tile, 'is-tap');
    var line = Array.prototype.find.call(cart.querySelectorAll('p:not(.pos-total)'), function (p) { return p.getAttribute('data-item') === item[1]; });
    if (!line) {
      var lines = cart.querySelectorAll('p:not(.pos-total)');
      if (lines.length >= 4) lines[0].remove();
      line = document.createElement('p');
      line.setAttribute('data-item', item[1]);
      line.setAttribute('data-qty', '0');
      line.innerHTML = '<span></span><b></b>';
      cart.insertBefore(line, total);
    }
    var q = (parseInt(line.getAttribute('data-qty'), 10) || 0) + 1;
    line.setAttribute('data-qty', q);
    line.querySelector('span').textContent = item[1] + (q > 1 ? ' x' + q : '');
    line.querySelector('b').textContent = fmt(item[0] * q);
    flash(line, 'is-flash');
    var sum = 0;
    cart.querySelectorAll('p:not(.pos-total) b').forEach(function (b) { sum += num(b); });
    total.querySelector('b').textContent = fmt(sum);
  }

  // The first picture's cart lines carry no item names yet; tag them so repeat taps add to the same line.
  document.querySelectorAll('.pos-cart p:not(.pos-total)').forEach(function (p) {
    var t = p.querySelector('span').textContent, m = t.match(/ x(\d+)$/);
    p.setAttribute('data-item', t.replace(/ x\d+$/, ''));
    p.setAttribute('data-qty', m ? m[1] : '1');
  });

  setInterval(function () {
    if (document.hidden) return;
    onScreen.forEach(function (m) {
      if (m.classList.contains('mock-pos')) store(m);
      else if (m.classList.contains('mock-fin')) finance(m);
      else if (m.querySelector('table')) inventory(m);
    });
  }, 1600);
})();
