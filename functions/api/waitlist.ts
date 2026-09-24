// /api/waitlist — Cloudflare Pages Function.
//
// Captures pre-launch waitlist emails while every "Add to Slack" CTA on the
// site is disabled. Two side-effects per accepted submission:
//   1. PutItem into DynamoDB `echo-synch-waitlist` (source of truth).
//   2. Notify philip@thread-patrol.com via Resend so signups land in the
//      inbox in real time.
//
// Env vars (Cloudflare Pages → Settings → Environment variables):
//   AWS_ACCESS_KEY_ID       — IAM user with dynamodb:PutItem on the table
//   AWS_SECRET_ACCESS_KEY   — (paired)
//   AWS_REGION              — default eu-west-1
//   WAITLIST_TABLE          — default "echo-synch-waitlist"
//   RESEND_API_KEY          — full-access Resend key
//   WAITLIST_NOTIFY_TO      — default "philip@thread-patrol.com"
//   WAITLIST_NOTIFY_FROM    — default "Echo-Synch Waitlist <support@echo-synch.com>"

interface Env {
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  WAITLIST_TABLE?: string;
  RESEND_API_KEY?: string;
  WAITLIST_NOTIFY_TO?: string;
  WAITLIST_NOTIFY_FROM?: string;
}

interface Body { email?: string; source?: string; }

const DEFAULT_REGION = 'eu-west-1';
const DEFAULT_TABLE = 'echo-synch-waitlist';
const DEFAULT_NOTIFY_TO = 'philip@thread-patrol.com';
const DEFAULT_NOTIFY_FROM = 'Echo-Synch Waitlist <support@echo-synch.com>';

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SOURCE_RE = /^[a-zA-Z0-9_-]{1,32}$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Body;
  try { body = (await request.json()) as Body; }
  catch { return json({ error: 'invalid_json' }, 400); }

  const email = (body.email ?? '').trim().toLowerCase();
  const rawSource = (body.source ?? 'unknown').trim();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'invalid_email' }, 400);
  }
  const source = SOURCE_RE.test(rawSource) ? rawSource : 'unknown';

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ua = (request.headers.get('User-Agent') ?? '').slice(0, 200);
  const createdAt = new Date().toISOString();

  // DynamoDB PutItem via SigV4. Source of truth — if this fails we return
  // 500 so the user is prompted to retry (better than silently losing the
  // email).
  let ddbOk = false;
  let ddbErr = '';
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    try {
      const region = env.AWS_REGION || DEFAULT_REGION;
      const table = env.WAITLIST_TABLE || DEFAULT_TABLE;
      const res = await dynamoPutItem({
        region,
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        payload: {
          TableName: table,
          Item: {
            email: { S: email },
            createdAt: { S: createdAt },
            source: { S: source },
            ip: { S: ip },
            ua: { S: ua },
          },
        },
      });
      ddbOk = res.ok;
      if (!ddbOk) {
        ddbErr = await res.text().catch(() => '');
        console.error(`[WAITLIST] DDB put failed status=${res.status} body=${ddbErr}`);
      }
    } catch (err) {
      ddbErr = String(err);
      console.error('[WAITLIST] DDB put threw', err);
    }
  } else {
    console.error('[WAITLIST] AWS credentials missing in env');
    return json({ error: 'config_error' }, 500);
  }

  if (!ddbOk) return json({ error: 'store_failed' }, 500);

  // Notification email — best-effort. The signup is already stored; a
  // Resend failure shouldn't fail the user's submission.
  if (env.RESEND_API_KEY) {
    const notifyTo = env.WAITLIST_NOTIFY_TO || DEFAULT_NOTIFY_TO;
    const notifyFrom = env.WAITLIST_NOTIFY_FROM || DEFAULT_NOTIFY_FROM;
    try {
      const text =
        `New Echo-Synch waitlist signup\n\n`
        + `Email:   ${email}\n`
        + `Source:  ${source}\n`
        + `Time:    ${createdAt}\n`
        + `IP:      ${ip}\n`
        + `UA:      ${ua}\n`;
      const html = text.replace(/\n/g, '<br>');
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: notifyFrom,
          to: [notifyTo],
          subject: `[Echo-Synch waitlist] ${email} — via ${source}`,
          text, html,
          reply_to: email,
        }),
      });
      if (!r.ok) {
        console.error(`[WAITLIST] Resend failed status=${r.status} body=${await r.text().catch(() => '')}`);
      }
    } catch (err) {
      console.error('[WAITLIST] Resend threw', err);
    }
  } else {
    console.warn('[WAITLIST] RESEND_API_KEY missing — skipping notification email');
  }

  return json({ ok: true }, 200);
};

// Anything other than POST → 405.
export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method === 'POST') return json({ error: 'routing' }, 500);
  return json({ error: 'method_not_allowed' }, 405);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': 'https://echo-synch.com',
    },
  });
}

// ---------------------------------------------------------------------------
// AWS SigV4 signer — just enough for a single DynamoDB PutItem call.
// Cloudflare Workers ship crypto.subtle so we don't need any external SDK.
// ---------------------------------------------------------------------------

interface SignArgs {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  payload: unknown;
}

async function dynamoPutItem(a: SignArgs): Promise<Response> {
  const service = 'dynamodb';
  const host = `dynamodb.${a.region}.amazonaws.com`;
  const url = `https://${host}/`;
  const body = JSON.stringify(a.payload);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);

  const canonicalHeaders =
      `content-type:application/x-amz-json-1.0\n`
    + `host:${host}\n`
    + `x-amz-date:${amzDate}\n`
    + `x-amz-target:DynamoDB_20120810.PutItem\n`;
  const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';

  const canonicalRequest =
      `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${a.region}/${service}/aws4_request`;
  const stringToSign =
      `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const kDate = await hmac(`AWS4${a.secretAccessKey}`, dateStamp);
  const kRegion = await hmac(kDate, a.region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = toHex(await hmac(kSigning, stringToSign));

  const authorization =
      `AWS4-HMAC-SHA256 Credential=${a.accessKeyId}/${credentialScope}, `
    + `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Date': amzDate,
      'X-Amz-Target': 'DynamoDB_20120810.PutItem',
      'Authorization': authorization,
    },
    body,
  });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return toHex(new Uint8Array(buf));
}

async function hmac(key: string | Uint8Array, msg: string): Promise<Uint8Array> {
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(msg));
  return new Uint8Array(sig);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
