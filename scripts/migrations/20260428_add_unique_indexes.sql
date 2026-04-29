-- Add database-level uniqueness guarantees for records that are treated as unique in application logic.
-- These deletions keep only the earliest row per logical key before creating unique indexes.

DELETE FROM moment_likes
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY moment_id, user_id ORDER BY id ASC) AS row_num
    FROM moment_likes
  ) deduped
  WHERE deduped.row_num > 1
);

DELETE FROM user_settings
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id, key ORDER BY id ASC) AS row_num
    FROM user_settings
  ) deduped
  WHERE deduped.row_num > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS moment_likes_moment_user_unique_idx
ON moment_likes (moment_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_key_unique_idx
ON user_settings (user_id, key);
