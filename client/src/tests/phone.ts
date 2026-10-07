import { vi } from 'vitest';
import { ONE_COLUMN, PHONE } from '../shell/use-media-query';

/** Lays the app out as on a phone until the mocks are restored. */
export function onPhone() {
  const desktop = window.matchMedia;
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    ...desktop(query),
    matches: query === PHONE || query === ONE_COLUMN,
  }));
}
