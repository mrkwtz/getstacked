export function parseTheme(value: string | undefined): 'dark' | 'light' {
  return value === 'light' ? 'light' : 'dark';
}
