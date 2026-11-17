// Blue Pill purchase -> journal access. Called by Razorpay (or the course site's server) when someone joins,
// renews, cancels or stops paying. Records the member by email in public.bluepill_memberships; the journal
// reads it for the signed-in user (my_bluepill_membership), so it works whether they sign up before or after paying.
//
// No user JWT: the caller is a server, so the gateway check is off (supabase/config.toml) and every request
// must carry a valid X-Razorpay-Signature instead.
//
// Required secrets: BLUEPILL_WEBHOOK_SECRET  the secret set on the Razorpay webhook (and used to sign plain calls)
//                   BLUEPILL_PLAN_IDS        comma-separated Razorpay plan ids that mean "Blue Pill"
//                                            (only needed when Razorpay itself calls this function)
// Setup, payloads and how to test it: docs/bluepill-webhook.md

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.3";
import { MAX_BATCH, parseBatch, parseWebhook, verifySignature, type Change } from "../_shared/bluepill.ts";

const MAX_BODY_BYTES = 512 * 1024;
const CHUNK = 20;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Admin = ReturnType<typeof createClient>;

/** Records one change. Returns 'applied' | 'stale' | 'unmatched'; throws if the database call fails. */
async function apply(admin: Admin, c: Change): Promise<string> {
  const { data, error } = await admin.rpc("apply_bluepill_event", {
    p_email: c.email,
    p_reference: c.reference,
    p_active_until: c.activeUntil ? c.activeUntil.toISOString() : null,
    p_event_at: c.eventAt.toISOString(),
    p_event: c.event,
    p_source: c.source,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const secret = Deno.env.get("BLUEPILL_WEBHOOK_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !url || !serviceKey) {
    console.error("bluepill-webhook: BLUEPILL_WEBHOOK_SECRET (or the Supabase env) is not set");
    return json(500, { error: "Server misconfigured" });
  }

  // The signature covers the exact bytes sent, so read the text first and parse it after.
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Body too large" });

  if (!(await verifySignature(secret, raw, req.headers.get("x-razorpay-signature")))) {
    return json(401, { error: "Bad signature" });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Body is not JSON" });
  }

  const planIds = (Deno.env.get("BLUEPILL_PLAN_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const admin = createClient(url, serviceKey);

  // --- A batch: the course site's hourly catch-up ----------------------------------------------------------
  if (Array.isArray(body)) {
    if (body.length > MAX_BATCH) return json(413, { error: `At most ${MAX_BATCH} calls per request` });
    const parsed = parseBatch(body, { planIds });

    const counts: Record<string, number> = { applied: 0, stale: 0, unmatched: 0, ignored: 0, invalid: 0 };
    const rejected: { index: number; reason: string }[] = [];
    try {
      for (let i = 0; i < parsed.length; i += CHUNK) {
        await Promise.all(parsed.slice(i, i + CHUNK).map(async (p, j) => {
          if (p.kind === "change") {
            counts[await apply(admin, p.change)]++;
          } else {
            counts[p.kind]++;
            if (p.kind === "invalid" && rejected.length < 20) rejected.push({ index: i + j, reason: p.reason });
          }
        }));
      }
    } catch (error) {
      // 500: the caller retries the whole batch, which is safe (an event already applied is applied again as itself).
      console.error("bluepill-webhook: batch could not be applied:", (error as Error).message);
      return json(500, { error: "Could not record the batch" });
    }
    console.log("bluepill-webhook: batch", body.length, JSON.stringify(counts));
    return json(200, { ok: true, total: body.length, ...counts, rejected });
  }

  // --- One event ---------------------------------------------------------------------------------------------
  const parsed = parseWebhook(body, { planIds });

  if (parsed.kind === "invalid") {
    console.error("bluepill-webhook: invalid:", parsed.reason);
    return json(400, { error: parsed.reason });
  }
  // 200 so Razorpay does not retry something that will never become relevant.
  if (parsed.kind === "ignored") return json(200, { ok: true, result: "ignored", reason: parsed.reason });

  const c = parsed.change;
  try {
    const result = await apply(admin, c);
    // Log what happened, not who: the address stays in the database.
    console.log("bluepill-webhook:", c.event, c.reference ?? "(no reference)", result);
    return json(200, { ok: true, result });
  } catch (error) {
    // 500 makes Razorpay retry (with backoff, for about a day), which is what we want for a database hiccup.
    console.error("bluepill-webhook: could not apply", c.event, c.reference, (error as Error).message);
    return json(500, { error: "Could not record the event" });
  }
});
