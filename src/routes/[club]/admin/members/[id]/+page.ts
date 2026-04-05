import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const [{ data: member }, { data: pendingInvite }, { data: clubMembers }] = await Promise.all([
    supabase
      .from('members')
      .select('*')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single(),
    supabase
      .from('club_invites')
      .select('id')
      .eq('club_id', club.id)
      .eq('member_id', params.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle(),
    supabase
      .from('members')
      .select('id, role')
      .eq('club_id', club.id),
  ]);

  if (!member) throw error(404, 'Member not found');

  return {
    targetMember: member,
    pendingInviteId: pendingInvite?.id ?? null,
    clubMembers: clubMembers ?? [],
  };
};
