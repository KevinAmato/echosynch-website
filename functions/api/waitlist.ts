// /api/waitlist — Cloudflare Pages Function.
//
// Handles waitlist signups while we wait for Slack Directory approval.
// Two side-effects per accepted submission:
//   1. Add the email to the Resend audience "echo-synch-waitlist" so we
//      can send a single launch announcement to everyone with one click.
//   2. Notify support@echo-synch.com by email so we see signups land in
//      real time without having to log into Resend.
//
// Why a Pages Function instead of a third-party form vendor:
//   - Resend is already in our DPA (transactional email) — adding a new
//     vendor (Formspree, ConvertKit, Mailchimp) would require a privacy/
//     DPA update and add a third party to the data flow.
//   - The Resend API key must stay server-side; an inline <script> can't
//     hold it. Pages Functions run on Cloudflare's edge with the same
//     latency profile as the rest of the site.
//
// Environment variables (configured per the README — set in Cloudflare
// Pages → Settings → Environment variables):
//   RESEND_API_KEY            — full-access Resend API key
//   RESEND_AUDIENCE_ID        — the audience UUID (Resend dashboard → Audiences)
//   WAITLIST_NOTIFY_TO        — where signup notifications land (default support@echo-synch.com)
//   WAITLIST_NOTIFY_FROM      — verified sender domain on Resend (default support@echo-synch.com)
//
// Errors are deliberately vague to the client: the form just shows a
// generic "try again later" message. Detailed errors land in Cloudflare's
// function logs for our debugging only.

interface Env {
  RESEND_API_KEY?: string;
  RESEND_AUDIENCE_ID?: string;
  WAITLIST_NOTIFY_TO?: string;
  WAITLIST_NOTIFY_FROM?: string;
}

interface WaitlistBody {
  email?: string;
  source?: string;
}

const DEFAULT_NOTIFY_TO = 'support@echo-synch.com';
const DEFAULT_NOTIFY_FROM = 'Echo-Synch Waitlist <support@echo-synch.com>';

// RFC 5322-ish — strict enough to catch typos, lenient enough not to
// reject legitimate-but-unusual addresses (Gmail aliases with `+`, etc.).
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Source is sent by the modal as the data-waitlist attribute value. We
// allow letters/numbers/hyphens/underscores so we can later see which CTA
// converted (hero / pricing-pro / nav / etc.) without it becoming an
// arbitrary string injection vector.
const SOURCE_RE = /^[a-zA-Z0-9_-]{1,32}$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // ----- Body parsing + validation -------------------------------------

  let body: WaitlistBody;
  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const source = (body.source ?? 'unknown').trim();

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'invalid_email' }, 400);
  }
  // Reject sources with weird chars but don't fail the request — fall back
  // to "unknown" so a typo in our own data-waitlist attribute can't break
  // a legitimate signup.
  const safeSource = SOURCE_RE.test(source) ? source : 'unknown';

  if (!env.RESEND_API_KEY) {
    console.error('[WAITLIST] RESEND_API_KEY missing in env');
    return json({ error: 'config_error' }, 500);
  }

  // ----- Add to Resend audience ----------------------------------------

  // We try the audience add first because that's the durable record. If
  // it fails, we still attempt the notification email below — better to
  // get the email in our inbox even if the audience-add bombed.
  let audienceOk = false;
  if (env.RESEND_AUDIENCE_ID) {
    try {
      const audienceRes = await fetch(
        `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            // Resend de-duplicates by email per audience, so re-submits
            // are no-ops. unsubscribed=false explicit so a previously
            // unsubscribed contact gets re-subscribed (rare, but tidy).
            unsubscribed: false,
          }),
        }
      );
      audienceOk = audienceRes.ok;
      if (!audienceOk) {
        const text = await audienceRes.text().catch(() => '');
        console.error(`[WAITLIST] audience add failed status=${audienceRes.status} body=${text}`);
      }
    } catch (err) {
      console.error('[WAITLIST] audience add threw', err);
    }
  } else {
    console.warn('[WAITLIST] RESEND_AUDIENCE_ID missing — skipping audience add');
  }

  // ----- Notification email --------------------------------------------

  const notifyTo = env.WAITLIST_NOTIFY_TO || DEFAULT_NOTIFY_TO;
  const notifyFrom = env.WAITLIST_NOTIFY_FROM || DEFAULT_NOTIFY_FROM;

  // Best-effort. We don't fail the user's submission if our notification
  // email bombs — they got onto the audience (the source of truth).
  try {
    const subject = `[Waitlist] ${email} — via ${safeSource}`;
    const text =
      `New Echo-Synch waitlist signup\n\n`
      + `Email:   ${email}\n`
      + `Source:  ${safeSource}\n`
      + `Time:    ${new Date().toISOString()}\n`
      + `IP:      ${request.headers.get('CF-Connecting-IP') ?? 'unknown'}\n`
      + `UA:      ${(request.headers.get('User-Agent') ?? '').slice(0, 200)}\n\n`
      + `Audience added: ${audienceOk ? 'yes' : 'NO — investigate'}\n`;
    const html = text
      .replace(/\n/g, '<br>')
      .replace(/(\bhttps?:\/\/\S+)/g, '<a href="$1">$1</a>');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: notifyFrom,
        to: [notifyTo],
        subject,
        text,
        html,
        // Reply-to set to the prospect's address so a one-click reply
        // from the inbox lands directly in their email rather than in
        // our own support inbox.
        reply_to: email,
      }),
    });
    if (!emailRes.ok) {
      const text = await emailRes.text().catch(() => '');
      console.error(`[WAITLIST] notification email failed status=${emailRes.status} body=${text}`);
    }
  } catch (err) {
    console.error('[WAITLIST] notification email threw', err);
  }

  // ----- Response -------------------------------------------------------

  // We return 200 even if both side-effects failed — the user's intent
  // is captured in our function logs (Cloudflare retains 7 days). If
  // someone deliberately signs up multiple times, Resend de-dupes — so
  // double-submits from the modal aren't user-visible problems.
  return json({ ok: true }, 200);
};

// Reject other methods explicitly so the route doesn't accidentally
// expose anything via GET / OPTIONS.
export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method === 'POST') {
    // onRequestPost above has already handled this — defensive no-op
    return json({ error: 'method_routing' }, 500);
  }
  return json({ error: 'method_not_allowed' }, 405);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      // Same-origin only — the modal lives on the same domain so we
      // don't need permissive CORS. Explicit deny prevents some
      // accidental cross-site abuse.
      'Access-Control-Allow-Origin': 'https://echo-synch.com',
    },
  });
}
