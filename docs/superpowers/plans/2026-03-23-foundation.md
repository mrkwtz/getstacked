# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the SvelteKit + Supabase + Tailwind project with working auth, club creation, and member management — a deployable foundation for all future features.

**Architecture:** SvelteKit full-stack app with Supabase for auth and database. Multi-tenant by design: every data table carries a `club_id`. Auth uses Supabase's magic link flow via `@supabase/ssr`. The Supabase local CLI runs the DB during development so tests hit a real database.

**Tech Stack:** SvelteKit, TypeScript, TailwindCSS, Supabase (Postgres + Auth), `@supabase/ssr`, Supabase CLI, Vitest, Playwright

---

## File Structure

```
src/
  lib/
    server/
      supabase.ts        # Server-side Supabase client (uses service role key)
    supabase.ts          # Browser Supabase client factory
    types.ts             # TypeScript types generated from DB schema + hand-written domain types
  routes/
    +layout.svelte       # Root layout: injects session, navigation shell
    +layout.server.ts    # Loads session from cookies on every request
    +page.svelte         # Landing page: sign in CTA or redirect to club if logged in
    auth/
      login/
        +page.svelte     # Email input → magic link sent confirmation
        +page.server.ts  # Actions: send magic link
      callback/
        +server.ts       # Handles Supabase OAuth/magic-link redirect, sets session cookies
      accept-invite/
        +page.svelte     # Accept club invite (show club name, confirm button)
        +page.server.ts  # Actions: accept invite (add club_member row)
    [club]/
      +layout.svelte     # Club shell: nav bar with links (Home, Leaderboard, Tournaments)
      +layout.server.ts  # Loads club by slug; validates user is a member; exposes club + role
      +page.svelte       # Club home: upcoming tournaments, recent results placeholder
      admin/
        +layout.server.ts  # Guard: redirects non-admins to /[club]
        members/
          +page.svelte     # Member list + invite form + remove action
          +page.server.ts  # Actions: invite_member, remove_member
        settings/
          +page.svelte     # Club name + slug edit
          +page.server.ts  # Actions: update_settings
    clubs/
      new/
        +page.svelte     # Create club form (name + slug)
        +page.server.ts  # Actions: create_club (inserts club + adds creator as admin)
  app.html               # HTML shell
  app.css                # Tailwind directives + base styles
supabase/
  migrations/
    0001_initial.sql     # clubs, club_members tables + RLS policies
  seed.sql               # Dev seed: one club, two members
tests/
  unit/
    clubs.test.ts        # Club slug validation, membership checks
    members.test.ts      # Role helpers
  e2e/
    auth.test.ts         # Login flow, magic link redirect
    club.test.ts         # Create club, invite member, remove member
    access.test.ts       # Non-member blocked, non-admin blocked from /admin
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `app.html`, `app.css`
- Create: `src/routes/+layout.svelte`, `src/routes/+page.svelte`
- Create: `.env.example`

- [x] **Step 1: Scaffold SvelteKit project**

```bash
npm create svelte@latest . -- --template skeleton --types typescript --no-prettier --no-eslint --no-playwright --no-vitest
```

Select: Skeleton project, TypeScript, no extras (we add them manually).

- [x] **Step 2: Add TailwindCSS**

```bash
npx svelte-add@latest tailwindcss
npm install
```

Verify `src/app.css` contains Tailwind directives and `tailwind.config.js` exists.

- [x] **Step 3: Add Vitest + Playwright**

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/svelte @playwright/test
```

Add to `vite.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'jsdom',
    globals: true
  }
});
```

Add `playwright.config.ts`:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI
  },
  use: { baseURL: 'http://localhost:5173' }
});
```

- [x] **Step 4: Add Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [x] **Step 5: Create `.env.example`**

```bash
# .env.example
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Copy to `.env` and fill in after Supabase CLI setup (Task 2).

- [x] **Step 6: Create root layout**

`src/routes/+layout.server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
  const supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) =>
        cookies.set(name, value, { ...options, path: '/' })
      )
    }
  });

  const { data: { session } } = await supabase.auth.getSession();
  return { session };
};
```

`src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  import '../app.css';
  export let data;
</script>

<slot />
```

- [x] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: server running at `http://localhost:5173` with no errors.

- [x] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project with Tailwind, Vitest, Supabase packages"
```

---

## Task 2: Supabase Local Setup + Database Schema

**Files:**
- Create: `supabase/migrations/0001_initial.sql`
- Create: `supabase/seed.sql`
- Create: `src/lib/types.ts`

- [x] **Step 1: Initialise Supabase CLI**

```bash
npx supabase init
npx supabase start
```

Expected output includes `API URL`, `anon key`, and `service_role key`. Copy these into `.env`.

- [x] **Step 2: Write failing schema test**

`tests/unit/clubs.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidSlug } from '$lib/clubs';

