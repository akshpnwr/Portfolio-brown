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

  /* ── Analytics ───────────────────────────────────────────────────────────
     One helper in front of whichever provider is installed, so nothing else
     in this file knows or cares which one it is. No provider present (the
     current state, and every local open of index.html) means every call is
     a silent no-op — never a thrown error, and never a blocked click.

     Supports Vercel Analytics (window.va) and Plausible (window.plausible);
     see DOMAIN.md for the one-line snippet that turns either on.

     Events, deliberately few. Analytics on a five-page-view-a-day site is
     only useful if each number answers a question worth acting on:
       hero-cta       — did the new headline move anyone to the offer?
       service-cta    — which engagement do people actually want?
       book-call      — does a calendar beat a form?
       project-live   — which case study earns the outbound click?
       contact-submit — the only one that is really a conversion. */

  function track(name, data) {
    try {
      if (typeof window.va === 'function') {
        window.va('event', { name: name, data: data || {} });
      }
      if (typeof window.plausible === 'function') {
        window.plausible(name, data ? { props: data } : undefined);
      }
    } catch (e) {
      // Analytics must never break the interaction it is measuring.
    }
  }

  /* Delegated so it covers the service cards, which applyData() rewrites
     after this runs, and any element that later grows a [data-track]. */
  function setupTracking() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-track]');
      if (!el) return;
      track(el.dataset.track, el.dataset.trackLabel
        ? { label: el.dataset.trackLabel }
        : undefined);
    });
  }

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
          // Only on a confirmed 2xx: a submit that Formspree rejected is
          // not a lead, and counting it would overstate the one number on
          // this site that actually matters.
          track('contact-submit');
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
    // Must stay in sync with the [data-nav] links in the header — a section
    // missing here simply never highlights.
    ['about', 'services', 'work', 'skills', 'process', 'experience'].forEach(function (id) {
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

  /* ── Data-driven copy ────────────────────────────────────────────────────
     Writes the values from data.js into the page: availability, the hero
     stat, case-study metrics, the booking link.

     Everything here degrades to the markup already in index.html. If data.js
     fails to load, PortfolioData is undefined, this returns early, and the
     visitor sees the last-committed inline copy rather than an empty page.
     That is why the HTML carries real defaults instead of empty elements. */

  function applyData() {
    var D = window.PortfolioData;
    if (!D) return;

    /* Availability line beside the hero CTAs. */
    var avail = document.querySelector('[data-availability]');
    if (avail && D.availability) {
      var a = D.availability;
      var text = a.taking
        ? String(a.line).replace('{month}', a.month)
        : a.lineClosed;
      // Keep the dot; only the text node after it changes.
      var dot = avail.querySelector('.hero__availability-dot');
      avail.textContent = '';
      if (dot) avail.appendChild(dot);
      avail.appendChild(document.createTextNode(text));
      avail.classList.toggle('hero__availability--closed', !a.taking);
    }

    /* Hero stat badge. */
    if (D.heroStat) {
      var sv = document.querySelector('[data-stat-value]');
      var sl = document.querySelector('[data-stat-label]');
      if (sv) sv.textContent = D.heroStat.value;
      if (sl) sl.textContent = D.heroStat.label;
    }

    /* Service cards. The three cards are already in index.html as a working
       fallback; this overwrites their text from data.js so prices and copy
       have a single source of truth.

       Deliberately an overwrite of existing markup rather than building the
       cards from scratch: the fallback has to be real HTML for the offer to
       survive a failed data.js load, and once it exists, rendering over it
       is both less code and less that can go wrong. Cards beyond the number
       in data.js are left untouched; extra entries in data.js are ignored. */
    if (D.services && D.services.length) {
      var cards = document.querySelectorAll('[data-service-grid] .service');
      D.services.forEach(function (svc, i) {
        var card = cards[i];
        if (!card) return;
        var set = function (sel, text) {
          var el = card.querySelector(sel);
          if (el && text) el.textContent = text;
        };
        set('.service__name', svc.name);
        set('.service__one-liner', svc.oneLiner);
        set('.service__body', svc.body);
        set('.service__price', svc.price);

        card.classList.toggle('service--featured', !!svc.featured);

        // Only the lead card carries a badge in the markup, but data.js is
        // free to move `featured` to another card — so create the element if
        // the card needs one and does not have it.
        var badge = card.querySelector('.service__badge');
        if (svc.featured && svc.badge) {
          if (!badge) {
            badge = document.createElement('div');
            badge.className = 'service__badge';
            card.insertBefore(badge, card.firstElementChild);
          }
          badge.textContent = svc.badge;
          badge.hidden = false;
        } else if (badge) {
          badge.hidden = true;
        }

        var list = card.querySelector('.service__includes');
        if (list && svc.includes) {
          list.textContent = '';
          svc.includes.forEach(function (item) {
            var li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
          });
        }

        var cta = card.querySelector('.service__cta');
        if (cta && svc.cta) {
          // Rebuild rather than set textContent: the arrow is a separate
          // aria-hidden span, and replacing the whole node would drop it.
          cta.textContent = svc.cta + ' ';
          var arrow = document.createElement('span');
          arrow.setAttribute('aria-hidden', 'true');
          arrow.textContent = '→';
          cta.appendChild(arrow);
          cta.dataset.trackLabel = svc.name;
        }
      });
    }

    /* Case-study outcome metrics. A metric still starting with "TODO" is
       unfilled — hide the whole block rather than showing scaffolding to a
       visitor. data.js logs those to the console instead. */
    if (D.metrics) {
      document.querySelectorAll('[data-project-id]').forEach(function (card) {
        var entry = D.metrics[card.dataset.projectId];
        if (!entry) return;
        var slot = card.querySelector('[data-metric]');
        var proseEl = card.querySelector('[data-outcome-prose]');
        var filled = entry.metric && !/^TODO/.test(entry.metric);
        if (slot) {
          if (filled) {
            slot.textContent = entry.metric;
            slot.hidden = false;
          } else {
            slot.hidden = true;
          }
        }
        if (proseEl && entry.prose) proseEl.textContent = entry.prose;
      });
    }

    /* Booking link. Hidden entirely while no URL is set — a "Book a call"
       button that goes nowhere costs more trust than its absence. */
    var book = document.querySelector('[data-booking]');
    if (book) {
      if (D.booking && D.booking.url) {
        book.href = D.booking.url;
        book.textContent = D.booking.label;
        book.hidden = false;
      } else {
        book.hidden = true;
      }
    }

    if (D.checkMetrics) D.checkMetrics();
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */

  function start() {
    var year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();

    applyData();
    setupTracking();
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
