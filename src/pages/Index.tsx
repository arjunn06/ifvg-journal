import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RazorpayPayment } from '@/components/RazorpayPayment';
import { TrendingUp, BarChart3, Shield, Calendar, Check, Brain, ArrowRight, Zap, Target, BookOpen, Sparkles, LineChart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/LogoMark';

const Index = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <LogoMark className="h-8 w-8 group-hover:shadow-[0_0_36px_hsl(var(--brand-red)/0.7)] transition-shadow" />
            <span className="font-display text-lg tracking-tight">
              IFVG<span className="text-primary">Journal</span>
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="https://ifvg.in" target="_blank" rel="noreferrer" className="hover:text-foreground transition">Community</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground rounded-full">
              <a href="/auth">Sign In</a>
            </Button>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full text-sm font-semibold px-5 shadow-[0_8px_24px_-8px_hsl(var(--brand-red)/0.6)]">
              <a href="/auth">Start Journaling</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-24 pb-32 lg:pt-32 lg:pb-40">
        {/* Red radial glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[700px] -z-10"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 0%, hsl(var(--brand-red) / 0.25), transparent 70%)',
            transform: `translateY(${scrollY * 0.15}px)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse 60% 50% at 50% 30%, black, transparent 80%)',
          }}
        />

        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs uppercase tracking-[0.2em] text-primary mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            For the Arjun IFVG community
          </div>

          <h1 className="font-display text-5xl sm:text-7xl lg:text-[120px] leading-[0.85] tracking-tight mb-8">
            Trade with
            <br />
            <span className="text-primary drop-shadow-[0_0_40px_hsl(var(--brand-red)/0.5)]">patience</span>
            <span className="text-muted-foreground">, not dopamine.</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            IFVG Journal is the trading journal built for ICT &amp; iFVG traders.
            Log every fill, replay every session, and let the data tell you what your discipline already knows.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-12 px-7 text-sm font-semibold shadow-[0_12px_40px_-10px_hsl(var(--brand-red)/0.7)]">
              <a href="/auth">
                Create your journal
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-full h-12 px-7 text-sm font-semibold border-border/60 bg-background/40 backdrop-blur hover:bg-secondary">
              <a href="https://ifvg.in" target="_blank" rel="noreferrer">Visit ifvg.in</a>
            </Button>
          </div>

          <div className="mt-14 flex items-center justify-center gap-8 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>ICT Concepts</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>Prop firm ready</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>CSV import</span>
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="relative pb-32">
        <div className="container mx-auto px-6">
          <div className="relative max-w-5xl mx-auto">
            <div
              className="absolute -inset-x-10 -inset-y-10 bg-primary/20 blur-3xl rounded-[3rem] -z-10"
              style={{ transform: `translateY(${scrollY * -0.04}px)` }}
            />
            <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-background/60">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary/70" />
                  <span className="h-3 w-3 rounded-full bg-muted" />
                  <span className="h-3 w-3 rounded-full bg-muted" />
                </div>
                <span className="text-xs text-muted-foreground tracking-wide">journal.ifvg.in / dashboard</span>
              </div>

              <div className="p-6 lg:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Net P&L', value: '+$12,340', accent: 'text-profit' },
                    { label: 'Win rate', value: '68.5%' },
                    { label: 'Avg R:R', value: '2.4R' },
                    { label: 'Max DD', value: '-3.1%', accent: 'text-loss' },
                  ].map((m) => (
                    <div key={m.label} className="rounded-xl bg-secondary/50 border border-border/40 p-4">
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{m.label}</div>
                      <div className={`mt-2 font-display text-2xl ${m.accent ?? ''}`}>{m.value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-secondary/40 border border-border/40 p-5">
                  <div className="flex items-end justify-between h-36 gap-1.5">
                    {Array.from({ length: 28 }).map((_, i) => {
                      const h = 18 + ((i * 37) % 80);
                      const isWin = (i * 7) % 3 !== 0;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-sm ${isWin ? 'bg-profit/70' : 'bg-loss/70'}`}
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { sym: 'NQ', side: 'Long', pnl: '+$420', tag: 'iFVG' },
                    { sym: 'ES', side: 'Short', pnl: '-$95', tag: 'OB' },
                    { sym: 'GC', side: 'Long', pnl: '+$210', tag: 'BPR' },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/40 border border-border/40 px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-display text-base">{t.sym}</span>
                        <span className="text-xs text-muted-foreground">{t.side}</span>
                        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">{t.tag}</span>
                      </div>
                      <span className={`font-semibold ${t.pnl.startsWith('+') ? 'text-profit' : 'text-loss'}`}>{t.pnl}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-24 border-t border-border/40">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs uppercase tracking-[0.3em] text-primary">Built for ICT traders</span>
            <h2 className="font-display text-4xl lg:text-6xl mt-4 leading-[0.95]">
              Everything you need.
              <br />
              <span className="text-muted-foreground">Nothing you don't.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 rounded-2xl overflow-hidden border border-border/60">
            {[
              { icon: TrendingUp, title: 'Fill-level tracking', body: 'Log entries, exits, partials, fees and slippage with precision.' },
              { icon: BarChart3, title: 'Honest analytics', body: 'Win rate, expectancy, R-multiple distribution, drawdown curves.' },
              { icon: Brain, title: 'Confluence engine', body: 'Tag iFVGs, OBs, liquidity sweeps. See which setup actually pays.' },
              { icon: Calendar, title: 'P&L calendar', body: 'Daily, weekly, monthly heatmaps. Spot tilt before it costs you.' },
              { icon: Shield, title: 'Drawdown alerts', body: 'Prop-firm aware risk monitor with hard rules and soft warnings.' },
              { icon: Zap, title: 'CSV / Rithmic import', body: 'Drag your fills. We pair them into round-trip trades automatically.' },
            ].map((f, i) => (
              <div key={i} className="group bg-card p-8 hover:bg-secondary/60 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manifesto strip */}
      <section className="relative py-32 overflow-hidden border-t border-border/40">
        <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 50%, hsl(var(--brand-red) / 0.18), transparent 70%)' }} />
        <div className="container mx-auto px-6 text-center">
          <Sparkles className="h-6 w-6 text-primary mx-auto mb-6" />
          <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl leading-[0.9] max-w-4xl mx-auto">
            We don't chase dopamine.
            <br />
            <span className="text-primary">We chase patience.</span>
          </h2>
          <p className="mt-8 text-muted-foreground max-w-xl mx-auto">
            A journal isn't paperwork. It's the mirror that turns trades into a craft.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-24 border-t border-border/40">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-[0.3em] text-primary">Pricing</span>
            <h2 className="font-display text-4xl lg:text-6xl mt-4 leading-[0.95]">Start free. Scale serious.</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="p-8 rounded-2xl border border-border/60 bg-card">
              <h3 className="font-display text-2xl mb-1">Starter</h3>
              <p className="text-sm text-muted-foreground mb-6">For new traders building the habit.</p>
              <div className="mb-8">
                <span className="font-display text-5xl">$0</span>
                <span className="text-muted-foreground"> / month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                {['Up to 20 trades / month', 'Basic analytics', 'P&L calendar', '1 trading account', 'CSV import'].map((l) => (
                  <li key={l} className="flex items-center gap-3"><Check className="h-4 w-4 text-primary flex-shrink-0" /><span>{l}</span></li>
                ))}
              </ul>
              <Button asChild className="w-full rounded-full h-11 bg-secondary text-foreground hover:bg-secondary/80 border border-border/60">
                <a href="/auth">Get started</a>
              </Button>
            </div>

            <div className="relative p-8 rounded-2xl border border-primary/60 bg-gradient-to-br from-card to-primary/5 shadow-[0_20px_60px_-20px_hsl(var(--brand-red)/0.5)]">
              <div className="absolute -top-3 left-8 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-semibold">Most popular</div>
              <h3 className="font-display text-2xl mb-1">Professional</h3>
              <p className="text-sm text-muted-foreground mb-6">For serious traders and prop firm operators.</p>
              <div className="mb-8">
                <span className="font-display text-5xl">$10</span>
                <span className="text-muted-foreground"> / month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                {['Unlimited trades', 'Advanced analytics + reports', 'Multiple accounts', 'Confluence tagging', 'Flexible CSV import (any broker)', 'Priority support'].map((l) => (
                  <li key={l} className="flex items-center gap-3"><Check className="h-4 w-4 text-primary flex-shrink-0" /><span>{l}</span></li>
                ))}
              </ul>
              <RazorpayPayment
                plan="professional"
                amount={10}
                onSuccess={() => {
                  toast({ title: 'Payment Successful!', description: 'Welcome to Professional. Redirecting…' });
                  setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
                }}
                onError={(error) => { console.error('Payment error:', error); }}
              >
                <div className="w-full h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center text-sm font-semibold transition-colors">
                  Start Professional
                </div>
              </RazorpayPayment>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-28 border-t border-border/40">
        <div className="container mx-auto px-6 text-center max-w-3xl">
          <h2 className="font-display text-4xl lg:text-6xl leading-[0.95] mb-6">
            Your next trade deserves
            <br />
            <span className="text-primary">a real record.</span>
          </h2>
          <p className="text-muted-foreground mb-10">
            Join the Arjun IFVG community traders journaling on IFVG Journal.
          </p>
          <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full h-12 px-8 text-sm font-semibold shadow-[0_12px_40px_-10px_hsl(var(--brand-red)/0.7)]">
            <a href="/auth">Create free account <ArrowRight className="ml-2 h-4 w-4" /></a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <span className="font-display text-primary-foreground text-xs leading-none">i</span>
            </div>
            <span className="font-display text-foreground">IFVG<span className="text-primary">Journal</span></span>
          </div>
          <div className="flex gap-6">
            <a href="/terms" className="hover:text-foreground transition">Terms</a>
            <a href="/refund" className="hover:text-foreground transition">Refund</a>
            <a href="https://ifvg.in" target="_blank" rel="noreferrer" className="hover:text-foreground transition">ifvg.in</a>
          </div>
          <span className="text-xs">© {new Date().getFullYear()} IFVG Journal</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