describe('isValidSlug', () => {
  it('accepts lowercase alphanumeric with hyphens', () => {
    expect(isValidSlug('my-poker-club')).toBe(true);
  });
  it('rejects uppercase', () => {
    expect(isValidSlug('My-Club')).toBe(false);
  });
  it('rejects spaces', () => {
    expect(isValidSlug('my club')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidSlug('')).toBe(false);
  });
});
```

- [x] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/unit/clubs.test.ts
```

Expected: FAIL — `$lib/clubs` not found.

- [x] **Step 4: Create migration**

`supabase/migrations/0001_initial.sql`:
```sql
-- clubs
create table clubs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- club_members
create table club_members (
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- RLS
alter table clubs enable row level security;
alter table club_members enable row level security;

-- clubs: members can read their own club
create policy "members can read own club"
  on clubs for select
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = clubs.id
        and club_members.user_id = auth.uid()
    )
  );

-- clubs: admins can update their club
create policy "admins can update own club"
  on clubs for update
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = clubs.id
        and club_members.user_id = auth.uid()
        and club_members.role = 'admin'
    )
  );

-- club_members: members can read members of their club
create policy "members can read club members"
  on club_members for select
  using (
    club_id in (
      select club_id from club_members where user_id = auth.uid()
    )
  );

-- club_members: admins can insert/delete members in their club
create policy "admins can manage club members"
  on club_members for all
  using (
    exists (
      select 1 from club_members cm
      where cm.club_id = club_members.club_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );
```

- [x] **Step 5: Apply migration**

```bash
npx supabase db reset
```

Expected: migration applied, seed not yet (no seed.sql content yet). No errors.

- [x] **Step 6: Create seed file**

`supabase/seed.sql`:
```sql
-- Dev seed: one club, two users (set up via Supabase dashboard or auth admin API)
-- Run after creating test users in local Supabase dashboard

-- Insert a test club (replace UUIDs with real user IDs from your local auth)
-- insert into clubs (id, slug, name) values ('...', 'test-club', 'Test Club');
-- insert into club_members values ('...', '...', 'admin', 'Admin User', now());
```

Note: full seed requires real auth user UUIDs — fill in after creating test users in the local Supabase dashboard at `http://localhost:54323`.

- [x] **Step 7: Generate TypeScript types**

```bash
npx supabase gen types typescript --local > src/lib/types.ts
```

Verify `src/lib/types.ts` contains `Database`, `clubs`, and `club_members` type definitions.

- [x] **Step 8: Add domain types**

Append to `src/lib/types.ts`:
```typescript
// Convenience aliases
export type Club = Database['public']['Tables']['clubs']['Row'];
export type ClubMember = Database['public']['Tables']['club_members']['Row'];
export type Role = 'admin' | 'member';

export type ClubContext = {
  club: Club;
  member: ClubMember;
  role: Role;
};
```

- [x] **Step 9: Commit**

```bash
git add supabase/ src/lib/types.ts
git commit -m "feat: add initial DB schema with clubs and club_members + RLS policies"
```

---

## Task 2b: i18n Setup (Paraglide JS)

**Files:**
- Create: `messages/en.json` — English message catalogue
- Create: `messages/de.json` — German message catalogue
- Modify: `src/hooks.server.ts` — add Paraglide language detection handle
- Modify: `src/routes/+layout.svelte` — wrap with `<ParaglideJS>`
- Create: `src/lib/i18n.ts` — re-export paraglide runtime helpers

- [x] **Step 1: Install and initialise Paraglide**

```bash
npx @inlang/paraglide-sveltekit@latest init
```

When prompted: select English as the default language, add German as a second language. Accept all other defaults.

This creates:
- `messages/en.json` and `messages/de.json`
- `project.inlang/` config directory
- Adds `@inlang/paraglide-sveltekit` to `package.json`
- Updates `vite.config.ts` with the Paraglide plugin
- Adds `src/lib/i18n.ts` (or `src/i18n.ts` depending on version)

- [x] **Step 2: Verify generated structure**

```bash
ls messages/
# Expected: en.json  de.json
cat messages/en.json
# Expected: {} or a default structure
```

- [x] **Step 3: Add initial message keys**

