import { useSubscription } from '@/hooks/useSubscription';
import { RazorpayPayment } from '@/components/RazorpayPayment';
import { SubscriptionRefresh } from '@/components/SubscriptionRefresh';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Panel, Skel } from '@/journal/ui/kit';
import '@/journal/auth/auth.css';

type Cell = string | boolean;
const ROWS: { label: string; free: Cell; premium: Cell }[] = [
  { label: 'Trades per month', free: 'Up to 20', premium: 'Unlimited' },
  { label: 'Trading accounts', free: '1', premium: 'Multiple' },
  { label: 'Analytics and reports', free: 'Basic', premium: 'Advanced' },
  { label: 'P&L calendar', free: true, premium: true },
  { label: 'Confluence checklist', free: 'Basic', premium: 'Advanced' },
  { label: 'Custom strategies and rules', free: false, premium: true },
  { label: 'Trade screenshots and notes', free: false, premium: true },
  { label: 'Export and backup', free: false, premium: true },
  { label: 'Priority support', free: false, premium: true },
];

function Value({ v }: { v: Cell }) {
  if (v === true) return <td className="v yes">Included</td>;
  if (v === false) return <td className="v no"><span aria-hidden="true">—</span><span className="sr-only">Not included</span></td>;
  return <td className={`v ${v === 'Basic' || v === '1' || v.startsWith('Up to') ? '' : 'yes'}`}>{v}</td>;
}

const Upgrade = () => {
  const { isPremium, isLoading, subscriptionTier, checkSubscription } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handlePaymentSuccess = async () => {
    toast({
      title: "Payment successful",
      description: "Your Premium plan is now active.",
    });

    // Refresh subscription status
    await checkSubscription();

    // Redirect to dashboard after a short delay
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive"
    });
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Plans" sub={<Skel w={320} />} />
        <div className="j-grid top">
          <Panel className="j-span-8" title="Compare plans">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ padding: '14px 0' }}><Skel w="60%" /></div>)}
          </Panel>
          <Panel className="j-span-4" title="Your plan"><Skel w={160} h={20} /></Panel>
        </div>
      </>
    );
  }

  const isCurrentlyPremium = isPremium && subscriptionTier === 'professional';

  return (
    <>
      <PageHeader
        title="Plans"
        sub={isCurrentlyPremium
          ? 'You are on Premium: no trade limit, every account, every report.'
          : 'Free covers one account and 20 trades a month. Premium removes the limits.'}
      />

      <div className="j-grid top">
        <Panel className="j-span-8" title="Compare plans" meta="Prices per month">
          <div className="j-table-wrap">
            <table className="up-table">
              <caption className="sr-only">What each plan includes</caption>
              <thead>
                <tr>
                  <th scope="col" className="id">Feature</th>
                  <th scope="col" className="plan">Free{!isCurrentlyPremium && <small>Your plan</small>}</th>
                  <th scope="col" className="plan">Premium{isCurrentlyPremium && <small>Your plan</small>}</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <Value v={r.free} />
                    <Value v={r.premium} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Price</th>
                  <td><div className="up-price">₹0</div><div className="j-meta">per month</div></td>
                  <td><div className="up-price">₹850</div><div className="j-meta">per month</div></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="up-buy">
            <span className="j-meta">{isCurrentlyPremium ? 'Premium is active on this account.' : 'Cancel any time. Access runs to the end of the billing period.'}</span>
            {!isCurrentlyPremium ? (
              <RazorpayPayment plan="professional" amount={850} onSuccess={handlePaymentSuccess} onError={handlePaymentError}>
                Upgrade to Premium
              </RazorpayPayment>
            ) : (
              <button type="button" className="j-btn" disabled>Current plan</button>
            )}
          </div>
        </Panel>

        <div className="j-span-4" style={{ display: 'grid', gap: 'var(--gap)' }}>
          <Panel title="Your plan">
            <SubscriptionRefresh />
          </Panel>
          <Panel title="Questions about billing">
            <p style={{ color: 'var(--text-2)' }}>
              Payments are covered by the <a className="auth-link" href="/refund">30-day refund policy</a>.
            </p>
            <p style={{ marginTop: 12 }}><a className="auth-link" href="mailto:support@ifvg.in">support@ifvg.in</a></p>
          </Panel>
        </div>
      </div>
    </>
  );
};

export default Upgrade;
