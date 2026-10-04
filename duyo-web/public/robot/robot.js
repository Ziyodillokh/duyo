/*
 * The robot page's two small motions, both off under reduced motion:
 *
 *   entrance  blocks rise into place as they reach the screen (robot.css,
 *             [data-reveal]); a block's siblings follow it a beat apart
 *   sky       a field of stars on a canvas behind the page that twinkles
 *             and drifts a little against the scroll, for depth — the
 *             site's cosmos, drawn in 2D at a fraction of the cost
 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ── Entrance ───────────────────────────────────────────────────────────
  var items = document.querySelectorAll('[data-reveal]');
  for (var i = 0; i < items.length; i++) {
    var el = items[i];
    var siblings = el.parentElement ? el.parentElement.querySelectorAll(':scope > [data-reveal]') : [el];
    el.style.setProperty('--d', String(Math.min(5, Array.prototype.indexOf.call(siblings, el))));
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    );
    items.forEach(function (node) {
      io.observe(node);
    });
  } else {
    items.forEach(function (node) {
      node.classList.add('is-in');
    });
  }

  // ── Sky ────────────────────────────────────────────────────────────────
  var canvas = document.querySelector('.sky');
  var ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  /** Stars per CSS px² of screen, and the most there will ever be. */
  var DENSITY = 1 / 2400;
  var MAX_STARS = 520;
  /** How far the nearest stars drift against the scroll, as a share of it. */
  var DRIFT = 0.05;
  /** The twinkle is slow light, not motion: a frame every other vsync is plenty. */
  var FRAME_MS = 1000 / 30;
  var TINTS = ['244,247,253', '244,247,253', '244,247,253', '200,224,255', '159,208,255', '255,226,160'];

  var stars = [];
  var width = 0;
  var height = 0;
  var dpr = 1;
  var raf = 0;
  var last = 0;

  function seed() {
    var count = Math.min(MAX_STARS, Math.round(width * height * DENSITY));
    stars = [];
    for (var n = 0; n < count; n++) {
      var near = Math.pow(Math.random(), 3); // most stars far and small
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.35 + near * 1.25,
        a: 0.25 + Math.random() * 0.6,
        depth: near,
        speed: 0.4 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
        tint: TINTS[Math.floor(Math.random() * TINTS.length)],
      });
    }
  }

  function size() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    // A phone's bars sliding change the window, not this canvas (100lvh).
    if (w === width && h === height && ratio === dpr) return false;
    width = w;
    height = h;
    dpr = ratio;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    seed();
    return true;
  }

  function draw(t) {
    var still = reduce.matches;
    var scroll = still ? 0 : window.scrollY;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (var n = 0; n < stars.length; n++) {
      var s = stars[n];
      var y = (s.y * height - scroll * DRIFT * (0.2 + s.depth)) % height;
      if (y < 0) y += height;
      var twinkle = still ? 1 : 0.72 + 0.28 * Math.sin(t * 0.001 * s.speed + s.phase);
      ctx.fillStyle = 'rgba(' + s.tint + ',' + (s.a * twinkle).toFixed(3) + ')';
      if (s.r < 0.8) {
        ctx.fillRect(s.x * width - s.r, y - s.r, s.r * 2, s.r * 2);
      } else {
        ctx.beginPath();
        ctx.arc(s.x * width, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function loop(t) {
    raf = 0;
    if (document.hidden || reduce.matches) return;
    if (t - last >= FRAME_MS) {
      last = t;
      draw(t);
    }
    raf = window.requestAnimationFrame(loop);
  }

  function start() {
    if (raf === 0 && !document.hidden && !reduce.matches) raf = window.requestAnimationFrame(loop);
  }

  size();
  draw(0);
  start();

  window.addEventListener(
    'resize',
    function () {
      if (size()) draw(performance.now());
    },
    { passive: true },
  );
  // Under reduced motion the sky is drawn once, still; scrolling it would be motion.
  document.addEventListener('visibilitychange', start);
  reduce.addEventListener('change', function () {
    draw(performance.now());
    start();
  });
})();