`messages/en.json`:
```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "app_name": "Poker Club Manager",
  "nav_home": "Home",
  "nav_tournaments": "Tournaments",
  "nav_leaderboard": "Leaderboard",
  "nav_admin": "Admin",
  "auth_sign_in": "Sign in",
  "auth_email_label": "Email",
  "auth_magic_link_button": "Send magic link",
  "auth_check_email": "Check your email — we sent you a magic link.",
  "auth_invalid_email": "Please enter a valid email address.",
  "club_create_title": "Create your club",
  "club_name_label": "Club name",
  "club_slug_label": "URL slug",
  "club_display_name_label": "Your display name in this club",
  "club_create_button": "Create club",
  "members_title": "Members",
  "members_invite_title": "Invite member",
  "members_invite_email": "Email",
  "members_invite_display_name": "Display name",
  "members_invite_button": "Send invite",
  "members_remove": "Remove",
  "settings_title": "Club settings",
  "settings_save": "Save changes",
  "settings_saved": "Settings saved.",
  "error_required": "This field is required.",
  "error_invalid_slug": "Slug must be lowercase letters, numbers, and hyphens only.",
  "error_slug_taken": "That slug is already taken.",
  "error_already_member": "This user is already a member.",
  "error_cannot_remove_self": "Cannot remove yourself.",
  "invite_title": "You're invited!",
  "invite_body": "You've been invited to join {club_name}.",
  "invite_join_button": "Join club",
  "get_started": "Get started",
  "landing_tagline": "Manage your club, run tournaments, track your legends."
}
```

`messages/de.json`:
```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "app_name": "Poker Club Manager",
  "nav_home": "Startseite",
  "nav_tournaments": "Turniere",
  "nav_leaderboard": "Rangliste",
  "nav_admin": "Admin",
  "auth_sign_in": "Anmelden",
  "auth_email_label": "E-Mail",
  "auth_magic_link_button": "Magic Link senden",
  "auth_check_email": "Bitte prüfe deine E-Mails — wir haben dir einen Magic Link gesendet.",
  "auth_invalid_email": "Bitte gib eine gültige E-Mail-Adresse ein.",
  "club_create_title": "Club erstellen",
  "club_name_label": "Club-Name",
  "club_slug_label": "URL-Slug",
  "club_display_name_label": "Dein Anzeigename in diesem Club",
  "club_create_button": "Club erstellen",
  "members_title": "Mitglieder",
  "members_invite_title": "Mitglied einladen",
  "members_invite_email": "E-Mail",
  "members_invite_display_name": "Anzeigename",
  "members_invite_button": "Einladung senden",
  "members_remove": "Entfernen",
  "settings_title": "Club-Einstellungen",
  "settings_save": "Änderungen speichern",
  "settings_saved": "Einstellungen gespeichert.",
  "error_required": "Dieses Feld ist erforderlich.",
  "error_invalid_slug": "Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.",
  "error_slug_taken": "Dieser Slug ist bereits vergeben.",
  "error_already_member": "Dieser Benutzer ist bereits Mitglied.",
  "error_cannot_remove_self": "Du kannst dich nicht selbst entfernen.",
  "invite_title": "Du wurdest eingeladen!",
  "invite_body": "Du wurdest eingeladen, {club_name} beizutreten.",
  "invite_join_button": "Club beitreten",
  "get_started": "Loslegen",
  "landing_tagline": "Verwalte deinen Club, organisiere Turniere, verewige deine Legenden."
}
```

- [x] **Step 4: Add language detection to hooks**

Check what `npx @inlang/paraglide-sveltekit init` generated in `src/hooks.server.ts`. It should have added a `i18n.handle()` call. If it created a separate `hooks.server.ts` instead of modifying the existing one, merge them into one file:

```typescript
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { sequence } from '@sveltejs/kit/hooks';
import { i18n } from '$lib/i18n';
import type { Handle } from '@sveltejs/kit';
import type { Database } from '$lib/types';

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

export const handle: Handle = sequence(i18n.handle(), supabaseHandle);
```

- [x] **Step 5: Update root layout to wrap with ParaglideJS**

`src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  import '../app.css';
  import { ParaglideJS } from '@inlang/paraglide-sveltekit';
  import { i18n } from '$lib/i18n';
  const { data, children } = $props();
</script>

<ParaglideJS {i18n}>
  {@render children()}
</ParaglideJS>
```

- [x] **Step 6: Verify build compiles**

```bash
npm run build
```

Expected: build succeeds. Fix any TypeScript errors before proceeding.

- [x] **Step 7: Commit**

```bash
git add messages/ src/ project.inlang/ vite.config.ts package.json
git commit -m "feat: add Paraglide JS i18n with English and German message catalogues"
```

---

## Task 3: Supabase Client Helpers + Slug Validation

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/server/supabase.ts`
- Create: `src/lib/clubs.ts`

- [x] **Step 1: Create browser Supabase client factory**

`src/lib/supabase.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from './types';

export function createClient() {
  return createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
}
```

- [x] **Step 2: Create server Supabase client factory**

`src/lib/server/supabase.ts`:
```typescript
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
```

- [x] **Step 3: Create clubs helper with slug validation**

`src/lib/clubs.ts`:
```typescript
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
```

- [x] **Step 4: Run unit tests**

```bash
npx vitest run tests/unit/clubs.test.ts
```

Expected: all 4 tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/lib/
git commit -m "feat: add Supabase client helpers and slug validation"
```

