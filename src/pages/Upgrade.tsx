// /upgrade: kept as the address, now the membership page. The journal is included with the Blue Pill and is not
// sold on its own, so there is nothing to buy here: it shows the membership on this account and links to the course.
// Only members reach it (RequireAuth puts everyone else on the no-access screen).

import { SubscriptionRefresh } from '@/components/SubscriptionRefresh';
import { PageHeader, Panel } from '@/journal/ui/kit';
import { BLUEPILL, SUPPORT_EMAIL } from '@/journal/access/bluepill';
import '@/journal/auth/auth.css';

const Upgrade = () => (
  <>
    <PageHeader title="Membership" sub="The journal is included with the Blue Pill, so there is nothing to buy here." />

    <div className="j-grid top">
      <Panel className="j-span-8" title={BLUEPILL.name} meta={`${BLUEPILL.price} ${BLUEPILL.per}`}>
        <p style={{ color: 'var(--text-2)' }}>{BLUEPILL.tagline}</p>
        <ul className="up-list">
          <li><b>The IFVG Journal</b>, all of it, with no trade limit</li>
          {BLUEPILL.includes.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <div className="up-buy">
          <span className="j-meta">{BLUEPILL.billing}</span>
          <a className="j-btn" href={BLUEPILL.url} target="_blank" rel="noopener noreferrer">See the Blue Pill</a>
        </div>
      </Panel>

      <div className="j-span-4" style={{ display: 'grid', gap: 'var(--gap)' }}>
        <Panel title="Your membership">
          <SubscriptionRefresh />
        </Panel>
        <Panel title="Questions about billing">
          <p style={{ color: 'var(--text-2)' }}>
            Your membership is billed by the Blue Pill, not by the journal. Write to us and we will point you the right way.
          </p>
          <p style={{ marginTop: 12 }}><a className="auth-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
        </Panel>
      </div>
    </div>
  </>
);

export default Upgrade;
