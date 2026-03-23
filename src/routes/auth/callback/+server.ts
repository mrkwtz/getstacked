import { redirect } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createAnonClient(cookies);
    await supabase.auth.exchangeCodeForSession(code);
  }

  throw redirect(303, next);
};
