interface LogoMarkProps {
  className?: string;
}

/**
 * IFVG brand mark — the "N" glyph (provided by ifvg.in).
 * Renders the white path on a red rounded square. Size via className (h-X w-X).
 */
export function LogoMark({ className = 'h-8 w-8' }: LogoMarkProps) {
  return (
    <div className={`${className} rounded-lg bg-primary flex items-center justify-center shadow-[0_0_24px_hsl(var(--brand-red)/0.5)]`}>
      <svg viewBox="0 0 192 192" className="h-[70%] w-[70%]" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M59.7334 120.762L75.8281 104.667L91.9227 88.5722L108.017 72.4775H124.112V120.762H108.017V96.6195L83.8754 120.762H59.7334ZM124.112 72.4775H108.017L124.112 56.3828V72.4775Z"
          fill="currentColor"
          className="text-primary-foreground"
        />
      </svg>
    </div>
  );
}
