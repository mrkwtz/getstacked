-- Rename buy_in to buy_in_amount for consistency with rebuy_amount / addon_amount
-- Postgres automatically updates inline check constraints to reference the new column name
ALTER TABLE tournaments RENAME COLUMN buy_in TO buy_in_amount;

-- Fee columns (cents, nullable, optional)
ALTER TABLE tournaments ADD COLUMN buy_in_fee integer CHECK (buy_in_fee >= 0);
ALTER TABLE tournaments ADD COLUMN rebuy_fee integer CHECK (rebuy_fee >= 0);
ALTER TABLE tournaments ADD COLUMN addon_fee integer CHECK (addon_fee >= 0);
