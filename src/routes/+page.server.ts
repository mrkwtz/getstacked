import { redirect } from '@sveltejs/kit';
import { createUserClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) return {};

	const { data: membership } = await createUserClient(session.access_token)
		.from('club_members')
		.select('clubs(slug)')
		.eq('user_id', session.user.id)
		.limit(1)
		.single();

	const slug = (membership?.clubs as { slug: string } | null)?.slug;
	throw redirect(303, slug ? `/${slug}` : '/clubs/new');
};
