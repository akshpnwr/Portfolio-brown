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
    line: 'Available now — taking on one new project.',
    // Used instead when a month IS set. {month} is substituted.
    lineFrom: 'Currently taking on one new project — available from {month}.',
    lineClosed: 'Fully booked at the moment — worth asking about next quarter.'
  };

  /* ── Hero stat ───────────────────────────────────────────────────────────
     The badge over the portrait. Never put years of experience here: it is
     the most prominent number on the page and a low year-count reads junior
     to a buyer. Keep it a count of shipped things.

     Alternative: { value: '3', label: 'SaaS platforms live' } */
  var heroStat = {
    value: '7+',
    // Kept short: the badge label is uppercase at 12px with wide tracking,
    // so anything longer than ~3 words wraps to three lines.
    label: 'shipped to production'
  };

  /* ── Services / engagement models ────────────────────────────────────────
     `featured` marks the lead offer — exactly one card should carry it.

     `shape` is the line above each CTA where a price used to sit. It says
     how the engagement is structured — fixed scope, retainer, project-based
     — rather than what it costs. A figure on the page invites a visitor to
     disqualify themselves before there is any conversation about what they
     actually need, and it dates badly.

     If a figure is ever wanted back, set `price` instead — applyData()
     still reads it as a fallback, so it is a one-line change. Note the slot
     is styled as a small tracked label now, not the large serif a price
     wants; restore .service__shape's old display treatment in styles.css
     if you put numbers back. */
  var services = [
    {
      id: 'mvp',
      featured: true,
      badge: 'Most popular',
      name: 'MVP Build',
      oneLiner: 'Idea to production in 6–10 weeks.',
      body: 'Full product build — data model, API, interface, deploy. You get a working, launched product, not a prototype.',
      includes: [
        'Architecture & schema design',
        'Full-stack build',
        'Deployment',
        '30 days post-launch support'
      ],
      shape: 'Fixed scope · 6–10 weeks',
      cta: 'Start a project'
    },
    {
      id: 'fractional',
      featured: false,
      badge: '',
      name: 'Fractional Founding Engineer',
      oneLiner: 'Ongoing engineering ownership, part-time.',
      body: 'For funded teams who need senior end-to-end capability without a full-time hire. Feature development, architecture decisions, keeping it alive.',
      includes: [
        '20–30 hrs/week',
        'Monthly rolling'
      ],
      shape: 'Monthly retainer · rolling',
      cta: 'Check availability'
    },
    {
      id: 'commerce',
      featured: false,
      badge: '',
      name: 'Commerce Storefront',
      oneLiner: 'Shopify builds for brands that care how it looks.',
      body: 'Custom theme development in Liquid — editorial storefronts tuned for high-consideration products.',
      includes: [
        'Theme customization',
        'Custom sections',
        'Launch'
      ],
      shape: 'Project-based · fixed scope',
      cta: 'Discuss a storefront'
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
      prose: 'A multi-tenant hiring platform running in production, with every organization isolated on one codebase.'
    },
    ireportify: {
      metric: 'TODO — get from client: hours saved per inspection, reports/month, crew count',
      prose: 'Inspection reporting that happens on deck instead of at a desk, in use by shipping professionals worldwide.'
    },
    realestateverifiedleads: {
      metric: 'TODO — get from client: lead-to-close %, qualified leads/month, sales-time saved',
      prose: 'A five-tier qualification flow that keeps unverified leads away from the closers.'
    },
    jamesaston: {
      metric: 'TODO — get from client: conversion %, AOV, orders/month since launch',
      prose: 'An editorial storefront that carries the brand from collection story through to checkout.'
    },
    furnicheer: {
      metric: 'TODO — get from client: orders/month, enquiry volume, AOV on made-to-order pieces',
      prose: 'A storefront built to handle custom orders and nationwide shipping.'
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
    isPlaceholderDomain: true
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
    services: services,
    metrics: metrics,
    booking: booking,
    site: site,
    checkMetrics: checkMetrics
  };
})(window);
