# Player Entity Design

**Date:** 2026-03-31
**Status:** Draft

## Problem

Club members currently require a Supabase `auth.users` account (`club_members.user_id` is a hard FK). In reality, most players in a poker club will never use the app — the admin manages them. We need a persistent player entity at the club level that does not require an account, but can optionally be linked to one.

## Decision: Clean Slate

This is pre-launch. Existing `club_members`, `tournament_players`, and related data will be dropped and rebuilt. No data migration needed. A single new migration file handles all schema changes (drop old tables/columns, create new); existing migration files are not edited.

## Data Model

### `players` table (replaces `club_members`)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | uuid | PK | Default `gen_random_uuid()` |
| `club_id` | uuid | FK → clubs, not null | |
| `user_id` | uuid | FK → auth.users, nullable | Set when account is linked |
| `role` | text | not null, default 'member' | CHECK: 'admin' or 'member' |
| `member_number` | integer | not null | Auto-incremented per club, editable by admin |
| `first_name` | text | not null | |
| `last_name` | text | not null | |
| `nickname` | text | nullable | If set, displayed in tournaments/rankings instead of real name |
| `birthday` | date | nullable | |
| `country` | text | nullable | |
| `city` | text | nullable | |
| `phone` | text | nullable | |
| `created_at` | timestamptz | not null, default now() | Backdatable by admin to represent original registration date |

**Constraints:**
- `UNIQUE (club_id, member_number)` — no duplicate member numbers within a club
- `UNIQUE (club_id, user_id)` with partial index `WHERE user_id IS NOT NULL` — one account per club

### `tournament_players` changes

- Remove `member_club_id`, `member_user_id`, `guest_name`, and the `tournament_players_identity` check constraint
- Add `player_id` (uuid, FK → players, not null)
- Remove the composite FK to `club_members`

### `club_invites` changes

- Add `player_id` (uuid, FK → players, nullable)
- When set, accepting the invite links the account to that existing player record
- When null, accepting the invite creates a new player record

## Display Name Logic

Single rule everywhere (tournaments, rankings, dropdowns, seating grids):

```
if nickname is set → show nickname
otherwise → "first_name last_name"
```

Implemented as `displayName(player)` utility in `src/lib/players.ts`.

## Member Number

- Auto-assigned as `max(member_number) + 1` for the club when creating a new player
- Editable by admin (e.g., to match pre-existing numbering from another system)
- Unique within a club via DB constraint

## RLS & Access Control

### Helper functions (replace existing)

- `get_user_club_ids(user_uuid)` → queries `players` instead of `club_members`
- `is_club_admin(user_uuid, check_club_id)` → queries `players` instead of `club_members`

### Policies

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| `players` | Club members (have `user_id` set) can read players in their clubs | Admins | Admins | Admins |
| `tournament_players` | Club members can read | Admins | Admins | Admins |
| `club_invites` | Admins | Admins | Admins | Admins |

### SvelteKit layout access check

`[club]/+layout.ts` changes from querying `club_members` to querying `players WHERE user_id = auth.uid()`. Same gate, different table.

Unlinked players (no `user_id`) cannot log in — they are data rows managed by admins.

### Linked player access (MVP)

Players with a linked account can log in and see:
- Club dashboard
- Their own tournament history and stats

They cannot access admin pages. Admin check: `players.role = 'admin'` for the current `user_id`.

## Invite Flow

### Variant 1: Invite new user to club (no existing player)

1. Admin generates invite link (no `player_id` attached)
2. User clicks link, signs up / logs in
3. User enters first name + last name
4. System creates `players` row with `user_id` set and next available `member_number`
5. Redirect to club dashboard

### Variant 2: Link existing player to an account

1. Admin opens player detail page
2. Clicks "Generate invite link" — creates `club_invites` record with `player_id` set
3. Admin shares link (WhatsApp, etc.)
4. User clicks link, signs up / logs in
5. System sets `user_id` on the existing `players` row — no name entry needed
6. Redirect to club dashboard

## UI Changes

### Sidebar nav

- "Members" → "Players" (rename nav item and i18n keys)

### Dashboard

- "Members" stat card → "Players"

### Admin: Players list page (replaces Members page)

Table columns:
- First name
- Last name
- Nickname
- Linked status (icon indicating whether account is connected)

Actions:
- "Add Player" button → modal/form with: first name (required), last name (required), nickname, birthday, country, city, phone, registration date (defaults to today), member number (auto-filled, editable)
- Click row → navigate to player detail page

### Admin: Player detail page (new)

- View/edit all player fields
- If no `user_id`: show "Generate invite link" button
- If `user_id` is set: show linked status indicator

### Tournament registration

- Dropdown shows all club players (display: nickname or "first_name last_name" + member number)
- "Quick add" button next to dropdown — minimal form (first name + last name only), creates player and immediately registers them
- No more guest name field

## Files Affected

### New files
- `supabase/migrations/XXXX_player_entity.sql` — schema changes (drop old tables, create `players`, alter `tournament_players`, alter `club_invites`)
- `src/lib/players.ts` — `displayName()` utility
- `src/routes/[club]/admin/players/+page.svelte` — player list
- `src/routes/[club]/admin/players/+page.ts` — player list loader
- `src/routes/[club]/admin/players/[id]/+page.svelte` — player detail/edit
- `src/routes/[club]/admin/players/[id]/+page.ts` — player detail loader

### Modified files
- `src/lib/types.ts` — new `Player` type, update `TournamentPlayer`
- `src/lib/components/Sidebar.svelte` — rename Members → Players
- `src/lib/server/supabase.ts` — no changes expected (clients stay the same)
- `src/routes/[club]/+layout.ts` — query `players` instead of `club_members`
- `src/routes/[club]/admin/+layout.ts` — admin check against `players`
- `src/routes/[club]/+page.svelte` — rename stat card
- `src/routes/[club]/admin/tournaments/[id]/+page.svelte` — player dropdown, remove guest flow, quick-add
- `src/routes/[club]/admin/tournaments/[id]/+page.ts` — query players instead of members
- `src/routes/invite/[token]/+page.svelte` — branching UI for variant 1 vs 2
- `src/routes/invite/[token]/+page.server.ts` — create or link player on accept
- `src/routes/clubs/new/+page.server.ts` — create admin player row instead of club_members
- `supabase/migrations/0002_fix_rls_infinite_recursion.sql` — update helper functions (or new migration)
- `messages/en.json`, `messages/de.json` — new/renamed i18n keys

### Removed files
- `src/routes/[club]/admin/members/+page.svelte` — replaced by players page
- `src/routes/[club]/admin/members/+page.ts` — replaced by players page
- `src/lib/members.ts` — `isAdmin()` moves to `src/lib/players.ts`
