# Tournament Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable admins to start a tournament, track bust order/rebuys/add-ons live per player, review final positions, and finish the tournament with payouts saved to the database.

**Architecture:** All UI lives on the existing tournament detail page (`/[club]/admin/tournaments/[id]`). The page re-renders after each server action round-trip — no optimistic UI needed. Business logic for payout calculation is pure TypeScript in `src/lib/tournaments.ts`, server-validated and tested with Vitest.

**Tech Stack:** SvelteKit 2, Svelte 5 runes (`$props`, `$state`, `$derived`), Supabase (service client for writes), Paraglide i18n, Vitest

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/0005_tournament_results.sql` | Create — add `payout_amount` column |
| `src/lib/types.ts` | Modify — add `payout_amount` to `TournamentPlayer`; extend `Tournament.prize_structures` with `payouts` |
| `src/lib/tournaments.ts` | Modify — add `calculatePayouts` function |
| `tests/unit/tournaments.test.ts` | Modify — add `calculatePayouts` tests |
| `messages/en.json` | Modify — add 14 new i18n keys |
| `messages/de.json` | Modify — add 14 new i18n keys (German) |
| `src/routes/[club]/admin/tournaments/[id]/+page.server.ts` | Modify — update load function; add 7 new actions |
| `src/routes/[club]/admin/tournaments/[id]/+page.svelte` | Modify — overhaul for all 3 status states |

---

## Task 1: DB Migration & Type Updates

**Files:**
- Create: `supabase/migrations/0005_tournament_results.sql`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0005_tournament_results.sql
alter table tournament_players
  add column payout_amount integer; -- cents, null until tournament finished
```

- [ ] **Step 2: Apply migration locally**

```bash
npx supabase db reset
```

Expected: "Finished supabase db reset on branch main." All 5 migrations applied.

- [ ] **Step 3: Update `TournamentPlayer` in `src/lib/types.ts`**

Find the `TournamentPlayer` interface (currently ends around line 514) and add `payout_amount`:

```typescript
export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  member_club_id: string | null;
  member_user_id: string | null;
  guest_name: string | null;
  rebuys: number;
  addon: boolean;
  finish_position: number | null;
  payout_amount: number | null;  // ← add this line
  created_at: string;
  club_members?: { display_name: string } | null;
}
```

- [ ] **Step 4: Update `Tournament` in `src/lib/types.ts`**

The `prize_structures` field currently is `{ name: string } | null`. Extend it to include `payouts` so the load function can return prize structure data for client-side preview:

```typescript
export interface Tournament {
  id: string;
  club_id: string;
  name: string;
  date: string;
  format: 'freezeout' | 'rebuy';
  buy_in: number;
  rebuy_amount: number | null;
  addon_amount: number | null;
  blind_structure_id: string | null;
  prize_structure_id: string | null;
  status: 'registration' | 'running' | 'finished';
  created_at: string;
  blind_structures?: { name: string } | null;
  prize_structures?: { name: string; payouts: { position: number; percentage: number }[] } | null;
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_tournament_results.sql src/lib/types.ts
git commit -m "feat: add payout_amount column and update tournament types"
```

---

## Task 2: `calculatePayouts` Function (TDD)

**Files:**
- Modify: `tests/unit/tournaments.test.ts`
- Modify: `src/lib/tournaments.ts`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `tests/unit/tournaments.test.ts` after the existing `validatePayouts` block:

