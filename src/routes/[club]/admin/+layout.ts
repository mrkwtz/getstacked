import { error } from '@sveltejs/kit';
import { isAdmin } from '$lib/members';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
  const { player } = await parent();
  if (!isAdmin(player)) throw error(403, 'Admin access required');
  return {};
};
