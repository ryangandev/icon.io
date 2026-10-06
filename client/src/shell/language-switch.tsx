import { LOCALE_NAMES, LOCALES, useLocale, useMessages } from '../i18n';
import { cx } from '../ui/cx';
import styles from './language-switch.module.css';

/**
 * The footer's language switch: every language by its own name, the current
 * one in ink, as one radio group, so a test counting pressed buttons never
 * sees it. It is the one control not drawn in Figma (docs/design.md).
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const m = useMessages();
  const { locale, setLocale } = useLocale();
  return (
    <span
      role="radiogroup"
      aria-label={m.shell.language.label}
      className={cx(styles.switch, className)}
    >
      {LOCALES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          role="radio"
          lang={candidate}
          className={styles.language}
          aria-checked={candidate === locale}
          onClick={() => setLocale(candidate)}
        >
          {LOCALE_NAMES[candidate]}
        </button>
      ))}
    </span>
  );
}
