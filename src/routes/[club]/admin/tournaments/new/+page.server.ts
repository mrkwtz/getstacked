import { fail, redirect, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const userClient = createUserClient(session!.access_token);
  const [{ data: blindStructures }, { data: prizeStructures }] = await Promise.all([
    userClient.from('blind_structures').select('id, name').eq('club_id', club.id).order('name'),
    userClient.from('prize_structures').select('id, name').eq('club_id', club.id).order('name'),
  ]);

  return {
    blindStructures: blindStructures ?? [],
    prizeStructures: prizeStructures ?? [],
  };
};

export const actions: Actions = {
  create_tournament: async ({ request, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() ?? '';
    const date = formData.get('date')?.toString() ?? '';
    const format = formData.get('format')?.toString() ?? '';
    const buyInRaw = formData.get('buy_in')?.toString() ?? '';
    const rebuyRaw = formData.get('rebuy_amount')?.toString() ?? '';
    const addonRaw = formData.get('addon_amount')?.toString() ?? '';
    const blindStructureId = formData.get('blind_structure_id')?.toString() ?? '';
    const prizeStructureId = formData.get('prize_structure_id')?.toString() ?? '';

    if (!name || !date || !buyInRaw || !blindStructureId || !prizeStructureId) {
      return fail(400, { errorKey: 'error_required' });
    }
    if (!['freezeout', 'rebuy'].includes(format)) {
      return fail(400, { errorKey: 'error_required' });
    }

    const buyIn = Math.round(parseFloat(buyInRaw) * 100);
    if (buyIn <= 0) return fail(400, { errorKey: 'error_required' });

    let rebuyAmount: number | null = null;
    let addonAmount: number | null = null;
    if (format === 'rebuy') {
      if (!rebuyRaw) return fail(400, { errorKey: 'error_required' });
      rebuyAmount = Math.round(parseFloat(rebuyRaw) * 100);
      if (rebuyAmount <= 0) return fail(400, { errorKey: 'error_required' });
      if (addonRaw) {
        addonAmount = Math.round(parseFloat(addonRaw) * 100);
        if (addonAmount <= 0) return fail(400, { errorKey: 'error_required' });
      }
    }

    const service = createServiceClient();

    // Verify structures belong to this club
    const [{ data: bs }, { data: ps }] = await Promise.all([
      service.from('blind_structures').select('id').eq('id', blindStructureId).eq('club_id', club.id).single(),
      service.from('prize_structures').select('id').eq('id', prizeStructureId).eq('club_id', club.id).single(),
    ]);
    if (!bs || !ps) return fail(400, { errorKey: 'error_required' });

    const { data: tournament, error: insertError } = await service
      .from('tournaments')
      .insert({
        club_id: club.id,
        name,
        date,
        format,
        buy_in: buyIn,
        rebuy_amount: rebuyAmount,
        addon_amount: addonAmount,
        blind_structure_id: blindStructureId,
        prize_structure_id: prizeStructureId,
        status: 'registration',
      })
      .select('id')
      .single();

    if (insertError || !tournament) return fail(500, { errorKey: 'server_error' });

    redirect(303, `/${club.slug}/admin/tournaments/${tournament.id}`);
  },
};
