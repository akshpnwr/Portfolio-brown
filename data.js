/* ==========================================================================
   data.js — the copy and figures that change most often.

   This site is static HTML with no build step, so there is no `src/data/*.ts`
   to import from. This file is the equivalent: a single global,
   `PortfolioData`, holding the values that get edited without touching layout
   — service copy, availability, the domain, the case-study metrics.

   It loads BEFORE site.js and writes its values into the page on boot (see
   applyData() in site.js). The HTML carries sensible defaults inline, so if
   this file ever fails to load the page still reads correctly — it just shows
   the last-committed copy rather than the values here.

   Edit here, not in index.html, for anything below.
   ========================================================================== */

(function (global) {
  'use strict';

  /* ── Availability ────────────────────────────────────────────────────────
     Shown next to the hero CTAs. Change MONTH when the slot moves; set
     `taking` to false to swap the line to the unavailable variant. */
  var availability = {
    taking: true,
    // Left empty to say "available now". Set it to a month name — 'October'
    // — and `line` switches to the deferred wording automatically, so the
    // dated and undated versions never have to be edited by hand.
    month: '',
    // Rendered when taking === true and no month is set.
    // "Available now" read as open capacity, which undercut the contact
    // section's scarcity line ("a small number of projects at a time").
    // Taking *a* project says the same availability without sounding empty.
    line: 'Taking on a new project this month.',
    // Used instead when a month IS set. {month} is substituted.
    lineFrom: 'Taking on new projects from {month}.',
    lineClosed: 'Fully booked right now. Ask me about next quarter.'
  };

  /* ── Shipped-work count ──────────────────────────────────────────────────
     ONE number, rendered in two places: the badge over the hero portrait and
     the first cell of the About stat row. They used to be set separately and
     drifted apart, which reads as inflation to anyone who notices.

     "7+" because seven is what the site SHOWS, not what exists: the five
     case studies plus two cut from the grid for positioning reasons (Baluni
     Public School, Easy Prime Holidays). Akash confirmed there is more
     shipped work beyond these — these are the ones he rates highest and
     chose to put forward. The "+" carries that without listing it.

     The seven on the page stay individually nameable, so the claim survives
     a reference call: "which seven are these?" has an answer.

     Never put years of experience here: it is the most prominent number on
     the page and a low year-count reads junior to a buyer. Keep it a count
     of shipped things. */
  var shippedCount = '7+';

  var heroStat = {
    value: shippedCount,
    // Kept short: the badge is narrow, so anything longer than ~3 words
    // wraps to three lines.
    label: 'shipped to production'
  };

  /* ── About stat row ──────────────────────────────────────────────────────
     The three figures that ARE the About section — they carry it, with one
     sentence of framing above rather than the other way round.

     The first shares its value with the hero portrait badge, by
     construction. That badge is now the hero's only figure: a proof strip
     repeating all three under the CTAs said the same thing twice on one
     screen, so it was removed. */
  var aboutStats = [
    { value: shippedCount, label: 'products shipped' },
    { value: '3', label: 'SaaS platforms live' },
    { value: '100%', label: 'end-to-end ownership' }
  ];

  /* ── Services / engagement models ────────────────────────────────────────
     `featured` marks the lead offer — exactly one card should carry it.

     `shape` is the line above each CTA where a price used to sit. It says
     how the engagement is structured — fixed scope, retainer, project-based
     — rather than what it costs. A figure on the page invites a visitor to
     disqualify themselves before there is any conversation about what they
     actually need, and it dates badly.

     If a figure is ever wanted back, set `price` instead — applyData()
     still reads it as a fallback, so it is a one-line change. Note the slot
     is styled as a small label now, not the large display figure a price
     wants; give .service__shape a display treatment in styles.css if you
     put numbers back. */
  var services = [
    {
      id: 'mvp',
      featured: true,
      badge: 'Most popular',
      name: 'MVP & Product Development',
      // ⁠ (word joiner) stops a narrow card breaking the line after the
      // en dash, which left "6–" and "10 weeks" on separate lines.
      oneLiner: 'Your idea, live in production in 6–⁠10 weeks.',
      body: 'You get a launched product people can sign up for and use, not a prototype or a handover document. I own the whole build, so there is no gap between the backend, the interface and the deploy.',
      includes: [
        'Built and launched end to end',
        'Scales past your first customers',
        'Live deployment on your domain',
        '30 days support after launch'
      ],
      shape: 'Fixed scope · 6–⁠10 weeks',
      cta: 'Tell me about your project'
    },
    {
      id: 'fractional',
      featured: false,
      badge: '',
      name: 'Fractional Engineering',
      oneLiner: 'A senior engineer who owns it, without the full-time hire.',
      body: 'For funded teams already running something. I take ownership of features, architecture calls and the unglamorous work of keeping a live product healthy.',
      includes: [
        '20–30 hrs/week',
        'Monthly rolling, cancel anytime'
      ],
      shape: 'Monthly retainer · rolling',
      cta: 'Check availability'
    },
    {
      id: 'commerce',
      featured: false,
      badge: '',
      name: 'Shopify Storefronts',
      oneLiner: 'For brands with a product worth showing properly.',
      body: 'Custom Shopify builds for brands whose product deserves better than a theme out of the box. Editorial storefronts tuned for considered purchases.',
      includes: [
        'Custom theme, built to your brand',
        'Made-to-order and custom flows',
        'Launched and trading'
      ],
      shape: 'Project-based · fixed scope',
      cta: 'Discuss your storefront'
    }
  ];

  /* ── Case-study outcome metrics ──────────────────────────────────────────
     Keyed by the project's data-project-id in index.html.

     `metric` renders large, above the outcome prose. Anything still starting
     with "TODO" is treated as unfilled: it is hidden from visitors and
     reported in the console on load (see checkMetrics below).

     DO NOT invent these. Ask the client for the real figure — conversion %,
     load time, orders/month, hours saved — and paste it in. An invented
     number is worse than no number: it is the one thing on the page a buyer
     can check with a reference call. */
  var metrics = {
    talentgpt: {
      metric: 'TODO — get from client: recruiters onboarded, time-to-hire reduction, orgs on the platform',
      prose: 'Live in production and still running. Multiple organizations hire on one codebase, each one\'s data sealed off from the rest, and it stayed fast as the data grew.'
    },
    ireportify: {
      metric: 'TODO — get from client: hours saved per inspection, reports/month, crew count',
      prose: 'Live and in daily use by shipping professionals worldwide. Reporting now happens on deck in a few taps instead of back at a desk.'
    },
    realestateverifiedleads: {
      metric: 'TODO — get from client: lead-to-close %, qualified leads/month, sales-time saved',
      prose: 'Live in production, and I\'m now the team\'s go-to for the critical work. Closers only ever see buyers who cleared voice verification.'
    },
    jamesaston: {
      metric: 'TODO — get from client: conversion %, AOV, orders/month since launch',
      prose: 'Live and taking orders. The storefront carries the brand from collection story through to checkout, and it launched without drama, in the founder\'s words.'
    },
    freshndew: {
      metric: 'TODO — get from client: conversion %, orders/month, repeat-purchase rate',
      prose: 'Live and selling. The storefront teaches the hard-water problem first, then walks the visitor straight into the cleanser-and-moisturiser routine.'
    },
    furnicheer: {
      metric: 'TODO — get from client: orders/month, enquiry volume, AOV on made-to-order pieces',
      prose: 'Live and trading across India and beyond, handling made-to-order pieces and nationwide shipping.'
    }
  };

  /* ── Booking ─────────────────────────────────────────────────────────────
     Cal.com or Calendly link for the contact section. While `url` is empty
     the button is hidden entirely rather than shipping a dead link — see
     applyData() in site.js. Paste the URL here to turn it on.

     See DOMAIN.md for how to get one. */
  var booking = {
    url: '',
    label: 'Book a 20-min call'
  };

  /* ── Site / domain ───────────────────────────────────────────────────────
     TODO(akash): swap this to the real custom domain once it is registered
     and pointed at Vercel, then re-run the canonical/OG update. Every URL
     that must change is listed in DOMAIN.md — this constant is the only one
     in JS, the rest are in index.html <head> and sitemap.xml. */
  var site = {
    domain: 'https://akashpanwar.dev',
    // Registered, resolving and served from Vercel over HTTPS; the OG image
    // at /assets/og-image.png returns a real PNG, so link previews render.
    // Flipped false so the console stops reporting a placeholder that is no
    // longer one.
    isPlaceholderDomain: false
  };

  /* ── Unfilled-metric report ──────────────────────────────────────────────
     Stands in for the build-time lint the spec asks for. There is no build
     step here, so the check runs on load and reports to the console. Visitors
     never see a TODO — applyData() hides those — but anyone opening devtools
     on the live site gets a list of what is still missing. */
  function checkMetrics() {
    var unfilled = Object.keys(metrics).filter(function (k) {
      return /^TODO/.test(metrics[k].metric || '');
    });
    if (!unfilled.length) return;
    /* eslint-disable no-console */
    console.warn(
      '%c Portfolio ', 'background:#a5544c;color:#fff',
      unfilled.length + ' case ' + (unfilled.length === 1 ? 'study is' : 'studies are') +
      ' missing a real outcome metric. These render blank until filled in ' +
      '(data.js → metrics):'
    );
    unfilled.forEach(function (k) {
      console.warn('  · ' + k + ' — ' + metrics[k].metric);
    });
    if (site.isPlaceholderDomain) {
      console.warn(
        '%c Portfolio ', 'background:#a5544c;color:#fff',
        'Canonical/OG URLs still point at a placeholder domain. See DOMAIN.md.'
      );
    }
    if (!booking.url) {
      console.warn(
        '%c Portfolio ', 'background:#a5544c;color:#fff',
        'No booking URL set — the "Book a call" button is hidden. ' +
        'Add one in data.js → booking.url. See DOMAIN.md for setup.'
      );
    }
    /* eslint-enable no-console */
  }

  global.PortfolioData = {
    availability: availability,
    heroStat: heroStat,
    aboutStats: aboutStats,
    services: services,
    metrics: metrics,
    booking: booking,
    site: site,
    checkMetrics: checkMetrics
  };
})(window);
