// Astro config for echo-synch.com
//
// Hosting target: Cloudflare Pages (matches the existing Cloudflare DNS
// for api.echo-synch.com and the email routing already in place). The
// build output is plain static HTML+CSS+JS — no SSR, no edge functions
// needed for the marketing surface (the /api/waitlist Pages Function is
// the one exception, see functions/api/waitlist.ts).

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://echo-synch.com',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      // Sitemap covers ALL public pages — landing, legal corpus, support,
      // docs, changelog. Future blog posts auto-include because they
      // live under /blog/*.
      //
      // Excluded:
      //   - 404 page (Google penalises sitemap entries that 404)
      //   - /trial-expired (dashboard-only redirect target, not a public
      //     destination — and including it could cause crawlers to
      //     repeatedly hit that URL trying to "verify" it)
      filter: (page) =>
        !page.includes('/404') &&
        !page.includes('/trial-expired') &&
        // The marketing-assets/slack-listing/ folder is for our own
        // submission tooling — not for search-engine indexing.
        !page.includes('/marketing-assets/'),
      changefreq: 'weekly',
      priority: 0.7,
      // Bump priority on the homepage; demote the legal pages.
      serialize: (item) => {
        if (item.url === 'https://echo-synch.com/') {
          item.priority = 1.0;
          item.changefreq = 'daily';
        } else if (
          item.url.endsWith('/privacy') ||
          item.url.endsWith('/terms') ||
          item.url.endsWith('/dpa')
        ) {
          item.priority = 0.3;
          item.changefreq = 'monthly';
        }
        return item;
      },
    }),
  ],
  build: {
    // Emit .html files at the route paths (e.g. /privacy.html) rather
    // than /privacy/index.html. Matches Thread-Patrol's URL shape and
    // keeps the _redirects file simple.
    format: 'file',
  },
});
