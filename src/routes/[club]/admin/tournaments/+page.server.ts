import { createUserClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const { data: tournaments } = await createUserClient(session!.access_token)
    .from('tournaments')
    .select('*')
    .eq('club_id', club.id)
    .order('date', { ascending: false });

  return { tournaments: tournaments ?? [] };
};
