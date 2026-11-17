import React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { GeneralNotificationEmail } from './_templates/general-notification-email.tsx';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { HttpError, assertCanEmail, authenticate } from '../_shared/auth.ts';
import { SENDERS, sendEmail } from '../_shared/email.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequestBody {
  userEmail: string;
  userDisplayName?: string;
  subject: string;
  heading: string;
  message: string;
  buttonText?: string;
  buttonUrl?: string;
  footerMessage?: string;
  fromEmail?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const caller = await authenticate(req);
    const body: NotificationRequestBody = await req.json();
    assertCanEmail(caller, body.userEmail);

    console.log('Processing general notification email for user:', body.userEmail);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user details from profiles if available
    let userDisplayName = body.userDisplayName;
    if (!userDisplayName) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('email', body.userEmail)
        .single();
      
      userDisplayName = profile?.display_name || body.userEmail.split('@')[0];
    }

    // Render the React email template
    const html = await renderAsync(
      React.createElement(GeneralNotificationEmail, {
        userDisplayName,
        userEmail: body.userEmail,
        subject: body.subject,
        heading: body.heading,
        message: body.message,
        buttonText: body.buttonText,
        buttonUrl: body.buttonUrl,
        footerMessage: body.footerMessage,
      })
    );

    console.log('Sending general notification email via Resend...');

    // Send the email using Resend
    // `fromEmail` may only name an address on the verified domain (enforced by sendEmail).
    const data = await sendEmail({
      from: body.fromEmail || SENDERS.notifications,
      to: body.userEmail,
      subject: body.subject,
      html,
    });

    console.log('General notification email sent successfully:', data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification email sent successfully',
        email_id: data?.id 
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error('Error in send-general-notification function:', error);
    
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || 'Failed to send notification email',
          code: error.code || 'UNKNOWN_ERROR',
        },
      }),
      {
        status: error instanceof HttpError ? error.status : 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});