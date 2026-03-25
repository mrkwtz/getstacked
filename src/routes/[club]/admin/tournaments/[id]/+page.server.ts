import { fail, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import { calculatePrizePool } from '$lib/tournaments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const userClient = createUserClient(session!.access_token);

  const { data: tournament } = await userClient
    .from('tournaments')
    .select('*, blind_structures(name), prize_structures(name)')
    .eq('id', params.id)
    .eq('club_id', club.id)
    .single();

  if (!tournament) throw error(404, 'Tournament not found');

  const [{ data: players }, { data: members }] = await Promise.all([
    userClient
      .from('tournament_players')
      .select('*, club_members!tournament_players_member_club_id_member_user_id_fkey(display_name)')
      .eq('tournament_id', params.id)
      .order('created_at'),
    userClient
      .from('club_members')
      .select('user_id, display_name')
      .eq('club_id', club.id)
      .order('display_name'),
  ]);

  const registeredIds = new Set((players ?? []).map((p) => p.member_user_id).filter(Boolean));
  const availableMembers = (members ?? []).filter((m) => !registeredIds.has(m.user_id));

  const prizePool = calculatePrizePool(
    (players ?? []).length,
    tournament.buy_in,
    0, 0, 0, 0
  );

  return {
    tournament,
    players: players ?? [],
    availableMembers,
    prizePool,
  };
};

export const actions: Actions = {
  add_player: async ({ request, params, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const memberId = formData.get('member_id')?.toString().trim() ?? '';
    const guestName = formData.get('guest_name')?.toString().trim() ?? '';

    const service = createServiceClient();

    if (memberId) {
      // Verify member belongs to this club
      const { data: clubMember } = await service
        .from('club_members')
        .select('user_id')
        .eq('club_id', club.id)
        .eq('user_id', memberId)
        .single();
      if (!clubMember) return fail(400, { errorKey: 'error_required' });

      // Check not already registered
      const { data: existing } = await service
        .from('tournament_players')
        .select('id')
        .eq('tournament_id', params.id)
        .eq('member_user_id', memberId)
        .single();
      if (existing) return fail(400, { errorKey: 'error_duplicate_player' });

      const { error: insertError } = await service.from('tournament_players').insert({
        tournament_id: params.id,
        member_club_id: club.id,
        member_user_id: memberId,
        guest_name: null,
      });
      if (insertError) return fail(500, { errorKey: 'server_error' });

    } else if (guestName) {
      const { error: insertError } = await service.from('tournament_players').insert({
        tournament_id: params.id,
        member_club_id: null,
        member_user_id: null,
        guest_name: guestName,
      });
      if (insertError) return fail(500, { errorKey: 'server_error' });

    } else {
      return fail(400, { errorKey: 'error_required' });
    }

    return {};
  },

  remove_player: async ({ request, params, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    // Verify tournament is in registration
    const { data: tournament } = await service
      .from('tournaments')
      .select('status')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'registration') return fail(400, { errorKey: 'error_tournament_not_open' });

    const { error: deleteError } = await service
      .from('tournament_players')
      .delete()
      .eq('id', playerId)
      .eq('tournament_id', params.id);

    if (deleteError) return fail(500, { errorKey: 'server_error' });
    return {};
  },
};
