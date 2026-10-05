import { useId, type SVGProps } from 'react';
import type { Colour, Fill, Shape } from '../../../../shared/trios';
import { cx } from '../cx';
import styles from './trios-shape.module.css';

export interface TriosShapeProps {
  shape: Shape;
  fill: Fill;
  colour: Colour;
  /** Its box in pixels: 40 on a Regular card, 24 on a Compact, 16 on a Mini. */
  size?: number;
  className?: string;
}

type SVGAttrs = Pick<SVGProps<SVGElement>, 'className'>;

/** The outline of each shape in its 40 × 40 box, as in Figma. */
function Outline({ shape, ...props }: { shape: Shape } & SVGAttrs) {
  switch (shape) {
    case 'circle':
      return <circle cx={20} cy={20} r={18} {...props} />;
    case 'square':
      return <rect x={4} y={4} width={32} height={32} rx={4} {...props} />;
    case 'triangle':
      return <path d="M20 2L38.5 35H1.5Z" {...props} />;
  }
}

/** Stripes 1.5 wide every 5, across the whole box, clipped to the shape. */
const STRIPES = Array.from({ length: 8 }, (_, index) => 1.75 + index * 5);

/**
 * Zumpo/Trios shape: one shape of a Trios card, solid, striped or in
 * outline, in one of the three Trios colours. It scales as a whole, stroke
 * included, as an instance does in Figma.
 */
export function TriosShape({
  shape,
  fill,
  colour,
  size = 40,
  className,
}: TriosShapeProps) {
  const clip = useId();
  return (
    <svg
      className={cx(styles.shape, styles[colour], className)}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      {fill === 'striped' && (
        <>
          <clipPath id={clip}>
            <Outline shape={shape} />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            {STRIPES.map((x) => (
              <rect key={x} x={x} y={0} width={1.5} height={40} />
            ))}
          </g>
        </>
      )}
      <Outline
        shape={shape}
        className={fill === 'solid' ? styles.solid : styles.outline}
      />
    </svg>
  );
}
