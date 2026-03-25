-- supabase/migrations/0005_tournament_results.sql
alter table tournament_players
  add column payout_amount integer; -- cents, null until tournament finished
