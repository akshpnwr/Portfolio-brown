/* ==========================================================================
   animations.js — every GSAP-driven scroll effect on the page.

   Loaded as a plain <script> from <helmet>, this registers a single global,
   `PortfolioAnimations`, which the Design Component logic in index.html calls
   from componentDidMount(). It is deliberately free of any DC-runtime
   knowledge so it can be reasoned about (and re-run) on its own.

   Two constraints shape everything here:

   1. GSAP loads from a CDN, so nothing may assume `window.gsap` exists at
      call time. init() waits for it and gives up gracefully.

   2. init() is idempotent — calling it twice is a no-op rather than a
      rebuild. This page previously ran on a design-tool preview runtime that
      mounted its component twice and reverted GSAP's contexts, which left
      every ScrollTrigger dead and the content stranded at opacity 0. That
      runtime is gone, but the guard is kept: cheap, and it makes this file
      safe to call from anywhere.

   Fail-safe rule: elements are NEVER hidden by CSS. Only this file hides
   them, and only once GSAP is confirmed live. If the CDN fails, the page
   renders as a complete, readable static site.
   ========================================================================== */

(function (global) {
  'use strict';

  var DESKTOP = '(min-width: 769px)';
  var MOBILE = '(max-width: 768px)';
  var REDUCE = '(prefers-reduced-motion: reduce)';

  /* The work section's sticky stack turns on at 901px, not at DESKTOP.
     It must match the `@media (max-width: 900px)` rule in styles.css that
     unstacks the panels: if the two disagree, the 769–900px band gets panels
     that CSS has made ordinary cards while JS has already excluded them from
     the reveal system, so they sit un-animated among neighbours that animate.
     Keep this in sync with that breakpoint. */
  var STICKY_WORK = '(min-width: 901px)';

  /* Where a section starts revealing, as a share of viewport height measured
     from the top. 0.80 means the element's top edge must climb to 80% down
     the screen — i.e. it is a fifth of the way in — before it animates.

     This number decides whether the reveal is *seen*. At 0.90 the tween
     began while the element was barely peeking over the bottom edge and,
     over its 0.8s, finished before the reader's eye arrived: technically
     animating, visibly nothing. Lower values reveal later and more visibly;
     going much below 0.70 starts to feel like the page is lagging behind
     the scroll. */
  var REVEAL_AT = 0.90;
  var REVEAL_START = 'top ' + (REVEAL_AT * 100) + '%';

  /* Add ?debug to the URL to draw ScrollTrigger's start/end markers for every
     effect and log what was built. Costs nothing in normal use, and turns
     "is this even running?" into a five-second check. */
  var DEBUG = /[?&]debug\b/.test(global.location.search);

  var state = {
    mm: null,      // active gsap.matchMedia() context
    splits: [],    // SplitText instances needing revert()
    poll: null,    // pending readiness timer
    started: false, // guards against overlapping init() calls
    token: 0,      // increments per init(); stale async work checks it
    smoother: null // ScrollSmoother instance, when active
  };

  /* Resolves once gsap + both plugins exist; rejects after ~6s.
     Polling rather than script onload: the <script> tags are created by the
     helmet manager, so we never get a reference to them to listen on. */
  function whenReady() {
    function present() {
      return global.gsap && global.ScrollTrigger && global.SplitText;
    }
    if (present()) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      (function tick() {
        if (present()) return resolve();
        if (Date.now() - t0 > 6000) return reject(new Error('GSAP unavailable'));
        state.poll = setTimeout(tick, 60);
      })();
    });
  }

  /* Undo everything a previous init() built. Safe to call when nothing has
     been built yet, which is what makes re-mounting harmless. */
  function teardown() {
    if (state.poll) { clearTimeout(state.poll); state.poll = null; }
    if (state.smoother) {
      try { state.smoother.kill(); } catch (e) { }
      state.smoother = null;
      document.documentElement.classList.remove('has-smooth-scroll');
    }
    if (state.mm) { state.mm.revert(); state.mm = null; }
    state.splits.forEach(function (s) { try { s.revert(); } catch (e) { } });
    state.splits = [];
    state.started = false;
    // Deliberately NOT calling showEverything() here: revert() restores the
    // inline styles gsap set, and the data-reveal-done flags mean the next
    // build re-animates only what has never been shown. Forcing everything
    // visible on teardown would permanently disable the reveals, since the
    // runtime tears down once during its normal mount cycle.
  }

  /* Last-resort visibility restore. Because nothing is hidden in CSS this is
     rarely needed — it covers a partial load, or a teardown that raced a
     half-applied gsap.set(), where the alternative is invisible content. */
  function showEverything() {
    var els = document.querySelectorAll('[data-reveal]');
    for (var i = 0; i < els.length; i++) {
      els[i].style.opacity = '1';
      els[i].style.transform = 'none';
      els[i].style.visibility = 'visible';
      // Visible now, so no later build should hide it again.
      els[i].setAttribute('data-reveal-done', '1');
    }
    var draw = document.getElementById('benchRailDraw');
    if (draw) draw.style.transform = 'scaleX(1)';
  }

  /* Safety net against the one unacceptable outcome: content hidden by this
     file that never gets revealed. Any element inside the viewport that is
     still transparent a moment after build is force-shown.

     This is not belt-and-braces for its own sake — it is the exact failure
     this page hit: the runtime's second mount tore down a live set of
     ScrollTriggers, leaving 40 elements at opacity 0 with nothing left to
     reveal them. The structural fix is above (init() ignores repeat calls);
     this guarantees that any future variation of it degrades to "visible but
     unanimated" rather than "invisible". */
  function startWatchdog() {
    var checks = 0;
    (function sweep() {
      if (!state.mm) return; // torn down

      // Only elements that have never been revealed can possibly need
      // rescuing. Re-measuring all 44 every half second cost real frames:
      // getBoundingClientRect + getComputedStyle each force a synchronous
      // layout, and doing that mid-scroll produced a visible hitch. Once
      // everything has played this list is empty and the sweep stops.
      var pending = document.querySelectorAll('[data-reveal]:not([data-reveal-done])');
      if (!pending.length) return;

      var vh = global.innerHeight || document.documentElement.clientHeight;
      for (var i = 0; i < pending.length; i++) {
        var el = pending[i];
        var r = el.getBoundingClientRect();
        // Only rescue elements well PAST their trigger point. Using the plain
        // "touching the viewport" test raced the reveal: the watchdog fired
        // while the element was still entering at the bottom edge and snapped
        // it visible with no animation. REVEAL_AT is where the tween starts,
        // so anything above half the viewport should long since have played.
        var wellPast = r.top < vh * 0.5 && r.bottom > 0;
        if (!wellPast) continue;
        var op = parseFloat(global.getComputedStyle(el).opacity);
        // Mid-tween values are legitimate; only rescue what is fully hidden
        // and has no tween running on it.
        if (op < 0.02 && !global.gsap.isTweening(el)) {
          el.style.opacity = '1';
          el.style.transform = 'none';
          el.setAttribute('data-reveal-done', '1');
        }
      }
      if (++checks < 40) setTimeout(sweep, 800);
    })();
  }

  /* Testimonial notes: hang each one on its pin and let it settle.

     The notes are drawn as paper pinned to a wall, so the honest motion is a
     card dropped onto a pin, swinging a little, and coming to rest — not an
     endless sway. A permanent loop would put three independent moving objects
     beside body copy the reader is trying to read, and ambient motion that
     never resolves is what turns "pinned wall" into "mobile over a crib".
     So the swing is a one-shot on reveal, and the only repeatable motion is
     hover, which the reader chooses.

     transform-origin is the whole trick. Rotation has to pivot at the pin —
     top centre, matching .note__pin's `top:-9px; left:50%` — because a card
     rotating about its own middle reads as a wobbling rectangle, while one
     rotating about a point above its top edge reads as hanging weight.

     These elements carry [data-reveal], so this claims them (see the same
     pattern in benchScrub) before reveals() can arm a second opacity tween
     on the same nodes. */
  function notes(gsap, reduce) {
    var els = gsap.utils.toArray('.note').filter(function (el) {
      return el.getAttribute('data-reveal-done') !== '1';
    });
    if (!els.length) return;

    els.forEach(function (el) { el.setAttribute('data-reveal-done', '1'); });

    // Reduced motion: no swing, no drop, no rotation written at all — the CSS
    // tilt is already correct and untouched, so this only fades them in,
    // matching how reveals() degrades. Returns before any of the swing setup
    // below, including the getComputedStyle reads.
    if (reduce) {
      gsap.set(els, { opacity: 0 });
      gsap.to(els, { opacity: 1, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
      return;
    }

    // The resting angles live in CSS (.note--tilt-*). Reading each one back
    // means the settle lands on exactly the tilt the stylesheet intends, so
    // JS and CSS can't drift apart if those rules are ever retuned.
    var rest = els.map(function (el) {
      var m = global.getComputedStyle(el).transform;
      if (!m || m === 'none') return 0;
      var p = m.match(/matrix\(([^)]+)\)/);
      if (!p) return 0;
      var v = p[1].split(',');
      return Math.atan2(parseFloat(v[1]), parseFloat(v[0])) * (180 / Math.PI);
    });

    // Origin only. Deliberately no clearProps here: clearProps runs *after*
    // the other properties in the same set() and would strip the origin it
    // was just given, dropping the pivot back to the card's centre.
    gsap.set(els, { transformOrigin: '50% -9px' });

    els.forEach(function (el, i) {
      var target = rest[i];
      // How far off rest the note starts. elastic swings back and forth
      // across `target` from here, so this is the widest excursion of the
      // whole settle — it sets how big the sway reads. 7° is roughly six
      // times the CSS resting tilt, visible without looking flung; past
      // ~10° the pin stops seeming strong enough to hold the paper.
      var swing = target >= 0 ? 7 : -7;

      gsap.set(el, { opacity: 0, y: -26, rotation: target + swing });

      var done = false;
      var play = function () {
        if (done) return;
        done = true;
        // Side-by-side notes cross the trigger line in the same frame, so
        // without an offset all three swing as one block and read as a single
        // hinged object. A tenth of a second apart is enough to separate them
        // into three pieces of paper without looking like a queue.
        var tl = gsap.timeline({ delay: i * 0.11 });
        // Drop onto the pin.
        tl.to(el, { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out' })
          // Then let the pin take the weight. elastic.out, not back.out:
          // back gives a single overshoot that is essentially over in its
          // first third, which is why the swing read as "barely there" no
          // matter how long the duration got — stretching it just slowed a
          // motion that had already finished. elastic oscillates across rest
          // several times, so the extra seconds are spent visibly swinging.
          //
          // The two elastic params are amplitude and period: 1 keeps the
          // overshoot at the stated angle (no extra flick beyond `swing`),
          // and 0.55 is the wavelength — bigger is slower and looser, below
          // ~0.4 it buzzes like a spring rather than swaying like paper.
          .to(el, {
            rotation: target,
            duration: 2.1,
            ease: 'elastic.out(1, 0.55)',
            onComplete: function () {
              // Hand the transform back to CSS. gsap's inline transform is a
              // style attribute and beats the .note:hover rule on specificity,
              // so leaving it here would silently dead-end the hover swing.
              // The note has settled on its CSS rest angle, so clearing is
              // visually a no-op — it just stops pinning the value inline.
              // transformOrigin stays in the stylesheet, so the pivot holds.
              gsap.set(el, { clearProps: 'transform' });
            }
          }, '-=0.18');
      };

      global.ScrollTrigger.create({
        trigger: el,
        start: REVEAL_START,
        once: true,
        onEnter: play,
        // Same stranding guard reveals() uses: if the note is already past
        // the start line at build time, onEnter never fires on its own.
        onRefresh: function (self) { if (self.isActive || self.progress > 0) play(); }
      });
    });
  }

  /* Section reveals. Replaces the old IntersectionObserver: batch() groups
     everything crossing the threshold in the same frame so a row of cards
     staggers together, which the old sibling-index maths only approximated. */
  function reveals(gsap, reduce) {
    // Skip anything a previous build already revealed. The DC runtime mounts
    // this component more than once; without this, the second build re-hides
    // content the user is already reading and re-arms triggers whose start
    // position has been scrolled past, stranding it at opacity 0. That is
    // the difference between "the animations replay" and "the page is blank".
    var els = gsap.utils.toArray('[data-reveal]').filter(function (el) {
      return el.getAttribute('data-reveal-done') !== '1';
    });
    if (!els.length) return;

    var show = function (targets, stagger) {
      var list = targets.length ? targets : [targets];
      list.forEach(function (el) { el.setAttribute('data-reveal-done', '1'); });
      gsap.to(list, {
        opacity: 1,
        y: 0,
        duration: reduce ? 0.35 : 0.8,
        ease: 'power3.out',
        stagger: stagger ? (reduce ? 0 : 0.09) : 0,
        overwrite: 'auto'
      });
    };

    // Split by what is already on screen. A scroll-triggered reveal only
    // fires when an element *crosses* its start position, so anything
    // already past that line at build time would stay hidden forever —
    // exactly the "nothing animates and the content is invisible" failure.
    var vh = global.innerHeight || document.documentElement.clientHeight;
    var onscreen = [];
    var offscreen = [];
    els.forEach(function (el) {
      var top = el.getBoundingClientRect().top;
      // Same threshold the ScrollTrigger uses, so an element can never fall
      // between the two rules and end up with neither treatment.
      if (top < vh * REVEAL_AT) onscreen.push(el); else offscreen.push(el);
    });

    // Already visible: reveal immediately rather than waiting for a scroll
    // that may never come (short viewports, deep links, restored scroll).
    if (onscreen.length) {
      gsap.set(onscreen, { opacity: 0, y: reduce ? 0 : 44 });
      show(onscreen, true);
    }

    if (!offscreen.length) return;
    gsap.set(offscreen, { opacity: 0, y: reduce ? 0 : 44 });

    // One trigger per element rather than ScrollTrigger.batch(): batch
    // aggregates by frame, which is prettier, but its callback is skipped
    // for elements whose crossing happened before the trigger existed.
    // A per-element trigger with an explicit onEnter/onRefresh pair always
    // resolves, so no element can be left stranded at opacity 0.
    offscreen.forEach(function (el, i) {
      var done = false;
      var play = function () {
        if (done) return;
        done = true;
        el.setAttribute('data-reveal-done', '1');
        // Small stagger by DOM order within a screenful, so neighbours
        // still feel grouped without batch()'s fragility.
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: reduce ? 0.35 : 0.9,
          ease: 'power3.out',
          delay: reduce ? 0 : (i % 4) * 0.06,
          overwrite: 'auto'
        });
      };
      global.ScrollTrigger.create({
        trigger: el,
        start: REVEAL_START,
        once: true,
        markers: DEBUG,
        onEnter: play,
        // Fires on refresh (font load, image sizing, resize). If the element
        // is already above the line by then, reveal rather than wait.
        onRefresh: function (self) { if (self.progress > 0) play(); }
      });
    });
  }

  /* Hero headline: line-masked character reveal.
     autoSplit matters — Instrument Serif arrives from Google Fonts after
     first paint, and splitting against the fallback puts the line masks in
     the wrong places. Returning the tween from onSplit lets SplitText
     re-synchronise it on every re-split. */
  function hero(gsap, SplitText, reduce) {
    var h1 = document.querySelector('.display--hero');
    if (!h1) return;
    // The reveal system also matches this node; SplitText owns it instead.
    h1.removeAttribute('data-reveal');
    gsap.set(h1, { opacity: 1, y: 0 });

    if (reduce) { gsap.from(h1, { opacity: 0, duration: 0.4 }); return; }

    state.splits.push(SplitText.create(h1, {
      type: 'lines,chars',
      mask: 'lines',
      autoSplit: true,
      linesClass: 'hero-line',
      onSplit: function (self) {
        // fromTo, not from: `from` leaves the characters stuck at their
        // start values if the tween is ever killed mid-flight (a re-split,
        // a teardown), and a killed hero reveal means a permanently faded
        // headline. clearProps drops the inline opacity/transform on
        // completion so the text ends in its plain CSS state.
        return gsap.fromTo(self.chars,
          { yPercent: 120, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.8,
            ease: 'power4.out',
            stagger: 0.018,
            delay: 0.15,
            clearProps: 'opacity,transform'
          });
      }
    }));

    // Backstop: if the split or its tween never completes — fonts that never
    // arrive, a re-split that races a teardown — force the headline back to
    // full strength. It is the largest element on the page; faded is worse
    // than unanimated.
    setTimeout(function () {
      if (parseFloat(global.getComputedStyle(h1).opacity) < 0.99) {
        gsap.set(h1, { opacity: 1, y: 0 });
      }
      h1.querySelectorAll('.hero-line *').forEach(function (c) {
        if (parseFloat(global.getComputedStyle(c).opacity) < 0.99) {
          c.style.opacity = '1';
          c.style.transform = 'none';
        }
      });
    }, 3000);
  }

  /* The work section's stacked panels.

     Each project is a viewport-sized panel that holds at the top of the screen
     while the next one scrolls up and covers it — the panels deal over each
     other like cards, alternating bone and ink.

     This is done with a ScrollTrigger pin per panel, deliberately, after
     `position: sticky` was tried and could not work: ScrollSmoother makes
     `#smooth-wrapper` a `position: fixed; overflow: hidden` box and translates
     the content inside it, so a sticky element has no scrolling ancestor to
     resolve against and simply scrolls away. (Verified: panel tops went to
     -227, -827 … holding nothing.) The pin is measured against the smoothed
     scroller, so it works where sticky cannot.

     Every panel except the last is pinned from the moment its top reaches the
     header to the moment the *next* panel's top does. `pinSpacing: false` is
     what produces the covering: without it ScrollTrigger inserts spacer height
     for the pinned duration and each panel gets its own stretch of empty
     scroll, which reads as a gap rather than a stack. With it the panels
     occupy the same scroll space and overlap, and the z-index ladder in
     styles.css decides who paints on top.

     The last panel is left unpinned so the section releases into the page
     instead of holding the reader at the bottom of the stack.

     Panels also opt out of reveals(). A reveal would set `opacity: 0; y: 44`
     on a pinned element — the panel would sit 44px low and, if its trigger
     never fired, stay invisible while still filling the screen. */
  function stickyWork(gsap) {
    var panels = gsap.utils.toArray('.project');
    if (panels.length < 2) return;

    panels.forEach(function (p) { p.setAttribute('data-reveal-done', '1'); });
    gsap.set(panels, { opacity: 1, y: 0, clearProps: 'transform' });

    // Alternating surface and stacking order both have to be set here, not in
    // CSS. ScrollTrigger wraps every pinned element in its own `.pin-spacer`,
    // so each panel ends up the *only* child of its wrapper — a
    // `:nth-of-type` ladder then matches (1) for all of them, which rendered
    // every panel bone and left the stacking order to chance. Setting both in
    // DOM order here, before the pins exist, survives the wrapping.
    panels.forEach(function (p, i) {
      p.classList.toggle('project--ink', i % 2 === 1);
      // Later panels must paint over the ones they cover.
      p.style.zIndex = String(i + 1);
    });

    panels.forEach(function (panel, i) {
      // The last panel has nothing to hand off to; pinning it would hold the
      // reader at the end of the section with no incoming panel to reward it.
      if (i === panels.length - 1) return;
      global.ScrollTrigger.create({
        trigger: panel,
        // Pinned at the very top of the viewport, not at the header offset —
        // the panels are full-height and deliberately run behind the
        // translucent header, so that the incoming colour reaches the top
        // edge of the screen with no seam. Their internal padding keeps the
        // content itself clear of the header.
        start: 'top top',
        // Hold until the panel that covers this one is itself in position.
        endTrigger: panels[i + 1],
        end: 'top top',
        pin: true,
        pinSpacing: false,
        // Positions depend on viewport height, which changes on resize and on
        // mobile address-bar show/hide.
        invalidateOnRefresh: true,
        anticipatePin: 1,
        markers: DEBUG
      });
    });
  }

  /* NOTE: the project images deliberately have no parallax.

     There was a per-card drift here (`scale: 1.12`, `yPercent: ±6`). Parallax
     inside a fixed frame always costs a crop — the image must be oversized so
     its edges never swing into view, which means the overscale is a permanent
     zoom whether or not anything is moving. At 1.12 that hid 11% of every
     image, and these are screenshots of real products: the cropped edges were
     nav bars, buttons and page chrome, i.e. the evidence the section exists
     to show.

     The drift also earned much less than it used to. It was tuned for cards
     scrolling the full height of the viewport; the panels are pinned now, so
     a held frame barely moves relative to the screen. The stacking is the
     section's motion. If any image drift is ever wanted back here, it has to
     be paired with an overscale of at least 2x its travel, and that crop is
     the price. */

  /* The signature moment: pin the process section and draw the brass rail
     left-to-right while each station lights in turn. The seven stations are
     a 7-column grid (all visible at once), so this is a timed sweep across
     them, not a scroll-through. Desktop, non-reduced-motion only. */
  function benchScrub(gsap) {
    var section = document.getElementById('process');
    var draw = document.getElementById('benchRailDraw');
    if (!section || !draw) return;
    var stations = gsap.utils.toArray('#bench .station');
    if (!stations.length) return;

    var texts = stations.map(function (s) { return s.querySelector('.station__text'); });
    var icons = stations.map(function (s) { return s.querySelector('svg'); });

    // Stations carry [data-reveal] too. Marking them done is not cosmetic:
    // reveals() runs before this and arms a trigger per station at
    // REVEAL_START. Those triggers fire *inside* the pinned scrub and
    // re-animate opacity/y on nodes the sweep is already driving, so the
    // stations flicker or stick. Raising REVEAL_AT moves the reveal trigger
    // deeper into the pin and makes the collision certain, which is why the
    // section appeared to break when the value went up.
    // data-reveal-done makes reveals() skip them entirely (see its filter).
    stations.forEach(function (s) { s.setAttribute('data-reveal-done', '1'); });
    gsap.set(stations, { opacity: 1, y: 0, clearProps: 'transform' });
    gsap.set(draw, { scaleX: 0 });
    // Floors sit low so the lift reads as a light coming on. Above ~0.25 the
    // unlit and lit states are too close to tell apart mid-sweep.
    gsap.set(texts, { opacity: 0.14, y: 8 });
    gsap.set(icons, { opacity: 0.16 });

    var span = stations.length;
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'center center',
        // One extra viewport drives the sweep: long enough to feel
        // deliberate, short enough not to trap the reader.
        end: '+=100%',
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        markers: DEBUG
      }
    });

    tl.to(draw, { scaleX: 1, ease: 'none', duration: span });
    stations.forEach(function (st, i) {
      // Column i spans [i, i+1); light it once the leading edge is inside,
      // so the glow always trails the line rather than racing it.
      var at = i + 0.35;
      tl.to(texts[i], { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, at);
      tl.to(icons[i], { opacity: 1, duration: 0.4, ease: 'power2.out' }, at);
    });

    // Class toggling lives in onUpdate rather than tl.call() so it is
    // symmetric: scrubbing back up un-lights each node instead of leaving
    // the whole rail stuck bright.
    tl.eventCallback('onUpdate', function () {
      var p = tl.progress() * span;
      stations.forEach(function (st, i) {
        st.classList.toggle('is-lit', p >= i + 0.35);
      });
    });
  }

  /* Mobile / reduced-motion path: no pin, no scrub, stations at full
     strength so nothing depends on the sweep having run. */
  function benchStatic(gsap, reduce) {
    var draw = document.getElementById('benchRailDraw');
    var stations = gsap.utils.toArray('#bench .station');
    gsap.set(stations.map(function (s) { return s.querySelector('.station__text'); }),
      { opacity: 1, y: 0 });
    gsap.set(stations.map(function (s) { return s.querySelector('svg'); }),
      { opacity: 1 });
    if (!draw) return;
    // Under reduced motion the rail is simply present. A scroll-triggered
    // draw that never fires would strand it at scaleX(0), i.e. invisible.
    if (reduce) { gsap.set(draw, { scaleX: 1 }); return; }
    gsap.fromTo(draw,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1.1,
        ease: 'power2.out',
        scrollTrigger: { trigger: '#bench', start: 'top 85%', once: true, markers: DEBUG }
      });
  }

  /* ?debug summary. Prints what actually got built, so a missing effect is
     obvious without reading any code. */
  function report() {
    var all = global.ScrollTrigger.getAll();
    var pinned = all.filter(function (t) { return t.pin; });
    /* eslint-disable no-console */
    console.log('%c PortfolioAnimations ', 'background:#6B4F3B;color:#fff', {
      'gsap': global.gsap.version,
      'reduced motion': global.matchMedia(REDUCE).matches,
      'ScrollTriggers': all.length,
      'pinned (process section)': pinned.length,
      'hero lines (SplitText)': document.querySelectorAll('.hero-line').length,
      'reveal targets': document.querySelectorAll('[data-reveal]').length,
      'work frames (no parallax by design)':
        document.querySelectorAll('.project .frame').length,
      // Sticky, not pinned — so it never appears in the pinned count above.
      'sticky work panels': global.matchMedia(STICKY_WORK).matches
        ? document.querySelectorAll('.project').length
        : 0,
      'reveal fires at': REVEAL_START
    });
    if (global.matchMedia(REDUCE).matches) {
      console.warn('Reduced motion is ON — the pin, the hero split and the ' +
        'card parallax are all disabled by design. Turn it off in your OS ' +
        'display settings to see them.');
    }
    /* eslint-enable no-console */
  }

  /* Inertial scrolling. Native wheel scrolling moves in hard ~120px steps
     with no interpolation — that is the "scrolls in bits" feel, and it is
     what every smooth-scrolling site is actually fixing.

     Deliberately NOT enabled everywhere:
       - reduced motion: smoothing is motion applied to the reader's own
         input, which is the most disorienting kind. Native scroll instead.
       - touch: mobile browsers already scroll smoothly and hand off to the
         OS. Hijacking that breaks momentum, overscroll and address-bar
         behaviour, and is the most common way these libraries make a site
         feel worse than doing nothing.
     In both cases the page keeps native scrolling, and every ScrollTrigger
     continues to work unchanged. */
  function smoothScroll(gsap, reduce) {
    var ScrollSmoother = global.ScrollSmoother;
    if (!ScrollSmoother) return;                       // CDN dropped it
    if (reduce) return;
    if (!document.getElementById('smooth-wrapper')) return;
    // Coarse pointer = touch-primary device.
    if (global.matchMedia('(pointer: coarse)').matches) return;

    document.documentElement.classList.add('has-smooth-scroll');
    state.smoother = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      // Seconds for the content to catch up to the real scroll position.
      // ~1s reads as deliberate; past ~1.5s it feels laggy rather than smooth.
      smooth: 1,
      // normalizeScroll moves scrolling onto the JS thread, which is what
      // keeps the pinned section from juddering against the smoothed content.
      normalizeScroll: true,
      ignoreMobileResize: true,
      effects: false
    });
  }

  function build() {
    var gsap = global.gsap;
    var ScrollTrigger = global.ScrollTrigger;
    var SplitText = global.SplitText;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    if (global.ScrollSmoother) gsap.registerPlugin(global.ScrollSmoother);

    var mm = gsap.matchMedia();
    state.mm = mm;

    mm.add({
      isDesktop: DESKTOP,
      isMobile: MOBILE,
      reduce: REDUCE,
      canStack: STICKY_WORK
    }, function (ctx) {
      var isDesktop = ctx.conditions.isDesktop;
      var reduce = ctx.conditions.reduce;
      // ORDER MATTERS. Everything that owns specific elements must claim them
      // before reveals() runs, because reveals() takes every [data-reveal]
      // node it has not been told to skip and arms a scroll trigger on it.
      // Two systems animating one element's opacity is the bug that produced
      // both the permanently faded hero and the broken process section.

      // Smoother first: it owns the scroller, and every ScrollTrigger created
      // afterwards measures against it.
      smoothScroll(gsap, reduce);

      // Claims the <h1> (strips data-reveal). Without this the reveal tween
      // drives the parent's opacity while SplitText drives each character's,
      // and the two multiply — land the timings badly and the headline
      // settles part-way, permanently faded.
      hero(gsap, SplitText, reduce);

      // Claims the seven stations (marks them data-reveal-done). Pinning is
      // desktop-only and motion-sensitive: holding the viewport still is the
      // effect vestibular users report as nauseating, and on a phone it
      // simply reads as a broken page.
      if (isDesktop && !reduce) benchScrub(gsap);
      else benchStatic(gsap, reduce);

      // Claims the project panels (marks them data-reveal-done). Gated on the
      // same 901px breakpoint the CSS unstacks at: below it, and under reduced
      // motion, the panels are `position: static` again — ordinary cards that
      // the reveal system should own as before.
      if (ctx.conditions.canStack && !reduce) stickyWork(gsap);

      // Claims the testimonial notes (marks them data-reveal-done). Same
      // reason as the stations: reveals() would otherwise arm a second
      // opacity/y tween on nodes the settle timeline already drives.
      notes(gsap, reduce);

      // Now the general case, over whatever is left.
      reveals(gsap, reduce);
    });
  }

  /* Public entry point. Idempotent: calling it again tears down the previous
     build first, which is what makes the runtime's re-mount cycle safe. */
  function init() {
    // Already built and running: do nothing. The DC runtime mounts this
    // component more than once during normal startup, and rebuilding on the
    // second mount tore down a working set of ScrollTriggers and re-hid
    // content whose start positions had already been passed — the page then
    // sat there with ghosted text and no animation. A rebuild is only
    // correct after an explicit destroy().
    if (state.mm) return Promise.resolve();
    teardown();
    state.started = true;
    var token = ++state.token;
    return whenReady().then(function () {
      // A newer init() (or a destroy()) superseded this one while we waited.
      if (token !== state.token || !state.started) return;
      // Build on a settled frame. The DC runtime mounts this component more
      // than once and is still committing DOM when the first mount fires;
      // building against a mid-commit layout produced triggers with stale
      // positions that never fired, which read as "nothing animates".
      return new Promise(function (resolve) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (token !== state.token || !state.started) return resolve();
            build();
            // Positions were measured during a load in which fonts and
            // images may still have been settling.
            global.ScrollTrigger.refresh();
            startWatchdog();
            if (DEBUG) report();
            resolve();
          });
        });
      });
    }).catch(function () {
      showEverything();
    });
  }

  /* Scroll to a target, routed through ScrollSmoother when it is active.
     A plain window.scrollTo() fights the smoothed scroller — the content is
     transformed, so the browser's idea of the scroll position and the
     smoother's disagree, and the page jumps then slides back. Callers should
     use this rather than scrolling the window directly. */
  function scrollTo(el, offset) {
    if (!el) return;
    if (state.smoother) {
      state.smoother.scrollTo(el, true, 'top ' + (offset || 0) + 'px');
      return;
    }
    var reduce = global.matchMedia(REDUCE).matches;
    global.scrollTo({
      top: el.getBoundingClientRect().top + global.scrollY - (offset || 0),
      behavior: reduce ? 'auto' : 'smooth'
    });
  }

  global.PortfolioAnimations = {
    init: init,
    destroy: teardown,
    showEverything: showEverything,
    scrollTo: scrollTo
  };
})(window);
