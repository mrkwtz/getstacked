import { redirect } from '@sveltejs/kit';
import { createUserClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) return {};

	const { data: member } = await createUserClient(session.access_token)
		.from('members')
		.select('clubs(slug)')
		.eq('user_id', session.user.id)
		.limit(1)
		.single();

	const slug = (member?.clubs as { slug: string } | null)?.slug;
	throw redirect(303, slug ? `/${slug}` : '/clubs/new');
};
