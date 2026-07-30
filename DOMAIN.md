# Launch checklist — domain, booking, analytics

Three things are wired but not switched on. Each is a one-line edit plus an
external account. Until they're done the site works, but the console logs a
warning for each on every load (see `checkMetrics()` in `data.js`).

---

## 1. Custom domain

**Status: placeholder.** Every absolute URL currently says
`https://akashpanwar.dev`, which was chosen as a stand-in. Nothing breaks
while the site is served from `*.vercel.app` — but the canonical tag points
at a host that doesn't resolve, which is worse for SEO than having no
canonical at all. Fix this before any real outreach.

### Files to change

Search the repo for `akashpanwar.dev` — it appears in exactly four places:

| File | What's there |
|---|---|
| `index.html` | `<link rel="canonical">`, `og:url`, `og:image`, `twitter:image` |
| `data.js` | `site.domain` — also set `isPlaceholderDomain: false` to silence the console warning |
| `sitemap.xml` | `<loc>` |
| `robots.txt` | `Sitemap:` line |

All four must agree. A canonical pointing one place and a sitemap another is
a genuine SEO problem, not a cosmetic one.

### Vercel + DNS steps

1. **Register the domain.** `akashpanwar.dev` may or may not be available —
   check before assuming. `.dev` is a Google-operated TLD and is on the
   HSTS preload list, so it is **HTTPS-only**; this is fine here (Vercel
   issues certificates automatically) but rules out any plain-HTTP testing.
2. **Vercel → Project → Settings → Domains → Add.** Enter the apex
   (`akashpanwar.dev`). Vercel will also offer to add `www` — accept, and
   set the apex as primary so `www` 308-redirects to it. Pick one as
   canonical and stay with it; serving both is the classic duplicate-content
   own goal.
3. **At the registrar, add the records Vercel shows you.** Typically:
   - Apex `@` → `A` → `76.76.21.21`
   - `www` → `CNAME` → `cname.vercel-dns.com`

   Use the values in the Vercel dashboard rather than these — they change.
   If the registrar supports `ALIAS`/`ANAME` at the apex, prefer that to the
   `A` record.
4. **Wait for propagation** (minutes to ~48h). Vercel's dashboard flags the
   domain valid and provisions the TLS certificate on its own.
5. **Update the four files above, commit, redeploy.**
6. **Verify:** `curl -I https://akashpanwar.dev` returns `200`, and
   `https://www.akashpanwar.dev` returns `308` to the apex.
7. **Post-launch:** add the property in
   [Google Search Console](https://search.google.com/search-console) and
   submit `https://akashpanwar.dev/sitemap.xml`.

### If a different domain is chosen

Nothing above is specific to `akashpanwar.dev` except the name. Swap it
everywhere and the rest holds. Prefer something that reads as a person, not
an agency — the whole pitch is that one identifiable person builds the
product.

---

## 2. Booking link

**Status: hidden.** The "Book a 20-min call" button exists in the contact
section but `applyData()` keeps it `hidden` while `data.js → booking.url` is
empty, so a dead button can't ship.

This matters more than it looks: a founder who won't write a project brief
will often still pick a slot off a calendar. It's the lowest-friction path
in the funnel.

### Cal.com (recommended — free tier is enough)

1. Sign up at [cal.com](https://cal.com) and claim a username, e.g. `akashpanwar`.
2. **Event Types → New.** Name it something with intent — "Project intro
   call" beats "15 Min Meeting". Set **20 minutes**.
3. Connect Google Calendar so real busy time blocks it. Skip this and you
   will get double-booked.
4. Set availability to hours you'll genuinely take a call in. Clients are
   likely in US/EU time zones — Cal.com shows slots in the visitor's local
   time automatically, but if your availability is IST-morning only, a US
   founder sees nothing bookable.
5. Copy the public link (`https://cal.com/akashpanwar/project-intro`).
6. Paste it into `data.js`:

   ```js
   var booking = {
     url: 'https://cal.com/akashpanwar/project-intro',
     label: 'Book a 20-min call'
   };
   ```

The button appears on the next load. Calendly works identically — same
field, paste its URL instead.

---

## 3. Analytics

**Status: wired, inactive.** `site.js` tracks four events
(`hero-cta`, `service-cta`, `book-call`, `project-live`, plus
`contact-submit`) and routes them through a single `track()` helper that
no-ops until a provider is present. Nothing to change in `site.js` —
just add the provider script.

### Vercel Analytics (easiest, since it's already deployed there)

Vercel → Project → **Analytics** → Enable. For a static site with no build
step, add this before `</body>` in `index.html`:

```html
<script defer src="/_vercel/insights/script.js"></script>
```

Custom events (the service-card clicks) need
`window.va('event', { name, data })`, which `track()` already calls if
`window.va` exists.

### Plausible (better if you want the numbers without a Vercel account)

Paid (~$9/mo), privacy-friendly, no cookie banner needed. Add to `<head>`:

```html
<script defer data-domain="akashpanwar.dev" src="https://plausible.io/js/script.tagged-events.js"></script>
```

`track()` calls `window.plausible(name, { props })` when present.

Either way, the events worth watching are `service-cta` (which offer people
click) and `contact-submit` (whether they convert). If `service-cta` fires
often on the MVP card but `contact-submit` stays flat, the price is doing
the filtering — which is the point, but worth knowing.

---

## 4. Before launch — content that's still missing

- **Case-study metrics.** All five projects have `TODO` placeholders in
  `data.js → metrics`. They're hidden from visitors and logged to the
  console. Get real figures from each client (conversion %, load time,
  orders/month, hours saved) — this is the single highest-value content
  change left, because it's the only hard evidence on the page.
- **Availability month.** `data.js → availability.month` says
  `September`. Keep it current; a stale month reads worse than no
  availability line at all.
- **OG image.** `assets/og-image.png` is generated and committed. If the
  headline copy in the hero changes, regenerate it to match — a preview
  card that disagrees with the page is a small but real credibility leak.
