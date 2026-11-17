# Blue Pill webhook: a purchase unlocks the journal

The journal is included with the Blue Pill (blueprint.ifvg.in/bluepill, billed monthly by Razorpay). The
`bluepill-webhook` edge function is how a membership reaches the journal. It records the member **by email** in
`public.bluepill_memberships`; the journal then asks `my_bluepill_membership()` about the signed-in user and matches on
their email. The order does not matter: pay first and sign up later, or the other way round. Nothing is synced or claimed.

```
blueprint.ifvg.in ──signed grant/revoke──▶ bluepill-webhook ──▶ bluepill_memberships (email, paid-through date)
 (owns memberships)                                                       ▲
journal (signed-in user) ──my_bluepill_membership()───────────────────────┘  matches the user's verified email
```

Access also still comes from the other two places (an active `subscribers` row, `profiles.premium_access_override`, admin
role). A Blue Pill purchase is a third way in, not a replacement.

## Two ways to feed it (pick one)

1. **The course site pushes it. Recommended.** blueprint.ifvg.in already owns every membership and each member's email, in its
   own Supabase project. Whenever a membership changes it sends this function a signed `grant` or `revoke`
   (`src/lib/journal-sync.server.ts` in the blueprint repo), and every hour its subscription sweep re-sends everyone in one
   batch, so a push that failed repairs itself. The journal gives access on exactly the same rule as the course library: the
   same paid-through date, no extra grace, trials included. Nothing to add in Razorpay.
2. **Razorpay calls the function directly.** Only if you want the journal independent of the course site. Needs the plan id and
   `notes.email` on subscriptions (below). Do not run both: they work out the end date differently (course site: the
   paid-through date; Razorpay path: plus 2 days) and whichever event happened last wins. This route only sees Blue Pill
   subscriptions: a Red Pill is a one-time order that only the course site records, so it needs Option 1.

## Setup

1. **Apply the migrations** (this one, and `20261116090000_lock_premium_grants.sql`):

   ```bash
   supabase db push
   ```

2. **Make a secret** and set it here. The course site (or Razorpay) is given the same value.

   ```bash
   openssl rand -hex 32
   supabase secrets set BLUEPILL_WEBHOOK_SECRET=<that value>
   ```

3. **Deploy the function** (`verify_jwt = false` for it is already in `supabase/config.toml`: it is called by a server and checks
   the signature itself):

   ```bash
   supabase functions deploy bluepill-webhook
   ```

4. **Connect the feed.**

   **Option 1, the course site.** On the blueprint site's host (Lovable, project secrets) set:

   | Secret | Value |
   | --- | --- |
   | `JOURNAL_WEBHOOK_URL` | `https://dynibyqrcbxneiwjyahn.supabase.co/functions/v1/bluepill-webhook` |
   | `JOURNAL_WEBHOOK_SECRET` | the value from step 2 |

   Until both are set the course site skips the push, so it is safe to deploy it first. `https://blueprint.ifvg.in/api/public/env-check`
   shows whether the site can see them (true/false only). To fill the journal with the members you already have, run the
   subscription sweep once instead of waiting for the hour (it needs the course site's service-role key, so run it from
   wherever the cron lives); its response has a `journal` block with how many calls were sent.

   **Option 2, Razorpay direct.** Also run `supabase secrets set BLUEPILL_PLAN_IDS=plan_xxxxxxxxxxxxxx` (the monthly plan, from
   Razorpay → Subscriptions → Plans; list several separated by commas), then in Razorpay (Account & Settings → Webhooks → Add
   new webhook) use this function's URL, the step 2 secret, and the events `subscription.activated`, `.charged`, `.resumed`,
   `.cancelled`, `.completed`, `.halted`, `.paused`. Create the subscriptions with `notes: { email }`: Razorpay only puts the
   payer's email on events that carry a payment, so without it a `cancelled` event has just a subscription id (the function
   finds the member by the id it saw on their first charge, but the note makes every event self-contained).

5. **Tell buyers which email to use.** The journal account has to be made with **the same email** the course was bought with,
   and verified. The course site's "subscription started" email and its members panel both say so. Someone who signs in with
   another address sees "no active membership" and the support address.

## What the function accepts

