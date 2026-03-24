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

`payouts` is a JSON array: `[{ position, percentage }, ...]` — percentages must sum to 100.

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

Amounts stored in cents (integers) to avoid floating point issues.

### `tournament_players`

```sql
create table tournament_players (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  member_id       uuid references club_members(user_id) on delete set null, -- null for guests
  guest_name      text,                                                       -- null for members
  rebuys          integer not null default 0,
  addon           boolean not null default false,
  finish_position integer,
  created_at      timestamptz not null default now(),
  -- Either member_id or guest_name must be set
  constraint tournament_players_identity check (
    (member_id is not null and guest_name is null) or
    (member_id is null and guest_name is not null)
  )
);
```

### RLS Policies

All four tables follow the same pattern:
- **SELECT**: any club member may read (using the existing `get_user_club_ids()` SECURITY DEFINER function)
- **INSERT / UPDATE / DELETE**: only club admins (using `is_club_admin()`)

---

## Prize Pool Calculation

Prize pool is always computed on the fly — never stored:

```
prize_pool = (player_count × buy_in)
           + (total_rebuys × rebuy_amount)
           + (addon_count × addon_amount)
```

For the registration phase, only the first term applies (rebuys and add-ons happen during the run phase). Display as: `{player_count} players × €{buy_in} = €{prize_pool}`.

---

## Routes & File Structure

```
src/routes/[club]/admin/
  +layout.svelte                          ← add "Tournaments" tab
  tournaments/
    +page.server.ts                       ← load: list tournaments for club
    +page.svelte                          ← tournament list + "New tournament" button
    new/
      +page.server.ts                     ← load: fetch templates; action: create_tournament
      +page.svelte                        ← creation form
    [id]/
      +page.server.ts                     ← load: tournament + players; actions: add_player, remove_player
      +page.svelte                        ← tournament detail + player registration
  blind-structures/
    +page.server.ts                       ← load: list; actions: create_blind_structure, delete_blind_structure
    +page.svelte                          ← template list + inline create form
  prize-structures/
    +page.server.ts                       ← load: list; actions: create_prize_structure, delete_prize_structure
    +page.svelte                          ← template list + inline create form
```

Plus:
- `supabase/migrations/YYYYMMDD_tournaments.sql` — all four tables + RLS
- `src/lib/types.ts` — new type aliases: `BlindStructure`, `PrizeStructure`, `Tournament`, `TournamentPlayer`
- `messages/en.json` + `messages/de.json` — new i18n keys (see below)

---

## Page Designs

### Tournaments list (`/admin/tournaments`)

- Page header: "Tournaments" title + "New tournament" red button (right-aligned)
- Table: Name | Date | Format | Status — rows link to the tournament detail page
- Status badge: "Registration" (red tint) | "Running" (amber tint) | "Finished" (muted)
- Footer links: "Blind structures" and "Prize structures" (navigate to template management pages)
- Empty state: "No tournaments yet."

### New tournament form (`/admin/tournaments/new`)

Fields:
- Name (text, required)
- Date (date, required)
- Format (select: Freezeout / Rebuy, required)
- Buy-in in € (number, required, > 0)
- **Rebuy amount in €** (shown only when format = Rebuy)
- **Add-on amount in €** (shown only when format = Rebuy, optional)
- Blind structure (select from club's templates, required)
- Prize structure (select from club's templates, required)

On submit → `create_tournament` action → redirect to `/admin/tournaments/[id]`.

If no blind/prize structures exist yet, show a hint: "No blind structures yet — [create one]."

### Tournament detail / registration (`/admin/tournaments/[id]`)

Layout:
- Header: tournament name + meta (date, format, buy-in) + status badge
- Prize pool callout (red accent): "4 players × €20 = **€80**"
- Player table: Name | Type (Member / Guest) | Remove button
  - Member rows show `display_name`; guest rows show name in muted colour with "(guest)" suffix
  - Remove button absent once tournament moves to "running"
- Add player form (below table): combined input — either select a club member from a `<select>` or type a guest name; "Add player" button

Validation:
- A member can only be registered once per tournament
- Guest name must be non-empty

### Blind structures (`/admin/blind-structures`)

- List of templates: Name | Level count | Delete button
- Inline create form: Name field + levels table (add/remove rows: duration, SB, BB, ante)
- Delete is disabled if a tournament references the structure (show "In use" instead)
- Empty state: "No blind structures yet."

### Prize structures (`/admin/prize-structures`)

- List of templates: Name | Payout summary (e.g. "1st 60%, 2nd 30%, 3rd 10%") | Delete button
- Inline create form: Name field + payouts table (add/remove rows: position, percentage); live validation that percentages sum to 100
- Delete is disabled if a tournament references the structure
- Empty state: "No prize structures yet."

---

## Server Logic Patterns

All server files follow the existing pattern in `members/+page.server.ts`:
- `load`: call `parent()` to get `{ club, member }`; use `createUserClient(session.access_token)` for reads
- `actions`: call `parent()`, guard with `if (!isAdmin(member)) throw error(403, ...)`; use `createServiceClient()` for writes
- Return `fail(400/500, { errorKey: 'i18n_key' })` for errors; return `{ success: true }` or redirect on success

`create_tournament` action:
1. Parse and validate all fields
2. Verify blind_structure_id and prize_structure_id belong to the club
3. Insert into `tournaments` with status `'registration'`
4. Redirect to `/[club]/admin/tournaments/[newId]`

`add_player` action:
1. Determine if input is a member_id (from select) or guest name (typed text)
2. For members: check not already registered in this tournament
3. Insert into `tournament_players`

`remove_player` action:
1. Verify player belongs to this tournament (and tournament belongs to this club)
2. Delete from `tournament_players`

---

## i18n Keys

New keys needed in `messages/en.json` (and German equivalents in `de.json`):

```json
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
"tournament_add_player_placeholder": "Select member or type guest name…",
"tournament_prize_pool_label": "Prize pool",
"tournament_no_players": "No players registered yet.",
"tournament_empty": "No tournaments yet.",
"tournament_guest_suffix": "(guest)",
"blind_structures_title": "Blind structures",
"blind_structure_new_title": "New blind structure",
"blind_structure_name_label": "Name",
"blind_structure_levels_label": "Levels",
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
"prize_structure_payouts_label": "Payouts",
"prize_structure_add_payout": "Add place",
"prize_structure_position_label": "Place",
"prize_structure_percentage_label": "%",
"prize_structure_create_button": "Create",
"prize_structure_empty": "No prize structures yet.",
"prize_structure_in_use": "In use",
"error_percentage_sum": "Percentages must sum to 100.",
"error_duplicate_player": "This player is already registered.",
"error_no_blind_structures": "Create a blind structure first.",
"error_no_prize_structures": "Create a prize structure first."
```

---

## Testing

Unit tests (Vitest):
- Prize pool calculation helper: `calculatePrizePool(players, buyIn, rebuys, rebuyAmount, addonCount, addonAmount)`
- Payout validation helper: `validatePayouts(payouts)` — checks sum = 100, no duplicate positions, all > 0

Integration tests are not in scope for this phase (existing pattern: no integration tests in the project).

---

## Constraints

- All UI strings use `m.key()` via Paraglide — no hardcoded text
- Svelte 5 runes syntax throughout
- Amounts always stored and computed in cents; displayed in euros (divide by 100)
- Service client for all admin writes; user client for reads (respects RLS)
- No new auth or session logic — existing patterns unchanged
