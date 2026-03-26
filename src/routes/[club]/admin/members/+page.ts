import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from('club_members').select('*').eq('club_id', club.id).order('joined_at'),
    supabase
      .from('club_invites')
      .select('id, created_at, expires_at, used_at')
      .eq('club_id', club.id)
      .is('used_at', null)
      .order('created_at', { ascending: false }),
  ]);

  return { members: members ?? [], invites: invites ?? [] };
};
