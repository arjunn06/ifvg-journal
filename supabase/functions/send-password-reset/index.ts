import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { HttpError, authenticate, requireAdmin } from "../_shared/auth.ts";
import { SENDERS, SITE_URL, sendEmail } from "../_shared/email.ts";
import { PasswordResetEmail } from "./_templates/password-reset-email.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  userEmail: string;
  userDisplayName?: string;
  resetUrl: string;
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Real password-reset mail goes through the Auth hook (send-signup-confirmation).
    // This endpoint is for trusted backends and admins only.
    requireAdmin(await authenticate(req));
    const { userEmail, userDisplayName, resetUrl, token }: PasswordResetRequest = await req.json();

    if (!userEmail || !resetUrl || !token) {
      return new Response(
        JSON.stringify({ error: "Email, reset URL, and token are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // The link must point at our app or our Supabase project, never an arbitrary site.
    const allowedOrigins = [SITE_URL, Deno.env.get("SUPABASE_URL")].filter(Boolean) as string[];
    if (!allowedOrigins.some((origin) => resetUrl.startsWith(`${origin}/`))) {
      throw new HttpError(400, "resetUrl must point at the app or Supabase project");
    }

    // Render the React email template
    const emailHtml = await renderAsync(
      React.createElement(PasswordResetEmail, {
        userEmail,
        userDisplayName,
        resetUrl,
        token
      })
    );

    const data = await sendEmail({
      from: SENDERS.security,
      to: userEmail,
      subject: "Reset your IFVG Journal password",
      html: emailHtml,
    });

    console.log("Password reset email sent successfully:", data.id);

    return new Response(JSON.stringify({ data, error: null }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error instanceof HttpError ? error.status : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);