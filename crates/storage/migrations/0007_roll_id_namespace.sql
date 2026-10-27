-- Keep external result IDs separate from caller-owned creation nonces.
ALTER TABLE dice_rolls ADD COLUMN client_roll_id TEXT NOT NULL DEFAULT '';
UPDATE dice_rolls SET client_roll_id=id;
CREATE UNIQUE INDEX dice_client_ids ON dice_rolls(campaign_id,roller_user_id,client_roll_id);
ALTER TABLE dice_roll_rate ADD COLUMN client_roll_id TEXT NOT NULL DEFAULT '';
UPDATE dice_roll_rate SET client_roll_id=roll_id;
CREATE UNIQUE INDEX dice_rate_client_ids ON dice_roll_rate(campaign_id,user_id,client_roll_id);
