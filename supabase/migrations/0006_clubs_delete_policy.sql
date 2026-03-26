create policy "admins can delete own club"
  on clubs for delete
  using (is_club_admin(auth.uid(), id));
