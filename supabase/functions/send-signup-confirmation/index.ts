import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@2.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { SignupConfirmationEmail } from "./_templates/signup-confirmation-email.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  user: {
    email: string;
    user_metadata?: {
      display_name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Webhook received for signup confirmation");
    
    // Verify webhook signature
    const payloadText = await req.text();
    const headers = Object.fromEntries(req.headers);
    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "";

    if (!hookSecret) {
      console.warn("SEND_EMAIL_HOOK_SECRET not set; proceeding without verification (development mode)");
    } else {
      try {
        const wh = new Webhook(hookSecret);
        wh.verify(payloadText, headers);
      } catch (e) {
        console.error("Webhook verification failed:", e);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const payload: WebhookPayload = JSON.parse(payloadText);
    console.log("Webhook payload:", payload);

    const { user, email_data } = payload;
    const { email } = user;
    const { token_hash, redirect_to, email_action_type, site_url } = email_data;
    
    if (!email) {
      console.error("No email found in webhook payload");
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Construct the confirmation URL
    const confirmationUrl = `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;
    
    console.log("Sending confirmation email to:", email);
    console.log("Confirmation URL:", confirmationUrl);

    // Render the React email template
    const emailHtml = await renderAsync(
      React.createElement(SignupConfirmationEmail, {
        userEmail: email,
        userDisplayName: user.user_metadata?.display_name || email.split('@')[0],
        confirmationUrl,
        token: token_hash
      })
    );

    const emailResponse = await resend.emails.send({
      from: "IFVG Journal <noreply@ifvg.in>",
      to: [email],
      subject: "Welcome to IFVG Journal - Confirm your email",
      html: emailHtml,
    });

    console.log("Signup confirmation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-signup-confirmation webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);