All requests are `POST`, signed: HMAC-SHA256 of the exact body, hex, in the `X-Razorpay-Signature` header (Razorpay's scheme).
An unsigned or wrongly signed request gets `401`; a body it cannot understand `400` with the reason.

**A plain call** (the course site, or you with curl):

| Body | Effect |
| --- | --- |
| `{"email", "action":"grant", "active_until":"<ISO date>"}` | Access until that date. |
| `{"email", "action":"grant", "active_until":null}` | Access with no end date. `active_until` must be there: leaving it out is an error, so a forgotten field cannot hand out open-ended access. |
| `{"email", "action":"revoke"}` | Access ends now (refund, chargeback, ended by hand). |

Optional on all: `reference` (subscription or order id) and `event_at` (ISO date; defaults to now).

**A batch**: a JSON array of up to 500 plain calls. Each stands alone: a bad one is listed under `rejected`, the rest apply. The
response is `{"ok":true,"total":n,"applied":n,"stale":n,"unmatched":n,"ignored":n,"invalid":n,"rejected":[...]}`.

**A Razorpay subscription event** (Option 2):

| Razorpay event | Effect |
| --- | --- |
| `subscription.activated`, `.charged`, `.resumed` | Access until the paid-through date (`current_end`) **plus 2 days**, so a debit that lands late does not lock a member out. |
| `subscription.cancelled`, `.completed` | Access until the paid-through date, no grace: they paid for that period. |
| `subscription.halted`, `.paused` | Access ends now. |
| anything else | Ignored. A failed charge is retried by Razorpay and ends in `halted` if it never succeeds. |

Events for a plan that is not in `BLUEPILL_PLAN_IDS` are ignored. The grace is `GRACE_DAYS` in `supabase/functions/_shared/bluepill.ts`.

Every call is applied in the order things *happened* (`event_at`), not the order they arrive: a late or repeated older call
changes nothing (`"result":"stale"`). Test one by hand:

```bash
BODY='{"email":"member@example.com","action":"grant","active_until":"2026-12-17T00:00:00Z"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$BLUEPILL_WEBHOOK_SECRET" | awk '{print $NF}')
curl -sS -X POST https://dynibyqrcbxneiwjyahn.supabase.co/functions/v1/bluepill-webhook \
  -H "x-razorpay-signature: $SIG" -H 'content-type: application/json' -d "$BODY"
# {"ok":true,"result":"applied"}
```

## "I paid but I cannot get in"

Look at the member's row (admins can read the table; or the Supabase SQL editor):

```sql
select email, active_until, last_event, event_at, source from public.bluepill_memberships where email = lower('them@example.com');
```

- **No row.** The journal never heard about them. Is `JOURNAL_WEBHOOK_URL` / `JOURNAL_WEBHOOK_SECRET` set on the course site
  (`/api/public/env-check`)? Does the course site show them as an active member? Does the email on their course profile match
  what they are using here? The next hourly sweep repairs a missed push. On Option 2, Razorpay → Webhooks shows each delivery
  and our answer: `ignored: plan ... is not the Blue Pill` means `BLUEPILL_PLAN_IDS` is missing the plan, `401` means the
  secret differs.
- **Row, but `active_until` is in the past.** Their membership ended or a payment failed (`last_event` says which).
- **Row is fine.** They have not signed up here with that exact address, or have not verified it. The journal only counts a
  verified email. They can press "I have joined, check again" on the no-access screen once they have.

## Things to know

- **Keep "Confirm email" switched on** in the Supabase dashboard (Authentication → Providers → Email). Access is matched on a
  *verified* address. With confirmation off anyone could sign up with a buyer's email and walk in.
- The function never logs email addresses, only the event, the subscription id and the result.
- Which memberships include the journal is `JOURNAL_PILLS` in the course site's `src/lib/journal.ts`: the Blue Pill and the Red
  Pill. The Red Pill is one payment for 31 days of access on the course site, so a Red Pill student's journal access ends with
  it (renewing or moving to the Blue Pill extends it). Remove `"red"` from that list to stop including them.
- Tests: `node --test supabase/functions/_shared/bluepill.test.ts` here (Node 22.18+) and `node --test tests/journal-sync.test.ts`
  in the blueprint repo. The SQL in the migration has been reviewed but not run against a database; try step 1 on a branch or a
  local database first if you can.
