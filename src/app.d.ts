// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '$lib/types'; // types.ts is created in Task 2

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
      safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
    }
    interface PageData {
      session: Session | null;
    }
    // interface Error {}
    // interface Platform {}
  }
}

export {};
