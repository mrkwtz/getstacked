# Client-Side Supabase Mutations & Reads Design

## Goal

Move all data mutations AND reads from server-side SvelteKit loads to direct browser → Supabase calls using RLS. This eliminates Vercel function invocations for page-specific data on every navigation — important because tournament players visiting the app trigger server function costs.

The unavoidable minimum: the root `+layout.server.ts` still runs server-side on every navigation to manage Supabase auth cookies (the session HttpOnly cookie must be set/read server-side). Everything else goes client-side.

---

## Scope

**In scope:**
- Add `src/routes/+layout.ts` — universal layout that creates a Supabase client (browser on client, cookie-aware on server) and exposes it to all child loads via `parent()`
- Modify `src/routes/+layout.server.ts` — expose `cookies` so the universal layout can create an authenticated server-side Supabase client during SSR
- Convert `[club]/+layout.server.ts` → `+layout.ts` (universal)
- Convert `[club]/admin/+layout.server.ts` → `+layout.ts` (universal)
- Convert all `+page.server.ts` load functions → `+page.ts` (universal)
- Remove all `actions` from `+page.server.ts` files
- Add async browser-client mutation handlers to `.svelte` files
- Use `invalidateAll()` after mutations to re-run universal loads
- Add a Supabase RLS migration for clubs DELETE (required for `delete_club`)

**Out of scope:**
- Converting auth routes (`/auth/login`, `/auth/logout`) — use `locals.supabase` for cookie management
- Club creation (`/clubs/new`) — stays server-side
- Invite acceptance (`/invite/[token]`) — stays server-side (service role needed)
- Eliminating the root `+layout.server.ts` entirely (requires switching from HttpOnly cookies to localStorage — a separate future improvement)

---

## RLS Coverage

All required policies already exist:
- `club_invites`: admins can manage (insert/delete)
- `club_members`: admins can manage (delete for remove_member)
- `blind_structures`, `prize_structures`: admins can manage (insert/delete)
- `tournaments`: admins can manage (insert/update)
- `tournament_players`: admins can manage (insert/update/delete)
- `clubs` UPDATE: admins can update — **DELETE is missing, requires new migration**

---

## Migration

### `supabase/migrations/0006_clubs_delete_policy.sql`

```sql
create policy "admins can delete own club"
  on clubs for delete
  using (is_club_admin(auth.uid(), id));
```

---

## Universal Load Setup

### `src/routes/+layout.server.ts` — add `cookies` to return value

```ts
export const load: LayoutServerLoad = async ({ cookies, locals: { safeGetSession } }) => {
  return {
    theme: parseTheme(cookies.get('theme')),
    cookies: cookies.getAll(), // needed by +layout.ts to create server-side Supabase client
  };
};
```

`session` is removed from here — the universal `+layout.ts` below provides it instead.

