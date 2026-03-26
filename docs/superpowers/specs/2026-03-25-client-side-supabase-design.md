# Client-Side Supabase Mutations Design

## Goal

Move all data mutations from SvelteKit server actions (browser → server → Supabase) to direct browser → Supabase calls using RLS, so writes skip the server entirely. Page loads (reads) stay as server loads — they already respect RLS via `createUserClient`, and converting them to universal loads would require a cookie-aware Supabase client setup in a root `+layout.ts`, which is a separate concern.

---

## Scope

**In scope:**
- Remove all `actions` exports from `+page.server.ts` files
- Add async browser-client mutation handlers to `.svelte` files
- Replace `use:enhance` form submissions with `onclick` handlers
- Use `invalidateAll()` after each mutation to re-run server loads
- Add a Supabase RLS migration for clubs DELETE (required for `delete_club`)

**Out of scope:**
- Converting page loads to universal loads (`+page.ts`)
- Auth/session management changes
- Realtime subscriptions or optimistic UI
- Club creation (`/clubs/new`) — stays server-side (redirects after creation)
- Invite acceptance (`/invite/[token]`) — stays server-side (service role needed)

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

## Mutation Pattern

Every handler uses `try/finally` to ensure `loading` is always reset, even on early returns:

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

`loading` prevents double-submission. The `try/finally` ensures `loading` is reset whether the handler returns early (validation failure, error) or completes normally. `errorKey` replaces `form.errorKey` (same `resolveError(key)` rendering pattern already used in `members/+page.svelte`).

---

## Per-Page Changes

### `[club]/admin/members/+page.server.ts`

Remove actions: `create_invite`, `revoke_invite`, `remove_member`

The file becomes load-only (no `actions` export, no `createServiceClient` import).

**`members/+page.svelte` changes:**

