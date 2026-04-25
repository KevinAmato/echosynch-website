// Astro config for echo-synch.com
//
// Mirrors Thread-Patrol's setup: file-format output, no trailing slash, sitemap
// scoped to the future blog so generated/legacy pages don't double-list.
//
// Hosting target: Cloudflare Pages (matches the existing Cloudflare DNS for
// api.echo-synch.com and the email routing already in place). The build
// output is plain static HTML+CSS+JS — no SSR, no edge functions needed.

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://echo-synch.com',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      filter: (page) => page.includes('/blog/'),
    }),
  ],
  build: {
    // Emit .html files at the route paths (e.g. /privacy.html) rather than
    // /privacy/index.html. Matches Thread-Patrol's URL shape and keeps the
    // _redirects file simple.
    format: 'file',
  },
});
