import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', params.id)
    .eq('club_id', club.id)
    .single();

  if (!player) throw error(404, 'Player not found');

  return { targetPlayer: player };
};
