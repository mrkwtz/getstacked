-- Fix infinite recursion in RLS policies caused by club_members policies
-- referencing club_members in their own subqueries.
--
-- Solution: SECURITY DEFINER functions bypass RLS for their inner queries,
-- breaking the recursion while still enforcing access control.

-- Returns the club IDs the given user belongs to (runs without RLS)
create or replace function get_user_club_ids(user_uuid uuid)
  returns setof uuid
  language sql
  security definer
  stable
  set search_path = public
  as $$
    select club_id from club_members where user_id = user_uuid
  $$;

-- Returns true if the given user is an admin of the given club (runs without RLS)
create or replace function is_club_admin(user_uuid uuid, check_club_id uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
  as $$
    select exists (
      select 1 from club_members
      where user_id = user_uuid
        and club_id = check_club_id
        and role = 'admin'
    )
  $$;

-- clubs: members can read their own club
drop policy "members can read own club" on clubs;
create policy "members can read own club"
  on clubs for select
  using (id in (select get_user_club_ids(auth.uid())));

-- clubs: admins can update their club
drop policy "admins can update own club" on clubs;
create policy "admins can update own club"
  on clubs for update
  using (is_club_admin(auth.uid(), id));

-- club_members: members can read members of their club
drop policy "members can read club members" on club_members;
create policy "members can read club members"
  on club_members for select
  using (club_id in (select get_user_club_ids(auth.uid())));

-- club_members: admins can insert/delete members in their club
drop policy "admins can manage club members" on club_members;
create policy "admins can manage club members"
  on club_members for all
  using (is_club_admin(auth.uid(), club_id));
