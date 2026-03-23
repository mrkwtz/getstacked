import { error } from '@sveltejs/kit';
import { isAdmin } from '$lib/members';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
  const { member } = await parent();
  if (!isAdmin(member)) throw error(403, 'Admin access required');
  return {};
};
