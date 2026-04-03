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
    .from('members')
    .select('id')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();

  if (existing) throw redirect(303, `/${club.slug}`);

  // Check if invite has a member_id (variant 2: linking existing member)
  const linkedMember = invite.member_id ? true : false;

  return { clubName: club.name, clubSlug: club.slug, linkedMember };
};

export const actions: Actions = {
  default: async ({ params, request, locals: { safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (!session) throw redirect(303, `/auth/login?next=/invite/${params.token}`);

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

    // Already a member? Redirect straight to the club
    const { data: existing } = await service
      .from('members')
      .select('id')
      .eq('club_id', club.id)
      .eq('user_id', session.user.id)
      .single();
    if (existing) throw redirect(303, `/${club.slug}`);

    if (invite.member_id) {
      // Variant 2: Link account to existing member
      const { data: linked, error: linkError } = await service
        .from('members')
        .update({ user_id: session.user.id })
        .eq('id', invite.member_id)
        .is('user_id', null)
        .select('id');

      if (linkError) {
        if (linkError.code === '23505') throw redirect(303, `/${club.slug}`);
        throw error(500, 'Failed to link account');
      }
      if (!linked || linked.length === 0) {
        throw error(409, 'Member already linked to another account');
      }
    } else {
      // Variant 1: Create new member
      const formData = await request.formData();
      const firstName = formData.get('first_name')?.toString().trim() ?? '';
      const lastName = formData.get('last_name')?.toString().trim() ?? '';
      if (!firstName || !lastName) return { errorKey: 'error_required' };

      // Get next member number
      const { data: maxMember } = await service
        .from('members')
        .select('member_number')
        .eq('club_id', club.id)
        .order('member_number', { ascending: false })
        .limit(1)
        .single();
      const nextNumber = (maxMember?.member_number ?? 0) + 1;

      const { error: memberError } = await service
        .from('members')
        .insert({
          club_id: club.id,
          user_id: session.user.id,
          role: 'member',
          first_name: firstName,
          last_name: lastName,
          member_number: nextNumber,
        });

      if (memberError) {
        if (memberError.code === '23505') throw redirect(303, `/${club.slug}`);
        throw error(500, 'Failed to join club');
      }
    }

    await service
      .from('club_invites')
      .update({ used_at: new Date().toISOString(), used_by_user_id: session.user.id })
      .eq('id', params.token);

    throw redirect(303, `/${club.slug}`);
  }
};