---

## Task 4: Auth — Login + Magic Link + Callback

**Files:**
- Create: `src/routes/auth/login/+page.svelte`
- Create: `src/routes/auth/login/+page.server.ts`
- Create: `src/routes/auth/callback/+server.ts`

- [x] **Step 1: Write failing e2e test**

`tests/e2e/auth.test.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('login page shows email form', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
});

test('submitting login shows confirmation message', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByRole('button', { name: /send magic link/i }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx playwright test tests/e2e/auth.test.ts
```

Expected: FAIL — route not found.

- [x] **Step 3: Create login server action**

`src/routes/auth/login/+page.server.ts`:
```typescript
import { fail } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';

    if (!email || !email.includes('@')) {
      return fail(400, { error: 'Please enter a valid email address.' });
    }

    const supabase = createAnonClient(cookies);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${url.origin}/auth/callback` }
    });

    if (error) return fail(500, { error: error.message });

    return { sent: true };
  }
};
```

- [x] **Step 4: Create login page**

`src/routes/auth/login/+page.svelte`:
```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  export let form;
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-950">
  <div class="w-full max-w-sm p-8 bg-gray-900 rounded-xl shadow-lg">
    <h1 class="text-2xl font-bold text-white mb-6">Sign in</h1>

    {#if form?.sent}
      <p class="text-green-400">Check your email — we sent you a magic link.</p>
    {:else}
      <form method="POST" use:enhance>
        <div class="mb-4">
          <label for="email" class="block text-sm font-medium text-gray-300 mb-1">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            placeholder="you@example.com"
          />
        </div>

        {#if form?.error}
          <p class="text-red-400 text-sm mb-3">{form.error}</p>
        {/if}

        <button
          type="submit"
          class="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
        >
          Send magic link
        </button>
      </form>
    {/if}
  </div>
</div>
```

- [x] **Step 5: Create auth callback handler**

`src/routes/auth/callback/+server.ts`:
```typescript
import { redirect } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createAnonClient(cookies);
    await supabase.auth.exchangeCodeForSession(code);
  }

  throw redirect(303, next);
};
```

- [x] **Step 6: Run e2e tests**

```bash
npx playwright test tests/e2e/auth.test.ts
```

Expected: both tests PASS.

- [x] **Step 7: Commit**

```bash
git add src/routes/auth/
git commit -m "feat: add magic link auth flow with login page and callback handler"
```

---

## Task 5: Landing Page + Session-Aware Root Layout

**Files:**
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+layout.server.ts`
- Modify: `src/routes/+page.svelte`

- [x] **Step 1: Update root layout server load to expose session**

`src/routes/+layout.server.ts` (full replacement):
```typescript
import { createAnonClient } from '$lib/server/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
  const supabase = createAnonClient(cookies);
  const { data: { session } } = await supabase.auth.getSession();
  return { session };
};
```

- [x] **Step 2: Update root layout**

`src/routes/+layout.svelte`:
```svelte
<script lang="ts">
  import '../app.css';
  export let data;
</script>

<slot />
```

- [x] **Step 3: Create landing page**

`src/routes/+page.svelte`:
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  export let data;

  if (data.session) {
    goto('/clubs/new'); // redirect logged-in users without a club
  }
</script>

<div class="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
  <h1 class="text-4xl font-bold mb-4">Poker Club Manager</h1>
  <p class="text-gray-400 mb-8 text-lg">Manage your club, run tournaments, track your legends.</p>
  <a
    href="/auth/login"
    class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
  >
    Get started
  </a>
</div>
```

- [x] **Step 4: Verify landing page**

```bash
npm run dev
```

Open `http://localhost:5173`. Expected: landing page with "Get started" link.

- [x] **Step 5: Commit**

```bash
git add src/routes/+layout.svelte src/routes/+layout.server.ts src/routes/+page.svelte
git commit -m "feat: add landing page with session-aware redirect"
```

---

## Task 6: Club Creation

**Files:**
- Create: `src/routes/clubs/new/+page.svelte`
- Create: `src/routes/clubs/new/+page.server.ts`

- [x] **Step 1: Write failing e2e test**

Add to `tests/e2e/club.test.ts`:
```typescript
import { test, expect } from '@playwright/test';

// NOTE: these tests require a logged-in session.
// Use Playwright's storageState to inject a session, or test with a real magic link flow.
// For now, test the page structure without auth.

test('create club page shows form', async ({ page }) => {
  // We'll be redirected to login — verify redirect
  await page.goto('/clubs/new');
  // Unauthenticated user should be redirected to login
  await expect(page).toHaveURL(/\/auth\/login/);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx playwright test tests/e2e/club.test.ts
```

