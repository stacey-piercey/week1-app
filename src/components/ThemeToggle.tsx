import type { ThemeMode } from '../hooks/useTheme';

const LABELS: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

// ︎ asks for the plain text symbol, not a colour emoji (Windows draws ☀ as one).
const ICONS: Record<ThemeMode, string> = { system: '◐', light: '☀︎', dark: '☾' };

interface ThemeToggleProps {
  mode: ThemeMode;
  /** Move to the next mode: System → Light → Dark → System. */
  onCycle: () => void;
}

/** One button at the bottom of the sidebar. Its name says the current mode. */
export default function ThemeToggle({ mode, onCycle }: ThemeToggleProps) {
  return (
    <button type="button" className="theme-toggle" title="Change theme" onClick={onCycle}>
      <span className="theme-toggle-icon" aria-hidden="true">
        {ICONS[mode]}
      </span>
      Theme: {LABELS[mode]}
    </button>
  );
}
