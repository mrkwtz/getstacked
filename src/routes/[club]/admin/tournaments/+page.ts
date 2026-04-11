import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [
    { data: tournaments },
    { count: blindStructureCount },
    { count: prizeStructureCount },
  ] = await Promise.all([
    supabase
      .from('tournaments')
      .select('*')
      .eq('club_id', club.id)
      .order('date', { ascending: false }),
    supabase
      .from('blind_structures')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', club.id),
    supabase
      .from('prize_structures')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', club.id),
  ]);

  return {
    tournaments: tournaments ?? [],
    blindStructureCount: blindStructureCount ?? 0,
    prizeStructureCount: prizeStructureCount ?? 0,
  };
};
