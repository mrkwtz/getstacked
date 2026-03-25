# Tournament Creation & Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow club admins to create poker tournaments (Freezeout/Rebuy) with blind and prize structure templates, then register members and guests as players.

**Architecture:** Four new Supabase tables with RLS matching existing patterns. A pure helper library (`src/lib/tournaments.ts`) holds calculation and validation logic, tested in isolation. Admin UI adds a Tournaments tab to the existing admin layout and six new server+page file pairs.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), Supabase, Tailwind v4 CSS tokens, Paraglide JS i18n

---

## File Map

**New files:**
- `supabase/migrations/0003_tournaments.sql` — four tables + RLS policies
- `src/lib/tournaments.ts` — `calculatePrizePool()` and `validatePayouts()` helpers
- `tests/unit/tournaments.test.ts` — unit tests for both helpers
- `src/routes/[club]/admin/tournaments/+page.server.ts` — load tournament list
- `src/routes/[club]/admin/tournaments/+page.svelte` — tournament list page
- `src/routes/[club]/admin/tournaments/new/+page.server.ts` — load templates; create_tournament action
- `src/routes/[club]/admin/tournaments/new/+page.svelte` — creation form
- `src/routes/[club]/admin/tournaments/[id]/+page.server.ts` — load tournament detail; add_player / remove_player actions
- `src/routes/[club]/admin/tournaments/[id]/+page.svelte` — tournament detail + registration
- `src/routes/[club]/admin/blind-structures/+page.server.ts` — load with in_use flag; create/delete actions
- `src/routes/[club]/admin/blind-structures/+page.svelte` — template list + inline create form
- `src/routes/[club]/admin/prize-structures/+page.server.ts` — load with in_use flag; create/delete actions
- `src/routes/[club]/admin/prize-structures/+page.svelte` — template list + inline create form

**Modified files:**
- `src/lib/types.ts` — add `BlindStructure`, `PrizeStructure`, `Tournament`, `TournamentPlayer` aliases
- `src/routes/[club]/admin/+layout.svelte` — add Tournaments tab
- `messages/en.json` — add ~50 new i18n keys
- `messages/de.json` — German translations for same keys

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0003_tournaments.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0003_tournaments.sql

