import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { sequence } from '@sveltejs/kit/hooks';
import { setLanguageTag } from '$lib/paraglide/runtime.js';
import { getLanguageCookie, detectLanguageFromHeader } from '$lib/i18n';
import type { Handle } from '@sveltejs/kit';
import type { Database } from '$lib/types';

const i18nHandle: Handle = async ({ event, resolve }) => {
  const lang =
    getLanguageCookie(event.request.headers.get('cookie')) ??
    detectLanguageFromHeader(event.request.headers.get('accept-language'));

  setLanguageTag(() => lang);

  return resolve(event, {
    transformPageChunk({ html }) {
      return html.replace('%lang%', lang);
    }
  });
};

const supabaseHandle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) =>
        cookiesToSet.forEach(({ name, value, options }) =>
          event.cookies.set(name, value, { ...options, path: '/' })
        )
    }
  });

  event.locals.safeGetSession = async () => {
    const { data: { session } } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };
    const { data: { user }, error } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };
    return { session, user };
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    }
  });
};

export const handle: Handle = sequence(i18nHandle, supabaseHandle);
