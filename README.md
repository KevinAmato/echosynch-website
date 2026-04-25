# echo-synch-pages

Marketing website for [Echo-Synch](https://echo-synch.com) — a Slack-native
IT request triage bot.

Companion repos:
- **Bot + dashboard** — `../../Echo-Synch/` (the actual product)
- **Sibling marketing sites** — `../thread-patrol-pages` (Thread-Patrol),
  `../sync-o-pages` (Sync-o)

## Stack

- **[Astro 6](https://astro.build/)** — static site generator
- Plain CSS (no Tailwind, no PostCSS pre-processor) — design tokens lifted
  from `../../Echo-Synch/Design/Design Guidance/colors_and_type.css`
- Vanilla JS for the hero animation choreography (no Framer / GSAP)

## Local dev

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # outputs to dist/
pnpm preview  # serve the built dist/
```

## Deployment

Target: **Cloudflare Pages** (matches `api.echo-synch.com` already on Cloudflare).

1. Connect this repo to a new Cloudflare Pages project
2. Build command: `pnpm build`
3. Build output directory: `dist`
4. Custom domain: `echo-synch.com` (apex) + `www.echo-synch.com` redirect
5. The `public/_redirects` file handles the .html → clean-URL rewrites

### Environment variables (Cloudflare Pages → Settings → Environment variables)

The site is fully static **except** for the `/api/waitlist` Pages Function
which collects emails while we wait for Slack Directory approval. It needs:

| Variable | Required | Default | What it's for |
|---|---|---|---|
| `RESEND_API_KEY` | yes | — | Full-access Resend API key (separate from the SMTP key) |
| `RESEND_AUDIENCE_ID` | yes | — | UUID of a Resend audience named "echo-synch-waitlist" — create in Resend dashboard → Audiences |
| `WAITLIST_NOTIFY_TO` | no | `support@echo-synch.com` | Where signup notifications land |
| `WAITLIST_NOTIFY_FROM` | no | `Echo-Synch Waitlist <support@echo-synch.com>` | From address — must be on a Resend-verified domain |

**One-time Resend setup:**
1. Resend dashboard → **Audiences** → **Add audience** → name `echo-synch-waitlist`
2. Copy the audience UUID — paste as `RESEND_AUDIENCE_ID`
3. Resend dashboard → **API Keys** → create a "Full access" key (the SMTP-only key won't work for the audiences API) — paste as `RESEND_API_KEY`
4. Set both in Cloudflare Pages → Production scope, then redeploy

When Slack Directory approval lands, replace each `data-waitlist` button
attribute across the site with `href="https://api.echo-synch.com/slack/install"`
and remove the "Coming soon" pills. The Pages Function can stay — it's
useful for any future "notify me" flows (new tier launches, etc.).

## Page map

| Route             | Status        | Notes |
|-------------------|---------------|-------|
| `/`               | ✅ Built      | Landing page with signature animation |
| `/privacy`        | 🚧 Stub       | Adapt from `../thread-patrol-pages/privacy.html` |
| `/terms`          | 🚧 Stub       | Adapt from `../thread-patrol-pages/terms.html` |
| `/dpa`            | 🚧 Stub       | Adapt from `../thread-patrol-pages/dpa.html` |
| `/trust-center`   | 🚧 Stub       | Adapt from `../thread-patrol-pages/trust-center.html` |
| `/support`        | 🚧 Stub       | Adapt from `../thread-patrol-pages/support.html` |
| `/changelog`      | 🚧 Stub       | Populates as we ship |
| `/docs`           | 🚧 Placeholder | Real docs after public GA |
| `/404`            | ✅ Built      | Fallback |

## Design system

Source of truth: `../../Echo-Synch/Design/Design Guidance/`

Strict rules ([`SKILL.md`](../../Echo-Synch/Design/Design Guidance/SKILL.md)):
- One brand colour: Echo Indigo `#4F46E5`
- One gradient (the indigo radial glow); no others
- Light mode only; one optional dark slate-900 section per page
- No 3D, no illustrations, no stock photos
- Inter (UI/headings) + JetBrains Mono (code/eyebrows/Slack mocks)
- "Frictionless · Technical · Quiet" — no hype words, no emoji in chrome

When in doubt, look at the dashboard at `../../Echo-Synch/packages/dashboard/`
or the canonical UI kit at `../../Echo-Synch/Design/Design Guidance/ui_kits/marketing/`.