```typescript
import { describe, it, expect } from "vitest";
import { calculatePrizePool, validatePayouts, calculatePayouts } from "../../src/lib/tournaments";

// ... existing tests unchanged ...

describe("calculatePayouts", () => {
  it("distributes prize pool with clean percentages (no remainder)", () => {
    const players = [
      { id: "p1", finish_position: 1 },
      { id: "p2", finish_position: 2 },
      { id: "p3", finish_position: 3 },
    ];
    const payouts = [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 10 },
    ];
    const result = calculatePayouts(players, payouts, 10000);
    expect(result).toEqual(
      expect.arrayContaining([
        { playerId: "p1", amount: 6000 },
        { playerId: "p2", amount: 3000 },
        { playerId: "p3", amount: 1000 },
      ])
    );
  });

  it("adds rounding remainder to 1st place player", () => {
    // 3 players, pool 100 cents, payouts 60/30/10
    // floor(100*60/100)=60, floor(100*30/100)=30, floor(100*10/100)=10 → sum=100, no remainder
    // Use odd amounts to force a remainder: pool 10001 cents, 60/30/10
    // 60%: floor(10001*60/100)=6000, 30%: floor(10001*30/100)=3000, 10%: floor(10001*10/100)=1000
    // total distributed = 10000, remainder = 1 → goes to position 1
    const players = [
      { id: "p1", finish_position: 1 },
      { id: "p2", finish_position: 2 },
      { id: "p3", finish_position: 3 },
    ];
    const payouts = [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 10 },
    ];
    const result = calculatePayouts(players, payouts, 10001);
    const p1 = result.find((r) => r.playerId === "p1")!;
    const p2 = result.find((r) => r.playerId === "p2")!;
    const p3 = result.find((r) => r.playerId === "p3")!;
    expect(p1.amount).toBe(6001); // gets the +1 remainder
    expect(p2.amount).toBe(3000);
    expect(p3.amount).toBe(1000);
  });

  it("skips prize positions with no matching player (fewer players than paid positions)", () => {
    const players = [
      { id: "p1", finish_position: 1 },
      { id: "p2", finish_position: 2 },
    ];
    const payouts = [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 10 }, // no player in 3rd
    ];
    const result = calculatePayouts(players, payouts, 10000);
    expect(result).toHaveLength(2);
    const p1 = result.find((r) => r.playerId === "p1")!;
    const p2 = result.find((r) => r.playerId === "p2")!;
    expect(p1.amount).toBe(6000);
    expect(p2.amount).toBe(3000);
    // position 3 percentage is not redistributed — it's simply not awarded
  });

  it("unpaid players receive amount 0", () => {
    const players = [
      { id: "p1", finish_position: 1 },
      { id: "p2", finish_position: 2 },
      { id: "p3", finish_position: 3 },
      { id: "p4", finish_position: 4 },
    ];
    const payouts = [
      { position: 1, percentage: 70 },
      { position: 2, percentage: 30 },
    ];
    const result = calculatePayouts(players, payouts, 10000);
    const p3 = result.find((r) => r.playerId === "p3")!;
    const p4 = result.find((r) => r.playerId === "p4")!;
    expect(p3.amount).toBe(0);
    expect(p4.amount).toBe(0);
    expect(result).toHaveLength(4); // all players have an entry
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/tournaments.test.ts
```

Expected: 4 failures — `calculatePayouts is not a function` (or similar import error).

- [ ] **Step 3: Implement `calculatePayouts` in `src/lib/tournaments.ts`**

Add after the existing `validatePayouts` function:

```typescript
export function calculatePayouts(
  players: { id: string; finish_position: number | null }[],
  payouts: Payout[],   // from prize structure; percentage is a whole number (e.g. 60 = 60%)
  prizePool: number,   // cents
): { playerId: string; amount: number }[] {
  // Build a map of finish_position → player id
  const byPosition = new Map<number, string>();
  for (const player of players) {
    if (player.finish_position !== null) {
      byPosition.set(player.finish_position, player.id);
    }
  }

  // Sort payouts ascending by position
  const sorted = [...payouts].sort((a, b) => a.position - b.position);

  // Calculate base amounts
  const amounts = new Map<string, number>();
  let distributed = 0;

  for (const payout of sorted) {
    const playerId = byPosition.get(payout.position);
    if (playerId === undefined) continue; // no player at this position — skip
    const amount = Math.floor(prizePool * payout.percentage / 100);
    amounts.set(playerId, amount);
    distributed += amount;
  }

  // Add rounding remainder to 1st place — but ONLY when all prize positions were awarded.
  // If any position had no player, the un-awarded percentage is not redistributed.
  const allPositionsFilled = sorted.every((payout) => byPosition.has(payout.position));
  const remainder = prizePool - distributed;
  if (remainder > 0 && allPositionsFilled) {
    const firstPlaceId = byPosition.get(1);
    if (firstPlaceId !== undefined) {
      amounts.set(firstPlaceId, (amounts.get(firstPlaceId) ?? 0) + remainder);
    }
  }

  // Return an entry for every player (paid: their amount, unpaid: 0)
  return players.map((player) => ({
    playerId: player.id,
    amount: amounts.get(player.id) ?? 0,
  }));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/tournaments.test.ts
```

