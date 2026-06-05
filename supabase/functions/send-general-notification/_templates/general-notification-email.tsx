
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface GeneralNotificationEmailProps {
  userDisplayName?: string;
  userEmail: string;
  subject: string;
  heading: string;
  message: string;
  buttonText?: string;
  buttonUrl?: string;
  footerMessage?: string;
}

export const GeneralNotificationEmail = ({
  userDisplayName = 'Trader',
  userEmail,
  subject,
  heading,
  message,
  buttonText,
  buttonUrl,
  footerMessage,
}: GeneralNotificationEmailProps) => (
  <Html>
    <Head />
    <Preview>{subject}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with branding */}
        <Section style={header}>
          <div style={logoContainer}>
            <div style={logoIcon}>📧</div>
            <Text style={logoText}>IFVG Journal</Text>
          </div>
          <Text style={tagline}>Professional Trading Analytics</Text>
        </Section>

        {/* Main content */}
        <Section style={content}>
          <Heading style={h1}>{heading}</Heading>
          
          <Text style={greeting}>
            Hi {userDisplayName},
          </Text>

          <Text style={paragraph}>
            {message}
          </Text>

          {/* CTA Button (if provided) */}
          {buttonText && buttonUrl && (
            <Section style={ctaSection}>
              <Button style={ctaButton} href={buttonUrl}>
                {buttonText}
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          {/* Footer Message */}
          {footerMessage && (
            <Text style={paragraph}>
              {footerMessage}
            </Text>
          )}

          <Text style={paragraph}>
            If you have any questions, feel free to contact our support team at{' '}
            <Link href="mailto:support@ifvg.in" style={inlineLink}>
              support@ifvg.in
            </Link>
          </Text>

          <Text style={paragraph}>
            Best regards,<br />
            <strong>The IFVG Journal Team</strong>
          </Text>
        </Section>

        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            This email was sent to {userEmail}
          </Text>
          <Text style={footerLink}>
            <Link href="https://journal.ifvg.in" style={link}>ifvg.in</Link>
          </Text>
          <Text style={footerSmall}>
            © 2024 IFVG Journal. All rights reserved.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default GeneralNotificationEmail;

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

const inlineLink = {
  color: '#0066cc',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e9ecef',
  margin: '24px 0',
};

const footer = {
  backgroundColor: '#0a0a0a',
  padding: '30px',
  textAlign: 'center' as const,
  color: '#ffffff',
};

const footerText = {
  color: '#ffffff',
  fontSize: '14px',
  margin: '0 0 8px',
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
