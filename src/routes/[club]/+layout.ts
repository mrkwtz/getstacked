import { error, redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params, parent }) => {
  const { supabase, session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const { data: club } = await supabase
    .from('clubs')
    .select('*')
    .eq('slug', params.club)
    .single();
  if (!club) throw error(404, 'Club not found');

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();
  if (!player) throw error(403, 'You are not a member of this club');

  return { club, player };
};
