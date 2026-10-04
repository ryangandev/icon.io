import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type GlyphName } from './icon';
import styles from './button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps extends Omit<
  ComponentProps<typeof BaseButton>,
  'className'
> {
  className?: string;
  /**
   * Primary starts or confirms the main action, one per view. Secondary is
   * any other action, Quiet low-emphasis navigation, Danger a destructive
   * confirmation.
   */
  variant?: ButtonVariant;
  icon?: GlyphName;
  /** Hides the label visually; it stays the accessible name. */
  iconOnly?: boolean;
  /** Becomes icon-only when its container is narrow, like the phone toolbar's. */
  iconOnlyWhenNarrow?: boolean;
  children: ReactNode;
}

/**
 * Zumpo/Button. Disabled is only for an action that will become available;
 * a request in flight is a status line, not a disabled button.
 */
export function Button({
  variant = 'primary',
  icon,
  iconOnly = false,
  iconOnlyWhenNarrow = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <BaseButton
      className={cx(
        styles.button,
        variant !== 'primary' && styles[variant],
        iconOnly && styles.iconOnly,
        iconOnlyWhenNarrow && styles.iconOnlyWhenNarrow,
        className,
      )}
      {...rest}
    >
      {icon && <Icon glyph={icon} size={20} />}
      <span className={styles.label}>{children}</span>
    </BaseButton>
  );
}
