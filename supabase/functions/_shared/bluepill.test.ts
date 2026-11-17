// Run: node --test supabase/functions/_shared/bluepill.test.ts   (Node 22.18+; or `deno test`)
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRACE_DAYS, MAX_BATCH, cleanEmail, parseBatch, parseWebhook, sign, verifySignature, type Change, type Parsed } from './bluepill.ts';

const PLAN = 'plan_BLUEPILL';
const OPTS = { planIds: [PLAN], now: new Date('2026-11-17T10:00:00Z') };
const DAY = 86_400_000;

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const change = (p: Parsed): Change => {
  assert.equal(p.kind, 'change', JSON.stringify(p));
  return (p as { kind: 'change'; change: Change }).change;
};

/** A Razorpay subscription event shaped like the ones in their docs. */
function razorpay(event: string, o: { plan?: string; notes?: unknown; payment?: Record<string, unknown> | null; currentEnd?: string | null; createdAt?: string } = {}) {
  const sub: Record<string, unknown> = {
    id: 'sub_123',
    plan_id: o.plan ?? PLAN,
    status: 'active',
    notes: o.notes ?? [],
  };
  if (o.currentEnd !== null) sub.current_end = unix(o.currentEnd ?? '2026-12-17T00:00:00Z');
  const payload: Record<string, unknown> = { subscription: { entity: sub } };
  if (o.payment) payload.payment = { entity: o.payment };
  return { entity: 'event', event, contains: Object.keys(payload), payload, created_at: unix(o.createdAt ?? '2026-11-17T09:00:00Z') };
}

// --- signature ---------------------------------------------------------------------------------------------

test('a signature made with the secret verifies', async () => {
  const body = '{"a":1}';
  assert.equal(await verifySignature('s3cret', body, await sign('s3cret', body)), true);
});

test('matches openssl (what the docs tell people to use with curl)', async () => {
  // printf '%s' '{"a":1}' | openssl dgst -sha256 -hmac s3cret
  assert.equal(await sign('s3cret', '{"a":1}'), '5910e62016ef5034272c926c27071992a465c2335cecf41851bda071577f4f6d');
});

test('a changed body, the wrong secret or a missing or garbled signature are all refused', async () => {
  const sig = await sign('s3cret', '{"a":1}');
  assert.equal(await verifySignature('s3cret', '{"a":2}', sig), false);
  assert.equal(await verifySignature('other', '{"a":1}', sig), false);
  assert.equal(await verifySignature('s3cret', '{"a":1}', null), false);
  assert.equal(await verifySignature('s3cret', '{"a":1}', ''), false);
  assert.equal(await verifySignature('s3cret', '{"a":1}', 'zz'), false);
  assert.equal(await verifySignature('s3cret', '{"a":1}', sig.slice(0, -2)), false);
  assert.equal(await verifySignature('s3cret', '{"a":1}', sig + '00'), false);
  assert.equal(await verifySignature('', '{"a":1}', sig), false);
});

test('the signature is case-insensitive hex with stray whitespace tolerated', async () => {
  const sig = await sign('k', 'x');
  assert.equal(await verifySignature('k', 'x', ` ${sig.toUpperCase()} `), true);
});

// --- Razorpay events ---------------------------------------------------------------------------------------

test('charged: access runs to the paid-through date plus the grace', () => {
  const c = change(parseWebhook(razorpay('subscription.charged', { notes: { email: 'Member@Example.com ' } }), OPTS));
  assert.equal(c.email, 'member@example.com');
  assert.equal(c.reference, 'sub_123');
  assert.equal(c.activeUntil?.getTime(), new Date('2026-12-17T00:00:00Z').getTime() + GRACE_DAYS * DAY);
  assert.equal(c.eventAt.toISOString(), '2026-11-17T09:00:00.000Z');
  assert.equal(c.event, 'subscription.charged');
  assert.equal(c.source, 'razorpay');
});

test('charged with empty notes (Razorpay sends [] when there are none) falls back to the payer email on the payment', () => {
  const c = change(parseWebhook(razorpay('subscription.charged', { notes: [], payment: { email: 'Payer@Example.com' } }), OPTS));
  assert.equal(c.email, 'payer@example.com');
});

test('notes email wins over the payment email', () => {
  const c = change(parseWebhook(razorpay('subscription.charged', { notes: { email: 'journal@example.com' }, payment: { email: 'card@example.com' } }), OPTS));
  assert.equal(c.email, 'journal@example.com');
});

test('activated and resumed also grant', () => {
  for (const e of ['subscription.activated', 'subscription.resumed']) {
    const c = change(parseWebhook(razorpay(e, { notes: { email: 'a@b.co' } }), OPTS));
    assert.ok(c.activeUntil && c.activeUntil.getTime() > OPTS.now.getTime(), e);
  }
});

test('an event with no email still carries the subscription id, so it can find its member', () => {
  const c = change(parseWebhook(razorpay('subscription.cancelled'), OPTS));
  assert.equal(c.email, null);
  assert.equal(c.reference, 'sub_123');
});

test('cancelled and completed end at the paid-through date, with no grace', () => {
  for (const e of ['subscription.cancelled', 'subscription.completed']) {
    const c = change(parseWebhook(razorpay(e, { currentEnd: '2026-12-01T00:00:00Z' }), OPTS));
    assert.equal(c.activeUntil?.toISOString(), '2026-12-01T00:00:00.000Z', e);
  }
});

test('cancelled after the paid period already ended ends at the event, not in the past', () => {
  const c = change(parseWebhook(razorpay('subscription.cancelled', { currentEnd: '2026-11-01T00:00:00Z', createdAt: '2026-11-17T09:00:00Z' }), OPTS));
  assert.equal(c.activeUntil?.toISOString(), '2026-11-17T09:00:00.000Z');
});

