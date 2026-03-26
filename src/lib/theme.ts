export type Theme = 'light' | 'dark' | 'system';

const VALID_THEMES = new Set<string>(['light', 'dark', 'system']);

export function parseTheme(value: string | undefined): Theme {
  if (value && VALID_THEMES.has(value)) {
    return value as Theme;
  }
  return 'dark';
}
