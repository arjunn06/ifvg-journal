import { forwardRef } from 'react';
import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp';
import { OTP_LENGTH } from './otp';

/** One real input underneath (paste, autofill and password managers work), drawn as six cells. */
export const OtpInput = forwardRef<HTMLInputElement, {
  value: string; onChange: (v: string) => void; onComplete: (v: string) => void; disabled?: boolean; invalid?: boolean; describedBy?: string;
}>(function OtpInput({ value, onChange, onComplete, disabled, invalid, describedBy }, ref) {
  return (
    <OTPInput
      ref={ref}
      maxLength={OTP_LENGTH}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      disabled={disabled}
      aria-label={`${OTP_LENGTH}-digit verification code`}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      containerClassName="otp"
      render={({ slots }) => (
        <div className="otp-slots" aria-hidden="true">
          {slots.map((s, i) => (
            <div key={i} className="otp-cell j-num" data-active={s.isActive || undefined} data-invalid={invalid || undefined}>
              {s.char}
              {s.hasFakeCaret && <i className="otp-caret" />}
            </div>
          ))}
        </div>
      )}
    />
  );
});
