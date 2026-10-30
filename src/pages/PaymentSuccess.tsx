import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { SoloScreen } from '@/journal/auth/parts';
import { useToast } from '@/hooks/use-toast';
import { verifyZohoPayment } from '@/components/ZohoPayment';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verifying, setVerifying] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const orderId = searchParams.get('order_id');
      const plan = searchParams.get('plan');
      const amount = searchParams.get('amount');

      if (!orderId) {
        toast({
          title: "Invalid Payment",
          description: "Payment verification failed. Please contact support.",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      try {
        // Verify payment with Zoho
        const verification = await verifyZohoPayment(orderId);
        
        if (verification.status === 'success') {
          setPaymentData({
            orderId,
            plan,
            amount,
            transactionId: verification.transactionId
          });

          toast({
            title: "Payment Successful!",
            description: `Welcome to the ${plan} plan!`,
          });
        } else {
          throw new Error('Payment verification failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        // The page itself explains the failure (see the unconfirmed state below).
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams, navigate, toast]);

  if (verifying) {
    return (
      <SoloScreen title="Confirming your payment" sub="This takes a few seconds. Please keep this page open.">
        <div className="j-track" role="progressbar" aria-label="Confirming payment"><i style={{ width: '40%' }} /></div>
      </SoloScreen>
    );
  }

  // Verification did not succeed: say so instead of claiming an active plan.
  if (!paymentData) {
    return (
      <SoloScreen
        title="We could not confirm this payment"
        sub="If you were charged, your plan will update once the payment settles. Nothing is lost."
        foot={<>Still stuck? Write to <a className="auth-link" href="mailto:support@ifvg.in">support@ifvg.in</a> and include your order ID if you have it.</>}
      >
        <div className="auth-actions">
          <Link to="/upgrade" className="j-btn primary">Check plan status</Link>
          <Link to="/dashboard" className="j-btn ghost">Go to overview</Link>
        </div>
      </SoloScreen>
    );
  }

  return (
    <SoloScreen
      title="Payment confirmed"
      sub="Your subscription is active and premium features are unlocked."
      foot="A confirmation email has been sent to your registered address."
    >
      <dl className="auth-rows">
        <div><dt>Plan</dt><dd style={{ textTransform: 'capitalize' }}>{paymentData.plan}</dd></div>
        <div><dt>Amount</dt><dd>₹{paymentData.amount} per month</dd></div>
        <div><dt>Order ID</dt><dd>{paymentData.orderId}</dd></div>
        <div><dt>Transaction ID</dt><dd>{paymentData.transactionId}</dd></div>
      </dl>
      <div className="auth-actions">
        <button type="button" className="j-btn primary" onClick={() => navigate('/dashboard')}>Go to overview</button>
      </div>
    </SoloScreen>
  );
}
