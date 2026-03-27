create table tournament_tables (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  number        integer not null,
  max_seats     integer not null,
  dealer        text,
  created_at    timestamptz not null default now(),
  unique (tournament_id, number)
);

alter table tournament_players
  add column table_id        uuid references tournament_tables(id) on delete set null,
  add column seat_number     integer,
  add column preferred_table integer;

alter table tournament_tables enable row level security;

create policy "members can read tournament tables"
  on tournament_tables for select
  using (
    tournament_id in (
      select id from tournaments
      where club_id in (select get_user_club_ids(auth.uid()))
    )
  );

create policy "admins can manage tournament tables"
  on tournament_tables for all
  using (
    tournament_id in (
      select id from tournaments
      where is_club_admin(auth.uid(), club_id)
    )
  );

create index on tournament_tables (tournament_id);
create index on tournament_players (table_id);
