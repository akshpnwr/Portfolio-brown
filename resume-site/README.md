# resume.akashpanwar.dev

A hiring-focused site served from the same repo and the same Vercel project as
`akashpanwar.dev`. The main domain stays the client-acquisition site; this
subdomain presents the resume. One deploy, no branch, no second repo.

## How the routing works

[`../vercel.json`](../vercel.json) maps the subdomain onto this directory using
**`routes`, not `rewrites`** — and that distinction is load-bearing.

Vercel gives the filesystem precedence over `rewrites`:

> "The `source` property should **NOT** be a file because precedence is given
> to the filesystem prior to rewrites being applied."
> — [Vercel docs](https://vercel.com/docs/project-configuration/vercel-json)

Because `index.html` and `robots.txt` exist at the repo root, a rewrite of `/`
or `/robots.txt` never fires. The first attempt used `rewrites` and the
subdomain silently served the **main** site — a 200 with the wrong content, not
an error. `routes` is evaluated before the filesystem check, so it wins.

Do not convert these rules back to `rewrites`.

Rule order matters:

1. Shared assets (`/assets/`, `/uploads/`, `/resume.pdf`, `/favicon.svg`) pass
   through to the repo root — they are shared with the main site, not
   duplicated here.
2. Bare `/` maps to `resume-site/index.html`.
3. Everything else gets the `resume-site/` prefix.

## Link paths inside index.html

- Files **in this directory** use relative paths (`./styles.css`). An absolute
  `/resume-site/styles.css` would hit rule 3 and be prefixed twice, producing
  `/resume-site/resume-site/styles.css` → 404.
- **Shared** files use absolute paths (`/resume.pdf`, `/assets/…`) so rule 1
  passes them through.

## SEO

The subdomain is `noindex` via both a meta tag and [robots.txt](robots.txt), and
its canonical points at `akashpanwar.dev`. The two hosts share most of their
content, so indexing both would split ranking signals. The main domain remains
fully indexable.

## Verifying after a deploy

```sh
curl -sI https://resume.akashpanwar.dev/                   # 200
curl -s  https://resume.akashpanwar.dev/ | grep -o '<title>[^<]*'   # resume title
curl -s  https://akashpanwar.dev/ | grep -o '<title>[^<]*'          # main title, unchanged
```

If the subdomain shows the main site's title, the routes are not matching —
check that `vercel.json` still uses `routes` and that the deploy included it.
