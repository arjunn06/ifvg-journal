# Email setup (Resend + Supabase)

All transactional email is sent with [Resend](https://resend.com) from Supabase Edge Functions.
Shared config (client, sender addresses, site URL) lives in `supabase/functions/_shared/email.ts`.

| Function | Trigger | Sender |
| --- | --- | --- |
| `send-signup-confirmation` | Supabase Auth **Send Email hook**: sign-up confirmation (`signup`) and forgot-password (`recovery`) | noreply@ / security@ |
| `send-invitation` | Admin invites a user (`InvitationManagement.tsx`) | noreply@ |
| `send-upgrade-success` | Called with plan details after an upgrade | billing@ |
| `send-general-notification` | Generic notification (`src/lib/emailService.ts`) | notifications@ |
| `send-welcome-email`, `send-password-reset` | Nothing calls these today | welcome@ / security@ |

Sender addresses are `<name>@EMAIL_DOMAIN` (default `ifvg.in`). `sendEmail()` refuses any `from`
that is not on that domain.

### Who may call what

The public anon key is **not** enough: `_shared/auth.ts` requires a signed-in user's token or the
service-role key (for server-to-server callers such as payment webhooks).

| Function | Allowed callers |
| --- | --- |
| `send-signup-confirmation` | Supabase Auth only (webhook signature) |
| `send-invitation`, `send-password-reset` | Admins (`profiles.role = 'admin'`) or service role |
| `send-upgrade-success`, `send-general-notification`, `send-welcome-email` | A signed-in user, to their **own** address only; admins or service role, to anyone |

`send-password-reset` additionally only accepts a `resetUrl` on the app or Supabase project origin.
Real password-reset mail is sent by the Auth hook, so this endpoint is effectively unused.
A backend that calls these functions must send `Authorization: Bearer <service-role key>`.

## 1. Resend

1. **Domains → Add Domain** → `ifvg.in`. Add the DNS records Resend shows (SPF, DKIM; add DMARC too)
   and wait for the status to become **Verified**. Until then Resend only delivers to your own address.
2. **API Keys → Create API Key** with *Sending access*, limited to that domain.
3. Smoke-test the key and domain before touching Supabase:

   ```bash
   export RESEND_API_KEY=re_xxxxxxxxxxxxxxxx   # the key you just created
   curl -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer $RESEND_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"from":"IFVG Journal <noreply@ifvg.in>","to":["you@example.com"],"subject":"Resend test","html":"<p>It works.</p>"}'
   ```

## 2. Supabase

Project ref: `dynibyqrcbxneiwjyahn`.

```bash
# Secrets used by the functions (RESEND_API_KEY is required; the rest have defaults)
supabase secrets set RESEND_API_KEY=re_xxx SITE_URL=https://journal.ifvg.in --project-ref dynibyqrcbxneiwjyahn

# Deploy the email functions (config.toml already marks the hook verify_jwt = false)
supabase functions deploy send-signup-confirmation send-invitation send-upgrade-success \
  send-general-notification send-welcome-email send-password-reset --project-ref dynibyqrcbxneiwjyahn
```

### Auth hook (sign-up and password-reset emails)

1. Dashboard → **Authentication → Hooks → Send Email** → enable → hook type **HTTPS** →
   URL `https://dynibyqrcbxneiwjyahn.supabase.co/functions/v1/send-signup-confirmation`
   (deploy the function first) → **Generate secret** and copy the `v1,whsec_...` value.
   (Newer dashboards may offer a "Supabase Edge Function" type instead; either works.)
2. Immediately store it:
   `supabase secrets set SEND_EMAIL_HOOK_SECRET='v1,whsec_...' --project-ref dynibyqrcbxneiwjyahn`

   The function **refuses to send** (HTTP 500) until this secret exists, so do steps 1 and 2 back to
   back, not while people are signing up.
3. **Authentication → URL Configuration**: Site URL `https://journal.ifvg.in`, and add
   `https://journal.ifvg.in/**` to Redirect URLs (covers `/` and `/reset-password`).

Once the hook is on, Supabase no longer sends any auth email itself. The hook templates `signup`
and `recovery` only (the two flows the app uses); other types such as magic link or email change are
rejected with an explicit error, so add a template to the `switch` in
`send-signup-confirmation/index.ts` before using them.

### Sign-up verification (6-digit code)

Sign-up is verified with a one-time code, not just a link. The `signup` email shows the 6-digit `token`
from the hook payload, and `/verify-email` exchanges it with `supabase.auth.verifyOtp({ type: 'signup' })`.
The link in the same email still works as a fallback and lands on `/onboarding`.

- In the Email provider settings (Dashboard → **Authentication**), keep **Confirm email** on. **Email OTP
  length** must stay 6 (the app's code input is six cells); **Email OTP expiration** sets how long a code
  lives (Supabase default is 1 hour).
- Supabase allows one auth email per address per minute by default; the verify screen's resend countdown
  (60 s) mirrors that.
- Add `https://journal.ifvg.in/**` (and `http://localhost:8080/**` for local work) to the Redirect URLs,
  otherwise the fallback link lands on the Site URL instead of `/onboarding`.

## 3. Verify

- Sign up with a fresh address: the email should carry a 6-digit code, and entering it on
  `/verify-email` should land on onboarding. Then use *Send a new code* and *Forgot password*. Each should
  arrive from the right sender and the link should land back on the app.
- Resend dashboard → **Emails** shows delivery status; Supabase → **Edge Functions → Logs** shows
  failures. Functions return non-2xx when Resend rejects a message (e.g. domain not verified).
- Locally: `cp supabase/functions/.env.example supabase/functions/.env`, fill it in, then
  `supabase functions serve --env-file supabase/functions/.env`.

## Deliverability (mail landing in junk)

Authentication is fine once Resend shows the domain as Verified (DKIM at `resend._domainkey`, SPF/MX at
`send.`, DMARC at `_dmarc`). A new sending domain still starts with no reputation, so expect junk
placement for the first days. What helps:

- In Gmail, open one message in Junk and click **Not spam**, then reply to or star a few. Do the same in Outlook / iCloud.
- Resend → **Domains → ifvg.in**: keep **open tracking and click tracking off**. Tracking rewrites links to
  another domain, which spam filters dislike and which can break one-time auth links.
- Every message is sent with a plain-text part (`htmlToText` in `_shared/email.ts`); HTML-only mail is penalised.
- Links in auth emails point at `*.supabase.co`, a different domain from the sender. A Supabase custom
  domain (e.g. `auth.ifvg.in`, paid add-on) removes that mismatch.
- Images stay hidden in Junk until the user clicks "display images", which is why the header logo looks
  missing there. The URL itself is public and served as `image/png`.
- The sender avatar ("IJ") is the mail client's default letter icon. A real logo needs BIMI, which
  requires a DMARC `quarantine`/`reject` policy (already set) plus a paid VMC/CMC certificate.
