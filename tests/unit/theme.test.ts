import { describe, it, expect } from 'vitest';

import { parseTheme } from '../../src/lib/theme';

describe('parseTheme', () => {
  it('returns dark by default when cookie is missing', () => {
    expect(parseTheme(undefined)).toBe('dark');
  });
  it('returns dark for "dark"', () => {
    expect(parseTheme('dark')).toBe('dark');
  });
  it('returns light for "light"', () => {
    expect(parseTheme('light')).toBe('light');
  });
  it('returns dark for unexpected values', () => {
    expect(parseTheme('invalid')).toBe('dark');
  });
});
