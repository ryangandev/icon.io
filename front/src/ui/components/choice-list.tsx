import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { cx } from '../cx';
import { Icon } from './icon';
import type { SelectOption } from './select-field';
import styles from './select-field.module.css';

export interface ChoiceListProps<Value extends string> {
  /** The group's accessible name. */
  label: string;
  options: readonly SelectOption<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  className?: string;
}

/**
 * Zumpo/Select options laid out in the page rather than in a menu: a radio
 * group for a choice worth seeing whole, such as a board and its best time.
 */
export function ChoiceList<Value extends string>({
  label,
  options,
  value,
  onValueChange,
  className,
}: ChoiceListProps<Value>) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onValueChange(next as Value)}
      className={cx(styles.choices, className)}
    >
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          className={cx(
            styles.option,
            styles.choice,
            option.detail && styles.withDetail,
          )}
        >
          <span className={styles.text}>
            <span className={styles.optionLabel}>{option.label}</span>
            {option.detail && (
              <span className={styles.detail}>{option.detail}</span>
            )}
          </span>
          <Radio.Indicator className={styles.check}>
            <Icon glyph="check" size={20} />
          </Radio.Indicator>
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
