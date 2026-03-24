import type { LayoutServerLoad } from './$types';
import { parseTheme } from '$lib/theme';

export const load: LayoutServerLoad = async ({ cookies, locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  return { session, theme: parseTheme(cookies.get('theme')) };
};
