-- Blind structure templates
create table blind_structures (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  name       text not null,
  levels     jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Prize structure templates
create table prize_structures (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  name       text not null,
  payouts    jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- Tournaments
create table tournaments (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references clubs(id) on delete cascade,
  name               text not null,
  date               date not null,
  format             text not null check (format in ('freezeout', 'rebuy')),
  buy_in             integer not null check (buy_in > 0),
  rebuy_amount       integer check (rebuy_amount > 0),
  addon_amount       integer check (addon_amount > 0),
  blind_structure_id uuid references blind_structures(id) on delete set null,
  prize_structure_id uuid references prize_structures(id) on delete set null,
  status             text not null default 'registration'
                       check (status in ('registration', 'running', 'finished')),
  created_at         timestamptz not null default now()
);

-- Tournament players
create table tournament_players (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  member_club_id  uuid,
  member_user_id  uuid,
  guest_name      text,
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

-- RLS: blind_structures
alter table blind_structures enable row level security;

create policy "members can read blind structures"
  on blind_structures for select
  using (club_id in (select get_user_club_ids(auth.uid())));

create policy "admins can manage blind structures"
  on blind_structures for all
  using (is_club_admin(auth.uid(), club_id));

-- RLS: prize_structures
alter table prize_structures enable row level security;

create policy "members can read prize structures"
  on prize_structures for select
  using (club_id in (select get_user_club_ids(auth.uid())));

create policy "admins can manage prize structures"
  on prize_structures for all
  using (is_club_admin(auth.uid(), club_id));

-- RLS: tournaments
alter table tournaments enable row level security;

create policy "members can read tournaments"
  on tournaments for select
  using (club_id in (select get_user_club_ids(auth.uid())));

create policy "admins can manage tournaments"
  on tournaments for all
  using (is_club_admin(auth.uid(), club_id));

-- RLS: tournament_players
alter table tournament_players enable row level security;

create policy "members can read tournament players"
  on tournament_players for select
  using (
    tournament_id in (
      select id from tournaments
      where club_id in (select get_user_club_ids(auth.uid()))
    )
  );

create policy "admins can manage tournament players"
  on tournament_players for all
  using (
    tournament_id in (
      select id from tournaments
      where is_club_admin(auth.uid(), club_id)
    )
  );
