import { createUserClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const supabase = createUserClient(session!.access_token);

  const [{ count: memberCount }, { count: tournamentCount }] = await Promise.all([
    supabase.from('club_members').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
  ]);

  return {
    memberCount: memberCount ?? 0,
    tournamentCount: tournamentCount ?? 0,
  };
};
