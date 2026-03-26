# Client-Side Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use superpowers:test-driven-development for each task.

**Goal:** Move all data reads and mutations from server-side SvelteKit loads/actions to direct browser → Supabase calls, reducing Vercel function invocations per navigation from 3–4 down to 1.

**Architecture:** A new `src/routes/+layout.ts` creates an authenticated Supabase client (browser client in the browser, cookie-aware server client during SSR) and exposes it via `parent()` to all child loads. Sub-layouts and page loads convert from `+page.server.ts` to `+page.ts` universal loads. Mutations move from server actions to `onclick` handlers using `createClient()` + `invalidateAll()`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, `@supabase/ssr` v0.9.0 (`isBrowser`, `createBrowserClient`, `createServerClient`), Vitest, TypeScript

---

## File Map

**New files:**
- `supabase/migrations/0006_clubs_delete_policy.sql`
- `src/routes/+layout.ts`
- `src/routes/[club]/+layout.ts`
- `src/routes/[club]/admin/+layout.ts`
- `src/routes/[club]/+page.ts`
- `src/routes/[club]/admin/tournaments/+page.ts`
- `src/routes/[club]/admin/members/+page.ts`
- `src/routes/[club]/admin/blind-structures/+page.ts`
- `src/routes/[club]/admin/prize-structures/+page.ts`
- `src/routes/[club]/admin/tournaments/new/+page.ts`
- `src/routes/[club]/admin/tournaments/[id]/+page.ts`

**Modified files:**
- `src/routes/+layout.server.ts` — expose cookies, remove session
- `src/routes/[club]/admin/members/+page.server.ts` — remove all actions (keep empty export)
- `src/routes/[club]/admin/blind-structures/+page.server.ts` — remove all actions
- `src/routes/[club]/admin/prize-structures/+page.server.ts` — remove all actions
- `src/routes/[club]/admin/tournaments/new/+page.server.ts` — remove create_tournament action
- `src/routes/[club]/admin/tournaments/[id]/+page.server.ts` — remove all actions
- `src/routes/[club]/admin/members/+page.svelte`
- `src/routes/[club]/admin/blind-structures/+page.svelte`
- `src/routes/[club]/admin/prize-structures/+page.svelte`
- `src/routes/[club]/admin/tournaments/new/+page.svelte`
- `src/routes/[club]/admin/tournaments/[id]/+page.svelte`
- `src/routes/[club]/admin/settings/+page.svelte`

**Deleted files:**
- `src/routes/[club]/+layout.server.ts`
- `src/routes/[club]/admin/+layout.server.ts`
- `src/routes/[club]/+page.server.ts`
- `src/routes/[club]/admin/tournaments/+page.server.ts`
- `src/routes/[club]/admin/settings/+page.server.ts`

---

**Note on TDD:** This migration moves code between environments without adding new business logic. The existing unit tests (`tests/unit/tournaments.test.ts`) remain unchanged as a regression guard. Each task verifies `npm run check` (TypeScript + Svelte type-checking) and `npm test` before and after changes. For the Svelte mutation handlers specifically, `npm run check` is the primary correctness signal.

**Test command:** `npm test` (vitest unit tests)
**Type-check command:** `npm run check` (svelte-kit sync + svelte-check)

---

## Task 1: DB migration — clubs DELETE policy

**Files:**
- Create: `supabase/migrations/0006_clubs_delete_policy.sql`

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

Expected: all checks and tests pass.

- [ ] **Step 2: Create the migration file**

```sql
-- supabase/migrations/0006_clubs_delete_policy.sql
create policy "admins can delete own club"
  on clubs for delete
  using (is_club_admin(auth.uid(), id));
```

- [ ] **Step 3: Verify no regressions**

```bash
npm run check && npm test
```

Expected: still passes (SQL file doesn't affect TypeScript compilation).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_clubs_delete_policy.sql
git commit -m "feat: add RLS policy for club deletion by admins"
```

---

## Task 2: Root layout — universal Supabase client

**Files:**
- Modify: `src/routes/+layout.server.ts`
- Create: `src/routes/+layout.ts`

**Context:** The root `+layout.server.ts` currently returns `{ session, theme }`. We expose `cookies` (for the new universal layout to create an authenticated server client during SSR) and remove `session` (the universal `+layout.ts` provides it instead). `app.d.ts` already declares `PageData.session: Session | null` globally — this remains satisfied by the universal layout.

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

- [ ] **Step 2: Update `src/routes/+layout.server.ts`**

Replace the entire file content:

```ts
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
```

- [ ] **Step 3: Create `src/routes/+layout.ts`**

```ts
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

  return { supabase, session };
};
```

- [ ] **Step 4: Run type-check**

```bash
npm run check
```

Expected: passes. The `supabase` and `session` values merge with `theme` and `cookies` from the server layout to form the complete page data.

- [ ] **Step 5: Run unit tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/+layout.server.ts src/routes/+layout.ts
git commit -m "feat: add universal Supabase client to root layout"
```

