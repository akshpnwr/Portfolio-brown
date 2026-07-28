/* ==========================================================================
   site.js — page behaviour.

   Replaces the Design Component runtime (support.js) that used to render this
   page. That runtime was a design-tool preview harness: it mounted the
   component twice and reverted inline styles on its own schedule, which made
   GSAP's ScrollTriggers impossible to keep alive. This file does the same job
   with plain listeners and no re-render cycle.

   Hover, press and focus feedback are NOT here — they moved to CSS
   (styles.css §7b), which is where presentational state reacting to
   :hover/:active/:focus belongs. What remains is genuine behaviour: smooth
   nav, the mobile menu, the case-detail accordions, the contact form, plus
   the two ambient systems (hero grain drift, dust particles).
   ========================================================================== */

(function () {
  'use strict';

  var token = function (name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
  };

  var prefersReduced = function () {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  /* ── Smooth in-page nav ──────────────────────────────────────────────── */

  function setupNavClicks() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('[data-target]');
      if (!link) return;
      e.preventDefault();
      var el = document.getElementById(link.dataset.target);
      // Offset the fixed header so the target isn't tucked underneath it.
      var offset = parseInt(token('--header-offset'), 10) || 68;
      // Delegate to animations.js: when ScrollSmoother is running, a plain
      // window.scrollTo() fights it (the content is transformed, so the two
      // disagree about where "scrolled" is) and the page jumps then slides
      // back. The helper falls back to native scrolling when it is not.
      if (window.PortfolioAnimations && window.PortfolioAnimations.scrollTo) {
        window.PortfolioAnimations.scrollTo(el, offset);
      } else if (el) {
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - offset,
          behavior: prefersReduced() ? 'auto' : 'smooth'
        });
      }
      var header = document.getElementById('siteHeader');
      if (header) header.classList.remove('menu-open');
      var toggle = document.querySelector('.nav-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  /* ── Mobile menu ─────────────────────────────────────────────────────── */

  function setupMenu() {
    var toggle = document.querySelector('.nav-toggle');
    var header = document.getElementById('siteHeader');
    if (!toggle || !header) return;
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ── Case-detail accordions ──────────────────────────────────────────── */

  function setupDetails() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-detail-toggle]');
      if (!btn) return;
      var card = btn.closest('[data-project]');
      if (!card) return;
      var panel = card.querySelector('[data-detail]');
      var chev = btn.querySelector('[data-chev]');
      var label = btn.querySelector('[data-detail-label]');
      if (!panel) return;
      var open = panel.style.maxHeight && panel.style.maxHeight !== '0px';
      if (open) {
        panel.style.maxHeight = '0px';
        if (chev) chev.style.transform = '';
        if (label) label.textContent = ' View case details';
        btn.setAttribute('aria-expanded', 'false');
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px';
        if (chev) chev.style.transform = 'rotate(180deg)';
        if (label) label.textContent = ' Hide details';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  /* ── Contact form ────────────────────────────────────────────────────── */

  function setupForm() {
    var form = document.querySelector('[data-contact-form]');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('[data-status]');
      var btn = form.querySelector('button[type="submit"]');
      var say = function (msg, colorToken) {
        if (!status) return;
        status.style.color = token(colorToken);
        status.textContent = msg;
        status.style.opacity = '1';
      };
      say('Sending…', '--color-sage');
      if (btn) btn.disabled = true;

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          say("Thank you — your message is on its way. I'll reply within a day.",
            '--color-sage');
          form.querySelectorAll('input, textarea').forEach(function (el) {
            el.value = '';
          });
          return;
        }
        return res.json().catch(function () { return {}; }).then(function (data) {
          var msg = data.errors
            ? data.errors.map(function (x) { return x.message; }).join(', ')
            : 'Something went wrong.';
          say(msg + ' Please email me directly instead.', '--color-rust');
        });
      }).catch(function () {
        say('Network error. Please email me directly instead.', '--color-rust');
      }).then(function () {
        if (btn) btn.disabled = false;
      });
    });
  }

  /* ── Active-section highlighting in the nav ──────────────────────────── */

  function setupNavHighlight() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
    if (!links.length) return;
    var map = {};
    links.forEach(function (l) { map[l.dataset.target] = l; });
    // A thin band across the middle of the viewport: whichever section
    // crosses it is the active one. The previous version used threshold 0.4,
    // which required 40% of a section to be on screen — unreachable for the
    // work section (roughly 7000px tall in a 900px viewport), so the nav
    // never highlighted at all. Threshold 0 against a collapsed root works
    // regardless of section height.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var l = map[entry.target.id];
        if (!l || !entry.isIntersecting) return;
        // Active state is a class so its colours stay in styles.css.
        links.forEach(function (x) { x.classList.remove('is-active'); });
        l.classList.add('is-active');
      });
    }, { threshold: 0, rootMargin: '-45% 0px -55% 0px' });
    ['work', 'about', 'skills', 'process', 'experience'].forEach(function (id) {
      var s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ── Header condense + hero grain drift ──────────────────────────────── */

  function setupScrollChrome() {
    var header = document.getElementById('siteHeader');
    var grain = document.getElementById('heroGrain');
    var reduce = prefersReduced();
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        // ScrollSmoother moves the content by transform, so window.scrollY
        // still advances but lags what is actually on screen. Prefer the
        // smoother's own position when it is running.
        var sm = window.ScrollSmoother && window.ScrollSmoother.get
          ? window.ScrollSmoother.get() : null;
        var y = sm ? sm.scrollTop() : window.scrollY;
        // Header condense is a legibility change, not decorative motion —
        // it stays even under reduced motion. Values live in styles.css.
        if (header) header.classList.toggle('site-header--condensed', y > 24);
        if (!reduce && grain && y < window.innerHeight) {
          grain.style.transform = 'translateY(' + (y * 0.12) + 'px)';
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ── Cursor-tracking hero glow ───────────────────────────────────────── */

  function setupGlow() {
    if (prefersReduced()) return;
    var hero = document.getElementById('top');
    var glow = document.getElementById('heroGlow');
    if (!hero || !glow) return;
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      glow.style.left = (e.clientX - r.left) + 'px';
      glow.style.top = (e.clientY - r.top) + 'px';
      glow.style.opacity = '1';
    });
    hero.addEventListener('mouseleave', function () { glow.style.opacity = '0'; });
  }

  /* ── Ambient dust particles ──────────────────────────────────────────── */

  function setupParticles() {
    // Continuous ambient motion — skip entirely under reduced motion.
    if (prefersReduced()) return;
    var canvas = document.getElementById('dust');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W, H, parts;

    var resize = function () {
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    var init = function () {
      var n = Math.max(24, Math.floor(W / 26));
      parts = [];
      for (var i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.6 + 0.4,
          vy: -(Math.random() * 0.28 + 0.06),
          vx: (Math.random() - 0.5) * 0.14,
          a: Math.random() * 0.4 + 0.12,
          ph: Math.random() * Math.PI * 2,
          bright: Math.random() > 0.8
        });
      }
    };
    resize(); init();
    window.addEventListener('resize', function () { resize(); init(); });

    (function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.y += p.vy; p.ph += 0.01;
        p.x += p.vx + Math.sin(p.ph) * 0.12;
        if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
        if (p.x < -6) p.x = W + 6;
        if (p.x > W + 6) p.x = -6;
        var tw = p.a * (0.7 + 0.3 * Math.sin(p.ph * 2));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.bright
          ? 'rgba(226,205,168,' + tw + ')'
          : 'rgba(176,141,87,' + tw + ')';
        ctx.fill();
      }
      requestAnimationFrame(draw);
    })();
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */

  function start() {
    var year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();

    setupNavClicks();
    setupMenu();
    setupDetails();
    setupForm();
    setupNavHighlight();
    setupScrollChrome();
    setupGlow();
    setupParticles();

    // GSAP scroll effects. Loaded from a CDN, so it may not be parsed yet.
    if (window.PortfolioAnimations) window.PortfolioAnimations.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
