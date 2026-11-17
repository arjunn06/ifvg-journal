// Blue Pill purchase events -> membership changes. Pure: no Deno or Supabase calls, so it runs under Node's
// test runner as well (bluepill.test.ts). The edge function (bluepill-webhook) does the I/O.
//
// Two shapes of request are understood, both signed the way Razorpay signs webhooks (HMAC-SHA256 of the raw
// body, hex, header X-Razorpay-Signature, key = BLUEPILL_WEBHOOK_SECRET):
//
//   1. A Razorpay subscription webhook, pointed straight at the function from the Razorpay dashboard.
//   2. A plain call from the course site's server, or from you with curl:
//        { "email": "a@b.com", "action": "grant", "active_until": "2026-12-17T00:00:00Z" | null,
//          "reference": "sub_...", "event_at": "2026-11-17T10:00:00Z" }
//        { "email": "a@b.com", "action": "revoke" }          // refund, chargeback, ended by hand
//
// See docs/bluepill-webhook.md.

/** Days of access past the paid-through date, so a debit that lands a day late does not lock a member out. */
export const GRACE_DAYS = 2;
const DAY_MS = 86_400_000;

export interface Change {
  /** Lower-cased. Null when the event carries none; the reference then finds the member. */
  email: string | null;
  /** Razorpay subscription id. */
  reference: string | null;
  /** When access ends. Null = no end date. A revoke carries the moment it happened. */
  activeUntil: Date | null;
  /** When it happened at the source; an older event never overwrites a newer one. */
  eventAt: Date;
  event: string;
  source: 'razorpay' | 'api';
}

export type Parsed =
  | { kind: 'change'; change: Change }
  /** Valid and signed, but nothing to do (another product, an event we do not act on). Answer 200. */
  | { kind: 'ignored'; reason: string }
  /** Cannot be understood. Answer 400. */
  | { kind: 'invalid'; reason: string };

// --- Signature ---------------------------------------------------------------------------------------------

const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const hmacKey = (secret: string, usage: KeyUsage) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);

/** Hex HMAC-SHA256 of `body`: what Razorpay sends, and what a caller of the plain shape must send. */
export async function sign(secret: string, body: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time check (WebCrypto verify) of the signature header against the raw body. */
export async function verifySignature(secret: string, body: string, signature: string | null): Promise<boolean> {
  if (!secret || !signature) return false;
  const bytes = hexToBytes(signature.trim());
  if (!bytes) return false;
  return crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), bytes, enc.encode(body));
}

