import { describe, it, expect } from 'vitest';
import { displayName, isAdmin } from '$lib/players';

describe('displayName', () => {
  it('returns nickname when set', () => {
    expect(displayName({ first_name: 'John', last_name: 'Doe', nickname: 'JD' })).toBe('JD');
  });

  it('returns "first last" when no nickname', () => {
    expect(displayName({ first_name: 'John', last_name: 'Doe', nickname: null })).toBe('John Doe');
  });

  it('returns "first last" when nickname is empty string', () => {
    expect(displayName({ first_name: 'John', last_name: 'Doe', nickname: '' })).toBe('John Doe');
  });
});

describe('isAdmin', () => {
  it('returns true for admin role', () => {
    expect(isAdmin({ role: 'admin' } as any)).toBe(true);
  });

  it('returns false for member role', () => {
    expect(isAdmin({ role: 'member' } as any)).toBe(false);
  });
});
