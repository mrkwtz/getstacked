import { describe, it, expect } from 'vitest';
import { displayName, isAdmin, isGuest, isLastAdmin } from '$lib/members';

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

describe('isGuest', () => {
  it('returns true for guest role', () => {
    expect(isGuest({ role: 'guest' } as any)).toBe(true);
  });

  it('returns false for member role', () => {
    expect(isGuest({ role: 'member' } as any)).toBe(false);
  });

  it('returns false for admin role', () => {
    expect(isGuest({ role: 'admin' } as any)).toBe(false);
  });
});

describe('isLastAdmin', () => {
  const members = [
    { id: '1', role: 'admin' },
    { id: '2', role: 'member' },
    { id: '3', role: 'guest' },
  ] as any[];

  it('returns true when target is the only admin', () => {
    expect(isLastAdmin(members, '1')).toBe(true);
  });

  it('returns false when there are multiple admins', () => {
    const twoAdmins = [
      { id: '1', role: 'admin' },
      { id: '2', role: 'admin' },
    ] as any[];
    expect(isLastAdmin(twoAdmins, '1')).toBe(false);
  });

  it('returns false when target is not an admin', () => {
    expect(isLastAdmin(members, '2')).toBe(false);
  });

  it('returns false for empty list', () => {
    expect(isLastAdmin([], '1')).toBe(false);
  });
});
