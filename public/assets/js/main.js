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
