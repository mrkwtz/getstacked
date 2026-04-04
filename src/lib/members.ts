import type { Member } from './types';

export function displayName(member: Pick<Member, 'first_name' | 'last_name' | 'nickname'>): string {
  return member.nickname?.trim() || `${member.first_name} ${member.last_name}`;
}

export function isAdmin(member: Pick<Member, 'role'>): boolean {
  return member.role === 'admin';
}

export function isGuest(member: Pick<Member, 'role'>): boolean {
  return member.role === 'guest';
}

export function isLastAdmin(members: Pick<Member, 'id' | 'role'>[], targetId: string): boolean {
  const admins = members.filter((m) => m.role === 'admin');
  return admins.length === 1 && admins[0].id === targetId;
}
