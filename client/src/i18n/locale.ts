/**
 * The languages the UI speaks. Adding one is listed in
 * docs/architecture.md#adding-a-language.
 */
export type Locale = 'en' | 'zh';

export const LOCALES: readonly Locale[] = ['en', 'zh'];

/** Each language's name in itself, as the footer's switch lists them. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  en: 'English',
  zh: '中文',
};

/** The `lang` the document carries for each, so fonts and readers follow. */
export const LOCALE_TAGS: Readonly<Record<Locale, string>> = {
  en: 'en',
  zh: 'zh-CN',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as string[]).includes(value);
}

/**
 * The language a first visit starts in: the browser's first language we
 * speak, in its order of preference, else English.
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const tag = language.toLowerCase();
    for (const locale of LOCALES) {
      if (tag === locale || tag.startsWith(`${locale}-`)) return locale;
    }
  }
  return 'en';
}
