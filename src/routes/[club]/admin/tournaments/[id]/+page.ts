import { error } from '@sveltejs/kit';
import { calculatePrizePool, calculateTotalRake } from '$lib/tournaments';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, blind_structures(name, levels), prize_structures(name, payouts), blind_levels, prize_payouts')
    .eq('id', params.id)
    .eq('club_id', club.id)
    .single();
  if (!tournament) throw error(404, 'Tournament not found');

  const [{ data: players }, { data: clubMembers }, { data: tables }, { data: prizeStructures }, { data: blindStructures }] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('*, members!tournament_players_member_id_fkey(id, first_name, last_name, nickname)')
      .eq('tournament_id', params.id)
      .order('created_at'),
    supabase
      .from('members')
      .select('id, first_name, last_name, nickname, member_number')
      .eq('club_id', club.id)
      .order('first_name'),
    supabase
      .from('tournament_tables')
      .select('*')
      .eq('tournament_id', params.id)
      .order('number'),
    supabase.from('prize_structures').select('id, name').eq('club_id', club.id).order('name'),
    supabase.from('blind_structures').select('id, name').eq('club_id', club.id).order('name'),
  ]);

  const allPlayers = players ?? [];
  const registeredMemberIds = new Set(allPlayers.map((p) => p.member_id));
  const availableMembers = (clubMembers ?? []).filter((m) => !registeredMemberIds.has(m.id));

  const totalRebuys = allPlayers.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = allPlayers.filter((p) => p.addon).length;
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in_amount,
    tournament.buy_in_rake ?? 0,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    tournament.rebuy_rake ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
    tournament.addon_rake ?? 0,
  );

  const totalRake = calculateTotalRake(
    allPlayers.length,
    tournament.buy_in_rake ?? 0,
    totalRebuys,
    tournament.rebuy_rake ?? 0,
    addonCount,
    tournament.addon_rake ?? 0,
  );

  const prizeStructure = tournament.prize_payouts
    ? { payouts: tournament.prize_payouts as { position: number; percentage: number }[] }
    : tournament.prize_structures
      ? { payouts: tournament.prize_structures.payouts as { position: number; percentage: number }[] }
      : null;

  return { tournament, players: allPlayers, availableMembers, prizePool, totalRake, prizeStructure, tables: tables ?? [], prizeStructures: prizeStructures ?? [], blindStructures: blindStructures ?? [] };
};
