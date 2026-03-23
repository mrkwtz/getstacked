import { error, fail, redirect } from '@sveltejs/kit';
import { isValidSlug } from '$lib/clubs';
import { isAdmin } from '$lib/members';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, locals: { supabase }, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

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

    // Redirect to new slug if it changed
    if (slug !== club.slug) throw redirect(303, `/${slug}/admin/settings`);
    return { saved: true };
  }
};
