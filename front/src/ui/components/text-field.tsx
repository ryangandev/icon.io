import { Field } from '@base-ui/react/field';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../cx';
import styles from './field.module.css';

export interface TextFieldProps extends Omit<
  ComponentProps<typeof Field.Control>,
  'className'
> {
  label: ReactNode;
  /** A hint under the field, such as a length limit. */
  helper?: ReactNode;
  /** Replaces the helper and marks the field invalid; never repeat it in a Notice. */
  error?: ReactNode;
  className?: string;
}

/** Zumpo/Input: a labelled text field. */
export function TextField({
  label,
  helper,
  error,
  disabled,
  className,
  ...control
}: TextFieldProps) {
  const message = error ?? helper;
  return (
    <Field.Root
      className={cx(styles.field, className)}
      invalid={error != null}
      disabled={disabled}
    >
      <Field.Label className={styles.label}>{label}</Field.Label>
      <Field.Control className={styles.box} {...control} />
      {message != null && (
        <Field.Description className={styles.helper}>
          {message}
        </Field.Description>
      )}
    </Field.Root>
  );
}
