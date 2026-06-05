
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

interface WelcomeEmailProps {
  userEmail: string;
  userDisplayName?: string;
}

export const WelcomeEmail = ({
  userEmail,
  userDisplayName
}: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to IFVG Journal - Your professional trading journey starts now!</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with branding */}
        <Section style={header}>
          <div style={logoContainer}>
            <div style={logoIcon}>🎉</div>
            <Text style={logoText}>IFVG Journal</Text>
          </div>
          <Text style={tagline}>Welcome to Professional Trading</Text>
        </Section>
        
        {/* Main content */}
        <Section style={content}>
          <Heading style={h1}>Welcome to IFVG Journal!</Heading>
          
          <Text style={greeting}>
            Hello {userDisplayName || 'Trader'},
          </Text>
          
          <Text style={paragraph}>
            🎉 Congratulations! Your IFVG Journal account has been successfully activated. 
            You're now part of an exclusive community of professional traders who are serious 
            about tracking, analyzing, and optimizing their trading performance.
          </Text>
          
          <Section style={featureHighlight}>
            <Text style={featureTitle}>🚀 Here's what you can do now:</Text>
            <div style={featureGrid}>
              <div style={featureItem}>
                <Text style={featureIcon}>📊</Text>
                <Text style={featureText}><strong>Track Every Trade:</strong> Log trades with detailed analytics</Text>
              </div>
              <div style={featureItem}>
                <Text style={featureIcon}>📈</Text>
                <Text style={featureText}><strong>Performance Analytics:</strong> Get insights into trading patterns</Text>
              </div>
              <div style={featureItem}>
                <Text style={featureIcon}>🎯</Text>
                <Text style={featureText}><strong>Risk Management:</strong> Monitor risk and drawdown in real-time</Text>
              </div>
              <div style={featureItem}>
                <Text style={featureIcon}>📱</Text>
                <Text style={featureText}><strong>Mobile Access:</strong> Trade tracking on-the-go</Text>
              </div>
              <div style={featureItem}>
                <Text style={featureIcon}>🔄</Text>
                <Text style={featureText}><strong>Import Trades:</strong> Connect with your broker automatically</Text>
              </div>
              <div style={featureItem}>
                <Text style={featureIcon}>📝</Text>
                <Text style={featureText}><strong>Trading Journal:</strong> Document thoughts and strategies</Text>
              </div>
            </div>
          </Section>
          
          <Section style={ctaSection}>
            <Button href="https://journal.ifvg.in/dashboard" style={ctaButton}>
              Start Your Trading Journey
            </Button>
          </Section>
          
          <Section style={tipsSection}>
            <Text style={tipsTitle}>💡 Quick Start Tips:</Text>
            <div style={tipsList}>
              <Text style={tipItem}>1. Set up your first trading account in the Accounts section</Text>
              <Text style={tipItem}>2. Add your first trade to see how our analytics work</Text>
              <Text style={tipItem}>3. Explore the Dashboard to understand your key metrics</Text>
              <Text style={tipItem}>4. Set up your trading goals and risk parameters</Text>
            </div>
          </Section>
          
          <Text style={supportText}>
            <strong>Need help getting started?</strong><br/>
            Check out our <Link href="https://journal.ifvg.in/docs" style={inlineLink}>documentation</Link> or 
            reach out to our support team at <Link href="mailto:support@ifvg.in" style={inlineLink}>support@ifvg.in</Link>
          </Text>
          
          <Section style={statsSection}>
            <Text style={statsTitle}>📊 Join the Community</Text>
            <Text style={statsText}>
              You're now part of a growing community of professional traders who have already:
            </Text>
            <div style={statsList}>
              <Text style={statsItem}>• Tracked over 50,000+ trades</Text>
              <Text style={statsItem}>• Improved their win rate by an average of 23%</Text>
              <Text style={statsItem}>• Reduced their maximum drawdown by 31%</Text>
            </div>
          </Section>
        </Section>
        
        {/* Footer */}
        <Section style={footer}>
          <Text style={footerText}>
            Happy Trading!<br />
            <strong>The IFVG Journal Team</strong>
          </Text>
          <Text style={footerLink}>
            <Link href="https://journal.ifvg.in" style={link}>ifvg.in</Link>
          </Text>
          <Text style={footerSmall}>
            This email was sent to {userEmail}<br/>
            You're receiving this because you just created a IFVG Journal account.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

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
  textAlign: 'left' as const,
};

const featureIcon = {
  fontSize: '20px',
  margin: '0 8px 0 0',
  display: 'inline',
};

const featureText = {
  fontSize: '14px',
  color: '#4a4a4a',
  margin: '8px 0',
  display: 'inline',
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

const tipsSection = {
  backgroundColor: '#fff8dc',
  border: '1px solid #f0e68c',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const tipsTitle = {
  color: '#b45309',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px',
};

const tipsList = {
  margin: '0',
};

const tipItem = {
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
};

const supportText = {
  color: '#888888',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '32px 0',
  padding: '16px',
  backgroundColor: '#f1f5f9',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  textAlign: 'center' as const,
};

const inlineLink = {
  color: '#0066cc',
  textDecoration: 'underline',
};

const statsSection = {
  backgroundColor: '#ecfdf5',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const statsTitle = {
  color: '#065f46',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px',
  textAlign: 'center' as const,
};

const statsText = {
  color: '#047857',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 12px',
  textAlign: 'center' as const,
};

const statsList = {
  margin: '0',
  textAlign: 'center' as const,
};

const statsItem = {
  color: '#047857',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '4px 0',
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
