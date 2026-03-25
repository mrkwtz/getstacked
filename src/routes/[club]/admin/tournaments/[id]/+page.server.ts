import { fail, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import { calculatePrizePool, calculatePayouts } from '$lib/tournaments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const userClient = createUserClient(session!.access_token);

  const { data: tournament } = await userClient
    .from('tournaments')
    .select('*, blind_structures(name), prize_structures(name, payouts)')
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

  const allPlayers = players ?? [];
  const totalRebuys = allPlayers.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = allPlayers.filter((p) => p.addon).length;

  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
  );

  const prizeStructure = tournament.prize_structures
    ? { payouts: tournament.prize_structures.payouts as { position: number; percentage: number }[] }
    : null;

  return {
    tournament,
    players: allPlayers,
    availableMembers,
    prizePool,
    prizeStructure,
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
  add_player: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
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

  remove_player: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
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

  start_tournament: async ({ params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'registration') return fail(400, { errorKey: 'error_tournament_not_open' });

    const { count } = await service
      .from('tournament_players')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', params.id);
    if ((count ?? 0) < 2) return fail(400, { errorKey: 'tournament_min_players_error' });

    const { error: updateError } = await service
      .from('tournaments')
      .update({ status: 'running' })
      .eq('id', params.id);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  bust_player: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });

    const { data: players } = await service
      .from('tournament_players')
      .select('id, finish_position')
      .eq('tournament_id', params.id);
    if (!players) return fail(500, { errorKey: 'server_error' });

    const player = players.find((p) => p.id === playerId);
    if (!player) return fail(400, { errorKey: 'server_error' });
    if (player.finish_position !== null) return fail(400, { errorKey: 'server_error' });

    // next position = MAX of {1..total_players} not currently assigned
    const totalPlayers = players.length;
    const assigned = new Set(players.map((p) => p.finish_position).filter((p) => p !== null));
    const available = Array.from({ length: totalPlayers }, (_, i) => i + 1).filter((p) => !assigned.has(p));
    const nextPosition = Math.max(...available);

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ finish_position: nextPosition })
      .eq('id', playerId)
      .eq('tournament_id', params.id);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  unset_bust: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });

    const { data: player } = await service
      .from('tournament_players')
      .select('id')
      .eq('id', playerId)
      .eq('tournament_id', params.id)
      .single();
    if (!player) return fail(400, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ finish_position: null })
      .eq('id', playerId)
      .eq('tournament_id', params.id);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  add_rebuy: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status, format')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });
    if (tournament.format !== 'rebuy') return fail(400, { errorKey: 'server_error' });

    const { data: player } = await service
      .from('tournament_players')
      .select('id, rebuys')
      .eq('id', playerId)
      .eq('tournament_id', params.id)
      .single();
    if (!player) return fail(400, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ rebuys: player.rebuys + 1 })
      .eq('id', playerId);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  remove_rebuy: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status, format')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });
    if (tournament.format !== 'rebuy') return fail(400, { errorKey: 'server_error' });

    const { data: player } = await service
      .from('tournament_players')
      .select('id, rebuys')
      .eq('id', playerId)
      .eq('tournament_id', params.id)
      .single();
    if (!player) return fail(400, { errorKey: 'server_error' });
    if (player.rebuys <= 0) return fail(400, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ rebuys: player.rebuys - 1 })
      .eq('id', playerId);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  toggle_addon: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status, format')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });
    if (tournament.format !== 'rebuy') return fail(400, { errorKey: 'server_error' });

    const { data: player } = await service
      .from('tournament_players')
      .select('id, addon')
      .eq('id', playerId)
      .eq('tournament_id', params.id)
      .single();
    if (!player) return fail(400, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ addon: !player.addon })
      .eq('id', playerId);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  finish_tournament: async ({ params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('*, prize_structures(payouts)')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });

    const { data: players } = await service
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', params.id);
    if (!players) return fail(500, { errorKey: 'server_error' });

    if (players.some((p) => p.finish_position === null)) {
      return fail(400, { errorKey: 'tournament_positions_incomplete' });
    }

    if (!tournament.prize_structure_id || !tournament.prize_structures) {
      return fail(400, { errorKey: 'error_no_prize_structures' });
    }

    const totalRebuys = players.reduce((sum, p) => sum + p.rebuys, 0);
    const addonCount = players.filter((p) => p.addon).length;
    const prizePool = calculatePrizePool(
      players.length,
      tournament.buy_in,
      totalRebuys,
      tournament.rebuy_amount ?? 0,
      addonCount,
      tournament.addon_amount ?? 0,
    );

    const payoutResults = calculatePayouts(
      players,
      tournament.prize_structures.payouts as { position: number; percentage: number }[],
      prizePool,
    );

    const payoutUpdates = await Promise.all(
      payoutResults.map(({ playerId, amount }) =>
        service
          .from('tournament_players')
          .update({ payout_amount: amount })
          .eq('id', playerId),
      ),
    );
    if (payoutUpdates.some((r) => r.error)) return fail(500, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', params.id);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },
};
