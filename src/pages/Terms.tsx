import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, ArrowLeft, Shield, FileText, User, Clock } from 'lucide-react';

const Terms = () => {
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
              <FileText className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms and Conditions</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            These terms govern your use of IFVG Journal. Please read them carefully.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="grid gap-8">
          
          <Card>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 rounded-lg p-2">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">1. Acceptance of Terms</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using IFVG Journal ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-primary/10 rounded-lg p-2">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">2. Use License</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Permission is granted to temporarily download one copy of IFVG Journal per device for personal, non-commercial transitory viewing only.
              </p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  This is the grant of a license, not a transfer of title
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Under this license you may not modify or copy the materials
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Use the materials for any commercial purpose or for any public display
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  Attempt to reverse engineer any software contained on the website
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
              <p className="text-muted-foreground leading-relaxed">
                When you create an account with us, you must provide information that is accurate, complete, and current at all times. You are responsible for safeguarding the password and for all activities that occur under your account.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">4. Trading Data</h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of all trading data you input into the Service. We will not share, sell, or distribute your trading data to third parties without your explicit consent.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">5. Service Availability</h2>
              <p className="text-muted-foreground leading-relaxed">
                We strive to maintain 99.9% uptime but cannot guarantee uninterrupted service. The Service may be temporarily unavailable for maintenance, updates, or due to technical issues beyond our control.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">6. Payment Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                Subscription fees are billed in advance on a monthly basis. All fees are non-refundable except as required by law or as specified in our Refund Policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">7. Prohibited Uses</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">You may not use our Service:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  For any unlawful purpose or to solicit others to perform unlawful acts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  To infringe upon or violate our intellectual property rights or the intellectual property rights of others
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-1">•</span>
                  To submit false or misleading information
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">8. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever including breach of Terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">9. Disclaimer</h2>
              <p className="text-muted-foreground leading-relaxed">
                The information on this website is provided on an "as is" basis. To the fullest extent permitted by law, this Company excludes all representations, warranties, conditions and terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">10. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                In no event shall IFVG Journal, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, punitive, consequential, or special damages.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">11. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting to the website. Your continued use of the Service constitutes acceptance of the updated terms.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">12. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions about these Terms and Conditions, please contact us at:
              </p>
              <div className="bg-background rounded-lg p-4 border">
                <p className="font-medium">support@ifvg.in</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Terms;