---

## Task 3: Convert sub-layouts to universal

**Files:**
- Create: `src/routes/[club]/+layout.ts`
- Delete: `src/routes/[club]/+layout.server.ts`
- Create: `src/routes/[club]/admin/+layout.ts`
- Delete: `src/routes/[club]/admin/+layout.server.ts`

**Context:** These layouts currently use `locals.safeGetSession()` (server-only). After conversion, they use `supabase` and `session` from the root universal layout via `parent()`. The `redirect()` and `error()` helpers work identically in universal loads — SvelteKit handles them in both SSR and browser contexts.

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

- [ ] **Step 2: Create `src/routes/[club]/+layout.ts`**

```ts
import { error, redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params, parent }) => {
  const { supabase, session } = await parent();
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

- [ ] **Step 3: Delete `src/routes/[club]/+layout.server.ts`**

```bash
rm src/routes/\[club\]/+layout.server.ts
```

- [ ] **Step 4: Create `src/routes/[club]/admin/+layout.ts`**

```ts
import { error } from '@sveltejs/kit';
import { isAdmin } from '$lib/members';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
  const { member } = await parent();
  if (!isAdmin(member)) throw error(403, 'Admin access required');
  return {};
};
```

- [ ] **Step 5: Delete `src/routes/[club]/admin/+layout.server.ts`**

```bash
rm src/routes/\[club\]/admin/+layout.server.ts
```

- [ ] **Step 6: Run type-check**

```bash
npm run check
```

Expected: passes. SvelteKit regenerates the `$types` for all child pages automatically.

- [ ] **Step 7: Run tests**

```bash
npm test
```

- [ ] **Step 8: Commit**

```bash
git add src/routes/\[club\]/+layout.ts src/routes/\[club\]/admin/+layout.ts
git commit -m "feat: convert club and admin layouts to universal loads"
```

---

## Task 4: Convert simple read-only page loads

**Files:**
- Create: `src/routes/[club]/+page.ts`
- Delete: `src/routes/[club]/+page.server.ts`
- Create: `src/routes/[club]/admin/tournaments/+page.ts`
- Delete: `src/routes/[club]/admin/tournaments/+page.server.ts`

**Context:** Both pages have load-only server files (no actions). Converting them to universal loads is a direct port — replace `createUserClient(session.access_token)` with `supabase` from `parent()`.

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

- [ ] **Step 2: Create `src/routes/[club]/+page.ts`**

```ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ count: memberCount }, { count: tournamentCount }] = await Promise.all([
    supabase.from('club_members').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
  ]);

  return {
    memberCount: memberCount ?? 0,
    tournamentCount: tournamentCount ?? 0,
  };
};
```

- [ ] **Step 3: Delete `src/routes/[club]/+page.server.ts`**

```bash
rm src/routes/\[club\]/+page.server.ts
```

- [ ] **Step 4: Create `src/routes/[club]/admin/tournaments/+page.ts`**

```ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('club_id', club.id)
    .order('date', { ascending: false });

  return { tournaments: tournaments ?? [] };
};
```

- [ ] **Step 5: Delete `src/routes/[club]/admin/tournaments/+page.server.ts`**

```bash
rm src/routes/\[club\]/admin/tournaments/+page.server.ts
```

- [ ] **Step 6: Type-check and test**

```bash
npm run check && npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/\[club\]/+page.ts src/routes/\[club\]/admin/tournaments/+page.ts
git commit -m "feat: convert club and tournaments list loads to universal"
```

---

## Task 5: Members page — universal load + client mutations

**Files:**
- Create: `src/routes/[club]/admin/members/+page.ts`
- Modify: `src/routes/[club]/admin/members/+page.server.ts` (remove all actions)
- Modify: `src/routes/[club]/admin/members/+page.svelte`

**Context:** The members page has `create_invite`, `revoke_invite`, `remove_member` actions. The load stays but moves to `+page.ts`. The `.svelte` file currently uses `use:enhance` forms and `form.createdInviteId`. After migration: `form` prop is dropped, `newInviteId` is local state, mutations call `createClient()` directly.

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

- [ ] **Step 2: Create `src/routes/[club]/admin/members/+page.ts`**

```ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from('club_members').select('*').eq('club_id', club.id).order('joined_at'),
    supabase
      .from('club_invites')
      .select('id, created_at, expires_at, used_at')
      .eq('club_id', club.id)
      .is('used_at', null)
      .order('created_at', { ascending: false }),
  ]);

  return { members: members ?? [], invites: invites ?? [] };
};
```

- [ ] **Step 3: Strip `src/routes/[club]/admin/members/+page.server.ts` to empty actions**

Replace the entire file:

```ts
export const actions = {};
```

This keeps SvelteKit happy while we transition — the empty actions export is removed in the next step once the svelte file no longer references `form`.

- [ ] **Step 4: Rewrite `src/routes/[club]/admin/members/+page.svelte`**

Replace the `<script>` block entirely. Remove `form` from `$props`, remove `use:enhance` imports, add client handlers:

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import * as m from '$lib/paraglide/messages';
  import type { ClubMember } from '$lib/types';

  const { data } = $props<{
    data: {
      club: { id: string };
      member: { user_id: string };
      members: ClubMember[];
      invites: { id: string; created_at: string; expires_at: string }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  function inviteUrl(id: string) {
    return `${page.url.origin}/invite/${id}`;
  }

  let copied = $state<string | null>(null);
  async function copyLink(id: string) {
    await navigator.clipboard.writeText(inviteUrl(id));
    copied = id;
    setTimeout(() => { copied = null; }, 2000);
  }

  let loading = $state(false);
  let errorKey = $state<string | null>(null);
  let newInviteId = $state<string | null>(null);

  async function handleCreateInvite() {
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { data: invite, error } = await supabase
        .from('club_invites')
        .insert({ club_id: data.club.id, created_by: data.member.user_id })
        .select('id')
        .single();
      if (error) { errorKey = 'server_error'; return; }
      newInviteId = invite.id;
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('club_invites')
        .delete()
        .eq('id', inviteId)
        .eq('club_id', data.club.id);
      if (error) { errorKey = 'server_error'; return; }
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleRemoveMember(userId: string) {
    if (loading) return;
    if (userId === data.member.user_id) { errorKey = 'error_cannot_remove_self'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('club_members')
        .delete()
        .eq('club_id', data.club.id)
        .eq('user_id', userId);
      if (error) { errorKey = 'server_error'; return; }
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>
```

