import {
  availableLanguageTags,
  sourceLanguageTag,
  type AvailableLanguageTag
} from '$lib/paraglide/runtime.js';

const COOKIE_NAME = 'lang';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function isAvailableLanguageTag(tag: string): tag is AvailableLanguageTag {
  return (availableLanguageTags as readonly string[]).includes(tag);
}

/** Detect language from Accept-Language header, returning first match or source language. */
export function detectLanguageFromHeader(acceptLanguage: string | null): AvailableLanguageTag {
  if (!acceptLanguage) return sourceLanguageTag;
  const preferred = acceptLanguage
    .split(',')
    .map((part) => {
      const [lang, q] = part.trim().split(';q=');
      return { lang: lang.trim().split('-')[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of preferred) {
    if (isAvailableLanguageTag(lang)) return lang;
  }
  return sourceLanguageTag;
}

/** Set the language cookie. */
export function setLanguageCookie(document: Document, lang: AvailableLanguageTag): void {
  document.cookie = `${COOKIE_NAME}=${lang};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

/** Read the language cookie value (or null). */
export function getLanguageCookie(cookieHeader: string | null): AvailableLanguageTag | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (match && isAvailableLanguageTag(match[1])) return match[1] as AvailableLanguageTag;
  return null;
}
