import type { ReactNode } from 'react';
import styles from './filter-chip.module.css';

export interface FilterChipProps {
  /** The chip whose filter is showing; exactly one in a row is. */
  selected?: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/** Zumpo/Filter chip: one kind of thing to show, in a row of them. */
export function FilterChip({
  selected = false,
  onSelect,
  children,
}: FilterChipProps) {
  return (
    <button
      type="button"
      className={styles.chip}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