test('halted and paused end now', () => {
  for (const e of ['subscription.halted', 'subscription.paused']) {
    const c = change(parseWebhook(razorpay(e, { currentEnd: '2027-01-01T00:00:00Z' }), OPTS));
    assert.equal(c.activeUntil?.toISOString(), '2026-11-17T09:00:00.000Z', e);
  }
});

test('another product on the same Razorpay account is ignored', () => {
  const p = parseWebhook(razorpay('subscription.charged', { plan: 'plan_OTHER', notes: { email: 'a@b.co' } }), OPTS);
  assert.equal(p.kind, 'ignored');
});

test('with no plan list set, a Razorpay event is an error rather than a grant for everything', () => {
  const p = parseWebhook(razorpay('subscription.charged', { notes: { email: 'a@b.co' } }), { ...OPTS, planIds: [] });
  assert.equal(p.kind, 'invalid');
});

test('events that do not change access are ignored, whatever the plan', () => {
  for (const e of ['subscription.authenticated', 'subscription.pending', 'subscription.updated', 'payment.captured', 'payment.failed', 'invoice.paid']) {
    assert.equal(parseWebhook(razorpay(e), { ...OPTS, planIds: [] }).kind, 'ignored', e);
  }
});

test('a grant with no current_end, or with neither email nor subscription id, is invalid', () => {
  assert.equal(parseWebhook(razorpay('subscription.charged', { notes: { email: 'a@b.co' }, currentEnd: null }), OPTS).kind, 'invalid');
  const noIds = razorpay('subscription.charged');
  delete ((noIds.payload.subscription as { entity: Record<string, unknown> }).entity).id;
  assert.equal(parseWebhook(noIds, OPTS).kind, 'invalid');
});

test('a Razorpay event with no subscription is invalid', () => {
  assert.equal(parseWebhook({ event: 'subscription.charged', payload: {} }, OPTS).kind, 'invalid');
});

// --- plain calls -------------------------------------------------------------------------------------------

test('grant with an end date', () => {
  const c = change(parseWebhook({ email: ' Fan@Example.com', action: 'grant', active_until: '2026-12-17T00:00:00Z', reference: 'order_9' }, OPTS));
  assert.equal(c.email, 'fan@example.com');
  assert.equal(c.activeUntil?.toISOString(), '2026-12-17T00:00:00.000Z');
  assert.equal(c.reference, 'order_9');
  assert.equal(c.eventAt.getTime(), OPTS.now.getTime());
  assert.equal(c.source, 'api');
  assert.equal(c.event, 'grant');
});

test('grant with active_until null means no end date, but leaving it out is an error', () => {
  assert.equal(change(parseWebhook({ email: 'a@b.co', action: 'grant', active_until: null }, OPTS)).activeUntil, null);
  assert.equal(parseWebhook({ email: 'a@b.co', action: 'grant' }, OPTS).kind, 'invalid');
});

test('revoke ends at the event time', () => {
  const c = change(parseWebhook({ email: 'a@b.co', action: 'revoke', event_at: '2026-11-17T08:00:00Z' }, OPTS));
  assert.equal(c.activeUntil?.toISOString(), '2026-11-17T08:00:00.000Z');
  assert.equal(c.eventAt.toISOString(), '2026-11-17T08:00:00.000Z');
});

test('plain calls reject a bad email, action or date', () => {
  assert.equal(parseWebhook({ email: 'nope', action: 'grant', active_until: null }, OPTS).kind, 'invalid');
  assert.equal(parseWebhook({ email: 'a@b.co', action: 'delete' }, OPTS).kind, 'invalid');
  assert.equal(parseWebhook({ email: 'a@b.co', action: 'grant', active_until: 'tomorrow' }, OPTS).kind, 'invalid');
  assert.equal(parseWebhook({ email: 'a@b.co', action: 'grant', active_until: 20261217 }, OPTS).kind, 'invalid');
  assert.equal(parseWebhook({ email: 'a@b.co', action: 'revoke', event_at: 'later' }, OPTS).kind, 'invalid');
});

test('things that are not a webhook are invalid', () => {
  for (const b of [null, 'x', 3, [], {}, { hello: 'world' }]) assert.equal(parseWebhook(b, OPTS).kind, 'invalid', JSON.stringify(b));
});

test('cleanEmail', () => {
  assert.equal(cleanEmail(' A@B.CO '), 'a@b.co');
  for (const v of ['a', 'a@b', '@b.co', 'a b@c.co', '', null, undefined, 4]) assert.equal(cleanEmail(v), null, String(v));
});

// --- batches -----------------------------------------------------------------------------------------------

test('a batch parses each call on its own: good ones apply, bad ones are reported', () => {
  const out = parseBatch([
    { email: 'a@b.co', action: 'grant', active_until: '2026-12-17T00:00:00Z', reference: 'sub_1' },
    { email: 'nope', action: 'grant', active_until: null },
    { email: 'c@d.co', action: 'revoke' },
    'not an object',
    razorpay('subscription.charged', { notes: { email: 'e@f.co' } }),
  ], OPTS);
  assert.deepEqual(out.map((p) => p.kind), ['change', 'invalid', 'change', 'invalid', 'invalid']);
  assert.equal(change(out[0]).email, 'a@b.co');
  assert.equal(change(out[2]).activeUntil?.getTime(), OPTS.now.getTime());
  assert.match((out[4] as { reason: string }).reason, /not Razorpay events/);
});

test('an empty batch is fine and MAX_BATCH is a sane size', () => {
  assert.deepEqual(parseBatch([], OPTS), []);
  assert.ok(MAX_BATCH >= 100 && MAX_BATCH <= 1000);
});
