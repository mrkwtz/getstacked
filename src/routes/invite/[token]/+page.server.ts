import { error, redirect } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();

  if (!session) {
    throw redirect(303, `/auth/login?next=/invite/${params.token}`);
  }

  const service = createServiceClient();
  const { data: invite } = await service
    .from('club_invites')
    .select('*, clubs(id, name, slug)')
    .eq('id', params.token)
    .single();

  if (!invite || !invite.clubs) throw error(404, 'Invite not found');
  if (invite.used_at) throw error(410, 'Invite already used');
  if (new Date(invite.expires_at) < new Date()) throw error(410, 'Invite has expired');

  const club = invite.clubs as { id: string; name: string; slug: string };

  // Already a member? Redirect straight to the club
  const { data: existing } = await createUserClient(session.access_token)
    .from('club_members')
    .select('user_id')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();

  if (existing) throw redirect(303, `/${club.slug}`);

  return { clubName: club.name, clubSlug: club.slug };
};

export const actions: Actions = {
  default: async ({ params, request, locals: { safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (!session) throw redirect(303, `/auth/login?next=/invite/${params.token}`);

    const formData = await request.formData();
    const displayName = formData.get('display_name')?.toString().trim() ?? '';
    if (!displayName) return { errorKey: 'error_required' };

    const service = createServiceClient();

    const { data: invite } = await service
      .from('club_invites')
      .select('*, clubs(id, name, slug)')
      .eq('id', params.token)
      .single();

    if (!invite || !invite.clubs) throw error(404, 'Invite not found');
    if (invite.used_at) return { errorKey: 'invite_already_used' };
    if (new Date(invite.expires_at) < new Date()) return { errorKey: 'invite_expired' };

    const club = invite.clubs as { id: string; name: string; slug: string };

    const { error: memberError } = await service
      .from('club_members')
      .insert({ club_id: club.id, user_id: session.user.id, role: 'member', display_name: displayName });

    if (memberError) {
      if (memberError.code === '23505') throw redirect(303, `/${club.slug}`);
      throw error(500, 'Failed to join club');
    }

    await service
      .from('club_invites')
      .update({ used_at: new Date().toISOString(), used_by_user_id: session.user.id })
      .eq('id', params.token);

    throw redirect(303, `/${club.slug}`);
  }
};
