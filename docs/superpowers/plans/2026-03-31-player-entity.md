# Player Entity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the account-required `club_members` table with a new `players` table that supports account-less player management, with optional account linking via invites.

**Architecture:** A single Supabase migration drops `club_members` and the old `tournament_players` columns, creates the `players` table, and re-wires `tournament_players` and `club_invites`. TypeScript types, RLS helper functions, layout guards, and all UI components are updated to use `players` instead of `club_members`. The `displayName()` utility centralises name formatting. A new admin Players page and Player detail page replace the Members page.

**Tech Stack:** SvelteKit 5 (Svelte 5 runes), Supabase (Postgres, RLS), Paraglide JS (i18n), Vitest (TDD), Tailwind CSS v4

**Important conventions:**
- All Svelte components use Svelte 5 runes syntax (`$props()`, `$state()`, `$derived()`, `{@render children()}`)
- All user-visible strings must use Paraglide message functions (`m.some_key()`)
- Server-side DB writes use the service client (`createServiceClient()`) — it bypasses RLS
- Client-side mutations use `createClient()` from `$lib/supabase` + `invalidateAll()`
- TDD: write failing test first, then implement

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0008_player_entity.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 0008_player_entity.sql
-- Replaces club_members with players table, rewires tournament_players and club_invites.
-- Clean-slate: drops existing data (pre-launch).

-- ============================================================
-- 1. Drop dependent objects first
-- ============================================================

-- Drop RLS policies that reference club_members
drop policy if exists "members can read club members" on club_members;
drop policy if exists "admins can manage club members" on club_members;

-- Drop tournament_players constraints and columns that reference club_members
alter table tournament_players
  drop constraint if exists tournament_players_member_club_id_member_user_id_fkey,
  drop constraint if exists tournament_players_identity;

-- Drop tournament_players data (clean slate)
truncate tournament_players cascade;

-- Drop old columns from tournament_players
alter table tournament_players
  drop column if exists member_club_id,
  drop column if exists member_user_id,
  drop column if exists guest_name;

-- Drop club_members table
drop table if exists club_members cascade;

-- ============================================================
-- 2. Create players table
-- ============================================================

create table players (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  role          text not null default 'member' check (role in ('admin', 'member')),
  member_number integer not null,
  first_name    text not null,
  last_name     text not null,
  nickname      text,
  birthday      date,
  country       text,
  city          text,
  phone         text,
  created_at    timestamptz not null default now()
);

-- Unique member number per club
create unique index players_club_member_number on players (club_id, member_number);

-- One account per club (partial index: only where user_id is set)
create unique index players_club_user on players (club_id, user_id) where user_id is not null;

-- Index for RLS lookups
create index players_user_id on players (user_id) where user_id is not null;

-- ============================================================
-- 3. Add player_id to tournament_players
-- ============================================================

alter table tournament_players
  add column player_id uuid not null references players(id) on delete cascade;

create index tournament_players_player_id on tournament_players (player_id);

-- ============================================================
-- 4. Add player_id to club_invites
-- ============================================================

alter table club_invites
  add column player_id uuid references players(id) on delete set null;

-- Truncate existing invites (clean slate)
truncate club_invites;

-- ============================================================
-- 5. Update RLS helper functions to query players instead of club_members
-- ============================================================

create or replace function get_user_club_ids(user_uuid uuid)
  returns setof uuid
  language sql
  security definer
  stable
  set search_path = public
  as $$
    select club_id from players where user_id = user_uuid
  $$;

