import { describe, it, expect } from 'vitest';
import { isAdmin } from '$lib/members';

describe('isAdmin', () => {
  it('returns true for admin role', () => {
    expect(isAdmin({ role: 'admin' } as any)).toBe(true);
  });
  it('returns false for member role', () => {
    expect(isAdmin({ role: 'member' } as any)).toBe(false);
  });
});
