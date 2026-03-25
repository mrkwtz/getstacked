import { error, fail, redirect } from '@sveltejs/kit';
import { isValidSlug } from '$lib/clubs';
import { isAdmin } from '$lib/members';
import { createUserClient, createServiceClient } from '$lib/server/supabase';
import type { Actions } from './$types';

async function getAdminContext(params: { club: string }, safeGetSession: () => Promise<{ session: import('@supabase/supabase-js').Session | null }>) {
  const { session } = await safeGetSession();
  if (!session) throw error(401, 'Unauthorized');
  const supabase = createUserClient(session.access_token);
  const { data: club } = await supabase.from('clubs').select('*').eq('slug', params.club).single();
  if (!club) throw error(404, 'Club not found');
  const { data: member } = await supabase
    .from('club_members').select('*').eq('club_id', club.id).eq('user_id', session.user.id).single();
  if (!member || !isAdmin(member)) throw error(403, 'Admin access required');
  return { club, supabase };
}

export const actions: Actions = {
  update: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, supabase } = await getAdminContext(params, safeGetSession);

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() ?? '';
    const slug = formData.get('slug')?.toString().trim() ?? '';

    if (!name) return fail(400, { errorKey: 'error_required' });
    if (!isValidSlug(slug)) return fail(400, { errorKey: 'error_invalid_slug' });

    const { error: updateError } = await supabase
      .from('clubs')
      .update({ name, slug })
      .eq('id', club.id);

    if (updateError) {
      if (updateError.code === '23505') return fail(400, { errorKey: 'error_slug_taken' });
      return fail(500, { errorKey: 'server_error' });
    }

    if (slug !== club.slug) throw redirect(303, `/${slug}/admin/settings`);
    return { saved: true };
  },

  delete_club: async ({ request, params, locals: { safeGetSession } }) => {
    const { club } = await getAdminContext(params, safeGetSession);

    const formData = await request.formData();
    const confirmName = formData.get('confirm_name')?.toString().trim() ?? '';

    if (confirmName !== club.name) return fail(400, { errorKey: 'error_club_name_mismatch', action: 'delete' });

    const { error: deleteError } = await createServiceClient()
      .from('clubs')
      .delete()
      .eq('id', club.id);

    if (deleteError) return fail(500, { errorKey: 'server_error', action: 'delete' });

    throw redirect(303, '/');
  },
};
