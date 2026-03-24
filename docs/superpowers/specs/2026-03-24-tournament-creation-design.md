# Tournament Creation & Registration Design Spec

## Goal

Allow club admins to create poker tournaments (Freezeout or Rebuy format) using reusable blind and prize structure templates, then register members and guests as players. Prize pool is calculated automatically from player count and buy-in.

## Scope

**In scope:**
- Supabase migration: four new tables (blind_structures, prize_structures, tournaments, tournament_players)
- Admin UI: tournaments list, create tournament form, tournament detail/registration page
- Admin UI: blind structure template management (create, list, delete)
- Admin UI: prize structure template management (create, list, delete)
- Admin tab bar: add "Tournaments" tab

**Out of scope (future phases):**
- Running the tournament (blind timer, eliminations, rebuys during play)
- Live display screen
- Results recording and leaderboard
- Bounty/PKO, Sit & Go, Shootout formats

---

## Data Model

### `blind_structures`

```sql
create table blind_structures (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  name       text not null,
  levels     jsonb not null default '[]',
  created_at timestamptz not null default now()
);
```

`levels` is a JSON array of objects: `[{ small_blind, big_blind, ante, duration_minutes }, ...]`

Each level must satisfy: `small_blind > 0`, `big_blind >= small_blind`, `duration_minutes > 0`, `ante >= 0`.

### `prize_structures`

```sql
create table prize_structures (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  name       text not null,
  payouts    jsonb not null default '[]',
  created_at timestamptz not null default now()
);
```

`payouts` is a JSON array: `[{ position, percentage }, ...]` — percentages must sum to 100, all > 0, no duplicate positions.

### `tournaments`

```sql
create table tournaments (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null references clubs(id) on delete cascade,
  name                text not null,
  date                date not null,
  format              text not null check (format in ('freezeout', 'rebuy')),
  buy_in              integer not null check (buy_in > 0),       -- cents
  rebuy_amount        integer check (rebuy_amount > 0),          -- cents, null for freezeout
  addon_amount        integer check (addon_amount > 0),          -- cents, null for freezeout
  blind_structure_id  uuid references blind_structures(id) on delete set null,
  prize_structure_id  uuid references prize_structures(id) on delete set null,
  status              text not null default 'registration'
                        check (status in ('registration', 'running', 'finished')),
  created_at          timestamptz not null default now()
);
```

Amounts stored in **cents** (integers). Form inputs are in euros — multiply by 100 before inserting.

### `tournament_players`

`club_members` has a composite primary key `(club_id, user_id)`. The FK to club_members must use both columns:

```sql
create table tournament_players (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  member_club_id  uuid,          -- null for guests
  member_user_id  uuid,          -- null for guests
  guest_name      text,          -- null for members
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
```

### RLS Policies

All four tables follow the same pattern as existing tables:
- **SELECT**: any club member may read (use existing `get_user_club_ids()` SECURITY DEFINER function)
- **INSERT / UPDATE / DELETE**: only club admins (use existing `is_club_admin()`)

---

## Prize Pool Calculation

Prize pool is always computed on the fly — never stored:

```
prize_pool = (player_count × buy_in)
           + (total_rebuys × rebuy_amount)
           + (addon_count × addon_amount)
```

During the registration phase, only the first term applies (rebuys/add-ons happen during run phase). Display as: `{player_count} players × €{buy_in/100} = €{prize_pool/100}`.

Extract into a pure helper function for testability:

```typescript
// src/lib/tournaments.ts
export function calculatePrizePool(
  playerCount: number,
  buyIn: number,         // cents
  totalRebuys: number,
  rebuyAmount: number,   // cents
  addonCount: number,
  addonAmount: number    // cents
): number { ... }        // returns cents
```

---

## Routes & File Structure

```
src/routes/[club]/admin/
  +layout.svelte                          ← add "Tournaments" tab
  tournaments/
    +page.server.ts                       ← load: list tournaments for club
    +page.svelte                          ← tournament list + "New tournament" button
    new/
      +page.server.ts                     ← load: fetch blind/prize templates; action: create_tournament
      +page.svelte                        ← creation form
    [id]/
      +page.server.ts                     ← load: tournament + players + structure names; actions: add_player, remove_player
      +page.svelte                        ← tournament detail + player registration
  blind-structures/
    +page.server.ts                       ← load: list with in_use flag; actions: create_blind_structure, delete_blind_structure
    +page.svelte                          ← template list + inline create form
  prize-structures/
    +page.server.ts                       ← load: list with in_use flag; actions: create_prize_structure, delete_prize_structure
    +page.svelte                          ← template list + inline create form
```

