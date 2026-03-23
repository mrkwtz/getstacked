import type { ClubMember } from './types';

export function isAdmin(member: ClubMember): boolean {
  return member.role === 'admin';
}
