import { Field } from '@base-ui/react/field';
import { Select } from '@base-ui/react/select';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from './icon';
import fieldStyles from './field.module.css';
import styles from './select-field.module.css';

export interface SelectOption<Value extends string | number> {
  value: Value;
  label: string;
  /** An optional second line, such as a board's size and mines. */
  detail?: string;
}

export interface SelectFieldProps<Value extends string | number> {
  label: ReactNode;
  options: readonly SelectOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  helper?: ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
}

/**
 * Zumpo/Input with Select on, opening a Zumpo/Select menu of
 * Zumpo/Select options. Only the presets in options can be chosen.
 */
export function SelectField<Value extends string | number>({
  label,
  options,
  value,
  onValueChange,
  helper,
  disabled,
  name,
  className,
}: SelectFieldProps<Value>) {
  return (
    <Field.Root
      className={cx(fieldStyles.field, className)}
      disabled={disabled}
    >
      <Select.Root
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next as Value);
        }}
        name={name}
        disabled={disabled}
      >
        <Select.Label className={fieldStyles.label}>{label}</Select.Label>
        <Select.Trigger className={cx(fieldStyles.box, styles.trigger)}>
          <Select.Value className={styles.value} />
          <Select.Icon className={styles.chevron}>
            <Icon glyph="chevron-down" size={20} />
          </Select.Icon>
        </Select.Trigger>
        {helper != null && (
          <Field.Description className={fieldStyles.helper}>
            {helper}
          </Field.Description>
        )}
        <Select.Portal>
          <Select.Positioner
            className={cx('zumpo', styles.positioner)}
            alignItemWithTrigger={false}
            sideOffset={4}
          >
            <Select.Popup className={styles.popup}>
              <Select.List className={styles.list}>
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    className={styles.option}
                  >
                    <span className={styles.text}>
                      <Select.ItemText className={styles.optionLabel}>
                        {option.label}
                      </Select.ItemText>
                      {option.detail && (
                        <span className={styles.detail}>{option.detail}</span>
                      )}
                    </span>
                    <Select.ItemIndicator className={styles.check}>
                      <Icon glyph="check" size={20} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </Field.Root>
  );
}
