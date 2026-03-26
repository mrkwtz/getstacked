-- supabase/migrations/0006_clubs_delete_policy.sql
create policy "admins can delete own club"
  on clubs for delete
  using (is_club_admin(auth.uid(), id));
