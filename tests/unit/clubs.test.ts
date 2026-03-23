import { describe, it, expect } from 'vitest';
import { isValidSlug } from '$lib/clubs';

describe('isValidSlug', () => {
  it('accepts lowercase alphanumeric with hyphens', () => {
    expect(isValidSlug('my-poker-club')).toBe(true);
  });
  it('rejects uppercase', () => {
    expect(isValidSlug('My-Club')).toBe(false);
  });
  it('rejects spaces', () => {
    expect(isValidSlug('my club')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidSlug('')).toBe(false);
  });
});
