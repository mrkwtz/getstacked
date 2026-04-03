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
    .from('members')
    .select('*')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();
  if (!player) throw error(403, 'You are not a member of this club');

  // Load all clubs the user belongs to (for club switcher)
  const { data: userClubs } = await supabase
    .from('members')
    .select('clubs(slug, name)')
    .eq('user_id', session.user.id)
    .order('created_at');

  const otherClubs = (userClubs ?? [])
    .map((p) => p.clubs as { slug: string; name: string } | null)
    .filter((c): c is { slug: string; name: string } => c !== null && c.slug !== club.slug);

  return { club, player, otherClubs };
};