In the HTML template, replace every `<form method="POST" ... use:enhance>` with `onclick` handlers:

- The "Remove" button: `<button type="button" onclick={() => handleRemoveMember(member.user_id)}>…</button>`
- The "Copy" button: unchanged (already uses `onclick`)
- The "Revoke" button: `<button type="button" onclick={() => handleRevokeInvite(invite.id)}>…</button>`
- The "Generate" button: `<button type="button" onclick={handleCreateInvite}>…</button>`
- Replace `{#if form?.createdInviteId}` with `{#if newInviteId}`
- Replace `form.createdInviteId` with `newInviteId`
- Replace `{#if form?.errorKey}` with `{#if errorKey}`
- Replace `resolveError(form.errorKey)` with `resolveError(errorKey)`
- Replace `data.invites.filter((i) => i.id !== form?.createdInviteId)` with `data.invites.filter((i) => i.id !== newInviteId)`

- [ ] **Step 5: Delete the empty actions from `+page.server.ts`**

Now that the svelte file no longer uses `form`, delete the file entirely:

```bash
rm src/routes/\[club\]/admin/members/+page.server.ts
```

- [ ] **Step 6: Type-check**

```bash
npm run check
```

Expected: passes. If there are type errors in the svelte template about `form`, verify all `form?.` references are removed.

- [ ] **Step 7: Run tests**

```bash
npm test
```

- [ ] **Step 8: Commit**

```bash
git add src/routes/\[club\]/admin/members/
git commit -m "feat: migrate members page to universal load and client mutations"
```

---

## Task 6: Blind-structures page — universal load + client mutations

**Files:**
- Create: `src/routes/[club]/admin/blind-structures/+page.ts`
- Modify: `src/routes/[club]/admin/blind-structures/+page.server.ts` (remove actions)
- Modify: `src/routes/[club]/admin/blind-structures/+page.svelte`

**Context:** Two actions: `create_blind_structure` and `delete_blind_structure`. The create action validates name + levels (same logic moves to the svelte handler). The delete action checks if the structure is in-use before deleting — this check must be replicated client-side.

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

- [ ] **Step 2: Create `src/routes/[club]/admin/blind-structures/+page.ts`**

```ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: structures } = await supabase
    .from('blind_structures')
    .select('*, tournaments(id)')
    .eq('club_id', club.id)
    .order('name');

  return {
    structures: (structures ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      levels: s.levels as { small_blind: number; big_blind: number; ante: number; duration_minutes: number }[],
      in_use: Array.isArray(s.tournaments) && s.tournaments.length > 0,
    })),
  };
};
```

- [ ] **Step 3: Replace `src/routes/[club]/admin/blind-structures/+page.server.ts`**

Delete the entire file:

```bash
rm src/routes/\[club\]/admin/blind-structures/+page.server.ts
```

- [ ] **Step 4: Update `src/routes/[club]/admin/blind-structures/+page.svelte` script**

