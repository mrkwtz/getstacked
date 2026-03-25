import { fail, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const { data: members } = await createUserClient(session!.access_token)
    .from('club_members')
    .select('*')
    .eq('club_id', club.id)
    .order('joined_at');

  return { members: members ?? [] };
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
  invite_member: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';
    const displayName = formData.get('display_name')?.toString().trim() ?? '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { errorKey: 'auth_invalid_email' });
    }
    if (!displayName) return fail(400, { errorKey: 'error_required' });

    const service = createServiceClient();

    // Look up existing user by email, or invite them
    const { data: { users } } = await service.auth.admin.listUsers({ perPage: 1000 });
    let targetUser = users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;

    if (!targetUser) {
      const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
        data: { invited_to_club: club.id }
      });
      if (inviteError) return fail(500, { errorKey: 'server_error' });
      targetUser = invited.user;
    }

    const { error: memberError } = await service
      .from('club_members')
      .insert({ club_id: club.id, user_id: targetUser.id, role: 'member', display_name: displayName });

    if (memberError) {
      if (memberError.code === '23505') return fail(400, { errorKey: 'error_already_member' });
      return fail(500, { errorKey: 'server_error' });
    }

    return { invited: true };
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