Expected: FAIL — route not found.

- [x] **Step 3: Create club creation server action**

`src/routes/clubs/new/+page.server.ts`:
```typescript
import { fail, redirect } from '@sveltejs/kit';
import { createAnonClient, createServiceClient } from '$lib/server/supabase';
import { isValidSlug } from '$lib/clubs';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  const supabase = createAnonClient(cookies);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect(303, '/auth/login');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const supabase = createAnonClient(cookies);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect(303, '/auth/login');

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() ?? '';
    const slug = formData.get('slug')?.toString().trim() ?? '';
    const displayName = formData.get('display_name')?.toString().trim() ?? '';

    if (!name) return fail(400, { error: 'Club name is required.' });
    if (!isValidSlug(slug)) return fail(400, { error: 'Slug must be lowercase letters, numbers, and hyphens only.' });
    if (!displayName) return fail(400, { error: 'Your display name is required.' });

    // Use service client to insert club + member atomically (bypasses RLS for initial creation)
    const service = createServiceClient();

    const { data: club, error: clubError } = await service
      .from('clubs')
      .insert({ name, slug })
      .select('id')
      .single();

    if (clubError) {
      if (clubError.code === '23505') return fail(400, { error: 'That slug is already taken.' });
      return fail(500, { error: clubError.message });
    }

    const { error: memberError } = await service
      .from('club_members')
      .insert({ club_id: club.id, user_id: session.user.id, role: 'admin', display_name: displayName });

    if (memberError) return fail(500, { error: memberError.message });

    throw redirect(303, `/${slug}`);
  }
};
```

- [x] **Step 4: Create club creation page**

`src/routes/clubs/new/+page.svelte`:
```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  export let form;

  let name = '';
  let slug = '';
  let autoSlug = true;

  function onNameInput(e: Event) {
    name = (e.target as HTMLInputElement).value;
    if (autoSlug) {
      slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
  }

  function onSlugInput(e: Event) {
    slug = (e.target as HTMLInputElement).value;
    autoSlug = false;
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-950">
  <div class="w-full max-w-md p-8 bg-gray-900 rounded-xl shadow-lg">
    <h1 class="text-2xl font-bold text-white mb-6">Create your club</h1>

    <form method="POST" use:enhance>
      <div class="mb-4">
        <label for="name" class="block text-sm font-medium text-gray-300 mb-1">Club name</label>
        <input
          id="name" name="name" type="text" required
          bind:value={name} on:input={onNameInput}
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="River City Poker Club"
        />
      </div>

      <div class="mb-4">
        <label for="slug" class="block text-sm font-medium text-gray-300 mb-1">
          URL slug <span class="text-gray-500 font-normal">— yourclub.app/<span class="text-indigo-400">{slug || 'slug'}</span></span>
        </label>
        <input
          id="slug" name="slug" type="text" required
          bind:value={slug} on:input={onSlugInput}
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="river-city"
        />
      </div>

      <div class="mb-6">
        <label for="display_name" class="block text-sm font-medium text-gray-300 mb-1">Your display name in this club</label>
        <input
          id="display_name" name="display_name" type="text" required
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="Poker Pete"
        />
      </div>

      {#if form?.error}
        <p class="text-red-400 text-sm mb-4">{form.error}</p>
      {/if}

      <button type="submit" class="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
        Create club
      </button>
    </form>
  </div>
</div>
```

- [x] **Step 5: Run e2e test**

```bash
npx playwright test tests/e2e/club.test.ts
```

Expected: PASS (unauthenticated redirect works).

- [x] **Step 6: Commit**

```bash
git add src/routes/clubs/
git commit -m "feat: add club creation flow with slug validation"
```

---

## Task 7: Club Layout + Home Page

**Files:**
- Create: `src/routes/[club]/+layout.server.ts`
- Create: `src/routes/[club]/+layout.svelte`
- Create: `src/routes/[club]/+page.svelte`

- [x] **Step 1: Write unit test for member role helper**

`tests/unit/members.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isAdmin } from '$lib/members';

describe('isAdmin', () => {
  it('returns true for admin role', () => {
    expect(isAdmin({ role: 'admin' } as any)).toBe(true);
  });
  it('returns false for member role', () => {
    expect(isAdmin({ role: 'member' } as any)).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/members.test.ts
```

Expected: FAIL — `$lib/members` not found.

- [x] **Step 3: Create members helper**

`src/lib/members.ts`:
```typescript
import type { ClubMember } from './types';

export function isAdmin(member: ClubMember): boolean {
  return member.role === 'admin';
}
```

- [x] **Step 4: Run unit test**

```bash
npx vitest run tests/unit/members.test.ts
```

Expected: PASS.

- [x] **Step 5: Create club layout server load**

