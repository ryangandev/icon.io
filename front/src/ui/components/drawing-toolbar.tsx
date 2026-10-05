import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { CSSProperties } from 'react';
import { cx } from '../cx';
import { brushes, type BrushName } from '../generated/brushes';
import { Button } from './button';
import styles from './drawing-toolbar.module.css';

/** Brush widths in canvas pixels, smallest first. */
export const BRUSH_SIZES = [4, 10, 18, 28] as const;
export type BrushSize = (typeof BRUSH_SIZES)[number];

export interface DrawingToolbarProps {
  colour: BrushName;
  onColourChange: (colour: BrushName) => void;
  size: BrushSize;
  onSizeChange: (size: BrushSize) => void;
  onUndo: () => void;
  onClear: () => void;
  className?: string;
}

function title(name: string) {
  return name[0].toUpperCase() + name.slice(1);
}

/**
 * Zumpo/Drawing toolbar: the drawer's controls during the drawing phase. It
 * lays itself out as the Phone variant when its container is narrow.
 */
export function DrawingToolbar({
  colour,
  onColourChange,
  size,
  onSizeChange,
  onUndo,
  onClear,
  className,
}: DrawingToolbarProps) {
  return (
    <div className={cx(styles.container, className)}>
      <div className={styles.toolbar} role="toolbar" aria-label="Drawing tools">
        <RadioGroup
          className={styles.colours}
          aria-label="Colour"
          value={colour}
          onValueChange={(value) => onColourChange(value as BrushName)}
        >
          {brushes.map((brush) => (
            <Radio.Root
              key={brush.name}
              value={brush.name}
              className={styles.swatch}
              style={{ background: brush.color }}
              aria-label={title(brush.name)}
            />
          ))}
        </RadioGroup>
        <span className={styles.divider} />
        <div className={styles.tools}>
          <RadioGroup
            className={styles.sizes}
            aria-label="Brush size"
            value={size}
            onValueChange={(value) => onSizeChange(value as BrushSize)}
          >
            {BRUSH_SIZES.map((width) => (
              <Radio.Root
                key={width}
                value={width}
                className={styles.size}
                aria-label={`${width} pixels`}
              >
                <span
                  className={styles.dot}
                  style={{ '--dot': `${width}px` } as CSSProperties}
                />
              </Radio.Root>
            ))}
          </RadioGroup>
          <span className={styles.spacer} />
          <div className={styles.actions}>
            <Button
              variant="secondary"
              icon="undo"
              onClick={onUndo}
              iconOnlyWhenNarrow
            >
              Undo
            </Button>
            <Button
              variant="secondary"
              icon="trash"
              onClick={onClear}
              iconOnlyWhenNarrow
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