// --- Parsing -----------------------------------------------------------------------------------------------

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** Lower-cased address, or null when it does not look like one. */
export function cleanEmail(v: unknown): string | null {
  const s = str(v)?.toLowerCase() ?? null;
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

export interface ParseOptions {
  /** Razorpay plan ids that mean "Blue Pill". Events for any other plan are ignored. */
  planIds: string[];
  /** Used when an event has no time of its own. */
  now?: Date;
}

export function parseWebhook(body: unknown, opts: ParseOptions): Parsed {
  if (!isObj(body)) return { kind: 'invalid', reason: 'Body must be a JSON object' };
  if (typeof body.event === 'string' && isObj(body.payload)) return parseRazorpay(body, opts);
  if ('email' in body || 'action' in body) return parseApi(body, opts.now ?? new Date());
  return { kind: 'invalid', reason: 'Not a Razorpay event and not an { email, action } call' };
}

/** Most calls one request may carry. */
export const MAX_BATCH = 500;

/**
 * A batch is a JSON array of plain { email, action } calls, so the course site's hourly catch-up is one request
 * instead of hundreds. Each item stands alone: a bad one is reported, the rest still apply.
 */
export function parseBatch(items: unknown[], opts: ParseOptions): Parsed[] {
  return items.map((item): Parsed =>
    isObj(item) && typeof item.event === 'string'
      ? { kind: 'invalid', reason: 'A batch holds { email, action } calls, not Razorpay events' }
      : parseWebhook(item, opts),
  );
}

// Razorpay subscription events, by what they mean for access. Everything else (authenticated, pending, updated,
// payment.*, invoice.*) changes nothing: a failed charge is retried by Razorpay and ends in `halted` if it never
// succeeds, and access already runs to the paid-through date plus the grace.
const GRANTS = new Set(['subscription.activated', 'subscription.charged', 'subscription.resumed']);
/** Ends where the paid period ends: they paid for it. */
const ENDS_AT_PERIOD_END = new Set(['subscription.cancelled', 'subscription.completed']);
/** Ends now: payment never recovered, or the subscription was paused. */
const ENDS_NOW = new Set(['subscription.halted', 'subscription.paused']);

function parseRazorpay(body: Json, opts: ParseOptions): Parsed {
  const event = body.event as string;
  const kind = GRANTS.has(event) ? 'grant' : ENDS_AT_PERIOD_END.has(event) ? 'period' : ENDS_NOW.has(event) ? 'now' : null;
  if (!kind) return { kind: 'ignored', reason: `${event} does not change access` };

  const payload = body.payload as Json;
  const sub = isObj(payload.subscription) && isObj(payload.subscription.entity) ? payload.subscription.entity : null;
  if (!sub) return { kind: 'invalid', reason: `${event} has no subscription` };

  // Fail loudly rather than open: with no plan list, every product sold on this Razorpay account would qualify.
  if (opts.planIds.length === 0) return { kind: 'invalid', reason: 'BLUEPILL_PLAN_IDS is not set' };
  const plan = str(sub.plan_id);
  if (!plan || !opts.planIds.includes(plan)) return { kind: 'ignored', reason: `plan ${plan ?? '(none)'} is not the Blue Pill` };

  const created = typeof body.created_at === 'number' ? body.created_at : null;
  const eventAt = created ? new Date(created * 1000) : opts.now ?? new Date();

  // notes is an object when set and an empty array when not.
  const notes = isObj(sub.notes) ? sub.notes : {};
  const payment = isObj(payload.payment) && isObj(payload.payment.entity) ? payload.payment.entity : null;
  const email = cleanEmail(notes.email) ?? cleanEmail(payment?.email);
  const reference = str(sub.id);
  if (!email && !reference) return { kind: 'invalid', reason: `${event} has neither an email nor a subscription id` };

  const currentEnd = typeof sub.current_end === 'number' ? new Date(sub.current_end * 1000) : null;
  let activeUntil: Date;
  if (kind === 'now') {
    activeUntil = eventAt;
  } else if (!currentEnd) {
    return { kind: 'invalid', reason: `${event} has no current_end` };
  } else if (kind === 'grant') {
    activeUntil = new Date(currentEnd.getTime() + GRACE_DAYS * DAY_MS);
  } else {
    activeUntil = currentEnd > eventAt ? currentEnd : eventAt;
  }

  return { kind: 'change', change: { email, reference, activeUntil, eventAt, event, source: 'razorpay' } };
}

function parseApi(body: Json, now: Date): Parsed {
  const email = cleanEmail(body.email);
  if (!email) return { kind: 'invalid', reason: 'email is missing or not an email address' };

  const action = body.action;
  if (action !== 'grant' && action !== 'revoke') return { kind: 'invalid', reason: 'action must be "grant" or "revoke"' };

  let eventAt = now;
  if (body.event_at !== undefined) {
    const t = typeof body.event_at === 'string' ? new Date(body.event_at) : null;
    if (!t || Number.isNaN(t.getTime())) return { kind: 'invalid', reason: 'event_at must be an ISO date' };
    eventAt = t;
  }

  let activeUntil: Date | null;
  if (action === 'revoke') {
    activeUntil = eventAt;
  } else if (!('active_until' in body)) {
    // Required, so a caller that forgets it cannot hand out access with no end by accident. null says "no end" on purpose.
    return { kind: 'invalid', reason: 'grant needs active_until (an ISO date, or null for no end date)' };
  } else if (body.active_until === null) {
    activeUntil = null;
  } else {
    const t = typeof body.active_until === 'string' ? new Date(body.active_until) : null;
    if (!t || Number.isNaN(t.getTime())) return { kind: 'invalid', reason: 'active_until must be an ISO date or null' };
    activeUntil = t;
  }

  return {
    kind: 'change',
    change: { email, reference: str(body.reference), activeUntil, eventAt, event: action, source: 'api' },
  };
}
