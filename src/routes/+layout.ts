import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutLoad } from './$types';
import type { Database } from '$lib/types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
  depends('supabase:auth');

  const supabase = isBrowser()
    ? createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
    : createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { fetch },
        cookies: {
          getAll: () => data.cookies,
          setAll: () => {}, // read-only in universal load; root hooks.server.ts handles writes
        },
      });

  const { data: { session } } = await supabase.auth.getSession();

  return { supabase, session, theme: data.theme };
};
