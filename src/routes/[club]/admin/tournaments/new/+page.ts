import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ data: blindStructures }, { data: prizeStructures }] = await Promise.all([
    supabase.from('blind_structures').select('id, name').eq('club_id', club.id).order('name'),
    supabase.from('prize_structures').select('id, name').eq('club_id', club.id).order('name'),
  ]);

  return {
    blindStructures: blindStructures ?? [],
    prizeStructures: prizeStructures ?? [],
  };
};
