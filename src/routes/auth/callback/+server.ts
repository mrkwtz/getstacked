import { redirect } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  // Validate next is a relative path to prevent open redirect attacks.
  // Reject protocol-relative URLs (//evil.com) which start with '/' but redirect off-site.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (code) {
    const supabase = createAnonClient(cookies);
    await supabase.auth.exchangeCodeForSession(code);
  }

  throw redirect(303, safeNext);
};