### `src/routes/+layout.ts` — new file

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
        cookies: { getAll: () => data.cookies, setAll: () => {} },
      });

  const { data: { session } } = await supabase.auth.getSession();

  return { supabase, session };
};
```

- On the server (SSR): uses `data.cookies` from the server layout to create an authenticated client
- On the client (navigation): uses `createBrowserClient` which reads the session from the browser cookie/localStorage
- `depends('supabase:auth')` allows auth state changes to invalidate this load

All child loads receive `{ supabase, session, theme }` via `await parent()`.

---

## Layout Conversions

### `[club]/+layout.server.ts` → `[club]/+layout.ts`

Delete the `.server.ts` file. Create `+layout.ts`:

```ts
import { error, redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params, parent }) => {
  const { supabase, session } = await parent();
  if (!session) throw redirect(303, '/auth/login');

  const { data: club } = await supabase
    .from('clubs').select('*').eq('slug', params.club).single();
  if (!club) throw error(404, 'Club not found');

  const { data: member } = await supabase
    .from('club_members').select('*')
    .eq('club_id', club.id).eq('user_id', session.user.id).single();
  if (!member) throw error(403, 'You are not a member of this club');

  return { club, member };
};
```

On client-side navigation this runs entirely in the browser — no server call.

### `[club]/admin/+layout.server.ts` → `[club]/admin/+layout.ts`

Delete the `.server.ts` file. Create `+layout.ts`:

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

---

## Page Load Conversions

All `+page.server.ts` load functions become `+page.ts`. The pattern: call `await parent()` to get `{ supabase, club }`, use `supabase` for queries.

### `[club]/+page.ts` (was `+page.server.ts`)

```ts
export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();
  const [{ count: memberCount }, { count: tournamentCount }] = await Promise.all([
    supabase.from('club_members').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
  ]);
  return { memberCount: memberCount ?? 0, tournamentCount: tournamentCount ?? 0 };
};
```

### `[club]/admin/members/+page.ts` (keep load, remove actions)

```ts
export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from('club_members').select('*').eq('club_id', club.id).order('joined_at'),
    supabase.from('club_invites').select('id, created_at, expires_at, used_at')
      .eq('club_id', club.id).is('used_at', null).order('created_at', { ascending: false }),
  ]);
  return { members: members ?? [], invites: invites ?? [] };
};
```

### `[club]/admin/tournaments/+page.ts`

```ts
export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();
  const { data: tournaments } = await supabase
    .from('tournaments').select('*').eq('club_id', club.id).order('date', { ascending: false });
  return { tournaments: tournaments ?? [] };
};
```

### `[club]/admin/tournaments/new/+page.ts` (keep load, remove action)

```ts
export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();
  const [{ data: blindStructures }, { data: prizeStructures }] = await Promise.all([
    supabase.from('blind_structures').select('id, name').eq('club_id', club.id).order('name'),
    supabase.from('prize_structures').select('id, name').eq('club_id', club.id).order('name'),
  ]);
  return { blindStructures: blindStructures ?? [], prizeStructures: prizeStructures ?? [] };
};
```

### `[club]/admin/tournaments/[id]/+page.ts` (keep load, remove actions)

```ts
import { error } from '@sveltejs/kit';
import { calculatePrizePool } from '$lib/tournaments';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*, blind_structures(name), prize_structures(name, payouts)')
    .eq('id', params.id).eq('club_id', club.id).single();
  if (!tournament) throw error(404, 'Tournament not found');

  const [{ data: players }, { data: members }] = await Promise.all([
    supabase.from('tournament_players')
      .select('*, club_members!tournament_players_member_club_id_member_user_id_fkey(display_name)')
      .eq('tournament_id', params.id).order('created_at'),
    supabase.from('club_members').select('user_id, display_name')
      .eq('club_id', club.id).order('display_name'),
  ]);

  const allPlayers = players ?? [];
  const registeredIds = new Set(allPlayers.map(p => p.member_user_id).filter(Boolean));
  const availableMembers = (members ?? []).filter(m => !registeredIds.has(m.user_id));
  const totalRebuys = allPlayers.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = allPlayers.filter(p => p.addon).length;

  const prizePool = calculatePrizePool(
    allPlayers.length, tournament.buy_in,
    totalRebuys, tournament.rebuy_amount ?? 0,
    addonCount, tournament.addon_amount ?? 0,
  );

  const prizeStructure = tournament.prize_structures
    ? { payouts: tournament.prize_structures.payouts as { position: number; percentage: number }[] }
    : null;

  return { tournament, players: allPlayers, availableMembers, prizePool, prizeStructure };
};
```

### `[club]/admin/blind-structures/+page.ts` (keep load, remove actions)

```ts
export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();
  const { data: structures } = await supabase
    .from('blind_structures').select('*, tournaments(id)').eq('club_id', club.id).order('name');
  return {
    structures: (structures ?? []).map(s => ({
      id: s.id, name: s.name,
      levels: s.levels as { small_blind: number; big_blind: number; ante: number; duration_minutes: number }[],
      in_use: Array.isArray(s.tournaments) && s.tournaments.length > 0,
    })),
  };
};
```

### `[club]/admin/prize-structures/+page.ts` (keep load, remove actions)

```ts
export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();
  const { data: structures } = await supabase
    .from('prize_structures').select('*, tournaments(id)').eq('club_id', club.id).order('name');
  return {
    structures: (structures ?? []).map(s => ({
      id: s.id, name: s.name,
      payouts: s.payouts as { position: number; percentage: number }[],
      in_use: Array.isArray(s.tournaments) && s.tournaments.length > 0,
    })),
  };
};
```

### `[club]/admin/settings/+page.server.ts` — delete entirely

No load function. After removing actions, the file is empty and deleted.

---

## Mutation Pattern

Every handler uses `try/finally` to ensure `loading` is always reset:

```ts
import { createClient } from '$lib/supabase';
import { invalidateAll } from '$app/navigation';

