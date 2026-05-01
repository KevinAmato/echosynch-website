// Astro content-collection schema for the blog. Keep in sync with
// scripts/generate-post.js front-matter output and the [slug].astro
// route's expected fields.
//
// Categories tuned to Echo-Synch's IT-helpdesk audience (vs
// Thread-Patrol's Slack-admin categories). Adding a new category
// requires editing this file AND adding a chip to src/pages/blog.astro.
//
// `image` defaults to /og-image.png (the same OG image the homepage
// uses) so a freshly-generated post without a per-post image still
// gets a passable social card.

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum([
      'ai-triage',
      'sla',
      'automation',
      'metrics',
      'comparison',
      'integrations',
      'best-practices',
      'guides',
    ]),
    tags: z.array(z.string()).default([]),
    image: z.string().default('/og-image.png'),
    author: z.string().default('Echo-Synch Team'),
    avoids_overlap_with: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
