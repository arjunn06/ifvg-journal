import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type Theme } from '@/providers/ThemeProvider';

export const THEMES: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** One-tap light/dark switch for pages without the app menu. It flips whatever is on screen; the menu also offers System. */
export function ThemeToggle({ className = 'j-icon-btn' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === 'light' ? 'dark' : 'light';
  return (
    <button type="button" className={className} onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {resolvedTheme === 'light' ? <Moon /> : <Sun />}
    </button>
  );
}
