import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Database } from '$lib/types';
import type { Cookies } from '@sveltejs/kit';

/** Anon client — respects RLS, use for auth operations (signIn, exchangeCode, etc.) */
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

/** User client — respects RLS as the authenticated user, use for data queries in server loads */
export function createUserClient(accessToken: string) {
  return createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false }
  });
}

/** Service role client — bypasses RLS, use only for server-side admin operations */
export function createServiceClient() {
  return createServerClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false }
  });
}
