create table club_invites (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at    timestamptz,
  used_by_user_id uuid references auth.users(id) on delete set null
);

alter table club_invites enable row level security;

create policy "admins can manage club invites"
  on club_invites for all
  using (is_club_admin(auth.uid(), club_id));
