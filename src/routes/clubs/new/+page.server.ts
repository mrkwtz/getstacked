import { fail, redirect } from '@sveltejs/kit';
import { createServiceClient } from '$lib/server/supabase';
import { isValidSlug } from '$lib/clubs';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) throw redirect(303, '/auth/login');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals: { safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (!session) throw redirect(303, '/auth/login');

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() ?? '';
    const slug = formData.get('slug')?.toString().trim() ?? '';
    const displayName = formData.get('display_name')?.toString().trim() ?? '';

    if (!name) return fail(400, { errorKey: 'error_required', field: 'name' });
    if (!isValidSlug(slug)) return fail(400, { errorKey: 'error_invalid_slug' });
    if (!displayName) return fail(400, { errorKey: 'error_required', field: 'display_name' });

    const service = createServiceClient();

    const { data: club, error: clubError } = await service
      .from('clubs')
      .insert({ name, slug })
      .select('id')
      .single();

    if (clubError) {
      if (clubError.code === '23505') return fail(400, { errorKey: 'error_slug_taken' });
      return fail(500, { errorKey: 'server_error', errorMessage: clubError.message });
    }

    const { error: memberError } = await service
      .from('club_members')
      .insert({ club_id: club.id, user_id: session.user.id, role: 'admin', display_name: displayName });

    if (memberError) return fail(500, { errorKey: 'server_error', errorMessage: memberError.message });

    throw redirect(303, `/${slug}`);
  }
};
