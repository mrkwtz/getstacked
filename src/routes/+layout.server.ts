import type { LayoutServerLoad } from './$types';

export function parseTheme(value: string | undefined): 'dark' | 'light' {
  return value === 'light' ? 'light' : 'dark';
}

export const load: LayoutServerLoad = async ({ cookies, locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  return { session, theme: parseTheme(cookies.get('theme')) };
};
