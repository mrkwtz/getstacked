import { error } from '@sveltejs/kit';
import { calculatePrizePool } from '$lib/tournaments';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, blind_structures(name), prize_structures(name, payouts)')
    .eq('id', params.id)
    .eq('club_id', club.id)
    .single();
  if (!tournament) throw error(404, 'Tournament not found');

  const [{ data: players }, { data: clubPlayers }, { data: tables }, { data: prizeStructures }, { data: blindStructures }] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('*, players!tournament_players_player_id_fkey(id, first_name, last_name, nickname)')
      .eq('tournament_id', params.id)
      .order('created_at'),
    supabase
      .from('players')
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
  const registeredPlayerIds = new Set(allPlayers.map((p) => p.player_id));
  const availablePlayers = (clubPlayers ?? []).filter((p) => !registeredPlayerIds.has(p.id));

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

  return { tournament, players: allPlayers, availablePlayers, prizePool, prizeStructure, tables: tables ?? [], prizeStructures: prizeStructures ?? [], blindStructures: blindStructures ?? [] };
};
