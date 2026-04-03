# Member/Player Distinction + Member Enhancements

**Date:** 2026-04-03
**Status:** Approved

## Summary

Rename the "players" concept at the club level to "members". Players only exist within a tournament context (selected from club members). Additionally: add address + notes fields to member creation, show registration date in the overview, and make the overview table sortable.

## 1. Database Migration

- Rename table `players` → `members`
- Rename FK column `tournament_players.player_id` → `tournament_players.member_id`
- Rename FK column `club_invites.player_id` → `club_invites.member_id`
- Add `notes text` column to `members`
- Recreate all RLS policies on the renamed table
- Update all foreign key constraints

## 2. Type Rename

- Regenerate Supabase types (`src/lib/types.ts`) — the generated types will reflect the new `members` table name
- Export `Member` convenience type instead of `Player`
- Update `TournamentPlayer` interface: `player_id` → `member_id`, joined `players?` → `members?`

## 3. Code Rename

- `src/lib/players.ts` → `src/lib/members.ts`; functions (`displayName`, `isAdmin`) operate on `Member` type
- All `.from('players')` queries → `.from('members')`
- Route directory `src/routes/[club]/admin/players/` → `src/routes/[club]/admin/members/`
- Route directory `src/routes/[club]/admin/players/[id]/` → `src/routes/[club]/admin/members/[id]/`
- All imports updated accordingly (`$lib/players` → `$lib/members`, `Player` → `Member`)

## 4. i18n

- Rename all `player_*` keys → `member_*`, `players_*` → `members_*`
- `nav_players` → `nav_members` (EN: "Members", DE: "Mitglieder")
- `dashboard_stat_players` → `dashboard_stat_members`
- Keep `tournament_players_title` as-is (players is correct in tournament context)
- Add `member_notes_label` (EN: "Notes", DE: "Notizen")
- Update labels: "Delete Player" → "Delete Member", "Add Player" → "Add Member", etc.

## 5. UI Changes

### Member creation modal

Add two fields:
- **Address** — single-line text input (column already exists in DB from migration 0009)
- **Notes** — multi-line textarea

Include `address` and `notes` in the insert payload.

### Member detail/edit page

Add:
- **Notes** — textarea in both view and edit mode (view shows text, edit shows textarea)

The address field is already present in the edit page.

### Members overview table

Add column:
- **Registration date** — display `created_at` formatted as date (YYYY-MM-DD)

Add sortable column headers:
- Clickable headers on: Member #, First name, Last name, Nickname, Registration date
- Click toggles asc/desc sort
- Visual indicator (arrow) shows current sort column and direction
- Default sort: Member # ascending (current behavior)
- Sorting is client-side (all members are already loaded)

Update the data loader to also select `created_at`.

## 6. What stays unchanged

- `tournament_players` table name (players is correct in tournament context)
- Tournament UI labels: "Players" / "Spieler"
- `TournamentPlayer` type name
- Seating logic and tournament detail page references
- `tournament_add_player_button`, `tournament_players_title`, `tournament_no_players`, `tournament_select_player` i18n keys
