# Member/Player Distinction + Member Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the "players" concept at the club level to "members" throughout the DB, types, routes, and UI; add `notes` field to members; add address + notes to creation form; add registration date column and sorting to the members overview.

**Architecture:** Single Supabase migration renames `players` → `members`, updates FKs, and adds `notes`. Types are updated manually (no CLI regen needed — the project maintains `src/lib/types.ts` by hand). All `.from('players')` calls change to `.from('members')`. The route directory moves from `/admin/players` to `/admin/members`. i18n keys are renamed from `player_*`/`players_*` to `member_*`/`members_*` (tournament-scoped keys stay unchanged). Sorting is client-side.

**Tech Stack:** SvelteKit 5 (runes), Supabase (service client for server routes, browser client for page components), Paraglide JS (i18n), Tailwind CSS v4, Vitest

---

## File Map

**Create:**
- `supabase/migrations/0011_rename_players_to_members.sql` — DB rename + notes column
- `src/lib/members.ts` — renamed from `src/lib/players.ts`
- `src/routes/[club]/admin/members/+page.ts` — renamed loader
- `src/routes/[club]/admin/members/+page.svelte` — renamed + enhanced page
- `src/routes/[club]/admin/members/[id]/+page.ts` — renamed loader
- `src/routes/[club]/admin/members/[id]/+page.svelte` — renamed + notes field
- `tests/unit/members.test.ts` — renamed test file

**Modify:**
- `src/lib/types.ts` — rename `players` table type to `members`, add `notes`, update `TournamentPlayer`
- `messages/en.json` — rename keys, add notes label
- `messages/de.json` — rename keys, add notes label
- `src/lib/components/Sidebar.svelte` — update import + nav link
- `src/routes/[club]/+layout.ts` — `.from('players')` → `.from('members')`
- `src/routes/[club]/+page.ts` — `.from('players')` → `.from('members')`
- `src/routes/[club]/+page.svelte` — `Player` → `Member`, i18n key rename
- `src/routes/[club]/admin/+layout.ts` — import from `$lib/members`
- `src/routes/[club]/admin/tournaments/[id]/+page.ts` — update all queries
- `src/routes/[club]/admin/tournaments/[id]/+page.svelte` — update import + queries
- `src/routes/+page.server.ts` — `.from('players')` → `.from('members')`
- `src/routes/clubs/new/+page.server.ts` — `.from('players')` → `.from('members')`
- `src/routes/invite/[token]/+page.server.ts` — update all queries + `player_id` → `member_id`

**Delete:**
- `src/lib/players.ts`
- `src/routes/[club]/admin/players/+page.ts`
- `src/routes/[club]/admin/players/+page.svelte`
- `src/routes/[club]/admin/players/[id]/+page.ts`
- `src/routes/[club]/admin/players/[id]/+page.svelte`
- `tests/unit/players.test.ts`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0011_rename_players_to_members.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0011_rename_players_to_members.sql
-- Rename players table to members, update foreign keys, add notes column.

-- ============================================================
-- 1. Drop dependent indexes and constraints first
-- ============================================================

drop index players_club_id_member_number_idx;
drop index players_club_id_user_id_idx;
drop index players_user_id_idx;
drop index tournament_players_player_id_idx;

-- Drop FK constraint from tournament_players referencing players
alter table tournament_players
  drop constraint tournament_players_player_id_fkey;

-- Drop FK constraint from club_invites referencing players
alter table club_invites
  drop constraint club_invites_player_id_fkey;

-- ============================================================
-- 2. Drop RLS policies on players
-- ============================================================

drop policy "members can read club players" on players;
drop policy "admins can manage club players" on players;

-- ============================================================
-- 3. Rename the table
-- ============================================================

alter table players rename to members;

-- ============================================================
-- 4. Add notes column
-- ============================================================

alter table members add column notes text;

-- ============================================================
-- 5. Rename player_id column in tournament_players
-- ============================================================

alter table tournament_players rename column player_id to member_id;

-- ============================================================
-- 6. Rename player_id column in club_invites
-- ============================================================

alter table club_invites rename column player_id to member_id;

-- ============================================================
-- 7. Recreate foreign key constraints
-- ============================================================

alter table tournament_players
  add constraint tournament_players_member_id_fkey
  foreign key (member_id) references members(id) on delete cascade;

alter table club_invites
  add constraint club_invites_member_id_fkey
  foreign key (member_id) references members(id) on delete set null;

-- ============================================================
-- 8. Recreate indexes
-- ============================================================

create unique index members_club_id_member_number_idx
  on members (club_id, member_number);

create unique index members_club_id_user_id_idx
  on members (club_id, user_id)
  where user_id is not null;

create index members_user_id_idx
  on members (user_id)
  where user_id is not null;

create index tournament_players_member_id_idx
  on tournament_players (member_id);

-- ============================================================
-- 9. Recreate RLS policies
-- ============================================================

create policy "members can read club members"
  on members for select
  using (club_id in (select get_user_club_ids(auth.uid())));

create policy "admins can manage club members"
  on members for all
  using (is_club_admin(auth.uid(), club_id));

-- ============================================================
-- 10. Update helper functions to query members
-- ============================================================

create or replace function get_user_club_ids(user_uuid uuid)
  returns setof uuid
  language sql
  security definer
  stable
  set search_path = public
  as $$
    select club_id from members where user_id = user_uuid
  $$;

