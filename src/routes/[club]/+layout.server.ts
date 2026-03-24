import { error, redirect } from '@sveltejs/kit';
import { createServiceClient } from '$lib/server/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) throw redirect(303, '/auth/login');

  const service = createServiceClient();

  const { data: club } = await service
    .from('clubs')
    .select('*')
    .eq('slug', params.club)
    .single();

  if (!club) throw error(404, 'Club not found');

  const { data: member } = await service
    .from('club_members')
    .select('*')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();

  if (!member) throw error(403, 'You are not a member of this club');

  return { club, member };
};
