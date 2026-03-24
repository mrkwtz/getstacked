import { redirect } from '@sveltejs/kit';
import { createServiceClient } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) throw redirect(303, '/auth/login');

  const clubId = session.user.user_metadata?.invited_to_club as string | undefined;
  if (!clubId) throw redirect(303, '/');

  const service = createServiceClient();
  const { data: club } = await service
    .from('clubs')
    .select('name, slug')
    .eq('id', clubId)
    .single();

  if (!club) throw redirect(303, '/');

  return { club };
};

export const actions: Actions = {
  default: async ({ locals: { safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (!session) throw redirect(303, '/auth/login');

    const clubId = session.user.user_metadata?.invited_to_club as string | undefined;
    if (!clubId) throw redirect(303, '/');

    const service = createServiceClient();
    const { data: club } = await service
      .from('clubs')
      .select('slug')
      .eq('id', clubId)
      .single();

    await service.auth.admin.updateUserById(session.user.id, {
      user_metadata: { invited_to_club: null }
    });

    throw redirect(303, `/${club?.slug ?? ''}`);
  }
};
