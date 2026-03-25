import { fail, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const userClient = createUserClient(session!.access_token);
  const [{ data: members }, { data: invites }] = await Promise.all([
    userClient.from('club_members').select('*').eq('club_id', club.id).order('joined_at'),
    userClient.from('club_invites').select('id, created_at, expires_at, used_at')
      .eq('club_id', club.id).is('used_at', null).order('created_at', { ascending: false }),
  ]);

  return { members: members ?? [], invites: invites ?? [] };
};

async function getClubAndMember(params: { club: string }, safeGetSession: () => Promise<{ session: import('@supabase/supabase-js').Session | null }>) {
  const { session } = await safeGetSession();
  if (!session) throw error(401, 'Unauthorized');
  const supabase = createUserClient(session.access_token);
  const { data: club } = await supabase.from('clubs').select('*').eq('slug', params.club).single();
  if (!club) throw error(404, 'Club not found');
  const { data: member } = await supabase
    .from('club_members').select('*').eq('club_id', club.id).eq('user_id', session.user.id).single();
  if (!member) throw error(403, 'Not a member');
  return { club, member };
}

export const actions: Actions = {
  create_invite: async ({ params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const { data: invite, error: insertError } = await createServiceClient()
      .from('club_invites')
      .insert({ club_id: club.id, created_by: member.user_id })
      .select('id')
      .single();

    if (insertError || !invite) return fail(500, { errorKey: 'server_error' });
    return { createdInviteId: invite.id };
  },

  revoke_invite: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const inviteId = formData.get('invite_id')?.toString() ?? '';

    const { error: deleteError } = await createServiceClient()
      .from('club_invites')
      .delete()
      .eq('id', inviteId)
      .eq('club_id', club.id);

    if (deleteError) return fail(500, { errorKey: 'server_error' });
    return {};
  },

  remove_member: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member: currentMember } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(currentMember)) throw error(403, 'Admin access required');
    const formData = await request.formData();
    const userId = formData.get('user_id')?.toString() ?? '';

    if (userId === currentMember.user_id) {
      return fail(400, { errorKey: 'error_cannot_remove_self' });
    }

    const service = createServiceClient();
    const { error: deleteError } = await service
      .from('club_members')
      .delete()
      .eq('club_id', club.id)
      .eq('user_id', userId);

    if (deleteError) return fail(500, { errorKey: 'server_error' });
    return {};
  }
};