Expected: all tests pass (including existing `calculatePrizePool` and `validatePayouts` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tournaments.ts tests/unit/tournaments.test.ts
git commit -m "feat: add calculatePayouts with TDD tests"
```

---

## Task 3: i18n Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

Note: Paraglide regenerates `src/lib/paraglide/` automatically when the dev server runs (or on build). No manual step needed for that.

- [ ] **Step 1: Add keys to `messages/en.json`**

Add the following entries before the closing `}`. Insert them after `"error_club_name_mismatch"`:

```json
  "tournament_start_button": "Start tournament",
  "tournament_finish_button": "Finish tournament",
  "tournament_confirm_finish": "Confirm & close tournament",
  "tournament_cancel_review": "Cancel",
  "tournament_review_title": "Review results",
  "tournament_position_col": "Position",
  "tournament_payout_col": "Payout",
  "tournament_bust_button": "→ {position}",
  "tournament_undo_bust": "Undo",
  "tournament_rebuy_col": "Rebuys",
  "tournament_addon_col": "Add-on",
  "tournament_min_players_error": "At least 2 players required to start.",
  "tournament_positions_incomplete": "Assign all finish positions before finishing.",
  "error_tournament_not_running": "This action requires the tournament to be running."
```

- [ ] **Step 2: Add keys to `messages/de.json`**

Add the same keys in German after `"error_club_name_mismatch"`:

```json
  "tournament_start_button": "Turnier starten",
  "tournament_finish_button": "Turnier beenden",
  "tournament_confirm_finish": "Bestätigen & Turnier schließen",
  "tournament_cancel_review": "Abbrechen",
  "tournament_review_title": "Ergebnisse prüfen",
  "tournament_position_col": "Platz",
  "tournament_payout_col": "Auszahlung",
  "tournament_bust_button": "→ {position}",
  "tournament_undo_bust": "Rückgängig",
  "tournament_rebuy_col": "Rebuys",
  "tournament_addon_col": "Add-on",
  "tournament_min_players_error": "Mindestens 2 Spieler erforderlich.",
  "tournament_positions_incomplete": "Alle Platzierungen müssen vergeben sein.",
  "error_tournament_not_running": "Diese Aktion erfordert ein laufendes Turnier."
```

- [ ] **Step 3: Verify Paraglide picks up the new keys**

```bash
npm run build 2>&1 | head -20
```

Expected: no errors about missing message keys. (Or start dev server and confirm no type errors.)

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json
git commit -m "feat: add tournament lifecycle i18n keys"
```

---