-- Blind structure templates
create table blind_structures (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  name       text not null,
  levels     jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Prize structure templates
create table prize_structures (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  name       text not null,
  payouts    jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Tournaments
create table tournaments (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references clubs(id) on delete cascade,
  name               text not null,
  date               date not null,
  format             text not null check (format in ('freezeout', 'rebuy')),
  buy_in             integer not null check (buy_in > 0),
  rebuy_amount       integer check (rebuy_amount > 0),
  addon_amount       integer check (addon_amount > 0),
  blind_structure_id uuid references blind_structures(id) on delete set null,
  prize_structure_id uuid references prize_structures(id) on delete set null,
  status             text not null default 'registration'
                       check (status in ('registration', 'running', 'finished')),
  created_at         timestamptz not null default now()
);

-- Tournament players
create table tournament_players (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  member_club_id  uuid,
  member_user_id  uuid,
  guest_name      text,
  rebuys          integer not null default 0,
  addon           boolean not null default false,
  finish_position integer,
  created_at      timestamptz not null default now(),
  foreign key (member_club_id, member_user_id)
    references club_members(club_id, user_id) on delete set null,
  constraint tournament_players_identity check (
    (member_club_id is not null and member_user_id is not null and guest_name is null) or
    (member_club_id is null and member_user_id is null and guest_name is not null)
  )
);

-- RLS: blind_structures
alter table blind_structures enable row level security;

create policy "members can read blind structures"
  on blind_structures for select
  using (club_id in (select get_user_club_ids(auth.uid())));

create policy "admins can manage blind structures"
  on blind_structures for all
  using (is_club_admin(auth.uid(), club_id));

-- RLS: prize_structures
alter table prize_structures enable row level security;

create policy "members can read prize structures"
  on prize_structures for select
  using (club_id in (select get_user_club_ids(auth.uid())));

create policy "admins can manage prize structures"
  on prize_structures for all
  using (is_club_admin(auth.uid(), club_id));

-- RLS: tournaments
alter table tournaments enable row level security;

create policy "members can read tournaments"
  on tournaments for select
  using (club_id in (select get_user_club_ids(auth.uid())));

create policy "admins can manage tournaments"
  on tournaments for all
  using (is_club_admin(auth.uid(), club_id));

-- RLS: tournament_players
alter table tournament_players enable row level security;

create policy "members can read tournament players"
  on tournament_players for select
  using (
    tournament_id in (
      select id from tournaments
      where club_id in (select get_user_club_ids(auth.uid()))
    )
  );

create policy "admins can manage tournament players"
  on tournament_players for all
  using (
    tournament_id in (
      select id from tournaments
      where is_club_admin(auth.uid(), club_id)
    )
  );
```

- [ ] **Step 2: Apply migration locally**

```bash
supabase db push
```

Expected: Migration applied without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_tournaments.sql
git commit -m "feat: add tournaments migration (blind_structures, prize_structures, tournaments, tournament_players)"
```

---

### Task 2: Helper library and tests

**Files:**
- Create: `src/lib/tournaments.ts`
- Create: `tests/unit/tournaments.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/tournaments.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePrizePool, validatePayouts } from '../../src/lib/tournaments';

describe('calculatePrizePool', () => {
  it('freezeout: player_count × buy_in only', () => {
    expect(calculatePrizePool(4, 2000, 0, 0, 0, 0)).toBe(8000);
  });

  it('rebuy: adds rebuys and add-ons', () => {
    expect(calculatePrizePool(3, 2000, 2, 2000, 1, 1000)).toBe(3 * 2000 + 2 * 2000 + 1 * 1000);
  });

  it('zero players returns 0', () => {
    expect(calculatePrizePool(0, 2000, 0, 0, 0, 0)).toBe(0);
  });

  it('all amounts in cents in, cents out', () => {
    expect(calculatePrizePool(1, 5000, 0, 0, 0, 0)).toBe(5000);
  });
});

describe('validatePayouts', () => {
  it('valid single payout summing to 100', () => {
    expect(validatePayouts([{ position: 1, percentage: 100 }])).toBeNull();
  });

  it('valid multi-payout summing to 100', () => {
    expect(validatePayouts([
      { position: 1, percentage: 60 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 10 },
    ])).toBeNull();
  });

  it('returns error when sum !== 100', () => {
    expect(validatePayouts([{ position: 1, percentage: 90 }])).toBe('error_percentage_sum');
  });

  it('returns error for duplicate positions', () => {
    expect(validatePayouts([
      { position: 1, percentage: 50 },
      { position: 1, percentage: 50 },
    ])).toBe('error_duplicate_position');
  });

  it('returns error if any percentage <= 0', () => {
    expect(validatePayouts([
      { position: 1, percentage: 100 },
      { position: 2, percentage: 0 },
    ])).toBe('error_percentage_sum');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/tournaments.test.ts
```

Expected: FAIL (cannot find module)

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/tournaments.ts

export interface BlindLevel {
  small_blind: number;
  big_blind: number;
  ante: number;
  duration_minutes: number;
}

export interface Payout {
  position: number;
  percentage: number;
}

export function calculatePrizePool(
  playerCount: number,
  buyIn: number,        // cents
  totalRebuys: number,
  rebuyAmount: number,  // cents
  addonCount: number,
  addonAmount: number   // cents
): number {
  return playerCount * buyIn + totalRebuys * rebuyAmount + addonCount * addonAmount;
}

/**
 * Validates a payouts array.
 * Returns null if valid, or an i18n error key string if invalid.
 */
export function validatePayouts(payouts: Payout[]): string | null {
  if (payouts.some((p) => p.percentage <= 0)) return 'error_percentage_sum';
  const positions = payouts.map((p) => p.position);
  if (new Set(positions).size !== positions.length) return 'error_duplicate_position';
  const sum = payouts.reduce((acc, p) => acc + p.percentage, 0);
  if (sum !== 100) return 'error_percentage_sum';
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/tournaments.test.ts
```

Expected: 9 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tournaments.ts tests/unit/tournaments.test.ts
git commit -m "feat: add tournament helpers (calculatePrizePool, validatePayouts)"
```

---

### Task 3: Type aliases and i18n keys

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add type aliases to `src/lib/types.ts`**

Append to the end of the file (after the existing `ClubContext` type):

```typescript
export interface BlindStructure {
  id: string;
  club_id: string;
  name: string;
  levels: import('./tournaments').BlindLevel[];
  created_at: string;
}

export interface PrizeStructure {
  id: string;
  club_id: string;
  name: string;
  payouts: import('./tournaments').Payout[];
  created_at: string;
}

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
  prize_structures?: { name: string } | null;
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  member_club_id: string | null;
  member_user_id: string | null;
  guest_name: string | null;
  rebuys: number;
  addon: boolean;
  finish_position: number | null;
  created_at: string;
  club_members?: { display_name: string } | null;
}
```

- [ ] **Step 2: Add i18n keys to `messages/en.json`**

Add inside the JSON object (before the closing `}`):

```json
  "nav_tournaments": "Tournaments",
  "tournament_list_title": "Tournaments",
  "tournament_new_button": "New tournament",
  "tournament_new_title": "New tournament",
  "tournament_name_label": "Tournament name",
  "tournament_date_label": "Date",
  "tournament_format_label": "Format",
  "tournament_format_freezeout": "Freezeout",
  "tournament_format_rebuy": "Rebuy",
  "tournament_buyin_label": "Buy-in (€)",
  "tournament_rebuy_label": "Rebuy amount (€)",
  "tournament_addon_label": "Add-on amount (€)",
  "tournament_blind_structure_label": "Blind structure",
  "tournament_prize_structure_label": "Prize structure",
  "tournament_create_button": "Create tournament",
  "tournament_status_registration": "Registration open",
  "tournament_status_running": "Running",
  "tournament_status_finished": "Finished",
  "tournament_players_title": "Players",
  "tournament_add_player_button": "Add player",
  "tournament_member_placeholder": "Select member",
  "tournament_guest_placeholder": "Or type guest name",
  "tournament_prize_pool_label": "Prize pool",
  "tournament_no_players": "No players registered yet.",
  "tournament_empty": "No tournaments yet.",
  "tournament_guest_suffix": "(guest)",
  "blind_structures_title": "Blind structures",
  "blind_structure_new_title": "New blind structure",
  "blind_structure_name_label": "Name",
  "blind_structure_add_level": "Add level",
  "blind_structure_duration_label": "Duration (min)",
  "blind_structure_sb_label": "Small blind",
  "blind_structure_bb_label": "Big blind",
  "blind_structure_ante_label": "Ante",
  "blind_structure_create_button": "Create",
  "blind_structure_empty": "No blind structures yet.",
  "blind_structure_in_use": "In use",
  "prize_structures_title": "Prize structures",
  "prize_structure_new_title": "New prize structure",
  "prize_structure_name_label": "Name",
  "prize_structure_add_payout": "Add place",
  "prize_structure_position_label": "Place",
  "prize_structure_percentage_label": "%",
  "prize_structure_create_button": "Create",
  "prize_structure_empty": "No prize structures yet.",
  "prize_structure_in_use": "In use",
  "error_percentage_sum": "Percentages must sum to 100.",
  "error_duplicate_position": "Duplicate position.",
  "error_duplicate_player": "This player is already registered.",
  "error_no_blind_structures": "Create a blind structure first.",
  "error_no_prize_structures": "Create a prize structure first.",
  "error_tournament_not_open": "Tournament registration is closed.",
  "error_structure_in_use": "This structure is used by an existing tournament."
```

Note: `nav_tournaments` already exists in `en.json` — skip it when adding. Check before adding.

- [ ] **Step 3: Add German translations to `messages/de.json`**

Same keys, German values — add before closing `}`:

```json
  "tournament_list_title": "Turniere",
  "tournament_new_button": "Neues Turnier",
  "tournament_new_title": "Neues Turnier",
  "tournament_name_label": "Turniername",
  "tournament_date_label": "Datum",
  "tournament_format_label": "Format",
  "tournament_format_freezeout": "Freezeout",
  "tournament_format_rebuy": "Rebuy",
  "tournament_buyin_label": "Buy-in (€)",
  "tournament_rebuy_label": "Rebuy-Betrag (€)",
  "tournament_addon_label": "Add-on-Betrag (€)",
  "tournament_blind_structure_label": "Blind-Struktur",
  "tournament_prize_structure_label": "Preisstruktur",
  "tournament_create_button": "Turnier erstellen",
  "tournament_status_registration": "Registrierung offen",
  "tournament_status_running": "Läuft",
  "tournament_status_finished": "Beendet",
  "tournament_players_title": "Spieler",
  "tournament_add_player_button": "Spieler hinzufügen",
  "tournament_member_placeholder": "Mitglied auswählen",
  "tournament_guest_placeholder": "Oder Gastnamen eingeben",
  "tournament_prize_pool_label": "Preispool",
  "tournament_no_players": "Noch keine Spieler registriert.",
  "tournament_empty": "Noch keine Turniere.",
  "tournament_guest_suffix": "(Gast)",
  "blind_structures_title": "Blind-Strukturen",
  "blind_structure_new_title": "Neue Blind-Struktur",
  "blind_structure_name_label": "Name",
  "blind_structure_add_level": "Level hinzufügen",
  "blind_structure_duration_label": "Dauer (Min.)",
  "blind_structure_sb_label": "Small Blind",
  "blind_structure_bb_label": "Big Blind",
  "blind_structure_ante_label": "Ante",
  "blind_structure_create_button": "Erstellen",
  "blind_structure_empty": "Noch keine Blind-Strukturen.",
  "blind_structure_in_use": "In Verwendung",
  "prize_structures_title": "Preisstrukturen",
  "prize_structure_new_title": "Neue Preisstruktur",
  "prize_structure_name_label": "Name",
  "prize_structure_add_payout": "Platz hinzufügen",
  "prize_structure_position_label": "Platz",
  "prize_structure_percentage_label": "%",
  "prize_structure_create_button": "Erstellen",
  "prize_structure_empty": "Noch keine Preisstrukturen.",
  "prize_structure_in_use": "In Verwendung",
  "error_percentage_sum": "Prozentwerte müssen 100 ergeben.",
  "error_duplicate_position": "Doppelter Platz.",
  "error_duplicate_player": "Dieser Spieler ist bereits registriert.",
  "error_no_blind_structures": "Bitte zuerst eine Blind-Struktur erstellen.",
  "error_no_prize_structures": "Bitte zuerst eine Preisstruktur erstellen.",
  "error_tournament_not_open": "Die Turnier-Registrierung ist geschlossen.",
  "error_structure_in_use": "Diese Struktur wird von einem bestehenden Turnier verwendet."
```

Note: `nav_tournaments` (`"Turniere"`) already exists in `de.json` — skip it.

- [ ] **Step 4: Verify type check passes**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts messages/en.json messages/de.json
git commit -m "feat: add tournament types and i18n keys"
```

---

### Task 4: Admin tab bar — add Tournaments tab

**Files:**
- Modify: `src/routes/[club]/admin/+layout.svelte`

Current file has Members and Settings tabs using hardcoded text. The spec requires all UI strings via `m.key()` and a Tournaments tab.

- [ ] **Step 1: Update the layout to add Tournaments tab and use i18n**

Replace `src/routes/[club]/admin/+layout.svelte` with:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import * as m from '$lib/paraglide/messages';
  import type { Snippet } from 'svelte';
  import type { Club, ClubMember } from '$lib/types';

  const { data, children } = $props<{
    data: { club: Club; member: ClubMember };
    children: Snippet;
  }>();

  const base = $derived(`/${data.club.slug}/admin`);
</script>

<div class="flex flex-col h-full">
  <!-- Sub-nav tab bar -->
  <div class="border-b border-border px-6 flex">
    <a
      href="{base}/members"
      class="px-4 py-3 text-sm transition-colors -mb-px {
        page.url.pathname.startsWith(`${base}/members`)
          ? 'border-b-2 border-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }"
    >
      {m.members_title()}
    </a>
    <a
      href="{base}/settings"
      class="px-4 py-3 text-sm transition-colors -mb-px {
        page.url.pathname.startsWith(`${base}/settings`)
          ? 'border-b-2 border-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }"
    >
      {m.settings_title()}
    </a>
    <a
      href="{base}/tournaments"
      class="px-4 py-3 text-sm transition-colors -mb-px {
        page.url.pathname.startsWith(`${base}/tournaments`) ||
        page.url.pathname.startsWith(`${base}/blind-structures`) ||
        page.url.pathname.startsWith(`${base}/prize-structures`)
          ? 'border-b-2 border-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground'
      }"
    >
      {m.nav_tournaments()}
    </a>
  </div>

  <!-- Page content -->
  <div class="flex-1 p-6">
    {@render children()}
  </div>
</div>
```

- [ ] **Step 2: Run the dev server and verify tabs render**

```bash
npm run dev
```

Navigate to `/[your-club]/admin/members` — confirm three tabs appear: Members, Club settings, Tournaments. Click Tournaments — 404 is expected for now.

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/+layout.svelte
git commit -m "feat: add Tournaments tab to admin layout"
```

---

### Task 5: Blind structures page

**Files:**
- Create: `src/routes/[club]/admin/blind-structures/+page.server.ts`
- Create: `src/routes/[club]/admin/blind-structures/+page.svelte`

- [ ] **Step 1: Write the server file**

```typescript
// src/routes/[club]/admin/blind-structures/+page.server.ts
import { fail, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const { data: structures } = await createUserClient(session!.access_token)
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

export const actions: Actions = {
  create_blind_structure: async ({ request, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() ?? '';
    if (!name) return fail(400, { errorKey: 'error_required' });

    const smallBlinds = formData.getAll('small_blind').map(Number);
    const bigBlinds = formData.getAll('big_blind').map(Number);
    const antes = formData.getAll('ante').map(Number);
    const durations = formData.getAll('duration_minutes').map(Number);

    if (smallBlinds.length === 0) return fail(400, { errorKey: 'error_required' });

    const levels = smallBlinds.map((sb, i) => ({
      small_blind: sb,
      big_blind: bigBlinds[i] ?? 0,
      ante: antes[i] ?? 0,
      duration_minutes: durations[i] ?? 0,
    }));

    for (const level of levels) {
      if (level.small_blind <= 0 || level.big_blind < level.small_blind || level.duration_minutes <= 0 || level.ante < 0) {
        return fail(400, { errorKey: 'error_required' });
      }
    }

    const service = createServiceClient();
    const { error: insertError } = await service
      .from('blind_structures')
      .insert({ club_id: club.id, name, levels });

    if (insertError) return fail(500, { errorKey: 'server_error' });
    return { created: true };
  },

  delete_blind_structure: async ({ request, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const id = formData.get('id')?.toString() ?? '';

    const service = createServiceClient();

    // Check in use
    const { data: linked } = await service
      .from('tournaments')
      .select('id')
      .eq('blind_structure_id', id)
      .eq('club_id', club.id)
      .limit(1);

    if (linked && linked.length > 0) return fail(400, { errorKey: 'error_structure_in_use' });

    const { error: deleteError } = await service
      .from('blind_structures')
      .delete()
      .eq('id', id)
      .eq('club_id', club.id);

    if (deleteError) return fail(500, { errorKey: 'server_error' });
    return {};
  },
};
```

- [ ] **Step 2: Write the page component**

```svelte
<!-- src/routes/[club]/admin/blind-structures/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data, form } = $props<{
    data: {
      structures: {
        id: string;
        name: string;
        levels: { small_blind: number; big_blind: number; ante: number; duration_minutes: number }[];
        in_use: boolean;
      }[];
    };
    form: { created?: boolean; errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let levels = $state([{ small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }]);

  function addLevel() {
    levels = [...levels, { small_blind: '', big_blind: '', ante: '0', duration_minutes: '' }];
  }

  function removeLevel(i: number) {
    levels = levels.filter((_, idx) => idx !== i);
  }
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.blind_structures_title()}</h1>

  <!-- List -->
  {#if data.structures.length === 0}
    <p class="text-sm text-muted-foreground">{m.blind_structure_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[1fr_80px_80px] border-b border-border px-4 py-2.5">
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Levels</span>
        <span></span>
      </div>
      {#each data.structures as s}
        <div class="grid grid-cols-[1fr_80px_80px] px-4 py-3 border-b border-border last:border-0 items-center">
          <span class="text-sm font-medium text-foreground">{s.name}</span>
          <span class="text-xs text-muted-foreground">{s.levels.length}</span>
          <div class="flex justify-end">
            {#if s.in_use}
              <span class="text-xs text-muted-foreground">{m.blind_structure_in_use()}</span>
            {:else}
              <form method="POST" action="?/delete_blind_structure" use:enhance>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Delete
                </button>
              </form>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Create form -->
  <div class="bg-card border border-border rounded-lg p-5">
    <h2 class="text-sm font-semibold text-foreground mb-4">{m.blind_structure_new_title()}</h2>
    <form method="POST" action="?/create_blind_structure" use:enhance class="flex flex-col gap-4 max-w-lg">
      <div>
        <label for="bs-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.blind_structure_name_label()}
        </label>
        <input
          id="bs-name" name="name" type="text" required
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <!-- Levels table -->
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-muted-foreground">
              <th class="text-left font-medium pb-2">{m.blind_structure_duration_label()}</th>
              <th class="text-left font-medium pb-2">{m.blind_structure_sb_label()}</th>
              <th class="text-left font-medium pb-2">{m.blind_structure_bb_label()}</th>
              <th class="text-left font-medium pb-2">{m.blind_structure_ante_label()}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each levels as level, i}
              <tr>
                <td class="pr-2 pb-2">
                  <input name="duration_minutes" type="number" min="1" required bind:value={level.duration_minutes}
                    class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                </td>
                <td class="pr-2 pb-2">
                  <input name="small_blind" type="number" min="1" required bind:value={level.small_blind}
                    class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                </td>
                <td class="pr-2 pb-2">
                  <input name="big_blind" type="number" min="1" required bind:value={level.big_blind}
                    class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                </td>
                <td class="pr-2 pb-2">
                  <input name="ante" type="number" min="0" bind:value={level.ante}
                    class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                </td>
                <td class="pb-2">
                  {#if levels.length > 1}
                    <button type="button" onclick={() => removeLevel(i)}
                      class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">✕</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <button type="button" onclick={addLevel}
        class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
        + {m.blind_structure_add_level()}
      </button>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}

      <button type="submit"
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        {m.blind_structure_create_button()}
      </button>
    </form>
  </div>
</div>
```

- [ ] **Step 3: Start dev server and manually verify the page renders at `/[club]/admin/blind-structures`**

- [ ] **Step 4: Commit**

```bash
git add src/routes/[club]/admin/blind-structures/
git commit -m "feat: add blind structures admin page"
```

---

### Task 6: Prize structures page

**Files:**
- Create: `src/routes/[club]/admin/prize-structures/+page.server.ts`
- Create: `src/routes/[club]/admin/prize-structures/+page.svelte`

- [ ] **Step 1: Write the server file**

```typescript
// src/routes/[club]/admin/prize-structures/+page.server.ts
import { fail, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import { validatePayouts } from '$lib/tournaments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const { data: structures } = await createUserClient(session!.access_token)
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

export const actions: Actions = {
  create_prize_structure: async ({ request, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() ?? '';
    if (!name) return fail(400, { errorKey: 'error_required' });

    const positions = formData.getAll('position').map(Number);
    const percentages = formData.getAll('percentage').map(Number);

    if (positions.length === 0) return fail(400, { errorKey: 'error_required' });

    const payouts = positions.map((pos, i) => ({
      position: pos,
      percentage: percentages[i] ?? 0,
    }));

    const validationError = validatePayouts(payouts);
    if (validationError) return fail(400, { errorKey: validationError });

    const service = createServiceClient();
    const { error: insertError } = await service
      .from('prize_structures')
      .insert({ club_id: club.id, name, payouts });

    if (insertError) return fail(500, { errorKey: 'server_error' });
    return { created: true };
  },

  delete_prize_structure: async ({ request, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const id = formData.get('id')?.toString() ?? '';

    const service = createServiceClient();

    const { data: linked } = await service
      .from('tournaments')
      .select('id')
      .eq('prize_structure_id', id)
      .eq('club_id', club.id)
      .limit(1);

    if (linked && linked.length > 0) return fail(400, { errorKey: 'error_structure_in_use' });

    const { error: deleteError } = await service
      .from('prize_structures')
      .delete()
      .eq('id', id)
      .eq('club_id', club.id);

    if (deleteError) return fail(500, { errorKey: 'server_error' });
    return {};
  },
};
```

- [ ] **Step 2: Write the page component**

```svelte
<!-- src/routes/[club]/admin/prize-structures/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data, form } = $props<{
    data: {
      structures: {
        id: string;
        name: string;
        payouts: { position: number; percentage: number }[];
        in_use: boolean;
      }[];
    };
    form: { created?: boolean; errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as Record<string, (() => string) | undefined>;
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
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.prize_structures_title()}</h1>

  {#if data.structures.length === 0}
    <p class="text-sm text-muted-foreground">{m.prize_structure_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[1fr_1fr_80px] border-b border-border px-4 py-2.5">
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Payouts</span>
        <span></span>
      </div>
      {#each data.structures as s}
        <div class="grid grid-cols-[1fr_1fr_80px] px-4 py-3 border-b border-border last:border-0 items-center">
          <span class="text-sm font-medium text-foreground">{s.name}</span>
          <span class="text-xs text-muted-foreground">{payoutSummary(s.payouts)}</span>
          <div class="flex justify-end">
            {#if s.in_use}
              <span class="text-xs text-muted-foreground">{m.prize_structure_in_use()}</span>
            {:else}
              <form method="POST" action="?/delete_prize_structure" use:enhance>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Delete
                </button>
              </form>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Create form -->
  <div class="bg-card border border-border rounded-lg p-5">
    <h2 class="text-sm font-semibold text-foreground mb-4">{m.prize_structure_new_title()}</h2>
    <form method="POST" action="?/create_prize_structure" use:enhance class="flex flex-col gap-4 max-w-sm">
      <div>
        <label for="ps-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.prize_structure_name_label()}
        </label>
        <input
          id="ps-name" name="name" type="text" required
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <div class="flex gap-4 text-xs font-medium text-muted-foreground mb-1.5">
          <span class="w-20">{m.prize_structure_position_label()}</span>
          <span class="w-20">{m.prize_structure_percentage_label()}</span>
        </div>
        {#each payoutRows as row, i}
          <div class="flex gap-2 mb-2 items-center">
            <input name="position" type="number" min="1" required bind:value={row.position}
              class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
            <input name="percentage" type="number" min="1" max="100" required bind:value={row.percentage}
              class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
            {#if payoutRows.length > 1}
              <button type="button" onclick={() => removeRow(i)}
                class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">✕</button>
            {/if}
          </div>
        {/each}
        <p class="text-xs mt-1 {total === 100 ? 'text-muted-foreground' : 'text-accent'}">
          Total: {total}%
        </p>
      </div>

      <button type="button" onclick={addRow}
        class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
        + {m.prize_structure_add_payout()}
      </button>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}

      <button type="submit" disabled={total !== 100}
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
        {m.prize_structure_create_button()}
      </button>
    </form>
  </div>
</div>
```

- [ ] **Step 3: Manual verification in dev server**

- [ ] **Step 4: Commit**

```bash
git add src/routes/[club]/admin/prize-structures/
git commit -m "feat: add prize structures admin page"
```

---

### Task 7: Tournament list page

**Files:**
- Create: `src/routes/[club]/admin/tournaments/+page.server.ts`
- Create: `src/routes/[club]/admin/tournaments/+page.svelte`

- [ ] **Step 1: Write the server file**

```typescript
// src/routes/[club]/admin/tournaments/+page.server.ts
import { createUserClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const { data: tournaments } = await createUserClient(session!.access_token)
    .from('tournaments')
    .select('*')
    .eq('club_id', club.id)
    .order('date', { ascending: false });

  return { tournaments: tournaments ?? [] };
};
```

- [ ] **Step 2: Write the page component**

```svelte
<!-- src/routes/[club]/admin/tournaments/+page.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { Tournament } from '$lib/types';

  const { data } = $props<{ data: { tournaments: Tournament[]; club: { slug: string } } }>();

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
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function formatLabel(format: Tournament['format']): string {
    return format === 'freezeout' ? m.tournament_format_freezeout() : m.tournament_format_rebuy();
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <h1 class="text-base font-semibold text-foreground">{m.tournament_list_title()}</h1>
    <a
      href="/{data.club.slug}/admin/tournaments/new"
      class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors"
    >
      {m.tournament_new_button()}
    </a>
  </div>

  {#if data.tournaments.length === 0}
    <p class="text-sm text-muted-foreground">{m.tournament_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[1fr_80px_100px_120px] border-b border-border px-4 py-2.5">
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Date</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Format</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Status</span>
      </div>
      {#each data.tournaments as tournament}
        <a
          href="/{data.club.slug}/admin/tournaments/{tournament.id}"
          class="grid grid-cols-[1fr_80px_100px_120px] px-4 py-3 border-b border-border last:border-0 items-center hover:bg-card/80 transition-colors"
        >
          <span class="text-sm font-medium text-foreground">{tournament.name}</span>
          <span class="text-xs text-muted-foreground">{formatDate(tournament.date)}</span>
          <span class="text-xs text-muted-foreground">{formatLabel(tournament.format)}</span>
          <span class="inline-flex">
            <span class="text-xs font-medium px-2 py-0.5 rounded-full {statusClass(tournament.status)}">
              {statusLabel(tournament.status)}
            </span>
          </span>
        </a>
      {/each}
    </div>
  {/if}

  <div class="flex gap-6">
    <a href="/{data.club.slug}/admin/blind-structures" class="text-xs text-muted-foreground hover:text-foreground transition-colors border-b border-border pb-0.5">
      {m.blind_structures_title()}
    </a>
    <a href="/{data.club.slug}/admin/prize-structures" class="text-xs text-muted-foreground hover:text-foreground transition-colors border-b border-border pb-0.5">
      {m.prize_structures_title()}
    </a>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/+page.server.ts src/routes/[club]/admin/tournaments/+page.svelte
git commit -m "feat: add tournaments list page"
```

---

### Task 8: New tournament form

**Files:**
- Create: `src/routes/[club]/admin/tournaments/new/+page.server.ts`
- Create: `src/routes/[club]/admin/tournaments/new/+page.svelte`

- [ ] **Step 1: Write the server file**

```typescript
// src/routes/[club]/admin/tournaments/new/+page.server.ts
import { fail, redirect, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const userClient = createUserClient(session!.access_token);
  const [{ data: blindStructures }, { data: prizeStructures }] = await Promise.all([
    userClient.from('blind_structures').select('id, name').eq('club_id', club.id).order('name'),
    userClient.from('prize_structures').select('id, name').eq('club_id', club.id).order('name'),
  ]);

  return {
    blindStructures: blindStructures ?? [],
    prizeStructures: prizeStructures ?? [],
  };
};

export const actions: Actions = {
  create_tournament: async ({ request, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() ?? '';
    const date = formData.get('date')?.toString() ?? '';
    const format = formData.get('format')?.toString() ?? '';
    const buyInRaw = formData.get('buy_in')?.toString() ?? '';
    const rebuyRaw = formData.get('rebuy_amount')?.toString() ?? '';
    const addonRaw = formData.get('addon_amount')?.toString() ?? '';
    const blindStructureId = formData.get('blind_structure_id')?.toString() ?? '';
    const prizeStructureId = formData.get('prize_structure_id')?.toString() ?? '';

    if (!name || !date || !buyInRaw || !blindStructureId || !prizeStructureId) {
      return fail(400, { errorKey: 'error_required' });
    }
    if (!['freezeout', 'rebuy'].includes(format)) {
      return fail(400, { errorKey: 'error_required' });
    }

    const buyIn = Math.round(parseFloat(buyInRaw) * 100);
    if (buyIn <= 0) return fail(400, { errorKey: 'error_required' });

    let rebuyAmount: number | null = null;
    let addonAmount: number | null = null;
    if (format === 'rebuy') {
      if (!rebuyRaw) return fail(400, { errorKey: 'error_required' });
      rebuyAmount = Math.round(parseFloat(rebuyRaw) * 100);
      if (rebuyAmount <= 0) return fail(400, { errorKey: 'error_required' });
      if (addonRaw) {
        addonAmount = Math.round(parseFloat(addonRaw) * 100);
        if (addonAmount <= 0) return fail(400, { errorKey: 'error_required' });
      }
    }

    const service = createServiceClient();

    // Verify structures belong to this club
    const [{ data: bs }, { data: ps }] = await Promise.all([
      service.from('blind_structures').select('id').eq('id', blindStructureId).eq('club_id', club.id).single(),
      service.from('prize_structures').select('id').eq('id', prizeStructureId).eq('club_id', club.id).single(),
    ]);
    if (!bs || !ps) return fail(400, { errorKey: 'error_required' });

    const { data: tournament, error: insertError } = await service
      .from('tournaments')
      .insert({
        club_id: club.id,
        name,
        date,
        format,
        buy_in: buyIn,
        rebuy_amount: rebuyAmount,
        addon_amount: addonAmount,
        blind_structure_id: blindStructureId,
        prize_structure_id: prizeStructureId,
        status: 'registration',
      })
      .select('id')
      .single();

    if (insertError || !tournament) return fail(500, { errorKey: 'server_error' });

    redirect(303, `/${club.slug}/admin/tournaments/${tournament.id}`);
  },
};
```

- [ ] **Step 2: Write the page component**

```svelte
<!-- src/routes/[club]/admin/tournaments/new/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data, form } = $props<{
    data: {
      blindStructures: { id: string; name: string }[];
      prizeStructures: { id: string; name: string }[];
      club: { slug: string };
    };
    form: { errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let format = $state('freezeout');
</script>

<div class="flex flex-col gap-6 max-w-lg">
  <h1 class="text-base font-semibold text-foreground">{m.tournament_new_title()}</h1>

  <div class="bg-card border border-border rounded-lg p-5">
    <form method="POST" action="?/create_tournament" use:enhance class="flex flex-col gap-4">

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="t-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_name_label()}
          </label>
          <input id="t-name" name="name" type="text" required
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label for="t-date" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_date_label()}
          </label>
          <input id="t-date" name="date" type="date" required
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="t-format" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_format_label()}
          </label>
          <select id="t-format" name="format" bind:value={format} required
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors">
            <option value="freezeout">{m.tournament_format_freezeout()}</option>
            <option value="rebuy">{m.tournament_format_rebuy()}</option>
          </select>
        </div>
        <div>
          <label for="t-buyin" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_buyin_label()}
          </label>
          <input id="t-buyin" name="buy_in" type="number" min="1" step="0.01" required
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
      </div>

      {#if format === 'rebuy'}
        <div class="grid grid-cols-2 gap-4 bg-accent/5 border border-accent/20 rounded-md p-3">
          <div>
            <label for="t-rebuy" class="block text-xs font-medium text-accent mb-1.5">
              {m.tournament_rebuy_label()}
            </label>
            <input id="t-rebuy" name="rebuy_amount" type="number" min="1" step="0.01" required
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label for="t-addon" class="block text-xs font-medium text-accent mb-1.5">
              {m.tournament_addon_label()}
            </label>
            <input id="t-addon" name="addon_amount" type="number" min="1" step="0.01"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="t-bs" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_blind_structure_label()}
          </label>
          {#if data.blindStructures.length === 0}
            <p class="text-xs text-accent">
              <a href="/{data.club.slug}/admin/blind-structures" class="underline">{m.error_no_blind_structures()}</a>
            </p>
          {:else}
            <select id="t-bs" name="blind_structure_id" required
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors">
              <option value="">—</option>
              {#each data.blindStructures as bs}
                <option value={bs.id}>{bs.name}</option>
              {/each}
            </select>
          {/if}
        </div>
        <div>
          <label for="t-ps" class="block text-xs font-medium text-muted-foreground mb-1.5">
            {m.tournament_prize_structure_label()}
          </label>
          {#if data.prizeStructures.length === 0}
            <p class="text-xs text-accent">
              <a href="/{data.club.slug}/admin/prize-structures" class="underline">{m.error_no_prize_structures()}</a>
            </p>
          {:else}
            <select id="t-ps" name="prize_structure_id" required
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors">
              <option value="">—</option>
              {#each data.prizeStructures as ps}
                <option value={ps.id}>{ps.name}</option>
              {/each}
            </select>
          {/if}
        </div>
      </div>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}

      <button type="submit"
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        {m.tournament_create_button()}
      </button>
    </form>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/new/
git commit -m "feat: add new tournament form"
```

---

### Task 9: Tournament detail / registration page

**Files:**
- Create: `src/routes/[club]/admin/tournaments/[id]/+page.server.ts`
- Create: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

- [ ] **Step 1: Write the server file**

```typescript
// src/routes/[club]/admin/tournaments/[id]/+page.server.ts
import { fail, error } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import { isAdmin } from '$lib/members';
import { calculatePrizePool } from '$lib/tournaments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals: { safeGetSession } }) => {
  const { club } = await parent();
  const { session } = await safeGetSession();

  const userClient = createUserClient(session!.access_token);

  const { data: tournament } = await userClient
    .from('tournaments')
    .select('*, blind_structures(name), prize_structures(name)')
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

  const prizePool = calculatePrizePool(
    (players ?? []).length,
    tournament.buy_in,
    0, 0, 0, 0
  );

  return {
    tournament,
    players: players ?? [],
    availableMembers,
    prizePool,
  };
};

export const actions: Actions = {
  add_player: async ({ request, params, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const memberId = formData.get('member_id')?.toString().trim() ?? '';
    const guestName = formData.get('guest_name')?.toString().trim() ?? '';

    const service = createServiceClient();

    if (memberId) {
      // Verify member belongs to this club
      const { data: clubMember } = await service
        .from('club_members')
        .select('user_id')
        .eq('club_id', club.id)
        .eq('user_id', memberId)
        .single();
      if (!clubMember) return fail(400, { errorKey: 'error_required' });

      // Check not already registered
      const { data: existing } = await service
        .from('tournament_players')
        .select('id')
        .eq('tournament_id', params.id)
        .eq('member_user_id', memberId)
        .single();
      if (existing) return fail(400, { errorKey: 'error_duplicate_player' });

      const { error: insertError } = await service.from('tournament_players').insert({
        tournament_id: params.id,
        member_club_id: club.id,
        member_user_id: memberId,
        guest_name: null,
      });
      if (insertError) return fail(500, { errorKey: 'server_error' });

    } else if (guestName) {
      const { error: insertError } = await service.from('tournament_players').insert({
        tournament_id: params.id,
        member_club_id: null,
        member_user_id: null,
        guest_name: guestName,
      });
      if (insertError) return fail(500, { errorKey: 'server_error' });

    } else {
      return fail(400, { errorKey: 'error_required' });
    }

    return {};
  },

  remove_player: async ({ request, params, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');

    const formData = await request.formData();
    const playerId = formData.get('player_id')?.toString() ?? '';

    const service = createServiceClient();

    // Verify tournament is in registration
    const { data: tournament } = await service
      .from('tournaments')
      .select('status')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single();
    if (!tournament) return fail(404, { errorKey: 'server_error' });
    if (tournament.status !== 'registration') return fail(400, { errorKey: 'error_tournament_not_open' });

    const { error: deleteError } = await service
      .from('tournament_players')
      .delete()
      .eq('id', playerId)
      .eq('tournament_id', params.id);

    if (deleteError) return fail(500, { errorKey: 'server_error' });
    return {};
  },
};
```

- [ ] **Step 2: Write the page component**

```svelte
<!-- src/routes/[club]/admin/tournaments/[id]/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import type { Tournament, TournamentPlayer } from '$lib/types';

  const { data, form } = $props<{
    data: {
      tournament: Tournament;
      players: TournamentPlayer[];
      availableMembers: { user_id: string; display_name: string }[];
      prizePool: number;
    };
    form: { errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as Record<string, (() => string) | undefined>;
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
    <span class="text-xs font-medium px-2 py-0.5 rounded-full {statusClass(t.status)}">
      {statusLabel(t.status)}
    </span>
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
    {:else}
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
              {#if t.status === 'registration'}
                <form method="POST" action="?/remove_player" use:enhance>
                  <input type="hidden" name="player_id" value={player.id} />
                  <button type="submit" class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    Remove
                  </button>
                </form>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Add player -->
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
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/
git commit -m "feat: add tournament detail and registration page"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests pass (including the new tournaments helper tests).

- [ ] **Step 2: Run the type checker**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 3: Manual smoke test in dev**

```bash
npm run dev
```

Verify the full flow:
1. Navigate to `/[club]/admin` — confirm Tournaments tab is visible
2. Click Tournaments tab — confirm empty state and footer links to blind/prize structures
3. Navigate to blind structures — create one (e.g. "2h Turbo" with 3 levels)
4. Navigate to prize structures — create one (e.g. "Top 3 (60/30/10)")
5. Click "New tournament" — confirm form has selects populated with the templates; rebuy fields appear/disappear based on format
6. Create a tournament — confirm redirect to detail page
7. Add a member and a guest to the tournament — confirm prize pool updates
8. Remove a player — confirm they are removed

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: tournament feature post-verification fixes"
```