create or replace function is_club_admin(user_uuid uuid, check_club_id uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
  as $$
    select exists (
      select 1 from members
      where user_id = user_uuid
        and club_id = check_club_id
        and role = 'admin'
    )
  $$;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_rename_players_to_members.sql
git commit -m "feat: rename players table to members, add notes column"
```

---

## Task 2: Update Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Rename `players` table entry to `members` in Database type**

In `src/lib/types.ts`, find the `players:` table block (starts around line 78) and rename the key to `members:`. Also add `notes: string | null` to its Row, Insert, and Update blocks. Also rename `player_id` to `member_id` in the `club_invites` table block (lines ~46, 56, 66) and update the `tournament_players` table block similarly.

Replace the `players` table block key and add `notes`:

```typescript
      members: {
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
          address: string | null
          notes: string | null
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
          address?: string | null
          notes?: string | null
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
          address?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
```

Update `club_invites` Row/Insert/Update: rename `player_id` → `member_id` on lines ~46, 56, 66.

Update `tournament_players` table block: rename `player_id` → `member_id` in Row, Insert, Update, and Relationships.

- [ ] **Step 2: Update convenience type exports at the bottom of the file**

Replace:
```typescript
export type Player = Database['public']['Tables']['players']['Row'];
```
With:
```typescript
export type Member = Database['public']['Tables']['members']['Row'];
```

- [ ] **Step 3: Update `TournamentPlayer` interface**

Replace the existing interface:
```typescript
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
```
With:
```typescript
export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  member_id: string;
  rebuys: number;
  addon: boolean;
  finish_position: number | null;
  payout_amount: number | null;
  created_at: string;
  members?: { id: string; first_name: string; last_name: string; nickname: string | null } | null;
  table_id: string | null;
  seat_number: number | null;
  preferred_table: number | null;
  tournament_tables?: { number: number; max_seats: number } | null;
}
```

- [ ] **Step 4: Run type check**

```bash
npm run check
```

Expected: errors about `Player` not found and `player_id` usages — these will be fixed in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: rename Player type to Member, update TournamentPlayer"
```

---

## Task 3: Rename `src/lib/players.ts` → `src/lib/members.ts`

**Files:**
- Create: `src/lib/members.ts`
- Delete: `src/lib/players.ts`
- Create: `tests/unit/members.test.ts`
- Delete: `tests/unit/players.test.ts`

- [ ] **Step 1: Create `src/lib/members.ts`**

```typescript
import type { Member } from './types';

export function displayName(member: Pick<Member, 'first_name' | 'last_name' | 'nickname'>): string {
  return member.nickname?.trim() || `${member.first_name} ${member.last_name}`;
}

export function isAdmin(member: Pick<Member, 'role'>): boolean {
  return member.role === 'admin';
}
```

- [ ] **Step 2: Create `tests/unit/members.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { displayName, isAdmin } from '$lib/members';

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

- [ ] **Step 3: Run the new tests to verify they pass**

```bash
npx vitest run tests/unit/members.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 4: Delete old files**

```bash
rm src/lib/players.ts tests/unit/players.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/members.ts tests/unit/members.test.ts
git rm src/lib/players.ts tests/unit/players.test.ts
git commit -m "feat: rename players.ts to members.ts, update Member type"
```

---

## Task 4: Update i18n Messages

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/de.json`

- [ ] **Step 1: Update `messages/en.json`**

Make these key renames and additions (keep all other keys unchanged):

```json
"nav_members": "Members",
"dashboard_stat_members": "Members",
"members_title": "Members",
"members_empty": "No members yet.",
"member_add_button": "Add Member",
"member_first_name_label": "First name",
"member_last_name_label": "Last name",
"member_nickname_label": "Nickname",
"member_birthday_label": "Birthday",
"member_country_label": "Country",
"member_city_label": "City",
"member_phone_label": "Phone",
"member_address_label": "Address",
"member_notes_label": "Notes",
"member_member_number_label": "Member #",
"member_registration_date_label": "Registration date",
"member_remove": "Remove",
"member_delete_confirm_title": "Delete Member",
"member_delete_confirm_body": "Are you sure you want to delete {name}? This action cannot be undone.",
"member_delete_confirm": "Delete",
"member_save": "Save",
"member_cancel": "Cancel",
"member_linked": "Account linked",
"member_not_linked": "No account",
"member_generate_invite": "Generate invite link",
"member_detail_title": "Member Details",
"member_edit_title": "Edit Member",
"member_quick_add_title": "Quick Add Member",
"member_quick_add_button": "Add & Register",
```

Remove the old `nav_players`, `dashboard_stat_players`, `players_title`, `players_empty`, and all `player_*` keys that were renamed above.

- [ ] **Step 2: Update `messages/de.json`**

Same renames in German:

```json
"nav_members": "Mitglieder",
"dashboard_stat_members": "Mitglieder",
"members_title": "Mitglieder",
"members_empty": "Noch keine Mitglieder.",
"member_add_button": "Mitglied hinzufügen",
"member_first_name_label": "Vorname",
"member_last_name_label": "Nachname",
"member_nickname_label": "Spitzname",
"member_birthday_label": "Geburtstag",
"member_country_label": "Land",
"member_city_label": "Stadt",
"member_phone_label": "Telefon",
"member_address_label": "Adresse",
"member_notes_label": "Notizen",
"member_member_number_label": "Mitglieds-Nr.",
"member_registration_date_label": "Registrierungsdatum",
"member_remove": "Entfernen",
"member_delete_confirm_title": "Mitglied löschen",
"member_delete_confirm_body": "Möchtest du {name} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
"member_delete_confirm": "Löschen",
"member_save": "Speichern",
"member_cancel": "Abbrechen",
"member_linked": "Konto verknüpft",
"member_not_linked": "Kein Konto",
"member_generate_invite": "Einladungslink erstellen",
"member_detail_title": "Mitgliedsdetails",
"member_edit_title": "Mitglied bearbeiten",
"member_quick_add_title": "Mitglied schnell hinzufügen",
"member_quick_add_button": "Hinzufügen & Registrieren",
```

Remove old `nav_players`, `dashboard_stat_players`, `players_title`, `players_empty`, and all `player_*` keys that were renamed.

- [ ] **Step 3: Rebuild Paraglide to regenerate message functions**

```bash
npm run build
```

Expected: build succeeds, `src/lib/paraglide/messages/` updated with new `member_*` functions.

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/de.json src/lib/paraglide/
git commit -m "feat: rename i18n keys from player_* to member_*, add member_notes_label"
```

---

## Task 5: Update Shared Infrastructure Files

**Files:**
- Modify: `src/lib/components/Sidebar.svelte`
- Modify: `src/routes/[club]/admin/+layout.ts`
- Modify: `src/routes/[club]/+layout.ts`
- Modify: `src/routes/[club]/+page.ts`
- Modify: `src/routes/[club]/+page.svelte`
- Modify: `src/routes/+page.server.ts`
- Modify: `src/routes/clubs/new/+page.server.ts`

- [ ] **Step 1: Update `src/lib/components/Sidebar.svelte`**

Change line 2:
```typescript
import { isAdmin, displayName } from '$lib/members';
```

Change line 7:
```typescript
import type { Club, Member } from '$lib/types';
```

Change line 9:
```typescript
const { club, player, otherClubs, currentPath } = $props<{
    club: Club;
    player: Member;
    otherClubs: { slug: string; name: string }[];
    currentPath: string;
  }>();
```

Change the nav link at line 76:
```svelte
<a
  href="{clubPath}/admin/members"
  class="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors {
    isActive(`${clubPath}/admin/members`)
      ? 'bg-accent/10 border-l-2 border-accent text-foreground font-medium pl-[10px]'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
  }"
>
  {m.nav_members()}
</a>
```

- [ ] **Step 2: Update `src/routes/[club]/admin/+layout.ts`**

```typescript
import { error } from '@sveltejs/kit';
import { isAdmin } from '$lib/members';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
  const { player } = await parent();
  if (!isAdmin(player)) throw error(403, 'Admin access required');
  return {};
};
```

- [ ] **Step 3: Update `src/routes/[club]/+layout.ts`**

Change both `.from('players')` calls to `.from('members')`:

```typescript
  const { data: player } = await supabase
    .from('members')
    .select('*')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();
  if (!player) throw error(403, 'You are not a member of this club');

  const { data: userClubs } = await supabase
    .from('members')
    .select('clubs(slug, name)')
    .eq('user_id', session.user.id)
    .order('created_at');
```

- [ ] **Step 4: Update `src/routes/[club]/+page.ts`**

```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const [{ count: memberCount }, { count: tournamentCount }] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('club_id', club.id),
  ]);

  return {
    memberCount: memberCount ?? 0,
    tournamentCount: tournamentCount ?? 0,
  };
};
```

- [ ] **Step 5: Update `src/routes/[club]/+page.svelte`**

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { Club, Member } from '$lib/types';

  const { data } = $props<{ data: { club: Club; player: Member; memberCount: number; tournamentCount: number } }>();
</script>

<div class="p-6 flex flex-col gap-6">
  <h1 class="text-lg font-semibold text-foreground">{m.club_home_welcome({ club_name: data.club.name })}</h1>

  <!-- Stat cards -->
  <div class="grid grid-cols-2 gap-4">
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{m.dashboard_stat_members()}</p>
      <p class="text-3xl font-light text-foreground">{data.memberCount}</p>
    </div>
    <div class="bg-card border border-border rounded-lg p-4">
      <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{m.dashboard_stat_tournaments()}</p>
      <p class="text-3xl font-light text-foreground">{data.tournamentCount}</p>
    </div>
  </div>

  <!-- Next game placeholder -->
  <div class="bg-card border border-border rounded-lg p-4">
    <p class="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{m.dashboard_next_game()}</p>
    <p class="text-sm text-muted-foreground">{m.club_home_placeholder()}</p>
  </div>
</div>
```

- [ ] **Step 6: Update `src/routes/+page.server.ts`**

```typescript
import { redirect } from '@sveltejs/kit';
import { createUserClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) return {};

	const { data: member } = await createUserClient(session.access_token)
		.from('members')
		.select('clubs(slug)')
		.eq('user_id', session.user.id)
		.limit(1)
		.single();

	const slug = (member?.clubs as { slug: string } | null)?.slug;
	throw redirect(303, slug ? `/${slug}` : '/clubs/new');
};
```

- [ ] **Step 7: Update `src/routes/clubs/new/+page.server.ts`**

Change line 42–50:
```typescript
    const { error: memberError } = await service
      .from('members')
      .insert({
        club_id: club.id,
        user_id: session.user.id,
        role: 'admin',
        first_name: firstName,
        last_name: lastName,
        member_number: 1,
      });
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/Sidebar.svelte \
  src/routes/[club]/admin/+layout.ts \
  src/routes/[club]/+layout.ts \
  src/routes/[club]/+page.ts \
  src/routes/[club]/+page.svelte \
  src/routes/+page.server.ts \
  src/routes/clubs/new/+page.server.ts