Replace the `<script>` block:

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{
    data: {
      club: { id: string };
      structures: {
        id: string;
        name: string;
        levels: { small_blind: number; big_blind: number; ante: number; duration_minutes: number }[];
        in_use: boolean;
      }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let levels = $state([{ small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }]);

  function addLevel() {
    levels = [...levels, { small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }];
  }

  function removeLevel(i: number) {
    levels = levels.filter((_, idx) => idx !== i);
  }

  let name = $state('');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);

  async function handleCreate() {
    if (loading) return;
    errorKey = null;
    if (!name.trim()) { errorKey = 'error_required'; return; }
    if (levels.length === 0) { errorKey = 'error_required'; return; }

    const parsedLevels = levels.map((l) => ({
      small_blind: Number(l.small_blind),
      big_blind: Number(l.big_blind),
      ante: Number(l.ante),
      duration_minutes: Number(l.duration_minutes),
    }));
    for (const level of parsedLevels) {
      if (level.small_blind <= 0 || level.big_blind < level.small_blind || level.duration_minutes <= 0 || level.ante < 0) {
        errorKey = 'error_required';
        return;
      }
    }

    loading = true;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('blind_structures')
        .insert({ club_id: data.club.id, name: name.trim(), levels: parsedLevels });
      if (error) { errorKey = 'server_error'; return; }
      name = '';
      levels = [{ small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }];
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { data: linked } = await supabase
        .from('tournaments')
        .select('id')
        .eq('blind_structure_id', id)
        .eq('club_id', data.club.id)
        .limit(1);
      if (linked?.length) { errorKey = 'error_structure_in_use'; return; }
      await supabase.from('blind_structures').delete().eq('id', id).eq('club_id', data.club.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>
```

In the HTML template:
- Replace `<form method="POST" action="?/create_blind_structure" use:enhance>` with a `<div>` wrapper; replace the submit button with `<button type="button" onclick={handleCreate}>`
- Replace `<form method="POST" action="?/delete_blind_structure" use:enhance>` delete button with `<button type="button" onclick={() => handleDelete(s.id)}`
- Remove hidden input fields (`name="id"`, etc.) — values now come from state/function arguments
- Replace `{#if form?.errorKey}` with `{#if errorKey}` and `resolveError(form.errorKey)` with `resolveError(errorKey)`
- The `name` input should `bind:value={name}` instead of `name="name"`

- [ ] **Step 5: Type-check**

```bash
npm run check
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/\[club\]/admin/blind-structures/
git commit -m "feat: migrate blind-structures page to universal load and client mutations"
```

---

## Task 7: Prize-structures page — universal load + client mutations

**Files:**
- Create: `src/routes/[club]/admin/prize-structures/+page.ts`
- Modify: `src/routes/[club]/admin/prize-structures/+page.server.ts` (remove actions)
- Modify: `src/routes/[club]/admin/prize-structures/+page.svelte`

**Context:** Same pattern as blind-structures. Two actions: `create_prize_structure` and `delete_prize_structure`. Create validates using `validatePayouts()` from `$lib/tournaments` (import it in the svelte file).

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

- [ ] **Step 2: Create `src/routes/[club]/admin/prize-structures/+page.ts`**

```ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: structures } = await supabase
    .from('prize_structures')
    .select('*, tournaments(id)')
    .eq('club_id', club.id)
    .order('name');

  return {
    structures: (structures ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      payouts: s.payouts as { position: number; percentage: number }[],
      in_use: Array.isArray(s.tournaments) && s.tournaments.length > 0,
    })),
  };
};
```

- [ ] **Step 3: Delete `src/routes/[club]/admin/prize-structures/+page.server.ts`**

```bash
rm src/routes/\[club\]/admin/prize-structures/+page.server.ts
```

- [ ] **Step 4: Update `src/routes/[club]/admin/prize-structures/+page.svelte` script**

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import { validatePayouts } from '$lib/tournaments';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{
    data: {
      club: { id: string };
      structures: {
        id: string;
        name: string;
        payouts: { position: number; percentage: number }[];
        in_use: boolean;
      }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  function payoutSummary(payouts: { position: number; percentage: number }[]): string {
    return payouts
      .sort((a, b) => a.position - b.position)
      .map((p) => `${p.position}. ${p.percentage}%`)
      .join(', ');
  }

  let payoutRows = $state([{ position: '1', percentage: '' }]);
  const total = $derived(payoutRows.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0));

  function addRow() {
    payoutRows = [...payoutRows, { position: String(payoutRows.length + 1), percentage: '' }];
  }

  function removeRow(i: number) {
    payoutRows = payoutRows.filter((_, idx) => idx !== i);
  }

  let structureName = $state('');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);

  async function handleCreate() {
    if (loading) return;
    errorKey = null;
    if (!structureName.trim()) { errorKey = 'error_required'; return; }
    if (payoutRows.length === 0) { errorKey = 'error_required'; return; }

    const payouts = payoutRows.map((r, i) => ({
      position: Number(r.position) || i + 1,
      percentage: Number(r.percentage) || 0,
    }));
    const validationError = validatePayouts(payouts);
    if (validationError) { errorKey = validationError; return; }

    loading = true;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('prize_structures')
        .insert({ club_id: data.club.id, name: structureName.trim(), payouts });
      if (error) { errorKey = 'server_error'; return; }
      structureName = '';
      payoutRows = [{ position: '1', percentage: '' }];
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { data: linked } = await supabase
        .from('tournaments')
        .select('id')
        .eq('prize_structure_id', id)
        .eq('club_id', data.club.id)
        .limit(1);
      if (linked?.length) { errorKey = 'error_structure_in_use'; return; }
      await supabase.from('prize_structures').delete().eq('id', id).eq('club_id', data.club.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>
```

In the HTML template:
- Replace `<form method="POST" action="?/create_prize_structure" use:enhance>` wrappers with plain `<div>` wrappers
- `name` input: `bind:value={structureName}` (rename state var to avoid `name` keyword conflict)
- Submit button: `<button type="button" onclick={handleCreate}>`
- Delete button: `<button type="button" onclick={() => handleDelete(s.id)}`
- Replace `{#if form?.errorKey}` → `{#if errorKey}`, etc.

- [ ] **Step 5: Type-check and test**

```bash
npm run check && npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/\[club\]/admin/prize-structures/
git commit -m "feat: migrate prize-structures page to universal load and client mutations"
```

---

## Task 8: Tournaments/new — universal load + client mutation

**Files:**
- Create: `src/routes/[club]/admin/tournaments/new/+page.ts`
- Modify: `src/routes/[club]/admin/tournaments/new/+page.server.ts` (remove action)
- Modify: `src/routes/[club]/admin/tournaments/new/+page.svelte`

**Context:** One action: `create_tournament`. After creation, the server action does `redirect(303, ...)`. The client handler uses `goto()` from `$app/navigation` instead.

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

- [ ] **Step 2: Create `src/routes/[club]/admin/tournaments/new/+page.ts`**

```ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ data: blindStructures }, { data: prizeStructures }] = await Promise.all([
    supabase.from('blind_structures').select('id, name').eq('club_id', club.id).order('name'),
    supabase.from('prize_structures').select('id, name').eq('club_id', club.id).order('name'),
  ]);

  return {
    blindStructures: blindStructures ?? [],
    prizeStructures: prizeStructures ?? [],
  };
};
```

- [ ] **Step 3: Delete `src/routes/[club]/admin/tournaments/new/+page.server.ts`**

```bash
rm src/routes/\[club\]/admin/tournaments/new/+page.server.ts
```

- [ ] **Step 4: Update `src/routes/[club]/admin/tournaments/new/+page.svelte` script**

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{
    data: {
      club: { id: string; slug: string };
      blindStructures: { id: string; name: string }[];
      prizeStructures: { id: string; name: string }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let format = $state('freezeout');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const name = formData.get('name')?.toString().trim() ?? '';
      const date = formData.get('date')?.toString() ?? '';
      const formatVal = formData.get('format')?.toString() ?? '';
      const buyInRaw = formData.get('buy_in')?.toString() ?? '';
      const rebuyRaw = formData.get('rebuy_amount')?.toString() ?? '';
      const addonRaw = formData.get('addon_amount')?.toString() ?? '';
      const blindStructureId = formData.get('blind_structure_id')?.toString() ?? '';
      const prizeStructureId = formData.get('prize_structure_id')?.toString() ?? '';

      if (!name || !date || !buyInRaw) { errorKey = 'error_required'; return; }
      if (!['freezeout', 'rebuy'].includes(formatVal)) { errorKey = 'error_required'; return; }

      const buyIn = Math.round(parseFloat(buyInRaw) * 100);
      if (buyIn <= 0) { errorKey = 'error_required'; return; }

      let rebuyAmount: number | null = null;
      let addonAmount: number | null = null;
      if (formatVal === 'rebuy') {
        if (!rebuyRaw) { errorKey = 'error_required'; return; }
        rebuyAmount = Math.round(parseFloat(rebuyRaw) * 100);
        if (rebuyAmount <= 0) { errorKey = 'error_required'; return; }
        if (addonRaw) {
          addonAmount = Math.round(parseFloat(addonRaw) * 100);
          if (addonAmount <= 0) { errorKey = 'error_required'; return; }
        }
      }

      const supabase = createClient();

      if (blindStructureId) {
        const { data: bs } = await supabase.from('blind_structures').select('id').eq('id', blindStructureId).eq('club_id', data.club.id).single();
        if (!bs) { errorKey = 'error_required'; return; }
      }
      if (prizeStructureId) {
        const { data: ps } = await supabase.from('prize_structures').select('id').eq('id', prizeStructureId).eq('club_id', data.club.id).single();
        if (!ps) { errorKey = 'error_required'; return; }
      }

      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          club_id: data.club.id,
          name,
          date,
          format: formatVal,
          buy_in: buyIn,
          rebuy_amount: rebuyAmount,
          addon_amount: addonAmount,
          blind_structure_id: blindStructureId || null,
          prize_structure_id: prizeStructureId || null,
          status: 'registration',
        })
        .select('id')
        .single();

      if (error || !tournament) { errorKey = 'server_error'; return; }
      goto(`/${data.club.slug}/admin/tournaments/${tournament.id}`);
    } finally {
      loading = false;
    }
  }
</script>
```

In the HTML template:
- Change `<form method="POST" action="?/create_tournament" use:enhance` to `<form onsubmit={handleCreate}`
- The existing `bind:value={format}` stays — it's already Svelte state
- Replace `{#if form?.errorKey}` → `{#if errorKey}`, etc.
- Submit button can remain `type="submit"` (the form's `onsubmit` handles it)

- [ ] **Step 5: Type-check and test**

```bash
npm run check && npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/\[club\]/admin/tournaments/new/
git commit -m "feat: migrate tournaments/new page to universal load and client mutation"
```

---

## Task 9: Tournament detail — universal load + client mutations

**Files:**
- Create: `src/routes/[club]/admin/tournaments/[id]/+page.ts`
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.server.ts` (remove all actions)
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

**Context:** This is the largest task. Nine actions move to client handlers. The page load uses `calculatePrizePool` — import it in `+page.ts`. The bust position calculation uses `data.players` (fresh after each `invalidateAll()`). The `finish_tournament` handler runs `calculatePrizePool` and `calculatePayouts` entirely client-side.

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

- [ ] **Step 2: Create `src/routes/[club]/admin/tournaments/[id]/+page.ts`**

```ts
import { error } from '@sveltejs/kit';
import { calculatePrizePool } from '$lib/tournaments';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, blind_structures(name), prize_structures(name, payouts)')
    .eq('id', params.id)
    .eq('club_id', club.id)
    .single();
  if (!tournament) throw error(404, 'Tournament not found');

  const [{ data: players }, { data: members }] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('*, club_members!tournament_players_member_club_id_member_user_id_fkey(display_name)')
      .eq('tournament_id', params.id)
      .order('created_at'),
    supabase
      .from('club_members')
      .select('user_id, display_name')
      .eq('club_id', club.id)
      .order('display_name'),
  ]);

  const allPlayers = players ?? [];
  const registeredIds = new Set(allPlayers.map((p) => p.member_user_id).filter(Boolean));
  const availableMembers = (members ?? []).filter((m) => !registeredIds.has(m.user_id));

  const totalRebuys = allPlayers.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = allPlayers.filter((p) => p.addon).length;
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
  );

  const prizeStructure = tournament.prize_structures
    ? { payouts: tournament.prize_structures.payouts as { position: number; percentage: number }[] }
    : null;

  return { tournament, players: allPlayers, availableMembers, prizePool, prizeStructure };
};
```

- [ ] **Step 3: Delete all actions from `src/routes/[club]/admin/tournaments/[id]/+page.server.ts`**

The file currently has a load function (lines 1–62) and actions (lines 64–456). Delete the entire file:

```bash
rm src/routes/\[club\]/admin/tournaments/\[id\]/+page.server.ts
```

- [ ] **Step 4: Add client mutation handlers to `src/routes/[club]/admin/tournaments/[id]/+page.svelte`**

In the `<script>` block, after the existing imports, add:

```ts
import { createClient } from '$lib/supabase';
import { invalidateAll } from '$app/navigation';
import { calculatePrizePool, calculatePayouts } from '$lib/tournaments';
```

Remove `enhance` from imports. Remove `form` from `$props` destructuring (the page currently has `const { data, form } = $props<{...}>()`; change to `const { data } = $props<{...}>()`).

Add state variables:

```ts
let loading = $state(false);
let errorKey = $state<string | null>(null);
```

Add all handler functions. These go in the `<script>` block:

```ts
async function handleAddPlayer(memberId: string | null, guestName: string | null) {
  if (loading) return;
  if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }
  if (memberId) {
    const existing = data.players.find((p) => p.member_user_id === memberId);
    if (existing) { errorKey = 'error_duplicate_player'; return; }
  }
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    const { error } = await supabase.from('tournament_players').insert({
      tournament_id: data.tournament.id,
      member_club_id: memberId ? data.tournament.club_id : null,
      member_user_id: memberId,
      guest_name: guestName ?? null,
    });
    if (error) { errorKey = 'server_error'; return; }
    await invalidateAll();
  } finally {
    loading = false;
  }
}

async function handleRemovePlayer(playerId: string) {
  if (loading) return;
  if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    await supabase.from('tournament_players').delete().eq('id', playerId).eq('tournament_id', data.tournament.id);
    await invalidateAll();
  } finally {
    loading = false;
  }
}

