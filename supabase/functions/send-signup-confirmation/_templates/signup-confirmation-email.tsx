
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Button,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface SignupConfirmationEmailProps {
  userEmail: string;
  userDisplayName?: string;
  confirmationUrl: string;
  token: string;
}

export const SignupConfirmationEmail = ({
  userEmail,
  userDisplayName,
  confirmationUrl,
  token
}: SignupConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to IFVG Journal - Confirm your email to start trading analytics</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with branding */}
        <Section style={header}>
          <div style={logoContainer}>
            <div style={logoIcon}>📊</div>
            <Text style={logoText}>IFVG Journal</Text>
          </div>
          <Text style={tagline}>Professional Trading Analytics</Text>
        </Section>
        
        {/* Main content */}
        <Section style={content}>
          <Heading style={h1}>Welcome to IFVG Journal!</Heading>
          
          <Text style={greeting}>
            Hello {userDisplayName || 'Trader'},
          </Text>
          
          <Text style={paragraph}>
            Thank you for joining IFVG Journal, the professional trading journal and analytics platform. 
            To get started with tracking and analyzing your trades, please confirm your email address.
          </Text>
          
          <Section style={ctaSection}>
            <Button href={confirmationUrl} style={ctaButton}>
              Confirm Email & Start Trading
            </Button>
          </Section>
          
          <Text style={alternativeText}>
            Or copy and paste this link into your browser:
          </Text>
          <Text style={linkText}>
            {confirmationUrl}
          </Text>
          
          <Section style={codeSection}>
            <Text style={codeLabel}>Verification Code:</Text>
            <Text style={code}>{token}</Text>
          </Section>
          
          <Section style={featureHighlight}>
            <Text style={featureTitle}>🚀 What's waiting for you:</Text>
            <div style={featureGrid}>
              <div style={featureItem}>
                <Text style={featureIcon}>📈</Text>
                <Text style={featureText}>Advanced Performance Analytics</Text>
              </div>
              <div style={featureItem}>
                <Text style={featureIcon}>🎯</Text>
                <Text style={featureText}>Risk Management Tools</Text>
              </div>
              <div style={featureItem}>
                <Text style={featureIcon}>📊</Text>
                <Text style={featureText}>Detailed Trade Journaling</Text>
              </div>
              <div style={featureItem}>
                <Text style={featureIcon}>🔄</Text>
                <Text style={featureText}>Multi-Platform Integration</Text>
              </div>
            </div>
          </Section>
          
          <Text style={helpText}>
            If you didn't create an account with us, you can safely ignore this email.
          </Text>
        </Section>
        
        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            Happy Trading,<br />
            <strong>The IFVG Journal Team</strong>
          </Text>
          <Text style={footerLink}>
            <Link href="https://journal.ifvg.in" style={link}>ifvg.in</Link>
          </Text>
          <Text style={footerSmall}>
            This email was sent to {userEmail}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default SignupConfirmationEmail;

// Consistent styling matching landing page
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
  textAlign: 'center' as const,
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
  textAlign: 'center' as const,
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

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const ctaButton = {
  backgroundColor: '#000000',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  border: 'none',
  fontFamily: 'Inter, sans-serif',
};

const alternativeText = {
  color: '#666666',
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '24px 0 8px',
};

const linkText = {
  color: '#0066cc',
  fontSize: '14px',
  fontFamily: 'monospace',
  wordBreak: 'break-all' as const,
  backgroundColor: '#f8f9fa',
  padding: '12px',
  borderRadius: '6px',
  margin: '8px 0 24px',
  textAlign: 'center' as const,
};

const codeSection = {
  backgroundColor: '#f8f9fa',
  border: '1px solid #e9ecef',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const codeLabel = {
  color: '#666666',
  fontSize: '14px',
  margin: '0 0 8px',
};

const code = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#1a1a1a',
  fontFamily: 'monospace',
  letterSpacing: '2px',
  margin: '0',
};

const featureHighlight = {
  backgroundColor: '#f8f9fa',
  borderRadius: '12px',
  padding: '24px',
  margin: '32px 0',
};

const featureTitle = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px',
  textAlign: 'center' as const,
};

const featureGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
};

const featureItem = {
  textAlign: 'center' as const,
};

const featureIcon = {
  fontSize: '24px',
  margin: '0 0 8px',
  display: 'block',
};

const featureText = {
  fontSize: '14px',
  color: '#4a4a4a',
  fontWeight: '500',
  margin: '0',
};

const helpText = {
  color: '#888888',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '32px 0 0',
  padding: '16px',
  backgroundColor: '#fff8dc',
  borderRadius: '6px',
  border: '1px solid #f0e68c',
  textAlign: 'center' as const,
};

const footer = {
  backgroundColor: '#0a0a0a',
  padding: '30px',
  textAlign: 'center' as const,
  color: '#ffffff',
};

const footerText = {
  color: '#ffffff',
  fontSize: '16px',
  margin: '0 0 16px',
};

const footerLink = {
  color: '#888888',
  fontSize: '14px',
  margin: '0 0 16px',
};

const link = {
  color: '#ffffff',
  textDecoration: 'underline',
};

const footerSmall = {
  color: '#666666',
  fontSize: '12px',
  margin: '0',
};
