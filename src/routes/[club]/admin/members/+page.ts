import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, nickname, user_id, member_number, role, created_at')
    .eq('club_id', club.id)
    .order('member_number');

  return { members: members ?? [] };
};
