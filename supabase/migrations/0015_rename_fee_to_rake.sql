-- Rename fee columns to rake on the tournaments table
ALTER TABLE tournaments RENAME COLUMN buy_in_fee TO buy_in_rake;
ALTER TABLE tournaments RENAME COLUMN rebuy_fee TO rebuy_rake;
ALTER TABLE tournaments RENAME COLUMN addon_fee TO addon_rake;
