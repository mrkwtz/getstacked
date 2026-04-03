import type { Member } from './types';

export function displayName(member: Pick<Member, 'first_name' | 'last_name' | 'nickname'>): string {
  return member.nickname?.trim() || `${member.first_name} ${member.last_name}`;
}

export function isAdmin(member: Pick<Member, 'role'>): boolean {
  return member.role === 'admin';
}
