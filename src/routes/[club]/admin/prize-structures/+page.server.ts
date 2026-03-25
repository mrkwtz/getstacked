import { fail, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import { validatePayouts } from '$lib/tournaments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const { data: structures } = await createUserClient(session!.access_token)
    .from('prize_structures')
    .select('*, tournaments(id)')
    .eq('club_id', club.id)
    .order('name');

  return {
    structures: (structures ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      payouts: s.payouts as { position: number; percentage: number }[],
      in_use: Array.isArray(s.tournaments) && s.tournaments.length > 0,
    })),
  };
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
  create_prize_structure: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() ?? '';
    if (!name) return fail(400, { errorKey: 'error_required' });

    const positions = formData.getAll('position').map(Number);
    const percentages = formData.getAll('percentage').map(Number);

    if (positions.length === 0) return fail(400, { errorKey: 'error_required' });

    const payouts = positions.map((pos, i) => ({
      position: pos,
      percentage: percentages[i] ?? 0,
    }));

    const validationError = validatePayouts(payouts);
    if (validationError) return fail(400, { errorKey: validationError });

    const service = createServiceClient();
    const { error: insertError } = await service
      .from('prize_structures')
      .insert({ club_id: club.id, name, payouts });

    if (insertError) return fail(500, { errorKey: 'server_error' });
    return { created: true };
  },

  delete_prize_structure: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const id = formData.get('id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: linked } = await service
      .from('tournaments')
      .select('id')
      .eq('prize_structure_id', id)
      .eq('club_id', club.id)
      .limit(1);

    if (linked && linked.length > 0) return fail(400, { errorKey: 'error_structure_in_use' });

    const { error: deleteError } = await service
      .from('prize_structures')
      .delete()
      .eq('id', id)
      .eq('club_id', club.id);

    if (deleteError) return fail(500, { errorKey: 'server_error' });
    return {};
  },
};
