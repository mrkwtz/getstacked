import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: structures } = await supabase
    .from('prize_structures')
    .select('id, name, payouts')
    .eq('club_id', club.id)
    .order('name');

  return {
    structures: (structures ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      payouts: s.payouts as { position: number; percentage: number }[],
    })),
  };
};