Plus:
- `supabase/migrations/YYYYMMDD_tournaments.sql` — all four tables + RLS
- `src/lib/types.ts` — add type aliases: `BlindStructure`, `PrizeStructure`, `Tournament`, `TournamentPlayer`
- `src/lib/tournaments.ts` — `calculatePrizePool()` and `validatePayouts()` helpers
- `messages/en.json` + `messages/de.json` — new i18n keys (see below)

---

## Page Designs

### Tournaments list (`/admin/tournaments`)

- Page header: "Tournaments" title + "New tournament" red button (right-aligned)
- Table: Name | Date | Format | Status — rows link to the tournament detail page
- Status badge: "Registration" (red tint) | "Running" (amber tint) | "Finished" (muted)
- Footer links: "Blind structures" and "Prize structures" (navigate to template management pages)
- Empty state: muted text "No tournaments yet."

### New tournament form (`/admin/tournaments/new`)

Fields (all in a card):
- Name (text, required)
- Date (date, required)
- Format (select: Freezeout / Rebuy, required)
- Buy-in in € (number, required, > 0)
- **Rebuy amount in €** — shown only when format = Rebuy (required if shown)
- **Add-on amount in €** — shown only when format = Rebuy (optional)
- Blind structure (select from club's templates, required)
- Prize structure (select from club's templates, required)

If no blind structures exist, the select is replaced with a message linking to `/admin/blind-structures`. Same for prize structures.

On submit → `create_tournament` action → on success, redirect to `/[club]/admin/tournaments/[newId]`.

### Tournament detail / registration (`/admin/tournaments/[id]`)

Layout:
- Header: tournament name + meta line (date · format · buy-in · blind structure name · prize structure name) + status badge
- Prize pool callout: "4 players × €20 = **€80**" (red accent)
- Player table: Name | Type (Member / Guest) | Remove
  - Member rows show `display_name`; guest rows show name in muted colour with "(guest)" suffix
  - Remove button only shown when `status === 'registration'`
- Add player form: two inputs — `<select name="member_id">` listing club members not yet registered, and `<input name="guest_name">` for a guest name — and an "Add player" button. Member id takes precedence; if `member_id` is non-empty, `guest_name` is ignored.

### Blind structures (`/admin/blind-structures`)

- List: Name | Level count | Delete button (disabled and showing "In use" if referenced by any tournament)
- Inline create form: Name field + levels table (add/remove rows: duration, SB, BB, ante)
- Empty state: "No blind structures yet."

### Prize structures (`/admin/prize-structures`)

- List: Name | Payout summary (e.g. "1st 60%, 2nd 30%, 3rd 10%") | Delete button (disabled and showing "In use" if referenced)
- Inline create form: Name + payouts table (position, percentage) with live sum display; submit blocked until sum = 100
- Empty state: "No prize structures yet."

---

## Server Logic

All server files follow the existing patterns in `members/+page.server.ts`:

```typescript
// All load functions:
export const load: PageServerLoad = async ({ parent, locals: { safeGetSession } }) => {
  const { club, member } = await parent();
  const { session } = await safeGetSession();
  // reads: createUserClient(session!.access_token)
};

// All actions:
export const actions: Actions = {
  action_name: async ({ request, parent }) => {
    const { club, member } = await parent();
    if (!isAdmin(member)) throw error(403, 'Admin access required');
    // writes: createServiceClient()
    // errors: return fail(400/500, { errorKey: 'i18n_key' })
  }
};
```

### `blind-structures` and `prize-structures` load

Each list query must also determine whether each template is in use:

```typescript
// For blind structures:
const { data: structures } = await userClient
  .from('blind_structures')
  .select('*, tournaments(id)')
  .eq('club_id', club.id);

// Map to: { ...structure, in_use: structure.tournaments.length > 0 }
```

Same pattern for prize structures.

### `tournaments/new` load

Fetches both template lists so the creation form can populate the selects:

```typescript
const [{ data: blindStructures }, { data: prizeStructures }] = await Promise.all([
  userClient.from('blind_structures').select('id, name').eq('club_id', club.id).order('name'),
  userClient.from('prize_structures').select('id, name').eq('club_id', club.id).order('name'),
]);
```

### `create_tournament` action

1. Parse all form fields; validate required fields, `buy_in > 0`
2. For Rebuy format: validate `rebuy_amount > 0`
3. Verify `blind_structure_id` belongs to `club.id` (prevent cross-club assignment)
4. Verify `prize_structure_id` belongs to `club.id`
5. **Multiply `buy_in`, `rebuy_amount`, `addon_amount` by 100** (form is euros, DB is cents)
6. Insert into `tournaments` with `status: 'registration'`
7. Redirect to `/${club.slug}/admin/tournaments/${newId}`

### `tournaments/[id]` load

Fetches tournament with structure names, and players with member display names:

```typescript
const { data: tournament } = await userClient
  .from('tournaments')
  .select('*, blind_structures(name), prize_structures(name)')
  .eq('id', params.id)
  .eq('club_id', club.id)
  .single();

const { data: players } = await userClient
  .from('tournament_players')
  .select('*')
  .eq('tournament_id', params.id)
  .order('created_at');

// Also load club members list (for the add player select):
const { data: members } = await userClient
  .from('club_members')
  .select('user_id, display_name')
  .eq('club_id', club.id)
  .order('display_name');
```

If tournament is not found or doesn't belong to this club, throw `error(404)`.

### `add_player` action

Form fields: `member_id` (from select, may be empty string) and `guest_name` (text, may be empty).

1. If `member_id` is non-empty: it is a member registration
   a. Verify the member `(club_id, member_id)` row exists in `club_members` (prevents cross-club registration)
   b. Check that `member_user_id` is not already in `tournament_players` for this tournament
   c. Insert with `member_club_id = club.id`, `member_user_id = member_id`, `guest_name = null`
2. Else if `guest_name` is non-empty: it is a guest registration
   a. Insert with `member_club_id = null`, `member_user_id = null`, `guest_name = guestName.trim()`
   b. Duplicate guest names are allowed (two different people may share a name)
3. Else: return `fail(400, { errorKey: 'error_required' })` — `error_required` exists in the base i18n keys

### `remove_player` action

Form field: `player_id` (uuid).

1. Fetch the player row; verify it belongs to this tournament (and tournament to this club)
2. **Verify `tournament.status === 'registration'`**; return `fail(400, { errorKey: 'error_tournament_not_open' })` otherwise
3. Delete from `tournament_players`

### `create_blind_structure` action

Form fields: `name` (text), plus a dynamic list of level rows: `small_blind[]`, `big_blind[]`, `ante[]`, `duration_minutes[]` (parallel arrays via repeated form inputs).

1. Validate `name` is non-empty
2. Parse level arrays; validate at least one level exists
3. For each level: validate `small_blind > 0`, `big_blind >= small_blind`, `duration_minutes > 0`, `ante >= 0`
4. Insert into `blind_structures` with `levels` as the JSON array

### `create_prize_structure` action

Form fields: `name` (text), plus `position[]` and `percentage[]` parallel arrays.

1. Validate `name` is non-empty
2. Parse payout arrays; validate at least one payout exists
3. Validate all `percentage` values > 0, no duplicate positions, sum = 100 (use `validatePayouts()` helper)
4. Insert into `prize_structures` with `payouts` as the JSON array

### `delete_blind_structure` / `delete_prize_structure` actions

1. Verify the structure belongs to this club
2. Check it is not referenced by any tournament; return `fail(400, { errorKey: 'error_structure_in_use' })` if so
3. Delete

---

## i18n Keys

New keys in `messages/en.json` (and German equivalents in `de.json`):

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
"error_duplicate_player": "This player is already registered.",
"error_no_blind_structures": "Create a blind structure first.",
"error_no_prize_structures": "Create a prize structure first.",
"error_tournament_not_open": "Tournament registration is closed.",
"error_structure_in_use": "This structure is used by an existing tournament."
```

The "Tournaments" tab label in `+layout.svelte` uses `m.nav_tournaments()` (consistent with the i18n-everywhere constraint).

---

## Testing

Unit tests in `tests/unit/tournaments.test.ts`:

**`calculatePrizePool`** helper:
- Freezeout: `playerCount × buyIn` only
- Rebuy: adds rebuys and add-ons
- Zero players returns 0
- All amounts in cents in, cents out

**`validatePayouts`** helper:
- Returns valid for `[{position:1, percentage:100}]`
- Returns error if sum ≠ 100
- Returns error for duplicate positions
- Returns error if any percentage ≤ 0

---

## Constraints

- All UI strings use `m.key()` via Paraglide — no hardcoded text
- Svelte 5 runes syntax throughout (`$props()`, `$state()`, `$derived()`, `{@render children()}`)
- `page` from `$app/state` (not `$app/stores`)
- Amounts always stored and computed in cents; displayed in euros (divide by 100)
- Service client for all admin writes; user client for reads (respects RLS)
- No new auth or session logic — existing patterns unchanged
