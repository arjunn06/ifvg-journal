import { LegalDoc } from '@/journal/auth/parts';

const Terms = () => (
  <LegalDoc
    title="Terms and conditions"
    lede="These terms govern your use of IFVG Journal. Please read them before you create an account."
    other={{ to: '/refund', label: 'Refund policy' }}
    sections={[
      {
        id: 'acceptance', heading: '1. Acceptance of terms',
        body: <p>By accessing and using IFVG Journal ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.</p>,
      },
      {
        id: 'license', heading: '2. Use license',
        body: (
          <>
            <p>Permission is granted to temporarily download one copy of IFVG Journal per device for personal, non-commercial transitory viewing only.</p>
            <ul>
              <li>This is the grant of a license, not a transfer of title.</li>
              <li>Under this license you may not modify or copy the materials.</li>
              <li>Use the materials for any commercial purpose or for any public display.</li>
              <li>Attempt to reverse engineer any software contained on the website.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'accounts', heading: '3. User accounts',
        body: <p>When you create an account with us, you must provide information that is accurate, complete, and current at all times. You are responsible for safeguarding the password and for all activities that occur under your account.</p>,
      },
      {
        id: 'data', heading: '4. Trading data',
        body: <p>You retain ownership of all trading data you input into the Service. We will not share, sell, or distribute your trading data to third parties without your explicit consent.</p>,
      },
      {
        id: 'availability', heading: '5. Service availability',
        body: <p>We strive to maintain 99.9% uptime but cannot guarantee uninterrupted service. The Service may be temporarily unavailable for maintenance, updates, or due to technical issues beyond our control.</p>,
      },
      {
        id: 'payment', heading: '6. Payment terms',
        body: <p>Subscription fees are billed in advance on a monthly basis. All fees are non-refundable except as required by law or as specified in our <a className="inline" href="/refund">Refund policy</a>.</p>,
      },
      {
        id: 'prohibited', heading: '7. Prohibited uses',
        body: (
          <>
            <p>You may not use our Service:</p>
            <ul>
              <li>For any unlawful purpose or to solicit others to perform unlawful acts.</li>
              <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances.</li>
              <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others.</li>
              <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate.</li>
              <li>To submit false or misleading information.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'termination', heading: '8. Termination',
        body: <p>We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever including breach of Terms.</p>,
      },
      {
        id: 'disclaimer', heading: '9. Disclaimer',
        body: <p>The information on this website is provided on an "as is" basis. To the fullest extent permitted by law, this Company excludes all representations, warranties, conditions and terms.</p>,
      },
      {
        id: 'liability', heading: '10. Limitation of liability',
        body: <p>In no event shall IFVG Journal, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, punitive, consequential, or special damages.</p>,
      },
      {
        id: 'changes', heading: '11. Changes to terms',
        body: <p>We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting to the website. Your continued use of the Service constitutes acceptance of the updated terms.</p>,
      },
      {
        id: 'contact', heading: '12. Contact',
        body: <p>If you have any questions about these terms, write to <a className="inline" href="mailto:support@ifvg.in">support@ifvg.in</a>.</p>,
      },
    ]}
  />
);

export default Terms;
