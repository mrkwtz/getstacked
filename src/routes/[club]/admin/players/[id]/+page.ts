import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const [{ data: player }, { data: pendingInvite }] = await Promise.all([
    supabase
      .from('players')
      .select('*')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single(),
    supabase
      .from('club_invites')
      .select('id')
      .eq('club_id', club.id)
      .eq('player_id', params.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle(),
  ]);

  if (!player) throw error(404, 'Player not found');

  return { targetPlayer: player, pendingInviteId: pendingInvite?.id ?? null };
};
