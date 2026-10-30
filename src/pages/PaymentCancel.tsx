import { Link } from 'react-router-dom';
import { SoloScreen } from '@/journal/auth/parts';

export default function PaymentCancel() {
  return (
    <SoloScreen
      title="Payment cancelled"
      sub="No payment was taken and your plan has not changed."
      foot={<>Questions about a charge? Write to <a className="auth-link" href="mailto:support@ifvg.in">support@ifvg.in</a>.</>}
    >
      <div className="auth-actions">
        <Link to="/upgrade" className="j-btn primary">Back to plans</Link>
        <Link to="/dashboard" className="j-btn ghost">Go to overview</Link>
      </div>
    </SoloScreen>
  );
}