async function handleStartTournament() {
  if (loading) return;
  if (data.tournament.status !== 'registration') return;
  if (data.players.length < 2) { errorKey = 'tournament_min_players_error'; return; }
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    await supabase.from('tournaments').update({ status: 'running' }).eq('id', data.tournament.id);
    await invalidateAll();
  } finally {
    loading = false;
  }
}

async function handleBustPlayer(playerId: string) {
  if (loading) return;
  if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
  const player = data.players.find((p) => p.id === playerId);
  if (!player || player.finish_position !== null) return;
  const totalPlayers = data.players.length;
  const assigned = new Set(data.players.map((p) => p.finish_position).filter((p) => p !== null));
  const available = Array.from({ length: totalPlayers }, (_, i) => i + 1).filter((p) => !assigned.has(p));
  if (available.length === 0) return;
  const nextPosition = Math.max(...available);
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    await supabase.from('tournament_players')
      .update({ finish_position: nextPosition })
      .eq('id', playerId)
      .eq('tournament_id', data.tournament.id);
    await invalidateAll();
  } finally {
    loading = false;
  }
}

async function handleUnsetBust(playerId: string) {
  if (loading) return;
  if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    await supabase.from('tournament_players')
      .update({ finish_position: null })
      .eq('id', playerId)
      .eq('tournament_id', data.tournament.id);
    await invalidateAll();
  } finally {
    loading = false;
  }
}

