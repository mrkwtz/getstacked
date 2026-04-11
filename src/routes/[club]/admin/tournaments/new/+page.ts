import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ data: blindStructures }, { data: prizeStructures }] = await Promise.all([
    supabase.from('blind_structures').select('id, name, levels').eq('club_id', club.id).order('name'),
    supabase.from('prize_structures').select('id, name, payouts').eq('club_id', club.id).order('name'),
  ]);

  return {
    blindStructures: (blindStructures ?? []) as { id: string; name: string; levels: unknown }[],
    prizeStructures: (prizeStructures ?? []) as { id: string; name: string; payouts: unknown }[],
  };
};