`src/routes/[club]/+layout.server.ts`:
```typescript
import { error, redirect } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, cookies }) => {
  const supabase = createAnonClient(cookies);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect(303, '/auth/login');

  const { data: club } = await supabase
    .from('clubs')
    .select('*')
    .eq('slug', params.club)
    .single();

  if (!club) throw error(404, 'Club not found');

  const { data: member } = await supabase
    .from('club_members')
    .select('*')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();

  if (!member) throw error(403, 'You are not a member of this club');

  return { club, member };
};
```

- [x] **Step 6: Create club layout**

`src/routes/[club]/+layout.svelte`:
```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { isAdmin } from '$lib/members';
  export let data;

  $: club = data.club;
  $: member = data.member;
  $: clubPath = `/${club.slug}`;
</script>

<div class="min-h-screen bg-gray-950 text-white">
  <nav class="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-6">
    <span class="font-bold text-lg">{club.name}</span>
    <a href={clubPath} class="text-gray-400 hover:text-white text-sm transition-colors">Home</a>
    <a href="{clubPath}/tournaments" class="text-gray-400 hover:text-white text-sm transition-colors">Tournaments</a>
    <a href="{clubPath}/leaderboard" class="text-gray-400 hover:text-white text-sm transition-colors">Leaderboard</a>
    {#if isAdmin(member)}
      <a href="{clubPath}/admin" class="ml-auto text-indigo-400 hover:text-indigo-300 text-sm transition-colors">Admin</a>
    {/if}
  </nav>

  <main class="max-w-5xl mx-auto px-4 py-6">
    <slot />
  </main>
</div>
```

- [x] **Step 7: Create club home page**

`src/routes/[club]/+page.svelte`:
```svelte
<script lang="ts">
  export let data;
</script>

<h1 class="text-2xl font-bold mb-2">Welcome to {data.club.name}</h1>
<p class="text-gray-400">Tournaments and recent results will appear here.</p>
```

- [x] **Step 8: Commit**

```bash
git add src/routes/\[club\]/ src/lib/members.ts tests/unit/members.test.ts
git commit -m "feat: add club layout with nav and protected route guard"
```

---

## Task 8: Member Management (Admin)

**Files:**
- Create: `src/routes/[club]/admin/+layout.server.ts`
- Create: `src/routes/[club]/admin/members/+page.svelte`
- Create: `src/routes/[club]/admin/members/+page.server.ts`

- [x] **Step 1: Write failing e2e access test**

`tests/e2e/access.test.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('non-admin cannot access admin routes', async ({ page }) => {
  // Unauthenticated access → login redirect
  await page.goto('/test-club/admin/members');
  await expect(page).toHaveURL(/\/auth\/login/);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
npx playwright test tests/e2e/access.test.ts
```

Expected: FAIL — route not found.

- [x] **Step 3: Create admin layout guard**

`src/routes/[club]/admin/+layout.server.ts`:
```typescript
import { error } from '@sveltejs/kit';
import { isAdmin } from '$lib/members';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
  const { member } = await parent();
  if (!isAdmin(member)) throw error(403, 'Admin access required');
  return {};
};
```

- [x] **Step 4: Create member management server**

`src/routes/[club]/admin/members/+page.server.ts`:
```typescript
import { fail } from '@sveltejs/kit';
import { createAnonClient, createServiceClient } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, cookies }) => {
  const { club } = await parent();
  const supabase = createAnonClient(cookies);

  const { data: members } = await supabase
    .from('club_members')
    .select('*')
    .eq('club_id', club.id)
    .order('joined_at');

  return { members: members ?? [] };
};

export const actions: Actions = {
  invite_member: async ({ request, cookies, parent }) => {
    const { club } = await parent();
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';
    const displayName = formData.get('display_name')?.toString().trim() ?? '';

    if (!email || !email.includes('@')) return fail(400, { invite_error: 'Valid email required.' });
    if (!displayName) return fail(400, { invite_error: 'Display name required.' });

    const service = createServiceClient();

    // Look up or invite user by email via Supabase auth admin API
    const { data: userList } = await service.auth.admin.listUsers();
    let targetUser = userList?.users.find(u => u.email === email);

    if (!targetUser) {
      // Invite user — they'll get a sign-up email
      const { data: invited, error } = await service.auth.admin.inviteUserByEmail(email, {
        data: { invited_to_club: club.id }
      });
      if (error) return fail(500, { invite_error: error.message });
      targetUser = invited.user;
    }

    const { error: memberError } = await service
      .from('club_members')
      .insert({ club_id: club.id, user_id: targetUser.id, role: 'member', display_name: displayName });

    if (memberError) {
      if (memberError.code === '23505') return fail(400, { invite_error: 'This user is already a member.' });
      return fail(500, { invite_error: memberError.message });
    }

    return { invited: true };
  },

  remove_member: async ({ request, parent, cookies }) => {
    const { club, member: currentMember } = await parent();
    const formData = await request.formData();
    const userId = formData.get('user_id')?.toString() ?? '';

    // Prevent removing self
    if (userId === currentMember.user_id) return fail(400, { remove_error: 'Cannot remove yourself.' });

    const service = createServiceClient();
    const { error } = await service
      .from('club_members')
      .delete()
      .eq('club_id', club.id)
      .eq('user_id', userId);

    if (error) return fail(500, { remove_error: error.message });
    return {};
  }
};
```