async function handleAddRebuy(playerId: string) {
  if (loading) return;
  if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
  if (data.tournament.format !== 'rebuy') return;
  const player = data.players.find((p) => p.id === playerId)!;
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    await supabase.from('tournament_players')
      .update({ rebuys: player.rebuys + 1 })
      .eq('id', playerId)
      .eq('tournament_id', data.tournament.id);
    await invalidateAll();
  } finally {
    loading = false;
  }
}

async function handleRemoveRebuy(playerId: string) {
  if (loading) return;
  if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
  if (data.tournament.format !== 'rebuy') return;
  const player = data.players.find((p) => p.id === playerId)!;
  if (player.rebuys <= 0) return;
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    await supabase.from('tournament_players')
      .update({ rebuys: player.rebuys - 1 })
      .eq('id', playerId)
      .eq('tournament_id', data.tournament.id);
    await invalidateAll();
  } finally {
    loading = false;
  }
}

async function handleToggleAddon(playerId: string) {
  if (loading) return;
  if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }
  if (data.tournament.format !== 'rebuy') return;
  const player = data.players.find((p) => p.id === playerId)!;
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    await supabase.from('tournament_players')
      .update({ addon: !player.addon })
      .eq('id', playerId)
      .eq('tournament_id', data.tournament.id);
    await invalidateAll();
  } finally {
    loading = false;
  }
}

