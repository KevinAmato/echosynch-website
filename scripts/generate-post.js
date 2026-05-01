#!/usr/bin/env node
/**
 * Echo-Synch Blog Post Generator
 * --------------------------------
 * Usage:
 *   node scripts/generate-post.js                  # picks next keyword from queue
 *   node scripts/generate-post.js "custom keyword" # generate for a specific keyword
 *
 * Requires: ANTHROPIC_API_KEY env var
 *
 * Auto-merge mode (option B from product spec): once the script
 * succeeds the workflow commits directly to main and runs wrangler
 * pages deploy. There is no PR step. Quality gates below are *blocking*
 * — if any fails, we regenerate up to 2 more times. After 3 attempts
 * we exit non-zero and the workflow fails (the keyword stays unused
 * in the queue and tries again next run).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONTENT_DIR = path.join(__dirname, '../src/content/blog');
const QUEUE_FILE  = path.join(__dirname, '../src/data/keyword-queue.json');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';
const MAX_ATTEMPTS = 3;

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function levenshteinSimilarity(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

function getExistingPostTitles() {
  const titles = [];
  if (!fs.existsSync(CONTENT_DIR)) return titles;
  fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .forEach(f => {
      const content = fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8');
      const titleMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (titleMatch) titles.push({ title: titleMatch[1], slug: f.replace('.md', '') });
    });
  return titles;
}

function checkDuplicate(keyword, existingPosts) {
  const keywordSlug = slugify(keyword);
  for (const post of existingPosts) {
    const sim = levenshteinSimilarity(keywordSlug, post.slug);
    if (sim > 0.7) return { isDuplicate: true, matchedPost: post.title, similarity: sim };
  }
  return { isDuplicate: false };
}

function callAnthropicAPI(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.content[0].text);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Quality gates (BLOCKING in auto-merge mode) ──────────────────────────────
//
// Each gate returns { ok: boolean, reason?: string }. Composed by
// runQualityGates() which returns an array of failures (empty = pass).

const BANNED_PHRASES = [
  /in today'?s fast[- ]paced/i,
  /let'?s dive in/i,
  /it'?s important to note/i,
  /at the end of the day/i,
  /the bottom line/i,
  /needless to say/i,
  /by the end of this (post|article)/i,
  /^In conclusion[,:]/im,
  /^However,/m,
  /as we mentioned/i,
  /in this article we'?ll explore/i,
  /remember that/i,
];

const REQUIRED_FRONTMATTER_FIELDS = ['title', 'description', 'pubDate', 'category', 'tags', 'author'];

function runQualityGates(output, generatedTitle, existingPosts) {
  const failures = [];

  // Front-matter parsing
  const frontmatterMatch = output.match(/^---\n([\s\S]+?)\n---/);
  if (!frontmatterMatch) {
    failures.push('No front-matter block found at the top of the output.');
    return failures;  // can't validate further without frontmatter
  }
  const frontmatter = frontmatterMatch[1];
  const body = output.slice(frontmatterMatch[0].length).trim();

  // Required field check
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!new RegExp(`^${field}\\s*:`, 'm').test(frontmatter)) {
      failures.push(`Front-matter missing required field: ${field}`);
    }
  }

  // Word count gate (1400-2200 — we set the prompt to 1400-1800 but
  // allow some slack so a slightly long article isn't rejected).
  const wordCount = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`]/g, '')
    .split(/\s+/)
    .filter(Boolean).length;
  if (wordCount < 1400) failures.push(`Word count ${wordCount} below 1400 minimum.`);
  if (wordCount > 2200) failures.push(`Word count ${wordCount} above 2200 maximum.`);

  // H2 section count gate (must have at least 6)
  const h2Count = (body.match(/^##\s+/gm) || []).length;
  if (h2Count < 6) failures.push(`Only ${h2Count} H2 sections (need ≥ 6).`);

  // Required artifact: at least one fenced code block
  const codeBlockCount = (body.match(/```[\s\S]+?```/g) || []).length;
  if (codeBlockCount < 1) failures.push('No fenced code block (the required copy-paste artifact is missing).');

  // Em-dash cap (≤ 3 across the article)
  const emDashCount = (output.match(/—/g) || []).length;
  if (emDashCount > 3) failures.push(`Em-dash count ${emDashCount} exceeds cap of 3.`);

  // Banned phrases
  for (const re of BANNED_PHRASES) {
    if (re.test(output)) failures.push(`Banned phrase matched: ${re.source}`);
  }

  // Duplicate-title check (Levenshtein > 0.8 vs any existing title)
  for (const post of existingPosts) {
    const sim = levenshteinSimilarity(generatedTitle, post.title);
    if (sim > 0.8) {
      failures.push(`Title "${generatedTitle}" is ${Math.round(sim * 100)}% similar to existing post "${post.title}".`);
    }
  }

  return failures;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(keywordEntry, existingPosts, today) {
  const existingPostsList = existingPosts
    .map((p, i) => `${i + 1}. [${p.title}](/blog/${p.slug})`)
    .join('\n') || '_No existing posts yet — internal links not required for this article._';

  return `You are a senior content writer for Echo-Synch, a Slack bot that automatically triages, labels, and routes IT requests with SLA tracking. Echo-Synch's target customers are IT managers, helpdesk leads, and internal-tools admins at companies (50–2,000 employees) drowning in #it-help tickets.

BRAND VOICE: Practical, ops-savvy, no fluff. Write like an IT lead who has watched ticket queues burn down at scale. Specific over abstract. Concrete over corporate. Write the thing you wish someone had written before you spent a weekend solving this problem the hard way.

TASK: Write a complete blog post for the target keyword below.

TARGET KEYWORD: ${keywordEntry.keyword}
CATEGORY: ${keywordEntry.category}
DATE: ${today}

EXISTING POSTS — use this list for TWO purposes:
1. AVOID OVERLAP: Your article must cover a substantially different angle from these posts. If the keyword overlaps with an existing title, pivot to an uncovered sub-topic.
2. INTERNAL LINKS: Naturally link to 3-5 of these posts from within your article body wherever genuinely relevant. Use the exact markdown link format provided (e.g. [Post Title](/blog/post-slug)). Links must feel editorial and useful to the reader — never forced. Place them inline within sentences, not as a list at the end.

${existingPostsList}

OUTPUT FORMAT (return ONLY this, no preamble):
---
title: "Your SEO-optimised title here (50-65 chars)"
description: "Meta description here (150-160 chars, includes the keyword)"
pubDate: ${today}
category: ${keywordEntry.category}
tags: [tag1, tag2, tag3, tag4]
author: Echo-Synch Team
avoids_overlap_with:
  - "List the 2-3 existing post titles your article is most related to but distinct from"
---

[Full markdown article body here — 1400-1800 words]

ARTICLE STRUCTURE:
- Do NOT start with a # H1 title — the layout template renders the title automatically. Start the body directly with the first paragraph or an H2 section heading
- 6-8 H2 sections with descriptive, specific headings (NEVER use "Introduction", "Conclusion", "Overview", "Final Thoughts", or "What is X")
- 3-5 internal links to related existing posts (from the list above) placed naturally within prose, not in a list at the end
- 1-2 natural Echo-Synch mentions that are genuinely relevant — not forced
- End with a closing paragraph that adds a final insight or non-obvious observation. Do NOT recap what the article said. Do NOT label it "Summary" or "Conclusion". Do NOT include a CTA — the layout adds that automatically
- Write for IT and helpdesk managers, not beginners — assume the reader knows the basic terminology

REQUIRED ELEMENTS (each blog post MUST contain at least one of each):
- One copy-paste-ready artifact: a command, a JSON snippet, a regex, a checklist with concrete steps, a template message, or a config block. Format it in a fenced code block.
- One specific number or named feature in EVERY H2 section. Examples: a real product feature name, a real default value, a specific scope/permission, a measurable threshold. No generic "many companies" or "lots of teams".
- One concrete failure mode or war story per article. The kind of thing someone only knows after running into it in production.
- At least one paragraph using "we", "in our experience", "we've seen", or similar first-person plural — establishes that real humans/team have observed this.

QUALITY GATES — your draft fails if any of these appear:
- Phrases: "in today's fast-paced world", "let's dive in", "remember that", "it's important to note", "at the end of the day", "the bottom line", "needless to say", "as we mentioned", "in this article we'll explore", "by the end of this post"
- Patterns: a paragraph starting with "However,". A list of three bullets where each is exactly three words. Any H2 heading phrased as a question that the next paragraph answers in the first sentence (boring rhythm).
- Filler intros that explain what the article will cover instead of starting the actual content. The first paragraph must already be useful — drop the reader into the problem mid-sentence if it sharpens the lead.
- Em-dash overuse — modern LLMs default to ~1 per paragraph; cap at ~3 per article total. Use commas, periods, or parentheses instead.
- Generic closing lines like "now you have everything you need to..." — instead, end with an opinion, a non-obvious takeaway, or a sharp final observation.
- Symmetric structure (every H2 has 3 bullets, every section has the same length). Vary it. Some sections should be a single dense paragraph, others a list, others a code block + commentary.

VARIATION CHECKLIST — vary sentence length deliberately:
- Mix 4-word sentences with 30-word sentences. Predictable rhythm = AI tell.
- Some paragraphs should be one sentence. Others should be five.
- Don't begin three consecutive paragraphs with the same sentence structure.

OPTIONAL — STRONGLY ENCOURAGED IF NATURAL:
- A short FAQ block with 3-5 questions at the end (under an H2 like "Quick answers" or "What teams ask most"). Format: ### Question \\n Answer paragraph. This earns FAQPage rich-result eligibility in Google SERPs.
- A small comparison table when discussing 2+ tools, approaches, or scopes. Plain markdown tables work fine.

BANNED OPENING PATTERNS — do not start the article with any of these:
- "In today's [adjective] [noun]..."
- "[Topic] is [adjective]. [Restate]."
- "Have you ever..." / "Imagine..." / "Picture this..."
- "Slack has become..." / "Slack is one of..." (assume they know the platform)
- A definition of the keyword (boring; assume the reader googled the topic and wants the answer, not a vocabulary lesson)

GOOD OPENING PATTERNS:
- A specific failure mode from the wild: e.g. "Most workspaces accumulate dead channels the way old laptops accumulate desktop icons."
- A counter-intuitive claim that the article will support
- A specific scenario that sets up the problem: e.g. "It's Tuesday morning. The on-call engineer pings #alerts-production and gets nothing back."`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function generatePost(targetKeyword = null) {
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));

  let keywordEntry;
  if (targetKeyword) {
    keywordEntry = { keyword: targetKeyword, slug: slugify(targetKeyword), category: 'guides', used: false };
  } else {
    keywordEntry = queue.find(k => !k.used);
    if (!keywordEntry) {
      console.error('ERROR: All keywords in the queue have been used. Add more to src/data/keyword-queue.json');
      process.exit(1);
    }
  }

  console.log(`\n🎯 Target keyword: "${keywordEntry.keyword}" (category: ${keywordEntry.category})`);

  const existingPosts = getExistingPostTitles();
  console.log(`📚 Checking against ${existingPosts.length} existing posts...`);

  const dupCheck = checkDuplicate(keywordEntry.keyword, existingPosts);
  if (dupCheck.isDuplicate) {
    console.warn(`⚠️  Keyword is ${Math.round(dupCheck.similarity * 100)}% similar to existing post: "${dupCheck.matchedPost}"`);
    console.warn('   Passing to Claude to find a distinct angle — quality gates will catch dupes.');
  }

  const today = new Date().toISOString().split('T')[0];
  const prompt = buildPrompt(keywordEntry, existingPosts, today);

  // Auto-retry loop. We try MAX_ATTEMPTS times before giving up. Each
  // attempt is a fresh API call (Claude is non-deterministic enough
  // that a regenerate often fixes a borderline draft).
  let output = null;
  let generatedTitle = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`\n🤖 Attempt ${attempt}/${MAX_ATTEMPTS} — calling Claude API (${MODEL})...`);
    const startTime = Date.now();
    try {
      output = await callAnthropicAPI(prompt);
    } catch (err) {
      console.error(`ERROR (attempt ${attempt}): Claude API call failed:`, err.message);
      if (attempt === MAX_ATTEMPTS) process.exit(1);
      continue;
    }
    console.log(`   Generated in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // Extract title (used for dup check inside quality gates)
    const titleMatch = output.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (!titleMatch) {
      console.warn(`   Could not parse title — treating as quality-gate failure.`);
      if (attempt === MAX_ATTEMPTS) {
        console.error('ERROR: All attempts produced unparseable output.');
        process.exit(1);
      }
      continue;
    }
    generatedTitle = titleMatch[1].replace(/^["']|["']$/g, '');

    const failures = runQualityGates(output, generatedTitle, existingPosts);
    if (failures.length === 0) {
      console.log(`✅ Quality gates passed on attempt ${attempt}.`);
      break;
    }
    console.warn(`⚠️  Quality gates: ${failures.length} failure(s) on attempt ${attempt}:`);
    failures.forEach(f => console.warn(`     - ${f}`));
    if (attempt === MAX_ATTEMPTS) {
      console.error('ERROR: All 3 attempts failed quality gates. Aborting — keyword stays unused in the queue.');
      process.exit(1);
    }
    console.log('   Regenerating...');
  }

  // Write file
  const outputSlug = keywordEntry.slug || slugify(generatedTitle);
  const outputPath = path.join(CONTENT_DIR, `${outputSlug}.md`);
  if (fs.existsSync(outputPath)) {
    console.error(`ERROR: File already exists: ${outputPath}`);
    process.exit(1);
  }
  fs.writeFileSync(outputPath, output);
  console.log(`\n📝 Post written: src/content/blog/${outputSlug}.md`);
  console.log(`   Title: ${generatedTitle}`);

  // Mark keyword as used (only if we picked from the queue)
  if (!targetKeyword) {
    const updatedQueue = queue.map(k =>
      k.keyword === keywordEntry.keyword ? { ...k, used: true, usedDate: today } : k,
    );
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(updatedQueue, null, 2) + '\n');
    const remaining = updatedQueue.filter(k => !k.used).length;
    console.log(`   Keywords remaining in queue: ${remaining}`);
  }

  // Output the slug for the workflow's downstream steps to consume.
  // Written to GITHUB_OUTPUT when running in CI.
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `slug=${outputSlug}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `title=${generatedTitle}\n`);
  }

  console.log('\n✨ Done.');
}

generatePost(process.argv[2] || null).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
