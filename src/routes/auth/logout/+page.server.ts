import { redirect } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ cookies }) => {
    await createAnonClient(cookies).auth.signOut();
    throw redirect(303, '/auth/login');
  }
};
