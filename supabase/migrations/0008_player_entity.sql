-- 0008_player_entity.sql
-- Replace club_members (auth-account-required) with players (account-optional).
-- Pre-launch: data is dropped for a clean slate.

-- ============================================================
-- 1. Drop RLS policies that reference club_members
-- ============================================================

drop policy "members can read club members" on club_members;
drop policy "admins can manage club members" on club_members;
drop policy "admins can delete own club" on clubs;

-- ============================================================
-- 2. Drop tournament_players constraints/columns referencing
--    club_members, then truncate for a clean slate
-- ============================================================

alter table tournament_players
  drop constraint tournament_players_identity,
  drop constraint tournament_players_member_club_id_member_user_id_fkey,
  drop column member_club_id,
  drop column member_user_id,
  drop column guest_name;

truncate table tournament_players;

-- ============================================================
-- 3. Drop club_members table
-- ============================================================

drop table club_members;

-- ============================================================
-- 4. Create players table
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
create unique index players_club_id_member_number_idx
  on players (club_id, member_number);

-- At most one player record per (club, linked user)
create unique index players_club_id_user_id_idx
  on players (club_id, user_id)
  where user_id is not null;

-- Fast RLS lookups by user_id
create index players_user_id_idx
  on players (user_id)
  where user_id is not null;

-- ============================================================
-- 5. Add player_id to tournament_players
-- ============================================================

alter table tournament_players
  add column player_id uuid not null references players(id) on delete cascade;

create index tournament_players_player_id_idx
  on tournament_players (player_id);

-- ============================================================
-- 6. Add player_id to club_invites (nullable) + clean slate
-- ============================================================

truncate table club_invites;

alter table club_invites
  add column player_id uuid references players(id) on delete set null;

-- ============================================================
-- 7. Update helper functions to query players instead of
--    club_members
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
-- 8. RLS for players table
-- ============================================================

alter table players enable row level security;

-- Members can read all players in their club(s)
create policy "members can read club players"
  on players for select
  using (club_id in (select get_user_club_ids(auth.uid())));

-- Admins can insert, update, and delete players in their club
create policy "admins can manage club players"
  on players for all
  using (is_club_admin(auth.uid(), club_id));

-- ============================================================
-- 9. Restore clubs delete policy using updated helper function
-- ============================================================

create policy "admins can delete own club"
  on clubs for delete
  using (is_club_admin(auth.uid(), id));
