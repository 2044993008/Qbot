-- Migration: Add unique constraint on friends (user_id, friend_id)
-- Date: 2026-05-01

-- Remove duplicate friend relationships, keeping the earliest row per pair.
DELETE FROM friends
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id, friend_id ORDER BY id ASC) AS row_num
    FROM friends
  ) deduped
  WHERE deduped.row_num > 1
);

-- Create unique index to prevent future duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS friends_user_friend_unique_idx
ON friends (user_id, friend_id);
