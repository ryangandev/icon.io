import { useCallback, useEffect, useState } from 'react';

/** How long a button says "Copied" before it goes back. */
const COPIED_MS = 2000;

/**
 * Copies `text` on request and says so for a moment. Clipboard access can be
 * refused; then nothing is said, and the text is still wherever it was shown.
 */
export function useCopy(text: string) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Refused; see above.
    }
  }, [text]);

  return { copied, copy };
}
