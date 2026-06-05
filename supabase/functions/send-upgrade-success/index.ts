import React from 'npm:react@18.3.1';
import { Resend } from 'npm:resend@4.0.0';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { UpgradeSuccessEmail } from './_templates/upgrade-success-email.tsx';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpgradeRequestBody {
  userEmail: string;
  userDisplayName?: string;
  planName: string;
  planPrice: string;
  billingDate?: string;
  dashboardUrl?: string;
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
    const body: UpgradeRequestBody = await req.json();
    
    console.log('Processing upgrade success email for user:', body.userEmail);

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

    const dashboardUrl = body.dashboardUrl || `${Deno.env.get('SITE_URL') || 'https://yourapp.com'}/dashboard`;

    // Render the React email template
    const html = await renderAsync(
      React.createElement(UpgradeSuccessEmail, {
        userDisplayName,
        userEmail: body.userEmail,
        planName: body.planName,
        planPrice: body.planPrice,
        dashboardUrl,
        billingDate: body.billingDate,
      })
    );

    console.log('Sending upgrade success email via Resend...');

    // Send the email using Resend
    const { data, error } = await resend.emails.send({
      from: 'IFVG Journal <billing@ifvg.in>',
      to: [body.userEmail],
      subject: `Welcome to ${body.planName}! Your upgrade is complete 🎉`,
      html,
    });

    if (error) {
      console.error('Failed to send email:', error);
      throw error;
    }

    console.log('Upgrade success email sent successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Upgrade success email sent successfully',
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
    console.error('Error in send-upgrade-success function:', error);
    
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || 'Failed to send upgrade success email',
          code: error.code || 'UNKNOWN_ERROR',
        },
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});