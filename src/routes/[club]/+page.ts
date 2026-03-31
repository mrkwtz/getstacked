import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ count: playerCount }, { count: tournamentCount }] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
  ]);

  return {
    playerCount: playerCount ?? 0,
    tournamentCount: tournamentCount ?? 0,
  };
};
