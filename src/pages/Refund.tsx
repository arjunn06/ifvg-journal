import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, ArrowLeft, DollarSign, Clock, Shield, Mail, CheckCircle } from 'lucide-react';

const Refund = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-brand-blue" />
            <span className="font-bold text-xl">IFVG Journal</span>
          </div>
          <Button variant="outline" asChild>
            <a href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
        <div className="container mx-auto px-4 py-16 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/10 rounded-full p-4">
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Refund Policy</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We offer a hassle-free 30-day money-back guarantee. Your satisfaction is our priority.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Guarantee Badge */}
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800 max-w-2xl mx-auto">
          <CardContent className="p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3">
                <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">30-Day Money-Back Guarantee</h3>
            <p className="text-green-700 dark:text-green-300">
              Try IFVG Journal risk-free. If you're not completely satisfied within 30 days, we'll refund your payment.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 pb-16 max-w-4xl">
        <div className="grid gap-8">
          
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 rounded-lg p-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Eligibility Requirements</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">To be eligible for a refund, the following conditions must be met:</p>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  Refund request must be made within 30 days of initial subscription
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  Account must be in good standing with no violations of our Terms of Service
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  Request must be made by the original account holder
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  Account must not have exceeded reasonable usage limits during the refund period
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">What's Not Covered</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">The following are not eligible for refunds:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  Requests made after the 30-day period
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  Partial month refunds (we do not prorate subscriptions)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  Free plan accounts (no payment made)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  Accounts terminated for Terms of Service violations
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  Duplicate or fraudulent accounts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  Subscriptions obtained through promotional codes or special offers (unless explicitly stated)
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 rounded-lg p-2">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">How to Request a Refund</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">To request a refund:</p>
              <ol className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">1</span>
                  Contact our support team at <span className="font-medium text-foreground">support@ifvg.in</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">2</span>
                  Include your account email address and subscription details
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">3</span>
                  Provide a brief reason for the refund request
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">4</span>
                  Our team will review your request within 2-3 business days
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Refund Processing</h2>
              <p className="text-muted-foreground leading-relaxed">
                Once approved, refunds will be processed back to the original payment method within 5-10 business days. The exact timing depends on your bank or credit card company's processing times.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Account Access</h2>
              <p className="text-muted-foreground leading-relaxed">
                Upon refund approval, your account will be immediately downgraded to the free plan. All data will be preserved, but premium features will no longer be accessible.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Subscription Cancellation</h2>
              <p className="text-muted-foreground leading-relaxed">
                You can cancel your subscription at any time without penalty. Cancellation stops future billing but does not trigger an automatic refund for the current billing period. You'll continue to have access to premium features until the end of your current billing cycle.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Dispute Resolution</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you're not satisfied with our response to your refund request, you may contact your credit card company or payment provider to dispute the charge. However, we encourage you to contact us first to resolve any issues.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                For refund requests or questions about this policy, please contact us at:
              </p>
              <div className="bg-background rounded-lg p-4 border space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="font-medium">support@ifvg.in</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Response time: 2-3 business days</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Refund;