import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { HttpError, assertCanEmail, authenticate } from "../_shared/auth.ts";
import { SENDERS, sendEmail } from "../_shared/email.ts";
import { WelcomeEmail } from "./_templates/welcome-email.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  userEmail: string;
  userDisplayName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await authenticate(req);
    const { userEmail, userDisplayName }: WelcomeEmailRequest = await req.json();

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    assertCanEmail(caller, userEmail);

    // Render the React email template
    const emailHtml = await renderAsync(
      React.createElement(WelcomeEmail, {
        userEmail,
        userDisplayName
      })
    );

    const data = await sendEmail({
      from: SENDERS.welcome,
      to: userEmail,
      subject: "🎉 Welcome to IFVG Journal - Your Trading Journey Begins!",
      html: emailHtml,
    });

    console.log("Welcome email sent successfully:", data.id);

    return new Response(JSON.stringify({ data, error: null }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
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