git commit -m "feat: update shared infrastructure to use members table"
```

---

## Task 6: Update Invite Flow

**Files:**
- Modify: `src/routes/invite/[token]/+page.server.ts`

- [ ] **Step 1: Update all queries and references**

Replace the entire file with:

```typescript
import { error, redirect } from '@sveltejs/kit';
import { createServiceClient, createUserClient } from '$lib/server/supabase';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();

  if (!session) {
    throw redirect(303, `/auth/login?next=/invite/${params.token}`);
  }

  const service = createServiceClient();
  const { data: invite } = await service
    .from('club_invites')
    .select('*, clubs(id, name, slug)')
    .eq('id', params.token)
    .single();

  if (!invite || !invite.clubs) throw error(404, 'Invite not found');
  if (invite.used_at) throw error(410, 'Invite already used');
  if (new Date(invite.expires_at) < new Date()) throw error(410, 'Invite has expired');

  const club = invite.clubs as { id: string; name: string; slug: string };

  // Already a member? Redirect straight to the club
  const { data: existing } = await createUserClient(session.access_token)
    .from('members')
    .select('id')
    .eq('club_id', club.id)
    .eq('user_id', session.user.id)
    .single();

  if (existing) throw redirect(303, `/${club.slug}`);

  // Check if invite has a member_id (variant 2: linking existing member)
  const linkedMember = invite.member_id ? true : false;

  return { clubName: club.name, clubSlug: club.slug, linkedMember };
};

