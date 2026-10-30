import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Mark } from '../ui/kit';
import './auth.css';

export function Brand({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`auth-brand ${className}`} aria-label="IFVG Journal, home">
      <Mark size={26} />
      <span>IFVG Journal</span>
    </Link>
  );
}

/** A centred single-pane screen: brand, one heading, one idea, one primary action. */
export function SoloScreen({ title, sub, children, foot }: { title: string; sub?: ReactNode; children?: ReactNode; foot?: ReactNode }) {
  return (
    <div className="j-auth solo">
      <main className="j-auth-form">
        <div className="auth-pane">
          <Brand />
          <div className="auth-head">
            <h1>{title}</h1>
            {sub && <p>{sub}</p>}
          </div>
          {children}
          {foot && <div className="auth-fine">{foot}</div>}
        </div>
      </main>
    </div>
  );
}

/** Password input with a show/hide toggle. The toggle follows the input in tab order. */
export function PasswordField({
  label, value, onChange, autoComplete, disabled, hint, name, error,
}: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string; disabled?: boolean; hint?: string; name?: string; error?: boolean;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="j-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-pw">
        <input
          id={id} name={name} className="j-input" type={shown ? 'text' : 'password'} value={value} required disabled={disabled}
          autoComplete={autoComplete} aria-invalid={error || undefined} aria-describedby={hint ? `${id}-h` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
          {shown ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {hint && <span id={`${id}-h`} className="j-hint">{hint}</span>}
    </div>
  );
}

export function Field({
  label, type = 'text', value, onChange, autoComplete, disabled, required = true, name, hint, readOnly,
}: {
  label: string; type?: string; value: string; onChange?: (v: string) => void; autoComplete?: string; disabled?: boolean; required?: boolean; name?: string; hint?: string; readOnly?: boolean;
}) {
  const id = useId();
  return (
    <div className="j-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id} name={name} className="j-input" type={type} value={value} required={required} disabled={disabled} readOnly={readOnly}
        autoComplete={autoComplete} aria-describedby={hint ? `${id}-h` : undefined} onChange={(e) => onChange?.(e.target.value)}
      />
      {hint && <span id={`${id}-h`} className="j-hint">{hint}</span>}
    </div>
  );
}

export function LegalLinks() {
  return (
    <>
      <Link to="/terms">Terms</Link>
      <Link to="/refund">Refund policy</Link>
    </>
  );
}

/** A calm readable document: 720px column, one title, sentence-case headings, a back link. */
export function LegalDoc({
  title, lede, sections, other,
}: {
  title: string;
  lede: string;
  sections: { id: string; heading: string; body: ReactNode }[];
  other: { to: string; label: string };
}) {
  return (
    <div className="j-doc">
      <div className="j-doc-bar">
        <Link to="/" className="back"><ArrowLeft aria-hidden="true" />Back to IFVG Journal</Link>
      </div>
      <main>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        <nav className="j-doc-toc" aria-label="On this page">
          {sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.heading}</a>)}
        </nav>
        {sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
            <h2 id={`${s.id}-h`}>{s.heading}</h2>
            {s.body}
          </section>
        ))}
        <div className="j-doc-foot">
          <Link to={other.to}>{other.label}</Link>
          <a href="mailto:support@ifvg.in">support@ifvg.in</a>
        </div>
      </main>
    </div>
  );
}