let loading = $state(false);
let errorKey = $state<string | null>(null);

async function handleAction() {
  if (loading) return;
  loading = true;
  errorKey = null;
  try {
    const supabase = createClient();
    const { error } = await supabase.from('...').insert/update/delete(...);
    if (error) { errorKey = 'server_error'; return; }
    await invalidateAll();
  } finally {
    loading = false;
  }
}
```

`loading` prevents double-submission. The `try/finally` ensures `loading` resets whether the handler returns early or completes normally. `errorKey` replaces `form.errorKey` (same `resolveError(key)` rendering pattern already used in `members/+page.svelte`).

---

## Mutation Changes Per Page

### `[club]/admin/members/+page.server.ts`

Remove actions: `create_invite`, `revoke_invite`, `remove_member`

**`members/+page.svelte` changes:**

- Replace `form.createdInviteId` with `let newInviteId = $state<string | null>(null)`
- `handleCreateInvite()`:
  ```ts
  const { data: invite, error } = await supabase
    .from('club_invites')
    .insert({ club_id: data.club.id, created_by: data.member.user_id })
    .select('id').single();
  if (error) { errorKey = 'server_error'; return; }
  newInviteId = invite.id;
  await invalidateAll();
  ```
- `handleRevokeInvite(inviteId: string)`:
  ```ts
  const { error } = await supabase.from('club_invites').delete().eq('id', inviteId).eq('club_id', data.club.id);
  if (error) { errorKey = 'server_error'; return; }
  await invalidateAll();
  ```
- `handleRemoveMember(userId: string)`:
  - Guard: if `userId === data.member.user_id` → `errorKey = 'error_cannot_remove_self'; return;`
  ```ts
  const { error } = await supabase.from('club_members').delete().eq('club_id', data.club.id).eq('user_id', userId);
  if (error) { errorKey = 'server_error'; return; }
  await invalidateAll();
  ```

---

### `[club]/admin/blind-structures/+page.server.ts`

Remove actions: `create_blind_structure`, `delete_blind_structure`

**`blind-structures/+page.svelte` changes:**

- `handleCreate(formData: FormData)`:
  - Validate: name required, ≥1 level, level values valid (same as current action)
  ```ts
  await supabase.from('blind_structures').insert({ club_id: data.club.id, name, levels });
  await invalidateAll();
  ```
- `handleDelete(id: string)`:
  ```ts
  const { data: linked } = await supabase
    .from('tournaments').select('id').eq('blind_structure_id', id).eq('club_id', data.club.id).limit(1);
  if (linked?.length) { errorKey = 'error_structure_in_use'; return; }
  await supabase.from('blind_structures').delete().eq('id', id).eq('club_id', data.club.id);
  await invalidateAll();
  ```

---

### `[club]/admin/prize-structures/+page.server.ts`

Remove actions: `create_prize_structure`, `delete_prize_structure`

**`prize-structures/+page.svelte` changes:**

- `handleCreate(formData: FormData)`:
  - Validate using existing `validatePayouts()` from `$lib/tournaments`
  ```ts
  await supabase.from('prize_structures').insert({ club_id: data.club.id, name, payouts });
  await invalidateAll();
  ```
- `handleDelete(id: string)`:
  ```ts
  const { data: linked } = await supabase
    .from('tournaments').select('id').eq('prize_structure_id', id).eq('club_id', data.club.id).limit(1);
  if (linked?.length) { errorKey = 'error_structure_in_use'; return; }
  await supabase.from('prize_structures').delete().eq('id', id).eq('club_id', data.club.id);
  await invalidateAll();
  ```

---

### `[club]/admin/tournaments/new/+page.server.ts`

Remove action: `create_tournament`

**`tournaments/new/+page.svelte` changes:**

- `handleCreate(formData: FormData)`:
  - Same validation as the current action (name, date, format, buy_in, etc.)
  - Verify structures belong to this club:
  ```ts
  if (blindStructureId) {
    const { data: bs } = await supabase.from('blind_structures').select('id').eq('id', blindStructureId).eq('club_id', data.club.id).single();
    if (!bs) { errorKey = 'error_required'; return; }
  }
  if (prizeStructureId) {
    const { data: ps } = await supabase.from('prize_structures').select('id').eq('id', prizeStructureId).eq('club_id', data.club.id).single();
    if (!ps) { errorKey = 'error_required'; return; }
  }
  ```
  - Insert and navigate:
  ```ts
  const { data: tournament, error } = await supabase
    .from('tournaments').insert({ ... }).select('id').single();
  if (error) { errorKey = 'server_error'; return; }
  goto(`/${data.club.slug}/admin/tournaments/${tournament.id}`);
  ```
  - `goto` from `$app/navigation` replaces the server `redirect(303, ...)`.

---

### `[club]/admin/tournaments/[id]/+page.server.ts`

Remove all actions: `add_player`, `remove_player`, `start_tournament`, `bust_player`, `unset_bust`, `add_rebuy`, `remove_rebuy`, `toggle_addon`, `finish_tournament`

**`tournaments/[id]/+page.svelte` changes:**

Each becomes an async handler. All needed data is available from the page load (`data.tournament`, `data.players`, `data.prizeStructure`, `data.prizePool`). `invalidateAll()` after each mutation keeps data fresh.

**`handleAddPlayer(memberId: string | null, guestName: string | null)`:**
- Guard: `if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }`
- Duplicate check: `const existing = data.players.find(p => p.member_user_id === memberId); if (existing) { errorKey = 'error_duplicate_player'; return; }`
  ```ts
  await supabase.from('tournament_players').insert({
    tournament_id: data.tournament.id,
    member_club_id: memberId ? data.club.id : null,
    member_user_id: memberId,
    guest_name: guestName ?? null,
  });
  await invalidateAll();
  ```

**`handleRemovePlayer(playerId: string)`:**
- Guard: `if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }`
  ```ts
  await supabase.from('tournament_players').delete().eq('id', playerId).eq('tournament_id', data.tournament.id);
  await invalidateAll();
  ```

**`handleStartTournament()`:**
- Guard: `if (data.tournament.status !== 'registration') return;`
- Guard: `if (data.players.length < 2) { errorKey = 'tournament_min_players_error'; return; }`
  ```ts
  await supabase.from('tournaments').update({ status: 'running' }).eq('id', data.tournament.id);
  await invalidateAll();
  ```

**`handleBustPlayer(playerId: string)`:**
- Guard: `if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }`
- Guard: `const player = data.players.find(p => p.id === playerId); if (!player || player.finish_position !== null) return;`
  ```ts
  const totalPlayers = data.players.length;
  const assigned = new Set(data.players.map(p => p.finish_position).filter(p => p !== null));
  const available = Array.from({ length: totalPlayers }, (_, i) => i + 1).filter(p => !assigned.has(p));
  if (available.length === 0) return;
  const nextPosition = Math.max(...available);
  await supabase.from('tournament_players')
    .update({ finish_position: nextPosition })
    .eq('id', playerId).eq('tournament_id', data.tournament.id);
  await invalidateAll();
  ```

**`handleUnsetBust(playerId: string)`:**
- Guard: `if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }`
  ```ts
  await supabase.from('tournament_players')
    .update({ finish_position: null })
    .eq('id', playerId).eq('tournament_id', data.tournament.id);
  await invalidateAll();
  ```

**`handleAddRebuy(playerId: string)`:**
- Guard: `if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }`
- Guard: `if (data.tournament.format !== 'rebuy') return;`
  ```ts
  const player = data.players.find(p => p.id === playerId)!;
  await supabase.from('tournament_players')
    .update({ rebuys: player.rebuys + 1 })
    .eq('id', playerId).eq('tournament_id', data.tournament.id);
  await invalidateAll();
  ```

**`handleRemoveRebuy(playerId: string)`:**
- Guard: `if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }`
- Guard: `if (data.tournament.format !== 'rebuy') return;`
- Guard: `const player = data.players.find(p => p.id === playerId)!; if (player.rebuys <= 0) return;`
  ```ts
  await supabase.from('tournament_players')
    .update({ rebuys: player.rebuys - 1 })
    .eq('id', playerId).eq('tournament_id', data.tournament.id);
  await invalidateAll();
  ```

**`handleToggleAddon(playerId: string)`:**
- Guard: `if (data.tournament.status !== 'running') { errorKey = 'error_tournament_not_running'; return; }`
- Guard: `if (data.tournament.format !== 'rebuy') return;`
  ```ts
  const player = data.players.find(p => p.id === playerId)!;
  await supabase.from('tournament_players')
    .update({ addon: !player.addon })
    .eq('id', playerId).eq('tournament_id', data.tournament.id);
  await invalidateAll();
  ```

**`handleFinishTournament()`:**
- Guard: `if (data.tournament.status !== 'running') return;`
- Guard: `if (data.players.some(p => p.finish_position === null)) { errorKey = 'tournament_positions_incomplete'; return; }`
- Guard: `if (!data.prizeStructure) { errorKey = 'error_no_prize_structures'; return; }`
  ```ts
  import { calculatePrizePool, calculatePayouts } from '$lib/tournaments';
  const totalRebuys = data.players.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = data.players.filter(p => p.addon).length;
  const prizePool = calculatePrizePool(
    data.players.length, data.tournament.buy_in,
    totalRebuys, data.tournament.rebuy_amount ?? 0,
    addonCount, data.tournament.addon_amount ?? 0,
  );
  const payoutResults = calculatePayouts(data.players, data.prizeStructure.payouts, prizePool);
  await Promise.all(payoutResults.map(({ playerId, amount }) =>
    supabase.from('tournament_players').update({ payout_amount: amount }).eq('id', playerId)
  ));
  await supabase.from('tournaments').update({ status: 'finished' }).eq('id', data.tournament.id);
  await invalidateAll();
  ```

---

### `[club]/admin/settings/+page.server.ts`

Remove actions: `update`, `delete_club`. File becomes empty — delete it.

**`settings/+page.svelte` changes:**

- `handleUpdate(formData: FormData)`:
  - Validate name (non-empty) and slug with `isValidSlug` from `$lib/clubs`:
  ```ts
  if (!isValidSlug(slug)) { errorKey = 'error_invalid_slug'; return; }
  const { error: updateError } = await supabase.from('clubs').update({ name, slug }).eq('id', data.club.id);
  if (updateError?.code === '23505') { errorKey = 'error_slug_taken'; return; }
  if (updateError) { errorKey = 'server_error'; return; }
  if (slug !== data.club.slug) { goto(`/${slug}/admin/settings`); return; }
  saved = true;
  await invalidateAll();
  ```

- `handleDeleteClub(confirmName: string)`:
  - Guard: `if (confirmName !== data.club.name) { errorKey = 'error_club_name_mismatch'; return; }`
  ```ts
  await supabase.from('clubs').delete().eq('id', data.club.id);
  goto('/');
  ```

---

## What Stays Server-Side

| File | Reason |
|---|---|
| `src/routes/+layout.server.ts` | Auth cookie management (unavoidable) |
| `src/routes/[club]/admin/+page.server.ts` | Redirect only — trivial |
| `src/routes/clubs/new/+page.server.ts` | Club creation stays server-side |
| `src/routes/invite/[token]/+page.server.ts` | Invite acceptance needs service role |
| `src/routes/auth/*/+page.server.ts` | Cookie-based auth management |
| `src/hooks.server.ts` | Supabase cookie client setup |

**Server invocations per navigation after migration:**
- Root `+layout.server.ts` only — 1 invocation (down from 3–4 today)
- Page-specific data: 0 server invocations (browser → Supabase directly)

---

## Error Handling

- All `.svelte` files: `let errorKey = $state<string | null>(null)` replaces `form.errorKey`
- Render errors with existing `resolveError(key)` pattern (already in `members/+page.svelte`, copy to others)
- `loading = $state(false)` with `try/finally` prevents double-submission and ensures reset

---

## i18n Keys Used

All keys are already defined in `messages/en.json` and `messages/de.json`:
- `server_error`, `error_required`, `error_invalid_slug`, `error_slug_taken`, `error_club_name_mismatch`
- `error_structure_in_use`, `error_cannot_remove_self`, `error_duplicate_player`
- `error_tournament_not_open`, `error_tournament_not_running`, `error_no_prize_structures`
- `tournament_min_players_error`, `tournament_positions_incomplete`

No new keys needed.
