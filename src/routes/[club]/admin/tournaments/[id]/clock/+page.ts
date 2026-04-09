import { error } from '@sveltejs/kit';
import { calculatePrizePool, calculateAverageStack } from '$lib/tournaments';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase } = await parent();

  const { data: club } = await supabase
    .from('clubs')
    .select('id')
    .eq('slug', params.club)
    .single();
  if (!club) throw error(404, 'Club not found');

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, blind_structures(name, levels), prize_structures(name, payouts)')
    .eq('id', params.id)
    .eq('club_id', club.id)
    .single();
  if (!tournament) throw error(404, 'Tournament not found');

  const { data: players } = await supabase
    .from('tournament_players')
    .select('rebuys, addon, finish_position')
    .eq('tournament_id', params.id);

  const allPlayers = players ?? [];
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
  const averageStack = calculateAverageStack(tournament, allPlayers);
  const playersRemaining = allPlayers.filter((p) => p.finish_position === null).length;

  return { tournament, prizePool, averageStack, playersTotal: allPlayers.length, playersRemaining };
};
