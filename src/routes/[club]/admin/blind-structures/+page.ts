import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: structures } = await supabase
    .from('blind_structures')
    .select('id, name, levels')
    .eq('club_id', club.id)
    .order('name');

  return {
    structures: (structures ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      levels: s.levels as { small_blind: number; big_blind: number; ante: number; duration_minutes: number }[],
    })),
  };
};