## Task 4: Server Actions + Load Function Update

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.server.ts`

This task replaces the entire file. The current file has: `load` (fetches tournament + players + members), `getClubAndMember` helper, `add_player` action, `remove_player` action. We add 7 new actions and fix the load function.

- [ ] **Step 1: Update the load function**

The load function needs three changes:
1. Extend the prize_structures join to include `payouts` (not just `name`)
2. Fix the `calculatePrizePool` call site to use actual rebuys and add-ons
3. Return `prizeStructure` for client-side preview

Replace the `load` function (lines 7–50 of the current file):

```typescript
export const load: PageServerLoad = async ({ params, parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const userClient = createUserClient(session!.access_token);

  const { data: tournament } = await userClient
    .from('tournaments')
    .select('*, blind_structures(name), prize_structures(name, payouts)')
    .eq('id', params.id)
    .eq('club_id', club.id)
    .single();

  if (!tournament) throw error(404, 'Tournament not found');

  const [{ data: players }, { data: members }] = await Promise.all([
    userClient
      .from('tournament_players')
      .select('*, club_members!tournament_players_member_club_id_member_user_id_fkey(display_name)')
      .eq('tournament_id', params.id)
      .order('created_at'),
    userClient
      .from('club_members')
      .select('user_id, display_name')
      .eq('club_id', club.id)
      .order('display_name'),
  ]);

  const registeredIds = new Set((players ?? []).map((p) => p.member_user_id).filter(Boolean));
  const availableMembers = (members ?? []).filter((m) => !registeredIds.has(m.user_id));

  const allPlayers = players ?? [];
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

  return {
    tournament,
    players: allPlayers,
    availableMembers,
    prizePool,
    prizeStructure,
  };
};
```

- [ ] **Step 2: Add the 7 new actions**

Add these to the `actions` object in `+page.server.ts` (after the existing `remove_player` action). Also add `calculatePayouts` to the imports at the top of the file:

```typescript
import { calculatePrizePool, calculatePayouts } from '$lib/tournaments';
```

Then add the new actions:

```typescript
  start_tournament: async ({ params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'registration') return fail(400, { errorKey: 'error_tournament_not_open' });

    const { count } = await service
      .from('tournament_players')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', params.id);
    if ((count ?? 0) < 2) return fail(400, { errorKey: 'tournament_min_players_error' });

    const { error: updateError } = await service
      .from('tournaments')
      .update({ status: 'running' })
      .eq('id', params.id);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  bust_player: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });

    const { data: players } = await service
      .from('tournament_players')
      .select('id, finish_position')
      .eq('tournament_id', params.id);
    if (!players) return fail(500, { errorKey: 'server_error' });

    const player = players.find((p) => p.id === playerId);
    if (!player) return fail(400, { errorKey: 'server_error' });
    if (player.finish_position !== null) return fail(400, { errorKey: 'server_error' });

    // next position = MAX of {1..total_players} not currently assigned
    const totalPlayers = players.length;
    const assigned = new Set(players.map((p) => p.finish_position).filter((p) => p !== null));
    const available = Array.from({ length: totalPlayers }, (_, i) => i + 1).filter((p) => !assigned.has(p));
    const nextPosition = Math.max(...available);

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ finish_position: nextPosition })
      .eq('id', playerId)
      .eq('tournament_id', params.id);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  unset_bust: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });

    // Verify player belongs to this tournament
    const { data: player } = await service
      .from('tournament_players')
      .select('id')
      .eq('id', playerId)
      .eq('tournament_id', params.id)
      .single();
    if (!player) return fail(400, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ finish_position: null })
      .eq('id', playerId)
      .eq('tournament_id', params.id);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  add_rebuy: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status, format')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });
    if (tournament.format !== 'rebuy') return fail(400, { errorKey: 'server_error' });

    const { data: player } = await service
      .from('tournament_players')
      .select('id, rebuys')
      .eq('id', playerId)
      .eq('tournament_id', params.id)
      .single();
    if (!player) return fail(400, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ rebuys: player.rebuys + 1 })
      .eq('id', playerId);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  remove_rebuy: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status, format')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });
    if (tournament.format !== 'rebuy') return fail(400, { errorKey: 'server_error' });

    const { data: player } = await service
      .from('tournament_players')
      .select('id, rebuys')
      .eq('id', playerId)
      .eq('tournament_id', params.id)
      .single();
    if (!player) return fail(400, { errorKey: 'server_error' });
    if (player.rebuys <= 0) return fail(400, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ rebuys: player.rebuys - 1 })
      .eq('id', playerId);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  toggle_addon: async ({ request, params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('status, format')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });
    if (tournament.format !== 'rebuy') return fail(400, { errorKey: 'server_error' });

    const { data: player } = await service
      .from('tournament_players')
      .select('id, addon')
      .eq('id', playerId)
      .eq('tournament_id', params.id)
      .single();
    if (!player) return fail(400, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournament_players')
      .update({ addon: !player.addon })
      .eq('id', playerId);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },

  finish_tournament: async ({ params, locals: { safeGetSession } }) => {
    const { club, member } = await getClubAndMember(params, safeGetSession);
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const service = createServiceClient();

    const { data: tournament } = await service
      .from('tournaments')
      .select('*, prize_structures(payouts)')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'running') return fail(400, { errorKey: 'error_tournament_not_running' });

    const { data: players } = await service
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', params.id);
    if (!players) return fail(500, { errorKey: 'server_error' });

    if (players.some((p) => p.finish_position === null)) {
      return fail(400, { errorKey: 'tournament_positions_incomplete' });
    }

    if (!tournament.prize_structure_id || !tournament.prize_structures) {
      return fail(400, { errorKey: 'error_no_prize_structures' });
    }

    const totalRebuys = players.reduce((sum, p) => sum + p.rebuys, 0);
    const addonCount = players.filter((p) => p.addon).length;
    const prizePool = calculatePrizePool(
      players.length,
      tournament.buy_in,
      totalRebuys,
      tournament.rebuy_amount ?? 0,
      addonCount,
      tournament.addon_amount ?? 0,
    );

    const payoutResults = calculatePayouts(
      players,
      tournament.prize_structures.payouts as { position: number; percentage: number }[],
      prizePool,
    );

    const payoutUpdates = await Promise.all(
      payoutResults.map(({ playerId, amount }) =>
        service
          .from('tournament_players')
          .update({ payout_amount: amount })
          .eq('id', playerId),
      ),
    );
    if (payoutUpdates.some((r) => r.error)) return fail(500, { errorKey: 'server_error' });

    const { error: updateError } = await service
      .from('tournaments')
      .update({ status: 'finished' })
      .eq('id', params.id);
    if (updateError) return fail(500, { errorKey: 'server_error' });

    return {};
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are Supabase type inference errors on the new columns (since `payout_amount` isn't in the generated `Database` type yet), add `as any` casts where needed or run `npx supabase gen types typescript --local > src/lib/database.types.ts` and re-append manual types.

- [ ] **Step 4: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.server.ts
git commit -m "feat: add tournament lifecycle server actions"
```

---

## Task 5: UI Overhaul

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

This task replaces the entire Svelte component. Read the existing file first, then rewrite it.

- [ ] **Step 1: Write the new `+page.svelte`**

Replace the entire file with:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import { calculatePayouts } from '$lib/tournaments';
  import type { Tournament, TournamentPlayer } from '$lib/types';

  const { data, form } = $props<{
    data: {
      tournament: Tournament;
      players: TournamentPlayer[];
      availableMembers: { user_id: string; display_name: string }[];
      prizePool: number;
      prizeStructure: { payouts: { position: number; percentage: number }[] } | null;
    };
    form: { errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  function statusLabel(status: Tournament['status']): string {
    if (status === 'registration') return m.tournament_status_registration();
    if (status === 'running') return m.tournament_status_running();
    return m.tournament_status_finished();
  }

  function statusClass(status: Tournament['status']): string {
    if (status === 'registration') return 'bg-accent/15 text-accent';
    if (status === 'running') return 'bg-amber-500/15 text-amber-500';
    return 'bg-muted text-muted-foreground';
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
  }

  const t = $derived(data.tournament);
  const formatLabel = $derived(
    t.format === 'freezeout' ? m.tournament_format_freezeout() : m.tournament_format_rebuy()
  );
  const metaLine = $derived([
    formatDate(t.date),
    formatLabel,
    `€${(t.buy_in / 100).toFixed(2)} buy-in`,
    t.blind_structures?.name,
    t.prize_structures?.name,
  ].filter(Boolean).join(' · '));

  // Running state derived values
  const nextBustPosition = $derived((() => {
    const assigned = new Set(data.players.map((p) => p.finish_position).filter((p) => p !== null));
    const total = data.players.length;
    const available = Array.from({ length: total }, (_, i) => i + 1).filter((p) => !assigned.has(p));
    return available.length > 0 ? Math.max(...available) : 1;
  })());

  const allPositionsAssigned = $derived(
    data.players.length > 0 && data.players.every((p) => p.finish_position !== null)
  );

  const canFinish = $derived(allPositionsAssigned && data.prizeStructure !== null);

  // Finish review state
  let showReview = $state(false);

  const reviewPayouts = $derived(
    data.prizeStructure
      ? calculatePayouts(data.players, data.prizeStructure.payouts, data.prizePool)
      : []
  );

  // Sort players by position for finished view
  const sortedFinished = $derived(
    [...data.players].sort((a, b) => (a.finish_position ?? 999) - (b.finish_position ?? 999))
  );

  let selectedMemberId = $state('');
  let guestName = $state('');
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-base font-semibold text-foreground">{t.name}</h1>
      <p class="text-xs text-muted-foreground mt-1">{metaLine}</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-xs font-medium px-2 py-0.5 rounded-full {statusClass(t.status)}">
        {statusLabel(t.status)}
      </span>

      {#if t.status === 'registration'}
        <form method="POST" action="?/start_tournament" use:enhance>
          <button
            type="submit"
            disabled={data.players.length < 2}
            title={data.players.length < 2 ? m.tournament_min_players_error() : undefined}
            class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {m.tournament_start_button()}
          </button>
        </form>
      {:else if t.status === 'running'}
        <button
          type="button"
          disabled={!canFinish}
          title={!data.prizeStructure ? resolveError('error_no_prize_structures') : !allPositionsAssigned ? m.tournament_positions_incomplete() : undefined}
          onclick={() => { showReview = true; }}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.tournament_finish_button()}
        </button>
      {/if}
    </div>
  </div>

  <!-- Prize pool callout -->
  <div class="bg-accent/5 border border-accent/20 rounded-lg px-4 py-3 flex justify-between items-center">
    <span class="text-xs text-muted-foreground">
      {m.tournament_prize_pool_label()} · {data.players.length} × €{(t.buy_in / 100).toFixed(0)}
    </span>
    <span class="text-lg font-light text-accent">€{(data.prizePool / 100).toFixed(0)}</span>
  </div>

  <!-- Players table -->
  <div>
    <h2 class="text-sm font-semibold text-foreground mb-3">{m.tournament_players_title()}</h2>

    {#if data.players.length === 0}
      <p class="text-sm text-muted-foreground">{m.tournament_no_players()}</p>

    {:else if t.status === 'registration'}
      <!-- Registration table: Player · Type · Remove -->
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="grid grid-cols-[1fr_80px_80px] border-b border-border px-4 py-2.5">
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Player</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Type</span>
          <span></span>
        </div>
        {#each data.players as player}
          <div class="grid grid-cols-[1fr_80px_80px] px-4 py-3 border-b border-border last:border-0 items-center">
            {#if player.guest_name}
              <span class="text-sm text-muted-foreground">{player.guest_name} {m.tournament_guest_suffix()}</span>
              <span class="text-xs text-muted-foreground">Guest</span>
            {:else}
              <span class="text-sm font-medium text-foreground">{player.club_members?.display_name ?? '—'}</span>
              <span class="text-xs text-muted-foreground">Member</span>
            {/if}
            <div class="flex justify-end">
              <form method="POST" action="?/remove_player" use:enhance>
                <input type="hidden" name="player_id" value={player.id} />
                <button type="submit" class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {m.common_delete()}
                </button>
              </form>
            </div>
          </div>
        {/each}
      </div>

    {:else if t.status === 'running'}
      <!-- Running table: Player · Rebuys · Add-on · Position · Bust/Undo -->
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="grid border-b border-border px-4 py-2.5
          {t.format === 'rebuy' ? 'grid-cols-[1fr_120px_80px_80px_80px]' : 'grid-cols-[1fr_80px_80px]'}">
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Player</span>
          {#if t.format === 'rebuy'}
            <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_rebuy_col()}</span>
            <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_addon_col()}</span>
          {/if}
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_position_col()}</span>
          <span></span>
        </div>
        {#each data.players as player}
          <div class="grid border-b border-border last:border-0 px-4 py-3 items-center
            {t.format === 'rebuy' ? 'grid-cols-[1fr_120px_80px_80px_80px]' : 'grid-cols-[1fr_80px_80px]'}">
            <!-- Player name -->
            <span class="text-sm {player.finish_position !== null ? 'text-muted-foreground line-through' : 'font-medium text-foreground'}">
              {player.guest_name
                ? `${player.guest_name} ${m.tournament_guest_suffix()}`
                : (player.club_members?.display_name ?? '—')}
            </span>

            {#if t.format === 'rebuy'}
              <!-- Rebuys: − count + -->
              <div class="flex items-center gap-1">
                <form method="POST" action="?/remove_rebuy" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit" disabled={player.rebuys === 0}
                    class="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    −
                  </button>
                </form>
                <span class="text-sm text-foreground w-4 text-center">{player.rebuys}</span>
                <form method="POST" action="?/add_rebuy" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit"
                    class="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    +
                  </button>
                </form>
              </div>

              <!-- Add-on checkbox -->
              <div class="flex justify-center">
                <form method="POST" action="?/toggle_addon" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit"
                    class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer
                      {player.addon ? 'bg-accent border-accent' : 'border-border hover:border-accent'}">
                    {#if player.addon}
                      <svg class="w-3 h-3 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    {/if}
                  </button>
                </form>
              </div>
            {/if}

            <!-- Position -->
            <span class="text-sm text-center {player.finish_position !== null ? 'text-muted-foreground' : 'text-muted-foreground'}">
              {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
            </span>

            <!-- Bust / Undo -->
            <div class="flex justify-end">
              {#if player.finish_position === null}
                <form method="POST" action="?/bust_player" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit"
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {m.tournament_bust_button({ position: ordinal(nextBustPosition) })}
                  </button>
                </form>
              {:else}
                <form method="POST" action="?/unset_bust" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit"
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {m.tournament_undo_bust()}
                  </button>
                </form>
              {/if}
            </div>
          </div>
        {/each}
      </div>

    {:else}
      <!-- Finished table: Position · Player · Payout -->
      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="grid grid-cols-[60px_1fr_100px] border-b border-border px-4 py-2.5">
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_position_col()}</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Player</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground text-right">{m.tournament_payout_col()}</span>
        </div>
        {#each sortedFinished as player}
          <div class="grid grid-cols-[60px_1fr_100px] px-4 py-3 border-b border-border last:border-0 items-center">
            <span class="text-sm font-medium text-foreground">
              {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
            </span>
            <span class="text-sm text-foreground">
              {player.guest_name
                ? `${player.guest_name} ${m.tournament_guest_suffix()}`
                : (player.club_members?.display_name ?? '—')}
            </span>
            <span class="text-sm text-right {(player.payout_amount ?? 0) > 0 ? 'text-accent font-medium' : 'text-muted-foreground'}">
              {(player.payout_amount ?? 0) > 0 ? `€${((player.payout_amount ?? 0) / 100).toFixed(2)}` : '—'}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Add player (registration only) -->
  {#if t.status === 'registration'}
    <div class="flex flex-col gap-3">
      <form method="POST" action="?/add_player" use:enhance class="flex gap-2 items-center flex-wrap">
        <select
          name="member_id"
          bind:value={selectedMemberId}
          class="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">{m.tournament_member_placeholder()}</option>
          {#each data.availableMembers as member}
            <option value={member.user_id}>{member.display_name}</option>
          {/each}
        </select>
        <input
          name="guest_name"
          type="text"
          placeholder={m.tournament_guest_placeholder()}
          bind:value={guestName}
          disabled={!!selectedMemberId}
          class="px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
        />
        <button type="submit"
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
          {m.tournament_add_player_button()}
        </button>
      </form>
      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}
    </div>
  {/if}

  <!-- Error display for running status actions (bust, rebuy, etc.) -->
  {#if t.status === 'running' && form?.errorKey && !showReview}
    <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
  {/if}

  <!-- Finish review section (running status, shown when "Finish Tournament" clicked) -->
  {#if t.status === 'running' && showReview}
    <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
      <h2 class="text-sm font-semibold text-foreground">{m.tournament_review_title()}</h2>

      <div class="bg-card border border-border rounded-lg overflow-hidden">
        <div class="grid grid-cols-[60px_1fr_100px] border-b border-border px-4 py-2.5">
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.tournament_position_col()}</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Player</span>
          <span class="text-[10px] uppercase tracking-widest text-muted-foreground text-right">{m.tournament_payout_col()}</span>
        </div>
        {#each [...reviewPayouts].sort((a, b) => {
          const posA = data.players.find(p => p.id === a.playerId)?.finish_position ?? 999;
          const posB = data.players.find(p => p.id === b.playerId)?.finish_position ?? 999;
          return posA - posB;
        }) as payout}
          {@const player = data.players.find(p => p.id === payout.playerId)!}
          <div class="grid grid-cols-[60px_1fr_100px] px-4 py-3 border-b border-border last:border-0 items-center">
            <span class="text-sm font-medium text-foreground">
              {player.finish_position !== null ? ordinal(player.finish_position) : '—'}
            </span>
            <span class="text-sm text-foreground">
              {player.guest_name
                ? `${player.guest_name} ${m.tournament_guest_suffix()}`
                : (player.club_members?.display_name ?? '—')}
            </span>
            <span class="text-sm text-right {payout.amount > 0 ? 'text-accent font-medium' : 'text-muted-foreground'}">
              {payout.amount > 0 ? `€${(payout.amount / 100).toFixed(2)}` : '—'}
            </span>
          </div>
        {/each}
      </div>

      <div class="flex items-center gap-4">
        <form method="POST" action="?/finish_tournament" use:enhance>
          <button type="submit"
            class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
            {m.tournament_confirm_finish()}
          </button>
        </form>
        <button type="button" onclick={() => { showReview = false; }}
          class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          {m.tournament_cancel_review()}
        </button>
      </div>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Run the dev server and manually test each status**

```bash
npm run dev
```

Manual test checklist:
- [ ] Registration: add players, remove players, "Start Tournament" disabled with < 2 players, enabled with ≥ 2
- [ ] Running (rebuy format): rebuy +/− buttons, add-on toggle, bust button shows correct ordinal, undo clears position
- [ ] Running (freezeout format): rebuy and add-on columns hidden
- [ ] Running: "Finish Tournament" disabled until all positions assigned
- [ ] Running: "Finish Tournament" opens review section with correct payouts preview
- [ ] Review: "Cancel" dismisses review section
- [ ] Review: "Confirm & close tournament" transitions to finished status
- [ ] Finished: table shows position, player, payout; no action buttons

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: tournament lifecycle UI — all three status states"
```

---

## Final verification

- [ ] Run full test suite: `npx vitest run`
- [ ] Run type check: `npx tsc --noEmit`
- [ ] Push migration to production: `npx supabase db push`
