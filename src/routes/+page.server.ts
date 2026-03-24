import { redirect } from '@sveltejs/kit';
import { createUserClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) return {};

	const { data: membership, error } = await createUserClient(session.access_token)
		.from('club_members')
		.select('clubs(slug)')
		.eq('user_id', session.user.id)
		.limit(1)
		.single();

	console.log('[landing] user:', session.user.id);
	console.log('[landing] membership:', JSON.stringify(membership));
	console.log('[landing] error:', JSON.stringify(error));

	const slug = (membership?.clubs as { slug: string } | null)?.slug;
	throw redirect(303, slug ? `/${slug}` : '/clubs/new');
};
