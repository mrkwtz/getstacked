-- supabase/migrations/0006_clubs_delete_policy.sql
create policy "admins can delete own club"
  on clubs for delete
  using (
    exists (
      select 1 from club_members
      where club_members.club_id = clubs.id
        and club_members.user_id = auth.uid()
        and club_members.role = 'admin'
    )
  );