export const actions: Actions = {
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

    // Already a member? Redirect straight to the club
    const { data: existing } = await service
      .from('members')
      .select('id')
      .eq('club_id', club.id)
      .eq('user_id', session.user.id)
      .single();
    if (existing) throw redirect(303, `/${club.slug}`);

    if (invite.member_id) {
      // Variant 2: Link account to existing member
      const { data: linked, error: linkError } = await service
        .from('members')
        .update({ user_id: session.user.id })
        .eq('id', invite.member_id)
        .is('user_id', null)
        .select('id');

      if (linkError) {
        if (linkError.code === '23505') throw redirect(303, `/${club.slug}`);
        throw error(500, 'Failed to link account');
      }
      if (!linked || linked.length === 0) {
        throw error(409, 'Member already linked to another account');
      }
    } else {
      // Variant 1: Create new member
      const formData = await request.formData();
      const firstName = formData.get('first_name')?.toString().trim() ?? '';
      const lastName = formData.get('last_name')?.toString().trim() ?? '';
      if (!firstName || !lastName) return { errorKey: 'error_required' };

      // Get next member number
      const { data: maxMember } = await service
        .from('members')
        .select('member_number')
        .eq('club_id', club.id)
        .order('member_number', { ascending: false })
        .limit(1)
        .single();
      const nextNumber = (maxMember?.member_number ?? 0) + 1;

      const { error: memberError } = await service
        .from('members')
        .insert({
          club_id: club.id,
          user_id: session.user.id,
          role: 'member',
          first_name: firstName,
          last_name: lastName,
          member_number: nextNumber,
        });

      if (memberError) {
        if (memberError.code === '23505') throw redirect(303, `/${club.slug}`);
        throw error(500, 'Failed to join club');
      }
    }

    await service
      .from('club_invites')
      .update({ used_at: new Date().toISOString(), used_by_user_id: session.user.id })
      .eq('id', params.token);

    throw redirect(303, `/${club.slug}`);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/invite/[token]/+page.server.ts
git commit -m "feat: update invite flow to use members table"
```

---

## Task 7: Update Tournament Pages

**Files:**
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.ts`
- Modify: `src/routes/[club]/admin/tournaments/[id]/+page.svelte`

- [ ] **Step 1: Update `+page.ts`**

Replace the full file:

```typescript
import { error } from '@sveltejs/kit';
import { calculatePrizePool, calculateTotalFees } from '$lib/tournaments';
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

  const [{ data: players }, { data: clubMembers }, { data: tables }, { data: prizeStructures }, { data: blindStructures }] = await Promise.all([
    supabase
      .from('tournament_players')
      .select('*, members!tournament_players_member_id_fkey(id, first_name, last_name, nickname)')
      .eq('tournament_id', params.id)
      .order('created_at'),
    supabase
      .from('members')
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
  const registeredMemberIds = new Set(allPlayers.map((p) => p.member_id));
  const availableMembers = (clubMembers ?? []).filter((m) => !registeredMemberIds.has(m.id));

  const totalRebuys = allPlayers.reduce((sum, p) => sum + p.rebuys, 0);
  const addonCount = allPlayers.filter((p) => p.addon).length;
  const prizePool = calculatePrizePool(
    allPlayers.length,
    tournament.buy_in_amount,
    totalRebuys,
    tournament.rebuy_amount ?? 0,
    addonCount,
    tournament.addon_amount ?? 0,
  );

  const totalFees = calculateTotalFees(
    allPlayers.length,
    tournament.buy_in_fee ?? 0,
    totalRebuys,
    tournament.rebuy_fee ?? 0,
    addonCount,
    tournament.addon_fee ?? 0,
  );

  const prizeStructure = tournament.prize_structures
    ? { payouts: tournament.prize_structures.payouts as { position: number; percentage: number }[] }
    : null;

  return { tournament, players: allPlayers, availableMembers, prizePool, totalFees, prizeStructure, tables: tables ?? [], prizeStructures: prizeStructures ?? [], blindStructures: blindStructures ?? [] };
};
```

- [ ] **Step 2: Update `+page.svelte` — imports and member references**

On line 9, change:
```typescript
  import { displayName } from '$lib/members';
```

Find all uses of `player_id` in `handleAddPlayer` (line ~155) and `handleQuickAdd` (line ~198) — change to `member_id`:

```typescript
  async function handleAddPlayer(memberId: string) {
    if (loading) return;
    if (data.tournament.status !== 'registration') { errorKey = 'error_tournament_not_open'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('tournament_players').insert({
        tournament_id: data.tournament.id,
        member_id: memberId,
      });
      if (error) { errorKey = 'server_error'; return; }
      selectedPlayerId = '';
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
```

In `handleQuickAdd`, change `.from('players')` to `.from('members')` (two occurrences) and `player_id` → `member_id`:

```typescript
  async function handleQuickAdd() {
    if (loading) return;
    if (!quickFirstName.trim() || !quickLastName.trim()) { errorKey = 'error_required'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { data: maxMember } = await supabase
        .from('members')
        .select('member_number')
        .eq('club_id', data.tournament.club_id)
        .order('member_number', { ascending: false })
        .limit(1)
        .single();
      const nextNumber = (maxMember?.member_number ?? 0) + 1;

      const { data: newMember, error: memberError } = await supabase
        .from('members')
        .insert({
          club_id: data.tournament.club_id,
          first_name: quickFirstName.trim(),
          last_name: quickLastName.trim(),
          member_number: nextNumber,
        })
        .select('id')
        .single();
      if (memberError) { errorKey = 'server_error'; return; }

      const { error: regError } = await supabase.from('tournament_players').insert({
        tournament_id: data.tournament.id,
        member_id: newMember.id,
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

Also update the template sections in the same file:

- Search for `availablePlayers` (appears in the member-select dropdown) → replace with `data.availableMembers`
- Search for `p.players` (appears in the players list to get the joined member name) → replace with `p.members`
- The `handleAddPlayer` call site passes `selectedPlayerId` — that variable name can stay, it just holds the selected member's id.
- Search for `registeredPlayerIds` in the template (if referenced) → `registeredMemberIds`.

- [ ] **Step 3: Run type check**

```bash
npm run check
```

Expected: no errors (or only errors in files not yet updated — members admin pages, which come next).

- [ ] **Step 4: Commit**

```bash
git add src/routes/[club]/admin/tournaments/[id]/+page.ts \
  src/routes/[club]/admin/tournaments/[id]/+page.svelte
git commit -m "feat: update tournament pages to use members table"
```

---

## Task 8: Create Members Admin Route

**Files:**
- Create: `src/routes/[club]/admin/members/+page.ts`
- Create: `src/routes/[club]/admin/members/+page.svelte`
- Create: `src/routes/[club]/admin/members/[id]/+page.ts`
- Create: `src/routes/[club]/admin/members/[id]/+page.svelte`
- Delete: `src/routes/[club]/admin/players/` (entire directory)

- [ ] **Step 1: Create `src/routes/[club]/admin/members/+page.ts`**

```typescript
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { supabase, club } = await parent();

  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, nickname, user_id, member_number, created_at')
    .eq('club_id', club.id)
    .order('member_number');

  return { members: members ?? [] };
};
```

- [ ] **Step 2: Create `src/routes/[club]/admin/members/+page.svelte`**

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{
    data: {
      club: { id: string; slug: string };
      members: {
        id: string;
        first_name: string;
        last_name: string;
        nickname: string | null;
        user_id: string | null;
        member_number: number;
        created_at: string;
      }[];
    };
  }>();

  // Compute next available member number
  function nextMemberNumber(): number {
    if (data.members.length === 0) return 1;
    return Math.max(...data.members.map((m) => m.member_number)) + 1;
  }

  let showModal = $state(false);
  let saving = $state(false);
  let errors = $state<Record<string, string>>({});

  let firstName = $state('');
  let lastName = $state('');
  let nickname = $state('');
  let birthday = $state('');
  let country = $state('');
  let city = $state('');
  let phone = $state('');
  let address = $state('');
  let notes = $state('');
  let registrationDate = $state(new Date().toISOString().slice(0, 10));
  let memberNumber = $state(0);

  function openModal() {
    firstName = '';
    lastName = '';
    nickname = '';
    birthday = '';
    country = '';
    city = '';
    phone = '';
    address = '';
    notes = '';
    registrationDate = new Date().toISOString().slice(0, 10);
    memberNumber = nextMemberNumber();
    errors = {};
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = m.error_required();
    if (!lastName.trim()) e.lastName = m.error_required();
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    saving = true;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('members').insert({
        club_id: data.club.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        nickname: nickname.trim() || null,
        birthday: birthday || null,
        country: country.trim() || null,
        city: city.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        created_at: registrationDate ? new Date(registrationDate).toISOString() : undefined,
        member_number: memberNumber,
      });
      if (error) {
        errors = { form: error.message };
        return;
      }
      await invalidateAll();
      closeModal();
    } finally {
      saving = false;
    }
  }

  // ── Sorting ──────────────────────────────────────────────────
  type SortKey = 'member_number' | 'first_name' | 'last_name' | 'nickname' | 'created_at';
  let sortKey = $state<SortKey>('member_number');
  let sortAsc = $state(true);

  function setSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
  }

  const sortedMembers = $derived(
    [...data.members].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortAsc ? cmp : -cmp;
    })
  );

  function sortIcon(key: SortKey): string {
    if (sortKey !== key) return '↕';
    return sortAsc ? '↑' : '↓';
  }

  function formatDate(iso: string): string {
    return iso.slice(0, 10);
  }
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <h1 class="text-base font-semibold text-foreground">{m.members_title()}</h1>
    <button
      type="button"
      onclick={openModal}
      class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
    >
      {m.member_add_button()}
    </button>
  </div>

  <!-- Table -->
  {#if data.members.length === 0}
    <p class="text-sm text-muted-foreground">{m.members_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[60px_1fr_1fr_1fr_110px_40px] border-b border-border px-4 py-2.5">
        <button
          type="button"
          onclick={() => setSort('member_number')}
          class="text-[10px] uppercase tracking-widest text-muted-foreground text-left cursor-pointer hover:text-foreground transition-colors"
        >
          {m.member_member_number_label()} {sortIcon('member_number')}
        </button>
        <button
          type="button"
          onclick={() => setSort('first_name')}
          class="text-[10px] uppercase tracking-widest text-muted-foreground text-left cursor-pointer hover:text-foreground transition-colors"
        >
          {m.member_first_name_label()} {sortIcon('first_name')}
        </button>
        <button
          type="button"
          onclick={() => setSort('last_name')}
          class="text-[10px] uppercase tracking-widest text-muted-foreground text-left cursor-pointer hover:text-foreground transition-colors"
        >
          {m.member_last_name_label()} {sortIcon('last_name')}
        </button>
        <button
          type="button"
          onclick={() => setSort('nickname')}
          class="text-[10px] uppercase tracking-widest text-muted-foreground text-left cursor-pointer hover:text-foreground transition-colors"
        >
          {m.member_nickname_label()} {sortIcon('nickname')}
        </button>
        <button
          type="button"
          onclick={() => setSort('created_at')}
          class="text-[10px] uppercase tracking-widest text-muted-foreground text-left cursor-pointer hover:text-foreground transition-colors"
        >
          {m.member_registration_date_label()} {sortIcon('created_at')}
        </button>
        <span></span>
      </div>
      {#each sortedMembers as member}
        <a
          href="/{data.club.slug}/admin/members/{member.id}"
          class="grid grid-cols-[60px_1fr_1fr_1fr_110px_40px] px-4 py-3 border-b border-border last:border-0 items-center hover:bg-card/80 transition-colors"
        >
          <span class="text-xs text-muted-foreground">{member.member_number}</span>
          <span class="text-sm font-medium text-foreground">{member.first_name}</span>
          <span class="text-sm text-foreground">{member.last_name}</span>
          <span class="text-xs text-muted-foreground">{member.nickname ?? ''}</span>
          <span class="text-xs text-muted-foreground">{formatDate(member.created_at)}</span>
          <span class="flex items-center justify-center">
            {#if member.user_id}
              <span class="w-2 h-2 rounded-full bg-green-500" title={m.member_linked()}></span>
            {:else}
              <span class="w-2 h-2 rounded-full bg-muted-foreground/30" title={m.member_not_linked()}></span>
            {/if}
          </span>
        </a>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Member Modal -->
{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
  >
    <div class="bg-card rounded-xl p-6 max-w-md w-full mx-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
      <h2 class="text-base font-semibold text-foreground">{m.member_add_button()}</h2>

      {#if errors.form}
        <p class="text-xs text-destructive">{errors.form}</p>
      {/if}

      <div class="grid grid-cols-2 gap-3">
        <!-- First name -->
        <div class="flex flex-col gap-1">
          <label for="firstName" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_first_name_label()} *
          </label>
          <input
            id="firstName"
            type="text"
            bind:value={firstName}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.firstName ? 'border-destructive' : ''}"
          />
          {#if errors.firstName}
            <p class="text-xs text-destructive">{errors.firstName}</p>
          {/if}
        </div>

        <!-- Last name -->
        <div class="flex flex-col gap-1">
          <label for="lastName" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_last_name_label()} *
          </label>
          <input
            id="lastName"
            type="text"
            bind:value={lastName}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.lastName ? 'border-destructive' : ''}"
          />
          {#if errors.lastName}
            <p class="text-xs text-destructive">{errors.lastName}</p>
          {/if}
        </div>

        <!-- Nickname -->
        <div class="flex flex-col gap-1 col-span-2">
          <label for="nickname" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_nickname_label()}
          </label>
          <input
            id="nickname"
            type="text"
            bind:value={nickname}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Birthday -->
        <div class="flex flex-col gap-1">
          <label for="birthday" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_birthday_label()}
          </label>
          <input
            id="birthday"
            type="date"
            bind:value={birthday}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Country -->
        <div class="flex flex-col gap-1">
          <label for="country" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_country_label()}
          </label>
          <input
            id="country"
            type="text"
            bind:value={country}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- City -->
        <div class="flex flex-col gap-1">
          <label for="city" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_city_label()}
          </label>
          <input
            id="city"
            type="text"
            bind:value={city}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Phone -->
        <div class="flex flex-col gap-1">
          <label for="phone" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_phone_label()}
          </label>
          <input
            id="phone"
            type="tel"
            bind:value={phone}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Address -->
        <div class="flex flex-col gap-1 col-span-2">
          <label for="address" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_address_label()}
          </label>
          <input
            id="address"
            type="text"
            bind:value={address}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Notes -->
        <div class="flex flex-col gap-1 col-span-2">
          <label for="notes" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_notes_label()}
          </label>
          <textarea
            id="notes"
            bind:value={notes}
            rows={3}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors resize-none"
          ></textarea>
        </div>

        <!-- Registration date -->
        <div class="flex flex-col gap-1">
          <label for="registrationDate" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_registration_date_label()}
          </label>
          <input
            id="registrationDate"
            type="date"
            bind:value={registrationDate}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Member number -->
        <div class="flex flex-col gap-1">
          <label for="memberNumber" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_member_number_label()}
          </label>
          <input
            id="memberNumber"
            type="number"
            bind:value={memberNumber}
            min="1"
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onclick={closeModal}
          class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {m.member_cancel()}
        </button>
        <button
          type="button"
          onclick={handleSave}
          disabled={saving}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.member_save()}
        </button>
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Create `src/routes/[club]/admin/members/[id]/+page.ts`**

```typescript
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  const { supabase, club } = await parent();

  const [{ data: member }, { data: pendingInvite }] = await Promise.all([
    supabase
      .from('members')
      .select('*')
      .eq('id', params.id)
      .eq('club_id', club.id)
      .single(),
    supabase
      .from('club_invites')
      .select('id')
      .eq('club_id', club.id)
      .eq('member_id', params.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle(),
  ]);

  if (!member) throw error(404, 'Member not found');

  return { targetMember: member, pendingInviteId: pendingInvite?.id ?? null };
};
```

- [ ] **Step 4: Create `src/routes/[club]/admin/members/[id]/+page.svelte`**

```svelte
<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll, goto } from '$app/navigation';
  import { displayName } from '$lib/members';
  import * as m from '$lib/paraglide/messages';
  import type { Member } from '$lib/types';

  const { data } = $props<{
    data: {
      club: { id: string; slug: string };
      player: Member;
      targetMember: Member;
      pendingInviteId: string | null;
    };
  }>();

  type Mode = 'view' | 'edit';
  let mode = $state<Mode>('view');
  let saving = $state(false);
  let deleting = $state(false);
  let showDeleteModal = $state(false);
  let errors = $state<Record<string, string>>({});

  let firstName = $state('');
  let lastName = $state('');
  let nickname = $state('');
  let birthday = $state('');
  let country = $state('');
  let city = $state('');
  let phone = $state('');
  let address = $state('');
  let notes = $state('');
  let registrationDate = $state('');
  let memberNumber = $state(0);

  let copied = $state(false);
  let generatingInvite = $state(false);
  let revokingInvite = $state(false);

  const inviteUrl = $derived(
    data.pendingInviteId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${data.pendingInviteId}` : null
  );

  function startEdit() {
    const mem = data.targetMember;
    firstName = mem.first_name;
    lastName = mem.last_name;
    nickname = mem.nickname ?? '';
    birthday = mem.birthday ?? '';
    country = mem.country ?? '';
    city = mem.city ?? '';
    phone = mem.phone ?? '';
    address = mem.address ?? '';
    notes = mem.notes ?? '';
    registrationDate = mem.created_at ? mem.created_at.slice(0, 10) : '';
    memberNumber = mem.member_number;
    errors = {};
    mode = 'edit';
  }

  function cancelEdit() {
    mode = 'view';
    errors = {};
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = m.error_required();
    if (!lastName.trim()) e.lastName = m.error_required();
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    saving = true;
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from('members')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          nickname: nickname.trim() || null,
          birthday: birthday || null,
          country: country.trim() || null,
          city: city.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          created_at: registrationDate ? new Date(registrationDate).toISOString() : undefined,
          member_number: memberNumber,
        })
        .eq('id', data.targetMember.id);

      if (dbError) {
        if (dbError.code === '23505') {
          errors = { memberNumber: 'Member number already in use.' };
        } else {
          errors = { form: dbError.message };
        }
        return;
      }

      await invalidateAll();
      mode = 'view';
    } finally {
      saving = false;
    }
  }

  async function handleGenerateInvite() {
    generatingInvite = true;
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from('club_invites')
        .insert({
          club_id: data.club.id,
          created_by: data.player.user_id!,
          member_id: data.targetMember.id,
        });

      if (dbError) {
        errors = { invite: dbError.message };
        return;
      }

      await invalidateAll();
    } finally {
      generatingInvite = false;
    }
  }

  async function handleRevokeInvite() {
    if (!data.pendingInviteId) return;
    revokingInvite = true;
    try {
      const supabase = createClient();
      await supabase.from('club_invites').delete().eq('id', data.pendingInviteId);
      await invalidateAll();
    } finally {
      revokingInvite = false;
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  async function handleDelete() {
    deleting = true;
    try {
      const supabase = createClient();
      await supabase.from('members').delete().eq('id', data.targetMember.id);
      await goto(`/${data.club.slug}/admin/members`);
    } finally {
      deleting = false;
      showDeleteModal = false;
    }
  }

  let mem = $derived(data.targetMember);
</script>

<div class="flex flex-col gap-6">
  <!-- Back link -->
  <a
    href="/{data.club.slug}/admin/members"
    class="text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
  >
    ← {m.members_title()}
  </a>

  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-base font-semibold text-foreground">{displayName(mem)}</h1>
      <p class="text-xs text-muted-foreground mt-0.5">#{mem.member_number}</p>
    </div>
    {#if mode === 'view'}
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={startEdit}
          class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
        >
          {m.member_edit_title()}
        </button>
        <button
          type="button"
          onclick={() => showDeleteModal = true}
          class="w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
          aria-label={m.member_remove()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    {/if}
  </div>

  <!-- Detail / Edit card -->
  <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
    {#if errors.form}
      <p class="text-xs text-destructive">{errors.form}</p>
    {/if}

    <div class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
      <!-- First name -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_first_name_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.first_name}</p>
        {:else}
          <input
            type="text"
            bind:value={firstName}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.firstName ? 'border-destructive' : ''}"
          />
          {#if errors.firstName}
            <p class="text-xs text-destructive mt-0.5">{errors.firstName}</p>
          {/if}
        {/if}
      </div>

      <!-- Last name -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_last_name_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.last_name}</p>
        {:else}
          <input
            type="text"
            bind:value={lastName}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.lastName ? 'border-destructive' : ''}"
          />
          {#if errors.lastName}
            <p class="text-xs text-destructive mt-0.5">{errors.lastName}</p>
          {/if}
        {/if}
      </div>

      <!-- Nickname -->
      <div class="col-span-2">
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_nickname_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.nickname ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={nickname}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Member number -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_member_number_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.member_number}</p>
        {:else}
          <input
            type="number"
            bind:value={memberNumber}
            min="1"
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.memberNumber ? 'border-destructive' : ''}"
          />
          {#if errors.memberNumber}
            <p class="text-xs text-destructive mt-0.5">{errors.memberNumber}</p>
          {/if}
        {/if}
      </div>

      <!-- Birthday -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_birthday_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.birthday ?? '—'}</p>
        {:else}
          <input
            type="date"
            bind:value={birthday}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Phone -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_phone_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.phone ?? '—'}</p>
        {:else}
          <input
            type="tel"
            bind:value={phone}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Address -->
      <div class="col-span-2">
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_address_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.address ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={address}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Country -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_country_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.country ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={country}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- City -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_city_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.city ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={city}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Notes -->
      <div class="col-span-2">
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_notes_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground whitespace-pre-wrap">{mem.notes ?? '—'}</p>
        {:else}
          <textarea
            bind:value={notes}
            rows={3}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors resize-none"
          ></textarea>
        {/if}
      </div>

      <!-- Registration date -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_registration_date_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.created_at ? mem.created_at.slice(0, 10) : '—'}</p>
        {:else}
          <input
            type="date"
            bind:value={registrationDate}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>
    </div>

    <!-- Edit actions -->
    {#if mode === 'edit'}
      <div class="flex justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onclick={cancelEdit}
          class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {m.member_cancel()}
        </button>
        <button
          type="button"
          onclick={handleSave}
          disabled={saving}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.member_save()}
        </button>
      </div>
    {/if}
  </div>

  <!-- Account linking section -->
  {#if mode === 'view'}
    <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
      <div class="flex items-center gap-2">
        {#if mem.user_id}
          <span class="w-2 h-2 rounded-full bg-green-500"></span>
          <span class="text-sm text-foreground">{m.member_linked()}</span>
        {:else}
          <span class="w-2 h-2 rounded-full bg-border"></span>
          <span class="text-sm text-muted-foreground">{m.member_not_linked()}</span>
          <button
            type="button"
            onclick={handleGenerateInvite}
            disabled={generatingInvite}
            class="ml-auto text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {m.member_generate_invite()}
          </button>
        {/if}
      </div>

      {#if errors.invite}
        <p class="text-xs text-destructive">{errors.invite}</p>
      {/if}

      {#if inviteUrl}
        <div class="flex items-center gap-2">
          <div class="flex-1 bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
            <p class="text-xs text-foreground break-all">{inviteUrl}</p>
          </div>
          <button
            type="button"
            onclick={copyLink}
            class="text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? m.invite_copied() : m.invite_copy()}
          </button>
          <button
            type="button"
            onclick={handleRevokeInvite}
            disabled={revokingInvite}
            class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {m.invite_link_revoke()}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Delete confirmation modal -->
{#if showDeleteModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onkeydown={(e) => e.key === 'Escape' && (showDeleteModal = false)}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="fixed inset-0" onclick={() => showDeleteModal = false}></div>
    <div class="relative bg-card border border-border rounded-lg p-6 w-full max-w-sm shadow-lg flex flex-col gap-4">
      <h2 class="text-sm font-semibold text-foreground">{m.member_delete_confirm_title()}</h2>
      <p class="text-sm text-muted-foreground">
        {m.member_delete_confirm_body({ name: displayName(mem) })}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={() => showDeleteModal = false}
          class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {m.member_cancel()}
        </button>
        <button
          type="button"
          onclick={handleDelete}
          disabled={deleting}
          class="bg-destructive text-destructive-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.member_delete_confirm()}
        </button>
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 5: Delete old player admin route directory**

```bash
rm -rf src/routes/[club]/admin/players
```

- [ ] **Step 6: Run type check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 7: Run all unit tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/routes/[club]/admin/members/
git rm -r src/routes/[club]/admin/players/
git commit -m "feat: add members admin route with sorting, address, and notes fields"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Run type check**

```bash
npm run check
```

Expected: clean output, zero errors.

- [ ] **Step 2: Run unit tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Start dev server and smoke-test manually**

```bash
npm run dev
```

Verify:
- Sidebar shows "Members" nav link pointing to `/admin/members`
- Dashboard stat card says "Members"
- Members list loads, shows registration date column, columns are sortable
- "Add Member" modal has address and notes fields
- Member detail page shows notes in view and edit mode
- Tournament page still shows "Players" and works (add/remove players, seating)
- Invite flow works (if testable)

- [ ] **Step 4: Final commit if any last-minute fixes were made**

```bash
git add -A
git commit -m "fix: post-migration cleanup"
```
