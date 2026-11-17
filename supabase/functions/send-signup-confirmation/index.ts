import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { SENDERS, sendEmail } from "../_shared/email.ts";
import { PasswordResetEmail } from "../send-password-reset/_templates/password-reset-email.tsx";
import { SignupConfirmationEmail } from "./_templates/signup-confirmation-email.tsx";

/**
 * Supabase Auth "Send Email" hook. Once enabled (Dashboard > Authentication > Hooks),
 * Supabase stops sending its own auth emails and calls this function instead; Resend
 * delivers them. Called by Supabase Auth, not by browsers, so it is deployed with
 * verify_jwt = false (see supabase/config.toml) and authenticated by webhook signature.
 *
 * Handles the two flows the app uses: `signup` (sign-up + "resend verification")
 * and `recovery` (forgot password). Other types are rejected loudly.
 *
 * Secrets: RESEND_API_KEY, SEND_EMAIL_HOOK_SECRET (the `v1,whsec_...` value the
 * dashboard shows when the hook is created). SUPABASE_URL is provided by the runtime.
 */

interface HookPayload {
  user: {
    email: string;
    user_metadata?: { display_name?: string };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Supabase Auth surfaces `error.message` to the client when a hook fails.
const hookError = (httpCode: number, message: string) =>
  json({ error: { http_code: httpCode, message } }, httpCode);

const handler = async (req: Request): Promise<Response> => {
  // Fail closed: never accept unsigned calls, otherwise anyone who can reach
  // this URL could make Resend send mail from our domain.
  const rawSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  if (!rawSecret) {
    console.error("SEND_EMAIL_HOOK_SECRET is not set; refusing to send.");
    return hookError(500, "Email hook is not configured.");
  }

  const payloadText = await req.text();
  let payload: HookPayload;
  try {
    // standardwebhooks wants the bare base64 secret, without Supabase's `v1,whsec_` prefix.
    const wh = new Webhook(rawSecret.replace(/^v1,whsec_/, ""));
    payload = wh.verify(payloadText, Object.fromEntries(req.headers)) as HookPayload;
  } catch (e) {
    console.error("Webhook signature verification failed:", e);
    return hookError(401, "Invalid signature.");
  }

  try {
    const { user, email_data } = payload;
    const email = user?.email;
    if (!email) return hookError(400, "No email address in hook payload.");

    const { token, token_hash, redirect_to, email_action_type } = email_data;
    const displayName = user.user_metadata?.display_name || email.split("@")[0];

    // The verify endpoint lives on the Supabase project, not on the app's Site URL.
    const actionUrl =
      `${Deno.env.get("SUPABASE_URL")}/auth/v1/verify` +
      `?token=${encodeURIComponent(token_hash)}` +
      `&type=${encodeURIComponent(email_action_type)}` +
      `&redirect_to=${encodeURIComponent(redirect_to)}`;

    let element: ReturnType<typeof React.createElement>;
    let from: string;
    let subject: string;

    switch (email_action_type) {
      case "signup":
        element = React.createElement(SignupConfirmationEmail, {
          userEmail: email,
          userDisplayName: displayName,
          confirmationUrl: actionUrl,
          token,
        });
        from = SENDERS.noreply;
        subject = "Your IFVG Journal verification code";
        break;
      case "recovery":
        element = React.createElement(PasswordResetEmail, {
          userEmail: email,
          userDisplayName: displayName,
          resetUrl: actionUrl,
          token,
        });
        from = SENDERS.security;
        subject = "Reset your IFVG Journal password";
        break;
      default:
        // Failing is better than silently sending the wrong template.
        console.error(`No email template for auth email type "${email_action_type}".`);
        return hookError(400, `Unsupported email type: ${email_action_type}`);
    }

    const html = await renderAsync(element);
    // Never log `payload`, `actionUrl` or the tokens: they are credentials.
    const sent = await sendEmail({ from, to: email, subject, html });
    console.log(`Auth email "${email_action_type}" sent (resend id ${sent.id}).`);

    return json({});
  } catch (error) {
    console.error("send-signup-confirmation hook failed:", error);
    return hookError(500, "Could not send the email. Please try again.");
  }
};

serve(handler);
