import type { Player } from './types';

export function displayName(player: Pick<Player, 'first_name' | 'last_name' | 'nickname'>): string {
  return player.nickname?.trim() || `${player.first_name} ${player.last_name}`;
}

export function isAdmin(player: Pick<Player, 'role'>): boolean {
  return player.role === 'admin';
}
