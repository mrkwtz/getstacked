import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, nickname, user_id, member_number')
    .eq('club_id', club.id)
    .order('member_number');

  return { players: players ?? [] };
};