- [x] **Step 5: Create member management page**

`src/routes/[club]/admin/members/+page.svelte`:
```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  export let data;
  export let form;
</script>

<div class="max-w-2xl">
  <h1 class="text-2xl font-bold mb-6">Members</h1>

  <!-- Member list -->
  <div class="bg-gray-900 rounded-xl overflow-hidden mb-8">
    {#each data.members as member}
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
        <div>
          <span class="font-medium">{member.display_name}</span>
          <span class="ml-2 text-xs px-2 py-0.5 rounded-full {member.role === 'admin' ? 'bg-indigo-900 text-indigo-300' : 'bg-gray-800 text-gray-400'}">
            {member.role}
          </span>
        </div>
        <form method="POST" action="?/remove_member" use:enhance>
          <input type="hidden" name="user_id" value={member.user_id} />
          <button type="submit" class="text-sm text-red-400 hover:text-red-300">Remove</button>
        </form>
      </div>
    {/each}
    {#if data.members.length === 0}
      <p class="px-4 py-3 text-gray-500">No members yet.</p>
    {/if}
  </div>

  <!-- Invite form -->
  <div class="bg-gray-900 rounded-xl p-6">
    <h2 class="text-lg font-semibold mb-4">Invite member</h2>
    <form method="POST" action="?/invite_member" use:enhance class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-300 mb-1">Email</label>
        <input id="email" name="email" type="email" required
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="member@example.com" />
      </div>
      <div>
        <label for="display_name" class="block text-sm font-medium text-gray-300 mb-1">Display name</label>
        <input id="display_name" name="display_name" type="text" required
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="Poker Pete" />
      </div>
      {#if form?.invite_error}
        <p class="text-red-400 text-sm">{form.invite_error}</p>
      {/if}
      {#if form?.invited}
        <p class="text-green-400 text-sm">Member invited successfully.</p>
      {/if}
      <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
        Send invite
      </button>
    </form>
  </div>
</div>
```

- [x] **Step 6: Run e2e test**

```bash
npx playwright test tests/e2e/access.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/routes/\[club\]/admin/ tests/e2e/access.test.ts
git commit -m "feat: add admin member management with invite and remove"
```

---

## Task 9: Club Settings (Admin)

**Files:**
- Create: `src/routes/[club]/admin/settings/+page.svelte`
- Create: `src/routes/[club]/admin/settings/+page.server.ts`

- [x] **Step 1: Create settings server**

`src/routes/[club]/admin/settings/+page.server.ts`:
```typescript
import { fail, redirect } from '@sveltejs/kit';
import { createAnonClient } from '$lib/server/supabase';
import { isValidSlug } from '$lib/clubs';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { club } = await parent();
  return { club };
};

export const actions: Actions = {
  default: async ({ request, cookies, parent }) => {
    const { club } = await parent();
    const supabase = createAnonClient(cookies);
    const formData = await request.formData();

    const name = formData.get('name')?.toString().trim() ?? '';
    const slug = formData.get('slug')?.toString().trim() ?? '';

    if (!name) return fail(400, { error: 'Club name is required.' });
    if (!isValidSlug(slug)) return fail(400, { error: 'Invalid slug format.' });

    const { error } = await supabase
      .from('clubs')
      .update({ name, slug })
      .eq('id', club.id);

    if (error) {
      if (error.code === '23505') return fail(400, { error: 'That slug is already taken.' });
      return fail(500, { error: error.message });
    }

    // Redirect to new slug if it changed
    if (slug !== club.slug) throw redirect(303, `/${slug}/admin/settings`);
    return { saved: true };
  }
};
```

- [x] **Step 2: Create settings page**

`src/routes/[club]/admin/settings/+page.svelte`:
```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  export let data;
  export let form;
</script>

<div class="max-w-md">
  <h1 class="text-2xl font-bold mb-6">Club settings</h1>

  <form method="POST" use:enhance class="bg-gray-900 rounded-xl p-6 space-y-4">
    <div>
      <label for="name" class="block text-sm font-medium text-gray-300 mb-1">Club name</label>
      <input id="name" name="name" type="text" required value={data.club.name}
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
    </div>
    <div>
      <label for="slug" class="block text-sm font-medium text-gray-300 mb-1">URL slug</label>
      <input id="slug" name="slug" type="text" required value={data.club.slug}
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
    </div>
    {#if form?.error}
      <p class="text-red-400 text-sm">{form.error}</p>
    {/if}
    {#if form?.saved}
      <p class="text-green-400 text-sm">Settings saved.</p>
    {/if}
    <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
      Save changes
    </button>
  </form>
</div>
```