- Replace `form.createdInviteId` with `let newInviteId = $state<string | null>(null)`
- `handleCreateInvite()`:
  ```ts
  const { data: invite, error } = await supabase
    .from('club_invites')
    .insert({ club_id: data.club.id, created_by: data.member.user_id })
    .select('id')
    .single();
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
  - Perform same validation as the current action (name required, ≥1 level, level values valid)
  - On validation error: set `errorKey` without calling Supabase
  ```ts
  await supabase.from('blind_structures').insert({ club_id: data.club.id, name, levels });
  await invalidateAll();
  ```
- `handleDelete(id: string)`:
  - Check in-use before deleting (include `club_id` to scope to user's club via RLS):
  ```ts
  const { data: linked } = await supabase
    .from('tournaments').select('id')
    .eq('blind_structure_id', id).eq('club_id', data.club.id).limit(1);
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
  - Same in-use check as blind structures (query `tournaments` by `prize_structure_id`):
  ```ts
  const { data: linked } = await supabase
    .from('tournaments').select('id')
    .eq('prize_structure_id', id).eq('club_id', data.club.id).limit(1);
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
  - Verify optional structure IDs belong to this club (if provided):
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

Each becomes an async handler. The page already has all needed data from the server load (`data.tournament`, `data.players`, `data.prizeStructure`, `data.prizePool`). `invalidateAll()` after each mutation ensures `data.players` is fresh before the next operation.

---

**`handleAddPlayer(memberId: string | null, guestName: string | null)`:**
- Guard: `if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }`
- Duplicate check:
  ```ts
  if (memberId) {
    const existing = data.players.find(p => p.member_user_id === memberId);
    if (existing) { errorKey = 'error_duplicate_player'; return; }
  }
  ```
- Insert:
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
- Guard: already-busted check:
  ```ts
  const player = data.players.find(p => p.id === playerId);
  if (!player || player.finish_position !== null) return;
  ```
- Calculate next position from current `data.players` (same algorithm as server):
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
  `invalidateAll()` refreshes `data.players` so the next bust uses fresh position data.

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
- Guard: `if (player.rebuys <= 0) return;`
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
- Guard: all players must have positions:
  ```ts
  if (data.players.some(p => p.finish_position === null)) {
    errorKey = 'tournament_positions_incomplete'; return;
  }
  ```
- Guard: prize structure must be assigned:
  ```ts
  if (!data.prizeStructure) { errorKey = 'error_no_prize_structures'; return; }
  ```
- Recalculate prize pool from current page data (matches server logic; data is fresh after invalidateAll on each rebuy/addon):
  ```ts
  import { calculatePrizePool, calculatePayouts } from '$lib/tournaments';
  const totalRebuys = data.players.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = data.players.filter(p => p.addon).length;
  const prizePool = calculatePrizePool(
    data.players.length,
    data.tournament.buy_in,
    totalRebuys,
    data.tournament.rebuy_amount ?? 0,
    addonCount,
    data.tournament.addon_amount ?? 0
  );
  const payoutResults = calculatePayouts(data.players, data.prizeStructure.payouts, prizePool);
  ```
- Write payouts then set status:
  ```ts
  const { error: payoutError } = await supabase.rpc // use individual updates:
  await Promise.all(payoutResults.map(({ playerId, amount }) =>
    supabase.from('tournament_players').update({ payout_amount: amount }).eq('id', playerId)
  ));
  await supabase.from('tournaments').update({ status: 'finished' }).eq('id', data.tournament.id);
  await invalidateAll();
  ```

---

### `[club]/admin/settings/+page.server.ts`

Remove actions: `update`, `delete_club`

The file currently has no `load` export (load comes from parent layout). After removing actions it becomes empty and can be deleted entirely.

**`settings/+page.svelte` changes:**

- `handleUpdate(formData: FormData)`:
  - Validate name (non-empty) and slug with `isValidSlug` from `$lib/clubs`:
  ```ts
  if (!isValidSlug(slug)) { errorKey = 'error_invalid_slug'; return; }
  ```
  - Update:
  ```ts
  const { error: updateError } = await supabase
    .from('clubs').update({ name, slug }).eq('id', data.club.id);
  if (updateError?.code === '23505') { errorKey = 'error_slug_taken'; return; }
  if (updateError) { errorKey = 'server_error'; return; }
  if (slug !== data.club.slug) { goto(`/${slug}/admin/settings`); return; }
  saved = true;
  await invalidateAll();
  ```

- `handleDeleteClub(confirmName: string)`:
  - Client-side confirmation: `if (confirmName !== data.club.name) { errorKey = 'error_club_name_mismatch'; return; }`
  ```ts
  await supabase.from('clubs').delete().eq('id', data.club.id);
  goto('/');
  ```
  - Relies on the new clubs DELETE policy in migration `0006`.

---

## What Stays Server-Side

| File | Reason |
|---|---|
| `src/routes/+layout.server.ts` | Session cookie management |
| `src/routes/[club]/+layout.server.ts` | Auth validation + redirect |
| `src/routes/[club]/admin/+layout.server.ts` | Admin role check |
| `src/routes/[club]/admin/+page.server.ts` | Redirect only |
| `src/routes/clubs/new/+page.server.ts` | Club creation stays server-side |
| `src/routes/invite/[token]/+page.server.ts` | Invite acceptance needs service role |
| `src/routes/auth/*/+page.server.ts` | Auth/session management |
| All `+page.server.ts` `load` functions | Unchanged — reads stay server-side |

---

## Error Handling

- All `.svelte` files: `let errorKey = $state<string | null>(null)` replaces `form.errorKey`
- Render errors with existing `resolveError(key)` pattern (already in `members/+page.svelte`, copy to others)
- `loading = $state(false)` prevents double-submission on all handlers

---

## i18n Keys Used

All keys referenced in handlers are already defined in `messages/en.json` and `messages/de.json`:
- `server_error`, `error_required`, `error_invalid_slug`, `error_slug_taken`, `error_club_name_mismatch`
- `error_structure_in_use`, `error_cannot_remove_self`, `error_duplicate_player`
- `error_tournament_not_open`, `error_tournament_not_running`, `error_no_prize_structures`
- `tournament_min_players_error`, `tournament_positions_incomplete`

No new keys needed.