async function handleFinishTournament() {
  if (loading) return;
  if (data.tournament.status !== 'running') return;
  if (data.players.some((p) => p.finish_position === null)) {
    errorKey = 'tournament_positions_incomplete'; return;
  }
  if (!data.prizeStructure) { errorKey = 'error_no_prize_structures'; return; }
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    const totalRebuys = data.players.reduce((sum, p) => sum + p.rebuys, 0);
    const addonCount = data.players.filter((p) => p.addon).length;
    const prizePool = calculatePrizePool(
      data.players.length,
      data.tournament.buy_in,
      totalRebuys,
      data.tournament.rebuy_amount ?? 0,
      addonCount,
      data.tournament.addon_amount ?? 0,
    );
    const payoutResults = calculatePayouts(data.players, data.prizeStructure.payouts, prizePool);
    await Promise.all(
      payoutResults.map(({ playerId, amount }) =>
        supabase.from('tournament_players').update({ payout_amount: amount }).eq('id', playerId)
      )
    );
    await supabase.from('tournaments').update({ status: 'finished' }).eq('id', data.tournament.id);
    await invalidateAll();
  } finally {
    loading = false;
  }
}
```

In the HTML template, replace every `<form method="POST" action="?/..." use:enhance>` with the corresponding `onclick` handler:

- `?/add_player` form → call `handleAddPlayer(memberId, null)` or `handleAddPlayer(null, guestName)` from button clicks
- `?/remove_player` → `onclick={() => handleRemovePlayer(player.id)}`
- `?/start_tournament` → `onclick={handleStartTournament}`
- `?/bust_player` → `onclick={() => handleBustPlayer(player.id)}`
- `?/unset_bust` → `onclick={() => handleUnsetBust(player.id)}`
- `?/add_rebuy` → `onclick={() => handleAddRebuy(player.id)}`
- `?/remove_rebuy` → `onclick={() => handleRemoveRebuy(player.id)}`
- `?/toggle_addon` → `onclick={() => handleToggleAddon(player.id)}`
- `?/finish_tournament` → `onclick={handleFinishTournament}`
- Replace `{#if form?.errorKey}` → `{#if errorKey}` and `resolveError(form.errorKey)` → `resolveError(errorKey)`

- [ ] **Step 5: Type-check**

```bash
npm run check
```

Expected: passes. If any `form?.` reference remains, fix it.

- [ ] **Step 6: Run tests**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/\[club\]/admin/tournaments/\[id\]/
git commit -m "feat: migrate tournament detail page to universal load and client mutations"
```

---

## Task 10: Settings page — client mutations, delete server file

**Files:**
- Modify: `src/routes/[club]/admin/settings/+page.svelte`
- Delete: `src/routes/[club]/admin/settings/+page.server.ts`

**Context:** The settings page has no load function — data comes from parent layouts (`data.club`). Two actions: `update` (club name/slug) and `delete_club`. The delete action currently uses `createServiceClient()` because the clubs table had no DELETE policy — that's fixed by the migration in Task 1. The settings page also has two separate error contexts (update vs. delete), currently discriminated by `form.action`. After migration, use two separate state variables: `updateErrorKey` and `deleteErrorKey`.

- [ ] **Step 1: Verify baseline**

```bash
npm run check && npm test
```

- [ ] **Step 2: Delete `src/routes/[club]/admin/settings/+page.server.ts`**

```bash
rm src/routes/\[club\]/admin/settings/+page.server.ts
```

- [ ] **Step 3: Rewrite `src/routes/[club]/admin/settings/+page.svelte` script**

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll, goto } from '$app/navigation';
  import { isValidSlug } from '$lib/clubs';
  import * as m from '$lib/paraglide/messages';
  import type { Club } from '$lib/types';

  const { data } = $props<{ data: { club: Club } }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let confirmName = $state('');
  const deleteEnabled = $derived(confirmName === data.club.name);

  let loading = $state(false);
  let updateErrorKey = $state<string | null>(null);
  let deleteErrorKey = $state<string | null>(null);
  let saved = $state(false);

  async function handleUpdate(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    loading = true;
    updateErrorKey = null;
    saved = false;
    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const name = formData.get('name')?.toString().trim() ?? '';
      const slug = formData.get('slug')?.toString().trim() ?? '';
      if (!name) { updateErrorKey = 'error_required'; return; }
      if (!isValidSlug(slug)) { updateErrorKey = 'error_invalid_slug'; return; }

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('clubs')
        .update({ name, slug })
        .eq('id', data.club.id);
      if (updateError?.code === '23505') { updateErrorKey = 'error_slug_taken'; return; }
      if (updateError) { updateErrorKey = 'server_error'; return; }

      if (slug !== data.club.slug) {
        goto(`/${slug}/admin/settings`);
        return;
      }
      saved = true;
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleDeleteClub(e: SubmitEvent) {
    e.preventDefault();
    if (loading) return;
    if (confirmName !== data.club.name) { deleteErrorKey = 'error_club_name_mismatch'; return; }
    loading = true;
    deleteErrorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('clubs').delete().eq('id', data.club.id);
      if (error) { deleteErrorKey = 'server_error'; return; }
      goto('/');
    } finally {
      loading = false;
    }
  }
</script>
```

In the HTML template:
- `<form method="POST" action="?/update" use:enhance={...}>` → `<form onsubmit={handleUpdate}>`
- `<form method="POST" action="?/delete_club" use:enhance>` → `<form onsubmit={handleDeleteClub}>`
- `{#if form?.errorKey && form.action !== 'delete'}` → `{#if updateErrorKey}`
- `resolveError(form.errorKey)` (in update section) → `resolveError(updateErrorKey)`
- `{#if form?.saved}` → `{#if saved}`
- `{#if form?.errorKey && form.action === 'delete'}` → `{#if deleteErrorKey}`
- `resolveError(form.errorKey)` (in delete section) → `resolveError(deleteErrorKey)`
- Remove all hidden inputs

- [ ] **Step 4: Type-check**

```bash
npm run check
```

Expected: passes. Ensure no lingering `form?.` references.

- [ ] **Step 5: Run tests**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/\[club\]/admin/settings/
git commit -m "feat: migrate settings page to client mutations, remove server file"
```

---

## Final verification

- [ ] **Run full check and tests one last time**

```bash
npm run check && npm test
```

Expected: all pass with no errors.

- [ ] **Verify no stale server imports remain**

```bash
grep -r "createServiceClient\|createUserClient" src/routes/
```

Expected: no output (all server client usage has been removed from routes; only `src/lib/server/supabase.ts` definition remains).

- [ ] **Verify no stale `use:enhance` or `$app/forms` remains in migrated pages**

```bash
grep -r "use:enhance\|from '\$app/forms'" src/routes/\[club\]/
```

Expected: no output.
