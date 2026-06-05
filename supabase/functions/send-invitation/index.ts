
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  token: string;
  inviterName: string;
}

// Inline React Email template with consistent branding
const InvitationEmail = ({ email, token, inviterName, inviteUrl }: { 
  email: string; 
  token: string; 
  inviterName: string; 
  inviteUrl: string; 
}) => {
  const {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Text,
    Button,
    Section
  } = require('npm:@react-email/components@0.0.22');

  return React.createElement(Html, null,
    React.createElement(Head, null),
    React.createElement(Preview, null, "You're invited to join IFVG Journal Beta - Professional Trading Analytics"),
    React.createElement(Body, { style: main },
      React.createElement(Container, { style: container },
        // Header with branding
        React.createElement(Section, { style: header },
          React.createElement('div', { style: logoContainer },
            React.createElement('div', { style: logoIcon }, '🎉'),
            React.createElement(Text, { style: logoText }, 'IFVG Journal')
          ),
          React.createElement(Text, { style: tagline }, 'Beta Trading Platform')
        ),
        
        // Main content
        React.createElement(Section, { style: content },
          React.createElement(Heading, { style: h1 }, "You're Invited to IFVG Journal Beta!"),
          
          React.createElement(Text, { style: greeting }, 'Hello!'),
          
          React.createElement(Text, { style: paragraph }, 
            `${inviterName} has invited you to join the exclusive beta of IFVG Journal - our advanced trading journal and analytics platform.`
          ),
          
          React.createElement(Section, { style: inviteBox },
            React.createElement(Text, { style: inviteTitle }, '🎉 Welcome to the Future of Trading'),
            React.createElement(Text, { style: inviteText }, 
              'IFVG Journal helps professional traders track, analyze, and optimize their trading performance with advanced analytics and AI-powered insights.'
            ),
            React.createElement(Text, { style: inviteEmail }, 
              `Your invitation email: ${email}`
            ),
            React.createElement(Button, { href: inviteUrl, style: ctaButton }, 
              'Accept Invitation & Join Beta'
            )
          ),
          
          React.createElement(Section, { style: urgencyBox },
            React.createElement(Text, { style: urgencyTitle }, '⏰ This invitation expires in 7 days'),
            React.createElement(Text, { style: urgencyText }, 
              "Don't wait - secure your spot in our exclusive beta program!"
            )
          ),
          
          React.createElement(Text, { style: featuresTitle }, 'What you\'ll get:'),
          React.createElement('div', { style: featuresList },
            React.createElement(Text, { style: featureItem }, '📊 Advanced trade journaling and analytics'),
            React.createElement(Text, { style: featureItem }, '🤖 AI-powered trading insights'),
            React.createElement(Text, { style: featureItem }, '📈 Real-time performance tracking'),
            React.createElement(Text, { style: featureItem }, '🎯 Risk management tools'),
            React.createElement(Text, { style: featureItem }, '👥 Early access to new features')
          ),
          
          React.createElement(Text, { style: paragraph }, 
            'If you have any questions, feel free to reach out to our team. We\'re excited to have you on board!'
          )
        ),
        
        // Footer
        React.createElement(Section, { style: footer },
          React.createElement(Text, { style: footerText }, 'This invitation was sent to ' + email),
          React.createElement(Text, { style: footerText }, 
            'If you didn\'t expect this invitation, you can safely ignore this email.'
          ),
          React.createElement(Text, { style: footerSmall }, '© 2024 IFVG Journal. All rights reserved.')
        )
      )
    )
  );
};

// Styles matching the landing page
const main = {
  backgroundColor: '#0a0a0a',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#ffffff',
};

const container = {
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  backgroundColor: '#ffffff',
};

const header = {
  backgroundColor: '#0a0a0a',
  padding: '40px 30px',
  textAlign: 'center',
  borderBottom: '1px solid #1a1a1a',
};

const logoContainer = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  marginBottom: '8px',
};

const logoIcon = {
  fontSize: '28px',
};

const logoText = {
  fontSize: '32px',
  fontWeight: '700',
  color: '#ffffff',
  margin: '0',
  fontFamily: 'Inter, sans-serif',
};

const tagline = {
  color: '#888888',
  fontSize: '14px',
  margin: '0',
  fontWeight: '500',
};

const content = {
  backgroundColor: '#ffffff',
  padding: '40px 30px',
  color: '#1a1a1a',
};

const h1 = {
  color: '#1a1a1a',
  fontSize: '32px',
  fontWeight: '700',
  margin: '0 0 24px',
  textAlign: 'center',
  fontFamily: 'Inter, sans-serif',
};

const greeting = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 20px',
};

const paragraph = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
};

const inviteBox = {
  backgroundColor: '#f8f9fa',
  borderRadius: '12px',
  padding: '30px',
  textAlign: 'center',
  margin: '30px 0',
};

const inviteTitle = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: '600',
  margin: '0 0 15px',
};

const inviteText = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 20px',
};

const inviteEmail = {
  color: '#4a4a4a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 20px',
};

const ctaButton = {
  backgroundColor: '#000000',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '16px 32px',
  border: 'none',
  fontFamily: 'Inter, sans-serif',
};

const urgencyBox = {
  backgroundColor: '#fff8dc',
  border: '1px solid #f0e68c',
  borderRadius: '8px',
  padding: '20px',
  margin: '30px 0',
  textAlign: 'center',
};

const urgencyTitle = {
  color: '#b45309',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
};

const urgencyText = {
  color: '#92400e',
  fontSize: '14px',
  margin: '10px 0 0',
};

const featuresTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '30px 0 16px',
};

const featuresList = {
  margin: '0 0 30px',
};

const featureItem = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '28px',
  margin: '8px 0',
};

const footer = {
  backgroundColor: '#0a0a0a',
  padding: '30px',
  textAlign: 'center',
  color: '#ffffff',
};

const footerText = {
  color: '#ffffff',
  fontSize: '14px',
  margin: '0 0 10px',
};

const footerSmall = {
  color: '#666666',
  fontSize: '12px',
  margin: '0',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, token, inviterName }: InvitationRequest = await req.json();

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: "Email and token are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const inviteUrl = `https://journal.ifvg.in/invite/${token}`;

    // Render the React email template
    const emailHtml = await renderAsync(
      React.createElement(InvitationEmail, {
        email,
        token,
        inviterName: inviterName || 'Someone',
        inviteUrl
      })
    );

    const emailResponse = await resend.emails.send({
      from: "IFVG Journal <noreply@ifvg.in>",
      to: [email],
      subject: "You're invited to IFVG Journal Beta - Professional Trading Analytics",
      html: emailHtml,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
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
