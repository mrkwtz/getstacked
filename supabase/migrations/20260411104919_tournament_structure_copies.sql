-- Add tournament-owned copies of blind levels and prize payouts
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS blind_levels  jsonb,
  ADD COLUMN IF NOT EXISTS prize_payouts jsonb;

-- Backfill from referenced structures
UPDATE tournaments t
SET blind_levels = bs.levels
FROM blind_structures bs
WHERE t.blind_structure_id = bs.id;

UPDATE tournaments t
SET prize_payouts = ps.payouts
FROM prize_structures ps
WHERE t.prize_structure_id = ps.id;

-- Ensure deleting a global template does not cascade-delete tournament data
-- (soft reference only — set FK to null, tournament keeps its copy)
ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_blind_structure_id_fkey,
  ADD CONSTRAINT tournaments_blind_structure_id_fkey
    FOREIGN KEY (blind_structure_id)
    REFERENCES blind_structures(id)
    ON DELETE SET NULL;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_prize_structure_id_fkey,
  ADD CONSTRAINT tournaments_prize_structure_id_fkey
    FOREIGN KEY (prize_structure_id)
    REFERENCES prize_structures(id)
    ON DELETE SET NULL;
