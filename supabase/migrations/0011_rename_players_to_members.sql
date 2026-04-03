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