- [x] **Step 3: Add admin nav**

Add an admin dashboard page at `src/routes/[club]/admin/+page.svelte`:
```svelte
<script lang="ts">
  export let data;
  $: clubPath = `/${data.club.slug}/admin`;
</script>

<h1 class="text-2xl font-bold mb-6">Admin</h1>
<nav class="flex flex-col gap-2">
  <a href="{clubPath}/members" class="text-indigo-400 hover:underline">Members</a>
  <a href="{clubPath}/settings" class="text-indigo-400 hover:underline">Settings</a>
</nav>
```

- [x] **Step 4: Run full test suite**

```bash
npx vitest run && npx playwright test
```

Expected: all tests PASS.

- [x] **Step 5: Commit**

```bash
git add src/routes/\[club\]/admin/
git commit -m "feat: add club settings page with name and slug editing"
```

---

## Task 10: Accept Invite Flow

**Files:**
- Create: `src/routes/auth/accept-invite/+page.svelte`
- Create: `src/routes/auth/accept-invite/+page.server.ts`

- [ ] **Step 1: Create accept invite server**

Note: The `club_members` row is **pre-inserted** by the admin's `invite_member` action at the time of invite (Task 8). By the time the invitee arrives here, they are already a member. This page simply confirms they landed successfully and redirects them to their club — it does NOT insert a membership row.

`src/routes/auth/accept-invite/+page.server.ts`:
```typescript
import { redirect } from '@sveltejs/kit';
import { createAnonClient, createServiceClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  const supabase = createAnonClient(cookies);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) throw redirect(303, '/auth/login');

  // The invited_to_club metadata is set by the admin invite action
  const clubId = session.user.user_metadata?.invited_to_club;
  if (!clubId) throw redirect(303, '/');

  const service = createServiceClient();
  const { data: club } = await service
    .from('clubs')
    .select('name, slug')
    .eq('id', clubId)
    .single();

  if (!club) throw redirect(303, '/');

  return { club };
};

export const actions = {
  // The member row already exists — just redirect to the club
  default: async ({ cookies }) => {
    const supabase = createAnonClient(cookies);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect(303, '/auth/login');

    const service = createServiceClient();
    const clubId = session.user.user_metadata?.invited_to_club;
    const { data: club } = await service.from('clubs').select('slug').eq('id', clubId).single();

    throw redirect(303, `/${club?.slug ?? ''}`);
  }
};
```

- [ ] **Step 2: Create accept invite page**

`src/routes/auth/accept-invite/+page.svelte`:
```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  export let data;
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-950">
  <div class="w-full max-w-sm p-8 bg-gray-900 rounded-xl shadow-lg text-center">
    <h1 class="text-2xl font-bold text-white mb-2">You're invited!</h1>
    <p class="text-gray-400 mb-6">You've been invited to join <strong class="text-white">{data.club.name}</strong>.</p>
    <form method="POST" use:enhance>
      <button type="submit" class="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">
        Join club
      </button>
    </form>
  </div>
</div>
```

- [ ] **Step 3: Final test run**

```bash
npx vitest run && npx playwright test
```

Expected: all tests PASS.

- [ ] **Step 4: Final commit**

```bash
git add src/routes/auth/accept-invite/
git commit -m "feat: add accept-invite flow for new members"
```

---

## Task 11: Deploy to Vercel

**Files:**
- Modify: `svelte.config.js`
- Create: `vercel.json` (if needed)

- [ ] **Step 1: Install Vercel adapter**

```bash
npm install -D @sveltejs/adapter-vercel
```

Update `svelte.config.js`:
```javascript
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() }
};
```

- [ ] **Step 2: Set up Supabase project**

1. Create a new project at [supabase.com](https://supabase.com)
2. Run migrations against the hosted project: `npx supabase db push`
3. Copy the hosted project's `URL` and `anon key` to Vercel environment variables

- [ ] **Step 3: Deploy**

```bash
npx vercel --prod
```

Set environment variables in the Vercel dashboard:
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 4: Smoke test**

Visit the deployed URL. Verify:
- Landing page loads
- Login redirects to magic link form
- Magic link email arrives and logs in successfully

- [ ] **Step 5: Final commit**

```bash
git add svelte.config.js
git commit -m "chore: switch to Vercel adapter for deployment"
```
