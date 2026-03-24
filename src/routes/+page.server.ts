import { redirect } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, cookies }) => {
	const { session } = await parent();
	if (!session) return {};

	const supabase = createAnonClient(cookies);
	const { data: membership } = await supabase
		.from('club_members')
		.select('clubs(slug)')
		.eq('user_id', session.user.id)
		.limit(1)
		.single();

	const slug = (membership?.clubs as { slug: string } | null)?.slug;
	throw redirect(303, slug ? `/${slug}` : '/clubs/new');
};
