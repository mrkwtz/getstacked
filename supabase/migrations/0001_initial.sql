-- clubs
create table clubs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- club_members
create table club_members (
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

-- RLS
alter table clubs enable row level security;
alter table club_members enable row level security;

-- clubs: members can read their own club
create policy "members can read own club"
  on clubs for select
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = clubs.id
        and club_members.user_id = auth.uid()
    )
  );

-- clubs: admins can update their club
create policy "admins can update own club"
  on clubs for update
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = clubs.id
        and club_members.user_id = auth.uid()
        and club_members.role = 'admin'
    )
  );

-- club_members: members can read members of their club
create policy "members can read club members"
  on club_members for select
  using (
    club_id in (
      select club_id from club_members where user_id = auth.uid()
    )
  );

-- club_members: admins can insert/delete members in their club
create policy "admins can manage club members"
  on club_members for all
  using (
    exists (
      select 1 from club_members cm
      where cm.club_id = club_members.club_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );
