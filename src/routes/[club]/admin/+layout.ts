import { error } from '@sveltejs/kit';
import { isAdmin } from '$lib/players';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
  const { member } = await parent();
  if (!isAdmin(member)) throw error(403, 'Admin access required');
  return {};
};
