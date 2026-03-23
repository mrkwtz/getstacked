import { fail } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { errorKey: 'invalid_email' });
    }

    const supabase = createAnonClient(cookies);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${url.origin}/auth/callback` }
    });

    if (error) return fail(500, { errorKey: 'server_error', errorMessage: error.message });

    return { sent: true };
  }
};
