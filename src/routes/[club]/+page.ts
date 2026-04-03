import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ count: memberCount }, { count: tournamentCount }] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
  ]);

  return {
    memberCount: memberCount ?? 0,
    tournamentCount: tournamentCount ?? 0,
  };
};