create or replace function is_club_admin(user_uuid uuid, check_club_id uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
  as $$
    select exists (
      select 1 from players
      where user_id = user_uuid
        and club_id = check_club_id
        and role = 'admin'
    )
  $$;

-- ============================================================
-- 6. RLS for players table
-- ============================================================

alter table players enable row level security;

create policy "members can read club players"
  on players for select
  using (club_id in (select get_user_club_ids(auth.uid())));

create policy "admins can manage club players"
  on players for all
  using (is_club_admin(auth.uid(), club_id));

-- ============================================================
-- 7. Refresh dependent policies (clubs table still references helper functions, no changes needed)
-- ============================================================
-- The clubs and tournament policies already use get_user_club_ids / is_club_admin
-- which now query players. No policy DDL changes needed for those tables.
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db reset`
Expected: Database recreated with all migrations applied, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_player_entity.sql
git commit -m "feat: add players table migration, drop club_members (clean slate)"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update the Database type and add Player type**

In `src/lib/types.ts`, replace the `club_members` table type with `players`, update `tournament_players` to remove old columns and add `player_id`, and update `club_invites` to add `player_id`. Also update the convenience type aliases at the bottom of the file.

Replace the `club_members` block (lines 75–106) with:

```typescript
      players: {
        Row: {
          id: string
          club_id: string
          user_id: string | null
          role: string
          member_number: number
          first_name: string
          last_name: string
          nickname: string | null
          birthday: string | null
          country: string | null
          city: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          user_id?: string | null
          role?: string
          member_number: number
          first_name: string
          last_name: string
          nickname?: string | null
          birthday?: string | null
          country?: string | null
          city?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          user_id?: string | null
          role?: string
          member_number?: number
          first_name?: string
          last_name?: string
          nickname?: string | null
          birthday?: string | null
          country?: string | null
          city?: string | null
          phone?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
```

In the `tournament_players` block, remove `member_club_id`, `member_user_id`, `guest_name` from Row/Insert/Update and add `player_id: string` (required in Insert, optional in Update). Update Relationships: remove the `tournament_players_member_club_id_member_user_id_fkey` entry, add:

```typescript
          {
            foreignKeyName: "tournament_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
```

In `club_invites`, add `player_id: string | null` to Row, `player_id?: string | null` to Insert and Update.

Replace the convenience types at the bottom (lines 514–596) with:

```typescript
export type Club = Database['public']['Tables']['clubs']['Row'];
export type Player = Database['public']['Tables']['players']['Row'];
export type Role = 'admin' | 'member';

export type ClubContext = {
  club: Club;
  player: Player;
  role: Role;
};

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

export interface BlindStructure {
  id: string;
  club_id: string;
  name: string;
  levels: BlindLevel[];
  created_at: string;
}

export interface PrizeStructure {
  id: string;
  club_id: string;
  name: string;
  payouts: Payout[];
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
  prize_structures?: { name: string; payouts: { position: number; percentage: number }[] } | null;
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  player_id: string;
  rebuys: number;
  addon: boolean;
  finish_position: number | null;
  payout_amount: number | null;
  created_at: string;
  players?: { id: string; first_name: string; last_name: string; nickname: string | null } | null;
  table_id: string | null;
  seat_number: number | null;
  preferred_table: number | null;
  tournament_tables?: { number: number; max_seats: number } | null;
}

export type ClubInvite = Database['public']['Tables']['club_invites']['Row'];

export interface TournamentTable {
  id: string;
  tournament_id: string;
  number: number;
  max_seats: number;
  dealer: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Run type check**

Run: `npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: Type errors in files that still reference `ClubMember` or old `tournament_players` columns — that's expected, we'll fix those in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: update types — Player replaces ClubMember, tournament_players uses player_id"
```

---

### Task 3: Player Utility & displayName

**Files:**
- Create: `src/lib/players.ts`
- Delete: `src/lib/members.ts`
- Test: `tests/unit/players.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/players.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { displayName, isAdmin } from '$lib/players';

describe('displayName', () => {
  it('returns nickname when set', () => {
    expect(displayName({ first_name: 'John', last_name: 'Doe', nickname: 'JD' })).toBe('JD');
  });

  it('returns "first last" when no nickname', () => {
    expect(displayName({ first_name: 'John', last_name: 'Doe', nickname: null })).toBe('John Doe');
  });

  it('returns "first last" when nickname is empty string', () => {
    expect(displayName({ first_name: 'John', last_name: 'Doe', nickname: '' })).toBe('John Doe');
  });
});

describe('isAdmin', () => {
  it('returns true for admin role', () => {
    expect(isAdmin({ role: 'admin' } as any)).toBe(true);
  });

  it('returns false for member role', () => {
    expect(isAdmin({ role: 'member' } as any)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/players.test.ts`
Expected: FAIL — module `$lib/players` not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/players.ts`:

```typescript
import type { Player } from './types';

export function displayName(player: Pick<Player, 'first_name' | 'last_name' | 'nickname'>): string {
  return player.nickname?.trim() || `${player.first_name} ${player.last_name}`;
}

export function isAdmin(player: Pick<Player, 'role'>): boolean {
  return player.role === 'admin';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/players.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Delete old members.ts**

```bash
rm src/lib/members.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/players.ts tests/unit/players.test.ts
git rm src/lib/members.ts
git commit -m "feat: add displayName and isAdmin utilities in players.ts, remove members.ts"
```

---

### Task 4: i18n Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Add new keys and rename existing ones**

Add the following keys to `messages/en.json` (remove `members_*` keys that are no longer needed, keep `members_remove` as `player_remove`):

```json
  "nav_players": "Players",
  "dashboard_stat_players": "Players",
  "players_title": "Players",
  "players_empty": "No players yet.",
  "player_add_button": "Add Player",
  "player_first_name_label": "First name",
  "player_last_name_label": "Last name",
  "player_nickname_label": "Nickname",
  "player_birthday_label": "Birthday",
  "player_country_label": "Country",
  "player_city_label": "City",
  "player_phone_label": "Phone",
  "player_member_number_label": "Member #",
  "player_registration_date_label": "Registration date",
  "player_remove": "Remove",
  "player_save": "Save",
  "player_cancel": "Cancel",
  "player_linked": "Account linked",
  "player_not_linked": "No account",
  "player_generate_invite": "Generate invite link",
  "player_detail_title": "Player Details",
  "player_edit_title": "Edit Player",
  "player_quick_add_title": "Quick Add Player",
  "player_quick_add_button": "Add & Register",
  "invite_first_name_label": "First name",
  "invite_last_name_label": "Last name",
  "invite_linked_title": "Link Your Account",
  "invite_linked_body": "You've been invited to link your account to your player profile in {club_name}."
```

Add the equivalent German translations to `messages/de.json`:

```json
  "nav_players": "Spieler",
  "dashboard_stat_players": "Spieler",
  "players_title": "Spieler",
  "players_empty": "Noch keine Spieler.",
  "player_add_button": "Spieler hinzufügen",
  "player_first_name_label": "Vorname",
  "player_last_name_label": "Nachname",
  "player_nickname_label": "Spitzname",
  "player_birthday_label": "Geburtstag",
  "player_country_label": "Land",
  "player_city_label": "Stadt",
  "player_phone_label": "Telefon",
  "player_member_number_label": "Mitglieds-Nr.",
  "player_registration_date_label": "Registrierungsdatum",
  "player_remove": "Entfernen",
  "player_save": "Speichern",
  "player_cancel": "Abbrechen",
  "player_linked": "Konto verknüpft",
  "player_not_linked": "Kein Konto",
  "player_generate_invite": "Einladungslink erstellen",
  "player_detail_title": "Spielerdetails",
  "player_edit_title": "Spieler bearbeiten",
  "player_quick_add_title": "Spieler schnell hinzufügen",
  "player_quick_add_button": "Hinzufügen & Registrieren",
  "invite_first_name_label": "Vorname",
  "invite_last_name_label": "Nachname",
  "invite_linked_title": "Konto verknüpfen",
  "invite_linked_body": "Du wurdest eingeladen, dein Konto mit deinem Spielerprofil bei {club_name} zu verknüpfen."
```

Remove the now-unused keys from both files:
- `nav_members` (replaced by `nav_players`)
- `dashboard_stat_members` (replaced by `dashboard_stat_players`)
- `members_title`, `members_empty`, `members_invite_title`, `members_invite_generate`, `members_invite_copy`, `members_invite_copied`, `members_invite_revoke`, `members_invite_new_link`, `members_invited_success`, `members_remove`, `members_invite_button`

Keep: `club_display_name_label` (still used on club creation page, but this will change to first/last name — see Task 10).

- [ ] **Step 2: Compile paraglide**

Run: `npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide`
Expected: Successfully compiled.

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/de.json src/lib/paraglide/
git commit -m "feat: add player i18n keys, remove old members keys"
```

---

### Task 5: Layout Guards & Sidebar

**Files:**
- Modify: `src/routes/[club]/+layout.ts`
- Modify: `src/routes/[club]/admin/+layout.ts`
- Modify: `src/lib/components/Sidebar.svelte`
- Modify: `src/routes/[club]/+page.svelte`
- Modify: `src/routes/[club]/+page.ts`

- [ ] **Step 1: Update club layout guard**

Replace `src/routes/[club]/+layout.ts` contents with:

```typescript
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

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();
  if (!player) throw error(403, 'You are not a member of this club');

  return { club, player };
};
```

- [ ] **Step 2: Update admin layout guard**

Replace `src/routes/[club]/admin/+layout.ts` contents with:

```typescript
import { error } from '@sveltejs/kit';
import { isAdmin } from '$lib/players';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
  const { player } = await parent();
  if (!isAdmin(player)) throw error(403, 'Admin access required');
  return {};
};
```

- [ ] **Step 3: Update Sidebar**

In `src/lib/components/Sidebar.svelte`:

Replace import of `isAdmin` from `$lib/members` with `$lib/players`, and replace `ClubMember` with `Player`:

```typescript
  import { isAdmin } from '$lib/players';
  import { displayName } from '$lib/players';
  import ThemeToggle from './ThemeToggle.svelte';
  import LanguageSwitcher from './LanguageSwitcher.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { Club, Player } from '$lib/types';

  const { club, player, currentPath } = $props<{
    club: Club;
    player: Player;
    currentPath: string;
  }>();
```

Change `isAdmin(member)` to `isAdmin(player)`.

Change `member.display_name` to `displayName(player)`.

Change `{clubPath}/admin/members` to `{clubPath}/admin/players`.

Change `m.nav_members()` to `m.nav_players()`.

Change `isActive(\`${clubPath}/admin/members\`)` to `isActive(\`${clubPath}/admin/players\`)`.

- [ ] **Step 4: Update dashboard page and loader**

In `src/routes/[club]/+page.ts`, change `club_members` to `players`:

```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ count: playerCount }, { count: tournamentCount }] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
  ]);

  return {
    playerCount: playerCount ?? 0,
    tournamentCount: tournamentCount ?? 0,
  };
};
```

In `src/routes/[club]/+page.svelte`, update the props type and stat card:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { Club, Player } from '$lib/types';

  const { data } = $props<{ data: { club: Club; player: Player; playerCount: number; tournamentCount: number } }>();
</script>

<div class="p-6 flex flex-col gap-6">
  <h1 class="text-lg font-semibold text-foreground">{m.club_home_welcome({ club_name: data.club.name })}</h1>

  <!-- Stat cards -->
  <div class="grid grid-cols-3 gap-4">
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{m.dashboard_stat_players()}</p>
      <p class="text-3xl font-light text-foreground">{data.playerCount}</p>
    </div>
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{m.dashboard_stat_tournaments()}</p>
      <p class="text-3xl font-light text-foreground">{data.tournamentCount}</p>
    </div>
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{m.dashboard_stat_balance()}</p>
      <p class="text-3xl font-light text-accent">—</p>
    </div>
  </div>

  <!-- Next game placeholder -->
  <div class="bg-card border border-border rounded-lg p-4">
    <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{m.dashboard_next_game()}</p>
    <p class="text-sm text-muted-foreground">{m.club_home_placeholder()}</p>
  </div>
</div>
```

- [ ] **Step 5: Update any parent layout that passes `member` to Sidebar**

Search for where `Sidebar` is rendered and change `member={data.member}` to `player={data.player}`:

Run: `grep -rn "Sidebar" src/routes/ --include="*.svelte"`

Update each file that passes `member` prop to pass `player` instead.

- [ ] **Step 6: Run svelte-kit sync and type check**

Run: `npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10`
Expected: May still have errors in files not yet updated (tournament pages, invite pages). The layout, sidebar, and dashboard should be clean.

- [ ] **Step 7: Commit**

```bash
git add src/routes/[club]/+layout.ts src/routes/[club]/admin/+layout.ts src/lib/components/Sidebar.svelte src/routes/[club]/+page.svelte src/routes/[club]/+page.ts
git add -u src/routes/  # catch any layout files that pass Sidebar props
git commit -m "feat: switch layout guards, sidebar, and dashboard from club_members to players"
```

---

### Task 6: Players List Page

**Files:**
- Create: `src/routes/[club]/admin/players/+page.ts`
- Create: `src/routes/[club]/admin/players/+page.svelte`
- Delete: `src/routes/[club]/admin/members/+page.ts`
- Delete: `src/routes/[club]/admin/members/+page.svelte`

- [ ] **Step 1: Create the player list loader**

Create `src/routes/[club]/admin/players/+page.ts`:

```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, nickname, user_id, member_number')
    .eq('club_id', club.id)
    .order('member_number');

  return { players: players ?? [] };
};
```

- [ ] **Step 2: Create the player list page**

Create `src/routes/[club]/admin/players/+page.svelte`:

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props();

  let showAddModal = $state(false);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  // Add player form state
  let firstName = $state('');
  let lastName = $state('');
  let nickname = $state('');
  let birthday = $state('');
  let country = $state('');
  let city = $state('');
  let phone = $state('');
  let registrationDate = $state(new Date().toISOString().split('T')[0]);
  let memberNumber = $state('');

  const nextMemberNumber = $derived(
    data.players.length > 0
      ? Math.max(...data.players.map((p: { member_number: number }) => p.member_number)) + 1
      : 1
  );

  function openAddModal() {
    firstName = '';
    lastName = '';
    nickname = '';
    birthday = '';
    country = '';
    city = '';
    phone = '';
    registrationDate = new Date().toISOString().split('T')[0];
    memberNumber = String(nextMemberNumber);
    errorMsg = null;
    showAddModal = true;
  }

  async function handleAddPlayer() {
    if (loading) return;
    if (!firstName.trim() || !lastName.trim()) { errorMsg = m.error_required(); return; }
    const num = parseInt(memberNumber);
    if (!num || num < 1) { errorMsg = m.error_required(); return; }
    loading = true;
    errorMsg = null;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('players').insert({
        club_id: data.club.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        nickname: nickname.trim() || null,
        birthday: birthday || null,
        country: country.trim() || null,
        city: city.trim() || null,
        phone: phone.trim() || null,
        member_number: num,
        created_at: registrationDate || new Date().toISOString(),
      });
      if (error) {
        if (error.code === '23505') { errorMsg = 'Member number already taken'; return; }
        errorMsg = error.message;
        return;
      }
      showAddModal = false;
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-start justify-between">
    <h1 class="text-base font-semibold text-foreground">{m.players_title()}</h1>
    <button
      type="button"
      onclick={openAddModal}
      class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
    >
      {m.player_add_button()}
    </button>
  </div>

  {#if data.players.length === 0}
    <p class="text-sm text-muted-foreground">{m.players_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[60px_1fr_1fr_1fr_40px] border-b border-border px-4 py-2.5">
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">#</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.player_first_name_label()}</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.player_last_name_label()}</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.player_nickname_label()}</span>
        <span></span>
      </div>
      {#each data.players as player}
        <a
          href="/{data.club.slug}/admin/players/{player.id}"
          class="grid grid-cols-[60px_1fr_1fr_1fr_40px] px-4 py-3 border-b border-border last:border-0 items-center hover:bg-card/80 transition-colors"
        >
          <span class="text-xs text-muted-foreground">{player.member_number}</span>
          <span class="text-sm font-medium text-foreground">{player.first_name}</span>
          <span class="text-sm text-foreground">{player.last_name}</span>
          <span class="text-sm text-muted-foreground">{player.nickname ?? '—'}</span>
          <span class="flex justify-end">
            {#if player.user_id}
              <span class="w-2 h-2 rounded-full bg-green-500" title={m.player_linked()}></span>
            {:else}
              <span class="w-2 h-2 rounded-full bg-border" title={m.player_not_linked()}></span>
            {/if}
          </span>
        </a>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Player Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <button type="button" class="absolute inset-0 bg-black/50" onclick={() => (showAddModal = false)}></button>
    <div class="relative bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
      <h2 class="text-sm font-semibold text-foreground mb-4">{m.player_add_button()}</h2>
      <form onsubmit={(e) => { e.preventDefault(); handleAddPlayer(); }} class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_first_name_label()} *</label>
            <input bind:value={firstName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_last_name_label()} *</label>
            <input bind:value={lastName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_nickname_label()}</label>
          <input bind:value={nickname} type="text" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_birthday_label()}</label>
            <input bind:value={birthday} type="date" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_phone_label()}</label>
            <input bind:value={phone} type="tel" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_country_label()}</label>
            <input bind:value={country} type="text" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_city_label()}</label>
            <input bind:value={city} type="text" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_registration_date_label()}</label>
            <input bind:value={registrationDate} type="date" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_member_number_label()}</label>
            <input bind:value={memberNumber} type="number" min="1" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>
        {#if errorMsg}
          <p class="text-xs text-accent">{errorMsg}</p>
        {/if}
        <div class="flex gap-2 justify-end mt-2">
          <button type="button" onclick={() => (showAddModal = false)} class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-3 py-1.5">
            {m.player_cancel()}
          </button>
          <button type="submit" disabled={loading} class="bg-accent text-accent-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
            {m.player_save()}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Delete old members page files**

```bash
rm 'src/routes/[club]/admin/members/+page.svelte'
rm 'src/routes/[club]/admin/members/+page.ts'
rmdir 'src/routes/[club]/admin/members'
```

- [ ] **Step 4: Run svelte-kit sync and type check**

Run: `npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add 'src/routes/[club]/admin/players/'
git rm 'src/routes/[club]/admin/members/+page.svelte' 'src/routes/[club]/admin/members/+page.ts'
git commit -m "feat: add players list page, remove old members page"
```

---

### Task 7: Player Detail Page

**Files:**
- Create: `src/routes/[club]/admin/players/[id]/+page.ts`
- Create: `src/routes/[club]/admin/players/[id]/+page.svelte`

- [ ] **Step 1: Create the player detail loader**

Create `src/routes/[club]/admin/players/[id]/+page.ts`:

```typescript
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', params.id)
    .eq('club_id', club.id)
    .single();

  if (!player) throw error(404, 'Player not found');

  return { targetPlayer: player };
};
```

- [ ] **Step 2: Create the player detail page**

Create `src/routes/[club]/admin/players/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import { displayName } from '$lib/players';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props();

  const p = $derived(data.targetPlayer);

  let editing = $state(false);
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);

  // Edit form state
  let firstName = $state('');
  let lastName = $state('');
  let nickname = $state('');
  let birthday = $state('');
  let country = $state('');
  let city = $state('');
  let phone = $state('');
  let memberNumber = $state('');
  let registrationDate = $state('');

  function startEditing() {
    firstName = p.first_name;
    lastName = p.last_name;
    nickname = p.nickname ?? '';
    birthday = p.birthday ?? '';
    country = p.country ?? '';
    city = p.city ?? '';
    phone = p.phone ?? '';
    memberNumber = String(p.member_number);
    registrationDate = p.created_at.split('T')[0];
    errorMsg = null;
    editing = true;
  }

  async function handleSave() {
    if (loading) return;
    if (!firstName.trim() || !lastName.trim()) { errorMsg = m.error_required(); return; }
    const num = parseInt(memberNumber);
    if (!num || num < 1) { errorMsg = m.error_required(); return; }
    loading = true;
    errorMsg = null;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('players')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          nickname: nickname.trim() || null,
          birthday: birthday || null,
          country: country.trim() || null,
          city: city.trim() || null,
          phone: phone.trim() || null,
          member_number: num,
          created_at: registrationDate ? new Date(registrationDate).toISOString() : p.created_at,
        })
        .eq('id', p.id);
      if (error) {
        if (error.code === '23505') { errorMsg = 'Member number already taken'; return; }
        errorMsg = error.message;
        return;
      }
      editing = false;
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  // Invite link generation
  let inviteUrl = $state<string | null>(null);
  let copied = $state(false);

  async function handleGenerateInvite() {
    if (loading) return;
    loading = true;
    errorMsg = null;
    try {
      const supabase = createClient();
      const { data: invite, error } = await supabase
        .from('club_invites')
        .insert({ club_id: data.club.id, created_by: data.player.user_id!, player_id: p.id })
        .select('id')
        .single();
      if (error) { errorMsg = error.message; return; }
      inviteUrl = `${window.location.origin}/invite/${invite.id}`;
    } finally {
      loading = false;
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  async function handleDelete() {
    if (loading) return;
    loading = true;
    try {
      const supabase = createClient();
      await supabase.from('players').delete().eq('id', p.id);
      goto(`/${data.club.slug}/admin/players`);
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-start justify-between">
    <div>
      <a href="/{data.club.slug}/admin/players" class="text-xs text-muted-foreground hover:text-foreground transition-colors">&larr; {m.players_title()}</a>
      <h1 class="text-base font-semibold text-foreground mt-1">{displayName(p)}</h1>
      <p class="text-xs text-muted-foreground">#{p.member_number}</p>
    </div>
    {#if !editing}
      <button type="button" onclick={startEditing} class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        {m.player_edit_title()}
      </button>
    {/if}
  </div>

  {#if editing}
    <form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_first_name_label()} *</label>
          <input bind:value={firstName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_last_name_label()} *</label>
          <input bind:value={lastName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_nickname_label()}</label>
        <input bind:value={nickname} type="text" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_birthday_label()}</label>
          <input bind:value={birthday} type="date" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_phone_label()}</label>
          <input bind:value={phone} type="tel" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_country_label()}</label>
          <input bind:value={country} type="text" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_city_label()}</label>
          <input bind:value={city} type="text" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_registration_date_label()}</label>
          <input bind:value={registrationDate} type="date" class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_member_number_label()}</label>
          <input bind:value={memberNumber} type="number" min="1" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
      </div>
      {#if errorMsg}
        <p class="text-xs text-accent">{errorMsg}</p>
      {/if}
      <div class="flex gap-2 justify-end mt-2">
        <button type="button" onclick={() => (editing = false)} class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-3 py-1.5">
          {m.player_cancel()}
        </button>
        <button type="submit" disabled={loading} class="bg-accent text-accent-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
          {m.player_save()}
        </button>
      </div>
    </form>
  {:else}
    <div class="bg-card border border-border rounded-lg p-5">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p class="text-xs text-muted-foreground mb-0.5">{m.player_first_name_label()}</p>
          <p class="text-foreground">{p.first_name}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-0.5">{m.player_last_name_label()}</p>
          <p class="text-foreground">{p.last_name}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-0.5">{m.player_nickname_label()}</p>
          <p class="text-foreground">{p.nickname ?? '—'}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-0.5">{m.player_member_number_label()}</p>
          <p class="text-foreground">#{p.member_number}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-0.5">{m.player_birthday_label()}</p>
          <p class="text-foreground">{p.birthday ?? '—'}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-0.5">{m.player_phone_label()}</p>
          <p class="text-foreground">{p.phone ?? '—'}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-0.5">{m.player_country_label()}</p>
          <p class="text-foreground">{p.country ?? '—'}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-0.5">{m.player_city_label()}</p>
          <p class="text-foreground">{p.city ?? '—'}</p>
        </div>
        <div>
          <p class="text-xs text-muted-foreground mb-0.5">{m.player_registration_date_label()}</p>
          <p class="text-foreground">{p.created_at.split('T')[0]}</p>
        </div>
      </div>
    </div>

    <!-- Account linking -->
    <div class="bg-card border border-border rounded-lg p-5">
      {#if p.user_id}
        <p class="text-sm text-foreground flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-green-500"></span>
          {m.player_linked()}
        </p>
      {:else}
        <div class="flex flex-col gap-3">
          <p class="text-sm text-muted-foreground flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-border"></span>
            {m.player_not_linked()}
          </p>
          {#if inviteUrl}
            <div class="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
              <span class="text-xs font-mono text-foreground truncate flex-1">{inviteUrl}</span>
              <button type="button" onclick={copyLink} class="text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer flex-shrink-0">
                {copied ? m.invite_copied() : m.invite_copy()}
              </button>
            </div>
          {:else}
            <button type="button" onclick={handleGenerateInvite} disabled={loading} class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
              {m.player_generate_invite()}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Delete -->
    <button type="button" onclick={handleDelete} disabled={loading} class="self-start text-xs text-muted-foreground hover:text-accent transition-colors cursor-pointer">
      {m.player_remove()}
    </button>
  {/if}
</div>
```

**Important:** Task 4 removes the old `members_invite_copy` and `members_invite_copied` keys. Add replacements in Task 4's i18n key additions:
- en.json: `"invite_copy": "Copy"`, `"invite_copied": "Copied!"`
- de.json: `"invite_copy": "Kopieren"`, `"invite_copied": "Kopiert!"`

Then in this file, use `m.invite_copied()` and `m.invite_copy()` instead of the old `members_invite_*` names.

- [ ] **Step 3: Run svelte-kit sync and verify**

Run: `npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10`

- [ ] **Step 4: Commit**

```bash
git add 'src/routes/[club]/admin/players/[id]/'
git commit -m "feat: add player detail page with edit, invite link, and delete"
```

---

### Task 8: Tournament Page — Player Registration Rework

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.ts`
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

- [ ] **Step 1: Update tournament detail loader**

Replace the contents of `src/routes/[club]/admin/tournaments/[id]/+page.ts`:

```typescript
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

  const [{ data: players }, { data: clubPlayers }, { data: tables }, { data: prizeStructures }, { data: blindStructures }] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('*, players!tournament_players_player_id_fkey(id, first_name, last_name, nickname)')
      .eq('tournament_id', params.id)
      .order('created_at'),
    supabase
      .from('players')
      .select('id, first_name, last_name, nickname, member_number')
      .eq('club_id', club.id)
      .order('first_name'),
    supabase
      .from('tournament_tables')
      .select('*')
      .eq('tournament_id', params.id)
      .order('number'),
    supabase.from('prize_structures').select('id, name').eq('club_id', club.id).order('name'),
    supabase.from('blind_structures').select('id, name').eq('club_id', club.id).order('name'),
  ]);

  const allPlayers = players ?? [];
  const registeredPlayerIds = new Set(allPlayers.map((p) => p.player_id));
  const availablePlayers = (clubPlayers ?? []).filter((p) => !registeredPlayerIds.has(p.id));

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

  return { tournament, players: allPlayers, availablePlayers, prizePool, prizeStructure, tables: tables ?? [], prizeStructures: prizeStructures ?? [], blindStructures: blindStructures ?? [] };
};
```

- [ ] **Step 2: Update tournament page component**

In `src/routes/[club]/admin/tournaments/[id]/+page.svelte`, make these changes:

1. Add import at the top:
```typescript
import { displayName } from '$lib/players';
```

2. Replace all occurrences of `p.club_members?.display_name ?? p.guest_name ?? '?'` and similar patterns with:
```typescript
p.players ? displayName(p.players) : '?'
```

3. Replace `selectedMemberId` state and guest name handling with player-based selection:
```typescript
  let selectedPlayerId = $state('');
  let showQuickAdd = $state(false);
  let quickFirstName = $state('');
  let quickLastName = $state('');
```

4. Replace `handleAddPlayer` function:
```typescript
  async function handleAddPlayer(playerId: string) {
    if (loading) return;
    if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('tournament_players').insert({
        tournament_id: data.tournament.id,
        player_id: playerId,
      });
      if (error) { errorKey = 'server_error'; return; }
      selectedPlayerId = '';
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
```

5. Add quick-add handler:
```typescript
  async function handleQuickAdd() {
    if (loading) return;
    if (!quickFirstName.trim() || !quickLastName.trim()) { errorKey = 'error_required'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      // Get next member number
      const { data: maxPlayer } = await supabase
        .from('players')
        .select('member_number')
        .eq('club_id', data.tournament.club_id)
        .order('member_number', { ascending: false })
        .limit(1)
        .single();
      const nextNumber = (maxPlayer?.member_number ?? 0) + 1;

      // Create player
      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert({
          club_id: data.tournament.club_id,
          first_name: quickFirstName.trim(),
          last_name: quickLastName.trim(),
          member_number: nextNumber,
        })
        .select('id')
        .single();
      if (playerError) { errorKey = 'server_error'; return; }

      // Register for tournament
      const { error: regError } = await supabase.from('tournament_players').insert({
        tournament_id: data.tournament.id,
        player_id: newPlayer.id,
      });
      if (regError) { errorKey = 'server_error'; return; }

      showQuickAdd = false;
      quickFirstName = '';
      quickLastName = '';
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
```

6. Update the `activePlayers` derived to use `displayName`:
```typescript
  const activePlayers = $derived(
    data.players
      .filter((p) => p.finish_position === null && p.table_id !== null && p.seat_number !== null)
      .map((p) => ({
        id: p.id,
        name: p.players ? displayName(p.players) : '?',
        tableId: p.table_id!,
        tableNumber: data.tables.find((t) => t.id === p.table_id)?.number ?? 0,
        seatNumber: p.seat_number!,
      })),
  );
```

7. In the registration template section, replace the member dropdown + guest input with:
```svelte
        <div class="flex gap-2">
          <select
            bind:value={selectedPlayerId}
            class="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground"
          >
            <option value="">{m.tournament_select_player()}</option>
            {#each data.availablePlayers as player}
              <option value={player.id}>
                {player.nickname || `${player.first_name} ${player.last_name}`} #{player.member_number}
              </option>
            {/each}
          </select>
          <button
            type="button"
            onclick={() => handleAddPlayer(selectedPlayerId)}
            disabled={loading || !selectedPlayerId}
            class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {m.tournament_add_player_button()}
          </button>
          <button
            type="button"
            onclick={() => { showQuickAdd = true; quickFirstName = ''; quickLastName = ''; }}
            class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2"
            title={m.player_quick_add_title()}
          >
            +
          </button>
        </div>
```

8. Add quick-add modal (after the closing `</div>` of the main content, before the end of the file):
```svelte
{#if showQuickAdd}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <button type="button" class="absolute inset-0 bg-black/50" onclick={() => (showQuickAdd = false)}></button>
    <div class="relative bg-card border border-border rounded-xl p-6 w-full max-w-sm mx-4">
      <h2 class="text-sm font-semibold text-foreground mb-4">{m.player_quick_add_title()}</h2>
      <form onsubmit={(e) => { e.preventDefault(); handleQuickAdd(); }} class="flex flex-col gap-3">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_first_name_label()} *</label>
          <input bind:value={quickFirstName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">{m.player_last_name_label()} *</label>
          <input bind:value={quickLastName} type="text" required class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors" />
        </div>
        {#if errorKey}
          <p class="text-xs text-accent">{resolveError(errorKey)}</p>
        {/if}
        <div class="flex gap-2 justify-end mt-2">
          <button type="button" onclick={() => (showQuickAdd = false)} class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-3 py-1.5">
            {m.player_cancel()}
          </button>
          <button type="submit" disabled={loading} class="bg-accent text-accent-foreground text-sm font-medium px-4 py-1.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50">
            {m.player_quick_add_button()}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
```

9. Update all player name displays throughout the template. Everywhere you see patterns like:
   - `player.club_members?.display_name ?? player.guest_name ?? '?'` → `player.players ? displayName(player.players) : '?'`
   - `player.guest_name ? \`${player.guest_name} ${m.tournament_guest_suffix()}\`` → remove the guest suffix entirely, use `player.players ? displayName(player.players) : '?'`

10. Remove the `guestName` state variable and all references to it.

11. Update `data.availableMembers` references to `data.availablePlayers`.

- [ ] **Step 3: Add missing i18n key for player selection**

Add to `messages/en.json`: `"tournament_select_player": "Select player…"`
Add to `messages/de.json`: `"tournament_select_player": "Spieler auswählen…"`

Compile: `npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide`

- [ ] **Step 4: Run svelte-kit sync and type check**

Run: `npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add 'src/routes/[club]/admin/tournaments/[id]/+page.ts' 'src/routes/[club]/admin/tournaments/[id]/+page.svelte' messages/ src/lib/paraglide/
git commit -m "feat: rework tournament registration to use players table, add quick-add modal"
```

---

### Task 9: Update Seating Tests

**Files:**
- Modify: `tests/unit/seating.test.ts`

The seating module uses its own `ActivePlayer` interface (with `name` field) and doesn't reference `club_members` directly. The seating tests should still pass. Verify:

- [ ] **Step 1: Run existing seating tests**

Run: `npx vitest run tests/unit/seating.test.ts`
Expected: All 56 tests pass (seating module is independent of DB types).

- [ ] **Step 2: Commit (only if changes were needed)**

If no changes needed, skip this commit.

---

### Task 10: Club Creation & Invite Flow Updates

**Files:**
- Modify: `src/routes/clubs/new/+page.server.ts`
- Modify: `src/routes/clubs/new/+page.svelte`
- Modify: `src/routes/invite/[token]/+page.server.ts`
- Modify: `src/routes/invite/[token]/+page.svelte`

- [ ] **Step 1: Update club creation server action**

In `src/routes/clubs/new/+page.server.ts`, change the `club_members` insert to a `players` insert:

Replace:
```typescript
    const { error: memberError } = await service
      .from('club_members')
      .insert({ club_id: club.id, user_id: session.user.id, role: 'admin', display_name: displayName });
```

With:
```typescript
    const { error: memberError } = await service
      .from('players')
      .insert({
        club_id: club.id,
        user_id: session.user.id,
        role: 'admin',
        first_name: firstName,
        last_name: lastName,
        member_number: 1,
      });
```

Update the form data extraction:
```typescript
    const firstName = formData.get('first_name')?.toString().trim() ?? '';
    const lastName = formData.get('last_name')?.toString().trim() ?? '';

    if (!name) return fail(400, { errorKey: 'error_required', field: 'name' });
    if (!isValidSlug(slug)) return fail(400, { errorKey: 'error_invalid_slug' });
    if (!firstName) return fail(400, { errorKey: 'error_required', field: 'first_name' });
    if (!lastName) return fail(400, { errorKey: 'error_required', field: 'last_name' });
```

Remove the `displayName` variable and its validation.

- [ ] **Step 2: Update club creation form**

In `src/routes/clubs/new/+page.svelte`, replace the `display_name` field with first name and last name fields:

Replace the display_name div with:
```svelte
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="first_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
              {m.player_first_name_label()}
            </label>
            <input
              id="first_name" name="first_name" type="text" required
              placeholder="John"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label for="last_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
              {m.player_last_name_label()}
            </label>
            <input
              id="last_name" name="last_name" type="text" required
              placeholder="Doe"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
```

- [ ] **Step 3: Update invite acceptance server action**

In `src/routes/invite/[token]/+page.server.ts`:

Update the `load` function — check `players` instead of `club_members` for existing membership:
```typescript
  const { data: existing } = await createUserClient(session.access_token)
    .from('players')
    .select('id')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();

  if (existing) throw redirect(303, `/${club.slug}`);

  // Check if invite has a player_id (variant 2: linking existing player)
  const linkedPlayer = invite.player_id ? true : false;

  return { clubName: club.name, clubSlug: club.slug, linkedPlayer };
```

Update the `actions.default`:
```typescript
  default: async ({ params, request, locals: { safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (!session) throw redirect(303, `/auth/login?next=/invite/${params.token}`);

    const service = createServiceClient();

    const { data: invite } = await service
      .from('club_invites')
      .select('*, clubs(id, name, slug)')
      .eq('id', params.token)
      .single();

    if (!invite || !invite.clubs) throw error(404, 'Invite not found');
    if (invite.used_at) return { errorKey: 'invite_already_used' };
    if (new Date(invite.expires_at) < new Date()) return { errorKey: 'invite_expired' };

    const club = invite.clubs as { id: string; name: string; slug: string };

    if (invite.player_id) {
      // Variant 2: Link account to existing player
      const { error: linkError } = await service
        .from('players')
        .update({ user_id: session.user.id })
        .eq('id', invite.player_id)
        .is('user_id', null);

      if (linkError) {
        if (linkError.code === '23505') throw redirect(303, `/${club.slug}`);
        throw error(500, 'Failed to link account');
      }
    } else {
      // Variant 1: Create new player
      const formData = await request.formData();
      const firstName = formData.get('first_name')?.toString().trim() ?? '';
      const lastName = formData.get('last_name')?.toString().trim() ?? '';
      if (!firstName || !lastName) return { errorKey: 'error_required' };

      // Get next member number
      const { data: maxPlayer } = await service
        .from('players')
        .select('member_number')
        .eq('club_id', club.id)
        .order('member_number', { ascending: false })
        .limit(1)
        .single();
      const nextNumber = (maxPlayer?.member_number ?? 0) + 1;

      const { error: playerError } = await service
        .from('players')
        .insert({
          club_id: club.id,
          user_id: session.user.id,
          role: 'member',
          first_name: firstName,
          last_name: lastName,
          member_number: nextNumber,
        });

      if (playerError) {
        if (playerError.code === '23505') throw redirect(303, `/${club.slug}`);
        throw error(500, 'Failed to join club');
      }
    }

    await service
      .from('club_invites')
      .update({ used_at: new Date().toISOString(), used_by_user_id: session.user.id })
      .eq('id', params.token);

    throw redirect(303, `/${club.slug}`);
  }
```

- [ ] **Step 4: Update invite page UI**

In `src/routes/invite/[token]/+page.svelte`, update to handle both variants:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  const { data, form } = $props<{
    data: { clubName: string; clubSlug: string; linkedPlayer: boolean };
    form: { errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }
</script>

<div class="min-h-screen bg-background flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <div class="bg-card border border-border rounded-xl p-8">
      <div class="mb-6">
        <p class="font-extrabold text-sm tracking-tight text-foreground mb-1">GETSTACKED</p>
        {#if data.linkedPlayer}
          <p class="text-sm text-muted-foreground">{m.invite_linked_title()}</p>
        {:else}
          <p class="text-sm text-muted-foreground">{m.invite_title()}</p>
        {/if}
      </div>

      {#if data.linkedPlayer}
        <p class="text-sm text-foreground mb-6">{m.invite_linked_body({ club_name: data.clubName })}</p>
        <form method="POST" use:enhance>
          {#if form?.errorKey}
            <p class="text-xs text-accent mb-4">{resolveError(form.errorKey)}</p>
          {/if}
          <button
            type="submit"
            class="w-full bg-accent text-accent-foreground text-sm font-medium py-2.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
          >
            {m.invite_join_button()}
          </button>
        </form>
      {:else}
        <p class="text-sm text-foreground mb-6">{m.invite_body({ club_name: data.clubName })}</p>
        <form method="POST" use:enhance class="flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="first_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.invite_first_name_label()}
              </label>
              <input
                id="first_name" name="first_name" type="text" required
                placeholder="John"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label for="last_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
                {m.invite_last_name_label()}
              </label>
              <input
                id="last_name" name="last_name" type="text" required
                placeholder="Doe"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {#if form?.errorKey}
            <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
          {/if}

          <button
            type="submit"
            class="w-full bg-accent text-accent-foreground text-sm font-medium py-2.5 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
          >
            {m.invite_join_button()}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
```

- [ ] **Step 5: Run svelte-kit sync and type check**

Run: `npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add 'src/routes/clubs/new/+page.server.ts' 'src/routes/clubs/new/+page.svelte' 'src/routes/invite/[token]/+page.server.ts' 'src/routes/invite/[token]/+page.svelte'
git commit -m "feat: update club creation and invite flow for players table"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run full type check**

Run: `npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 0 errors.

- [ ] **Step 3: Run Paraglide compile**

Run: `npx @inlang/paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide`
Expected: Successfully compiled.

- [ ] **Step 4: Search for leftover references**

Run:
```bash
grep -rn "club_members\|ClubMember\|display_name\|guest_name\|member_club_id\|member_user_id" src/ --include="*.ts" --include="*.svelte" | grep -v node_modules | grep -v ".svelte-kit"
```
Expected: No results (all old references should be gone).

- [ ] **Step 5: Fix any remaining references found in step 4**

If any are found, update them to use the `players` table equivalents.

- [ ] **Step 6: Final commit (if fixes were needed)**

```bash
git add -u
git commit -m "fix: clean up remaining club_members references"
```
