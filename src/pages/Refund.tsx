import { LegalDoc } from '@/journal/auth/parts';

const Refund = () => (
  <LegalDoc
    title="Refund policy"
    lede="We offer a 30-day money-back guarantee on paid plans. If you are not satisfied within 30 days of your first payment, we will refund it."
    other={{ to: '/terms', label: 'Terms and conditions' }}
    sections={[
      {
        id: 'eligibility', heading: 'Eligibility',
        body: (
          <>
            <p>To be eligible for a refund, all of the following must be true:</p>
            <ul>
              <li>The request is made within 30 days of your initial subscription.</li>
              <li>Your account is in good standing, with no violations of our Terms of Service.</li>
              <li>The request is made by the original account holder.</li>
              <li>The account has not exceeded reasonable usage limits during the refund period.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'not-covered', heading: "What is not covered",
        body: (
          <>
            <p>The following are not eligible for refunds:</p>
            <ul>
              <li>Requests made after the 30-day period.</li>
              <li>Partial month refunds (we do not prorate subscriptions).</li>
              <li>Free plan accounts (no payment made).</li>
              <li>Accounts terminated for Terms of Service violations.</li>
              <li>Duplicate or fraudulent accounts.</li>
              <li>Subscriptions obtained through promotional codes or special offers (unless explicitly stated).</li>
            </ul>
          </>
        ),
      },
      {
        id: 'request', heading: 'How to request a refund',
        body: (
          <ol>
            <li>Contact our support team at <a className="inline" href="mailto:support@ifvg.in">support@ifvg.in</a>.</li>
            <li>Include your account email address and subscription details.</li>
            <li>Provide a brief reason for the refund request.</li>
            <li>Our team will review your request within 2-3 business days.</li>
          </ol>
        ),
      },
      {
        id: 'processing', heading: 'Refund processing',
        body: <p>Once approved, refunds will be processed back to the original payment method within 5-10 business days. The exact timing depends on your bank or credit card company's processing times.</p>,
      },
      {
        id: 'access', heading: 'Account access',
        body: <p>Upon refund approval, your account will be immediately downgraded to the free plan. All data will be preserved, but premium features will no longer be accessible.</p>,
      },
      {
        id: 'cancellation', heading: 'Subscription cancellation',
        body: <p>You can cancel your subscription at any time without penalty. Cancellation stops future billing but does not trigger an automatic refund for the current billing period. You will continue to have access to premium features until the end of your current billing cycle.</p>,
      },
      {
        id: 'disputes', heading: 'Dispute resolution',
        body: <p>If you are not satisfied with our response to your refund request, you may contact your credit card company or payment provider to dispute the charge. However, we encourage you to contact us first to resolve any issues.</p>,
      },
      {
        id: 'contact', heading: 'Contact',
        body: <p>For refund requests or questions about this policy, write to <a className="inline" href="mailto:support@ifvg.in">support@ifvg.in</a>. We reply within 2-3 business days.</p>,
      },
    ]}
  />
);

export default Refund;
