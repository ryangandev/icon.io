import type { SVGProps } from 'react';
import { glyphs, type GlyphName } from '../generated/glyphs';

export type { GlyphName };

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  glyph: GlyphName;
  /** Rendered size in px; strokes scale with it, as in Figma. */
  size?: number;
  /** Accessible name. Without it the icon is decorative and hidden. */
  label?: string;
}

/** A Zumpo line icon: 24 × 24, 2 px round strokes, drawn in currentColor. */
export function Icon({ glyph, size = 24, label, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true })}
      {...rest}
    >
      {glyphs[glyph].map((part, index) => (
        <path
          key={index}
          d={part.d}
          transform={`translate(${part.x} ${part.y})`}
          fill={'fill' in part ? 'currentColor' : undefined}
        />
      ))}
    </svg>
  );
}
