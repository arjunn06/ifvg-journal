import { supabase } from '@/integrations/supabase/client';

export interface UpgradeEmailData {
  userEmail: string;
  userDisplayName?: string;
  planName: string;
  planPrice: string;
  billingDate?: string;
  dashboardUrl?: string;
}

export interface NotificationEmailData {
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

class EmailService {
  private baseUrl = 'https://dynibyqrcbxneiwjyahn.supabase.co/functions/v1';

  /**
   * Send upgrade success email
   */
  async sendUpgradeSuccessEmail(data: UpgradeEmailData) {
    try {
      const response = await supabase.functions.invoke('send-upgrade-success', {
        body: data
      });

      if (response.error) {
        throw response.error;
      }

      console.log('Upgrade success email sent:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to send upgrade success email:', error);
      throw error;
    }
  }

  /**
   * Send general notification email
   */
  async sendNotificationEmail(data: NotificationEmailData) {
    try {
      const response = await supabase.functions.invoke('send-general-notification', {
        body: data
      });

      if (response.error) {
        throw response.error;
      }

      console.log('Notification email sent:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to send notification email:', error);
      throw error;
    }
  }

  /**
   * Send welcome email when user completes onboarding
   */
  async sendWelcomeEmail(userEmail: string, userName?: string) {
    try {
      const welcomeData: NotificationEmailData = {
        userEmail,
        userDisplayName: userName,
        subject: 'Welcome to IFVG Journal! 🎉',
        heading: 'Welcome to Your Trading Journey!',
        message: `We're excited to have you join IFVG Journal! Your account is now set up and ready to help you track and analyze your trading performance like never before.`,
        buttonText: 'Start Trading Analytics',
        buttonUrl: `${window.location.origin}/dashboard`,
        footerMessage: 'Ready to take your trading to the next level? Log in to your dashboard and start tracking your first trade!',
      };

      return await this.sendNotificationEmail(welcomeData);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  /**
   * Send subscription upgrade notification
   */
  async sendSubscriptionUpgrade(userEmail: string, planName: string, planPrice: string, userName?: string) {
    try {
      const upgradeData: UpgradeEmailData = {
        userEmail,
        userDisplayName: userName,
        planName,
        planPrice,
        dashboardUrl: `${window.location.origin}/dashboard`,
        billingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 30 days from now
      };

      return await this.sendUpgradeSuccessEmail(upgradeData);
    } catch (error) {
      console.error('Failed to send subscription upgrade email:', error);
      throw error;
    }
  }

  /**
   * Send account verification reminder
   */
  async sendVerificationReminder(userEmail: string, userName?: string) {
    try {
      const reminderData: NotificationEmailData = {
        userEmail,
        userDisplayName: userName,
        subject: 'Please verify your IFVG Journal account',
        heading: 'Account Verification Required',
        message: `To ensure the security of your account and access all features, please verify your email address. This helps us keep your trading data safe and secure.`,
        buttonText: 'Verify Account',
        buttonUrl: `${window.location.origin}/auth`,
        footerMessage: 'If you have already verified your account, you can safely ignore this email.',
      };

      return await this.sendNotificationEmail(reminderData);
    } catch (error) {
      console.error('Failed to send verification reminder:', error);
      throw error;
    }
  }

  /**
   * Send trading milestone celebration email
   */
  async sendMilestoneCelebration(userEmail: string, milestone: string, userName?: string) {
    try {
      const milestoneData: NotificationEmailData = {
        userEmail,
        userDisplayName: userName,
        subject: `🎉 Congratulations on ${milestone}!`,
        heading: `Amazing Achievement: ${milestone}!`,
        message: `Congratulations on reaching this important trading milestone! Your dedication to tracking and improving your trading performance is paying off. Keep up the excellent work!`,
        buttonText: 'View Your Progress',
        buttonUrl: `${window.location.origin}/dashboard`,
        footerMessage: 'Thank you for being part of IFVG Journal community. Here\'s to your continued success!',
      };

      return await this.sendNotificationEmail(milestoneData);
    } catch (error) {
      console.error('Failed to send milestone celebration email:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();