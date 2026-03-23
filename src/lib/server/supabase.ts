import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Database } from '$lib/types';
import type { Cookies } from '@sveltejs/kit';

/** Anon client — respects RLS, use for user-scoped queries */
export function createAnonClient(cookies: Cookies) {
  return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) =>
        cookies.set(name, value, { ...options, path: '/' })
      )
    }
  });
}

/** Service role client — bypasses RLS, use only for server-side admin operations */
export function createServiceClient() {
  return createServerClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false }
  });
}
