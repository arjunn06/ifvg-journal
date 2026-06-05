
import {
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
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface PasswordResetEmailProps {
  userEmail: string;
  userDisplayName?: string;
  resetUrl: string;
  token: string;
}

export const PasswordResetEmail = ({
  userEmail,
  userDisplayName,
  resetUrl,
  token
}: PasswordResetEmailProps) => (
  <Html>
    <Head />
    <Preview>Reset your IFVG Journal password - Secure access to your trading analytics</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with branding */}
        <Section style={header}>
          <div style={logoContainer}>
            <div style={logoIcon}>🔒</div>
            <Text style={logoText}>IFVG Journal</Text>
          </div>
          <Text style={tagline}>Account Security</Text>
        </Section>
        
        {/* Main content */}
        <Section style={content}>
          <Heading style={h1}>Password Reset Request</Heading>
          
          <Text style={greeting}>
            Hello {userDisplayName || 'Trader'},
          </Text>
          
          <Text style={paragraph}>
            We received a request to reset the password for your IFVG Journal account associated with <strong>{userEmail}</strong>.
          </Text>
          
          <Text style={paragraph}>
            If you made this request, click the button below to reset your password. This link will expire in 1 hour for security reasons.
          </Text>
          
          <Section style={ctaSection}>
            <Button href={resetUrl} style={ctaButton}>
              Reset My Password
            </Button>
          </Section>
          
          <Text style={alternativeText}>
            Or copy and paste this link into your browser:
          </Text>
          <Text style={linkText}>
            {resetUrl}
          </Text>
          
          <Section style={codeSection}>
            <Text style={codeLabel}>Reset Code:</Text>
            <Text style={code}>{token}</Text>
          </Section>
          
          <Section style={securityNotice}>
            <Text style={securityTitle}>🛡️ Security Notice</Text>
            <div style={securityList}>
              <Text style={securityItem}>• This password reset link expires in 1 hour</Text>
              <Text style={securityItem}>• If you didn't request this reset, please ignore this email</Text>
              <Text style={securityItem}>• Your password remains unchanged unless you click the link above</Text>
              <Text style={securityItem}>• Never share this email or link with anyone</Text>
            </div>
          </Section>
          
          <Text style={helpText}>
            <strong>Didn't request this?</strong><br/>
            If you didn't request a password reset, you can safely ignore this email. 
            Your account remains secure and no changes will be made.
          </Text>
        </Section>
        
        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            Stay Secure,<br />
            <strong>The IFVG Journal Security Team</strong>
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

export default PasswordResetEmail;

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
  backgroundColor: '#dc2626',
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

const securityNotice = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const securityTitle = {
  color: '#dc2626',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px',
  textAlign: 'center' as const,
};

const securityList = {
  margin: '0',
};

const securityItem = {
  color: '#7f1d1d',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '4px 0',
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
