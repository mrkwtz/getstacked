import type { LayoutServerLoad } from './$types';
import { parseTheme } from '$lib/theme';

export const load: LayoutServerLoad = async ({ cookies, locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  return {
    theme: parseTheme(cookies.get('theme')),
    cookies: cookies.getAll(),
    session, // kept for app.d.ts PageData compatibility during transition
  };
};
