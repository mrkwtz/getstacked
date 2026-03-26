import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('club_id', club.id)
    .order('date', { ascending: false });

  return { tournaments: tournaments ?? [] };
};
