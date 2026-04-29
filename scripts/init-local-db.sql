CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  qq_number VARCHAR(20) NOT NULL UNIQUE,
  nickname VARCHAR(64) NOT NULL,
  password VARCHAR(255) NOT NULL,
  avatar_color VARCHAR(7) DEFAULT '#3b82f6',
  signature VARCHAR(255) DEFAULT '这个人很懒，什么都没写',
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_qq_number_idx ON users (qq_number);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

CREATE TABLE IF NOT EXISTS friends (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  friend_id INTEGER NOT NULL REFERENCES users(id),
  remark VARCHAR(64) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS friends_user_id_idx ON friends (user_id);
CREATE INDEX IF NOT EXISTS friends_friend_id_idx ON friends (friend_id);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  avatar_color VARCHAR(7) DEFAULT '#10b981',
  description VARCHAR(255) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS groups_name_idx ON groups (name);

CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role VARCHAR(32) DEFAULT '普通成员',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON group_members (group_id);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON group_members (user_id);
CREATE INDEX IF NOT EXISTS group_members_group_user_idx ON group_members (group_id, user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  target_id INTEGER NOT NULL,
  last_message TEXT DEFAULT '',
  last_message_time TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations (user_id);
CREATE INDEX IF NOT EXISTS conversations_user_target_idx ON conversations (user_id, target_id);
CREATE INDEX IF NOT EXISTS conversations_last_message_time_idx ON conversations (last_message_time);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);

CREATE TABLE IF NOT EXISTS moments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  images JSONB DEFAULT '[]'::jsonb,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moments_user_id_idx ON moments (user_id);
CREATE INDEX IF NOT EXISTS moments_created_at_idx ON moments (created_at);

CREATE TABLE IF NOT EXISTS moment_comments (
  id SERIAL PRIMARY KEY,
  moment_id INTEGER NOT NULL REFERENCES moments(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moment_comments_moment_id_idx ON moment_comments (moment_id);
CREATE INDEX IF NOT EXISTS moment_comments_user_id_idx ON moment_comments (user_id);

CREATE TABLE IF NOT EXISTS moment_likes (
  id SERIAL PRIMARY KEY,
  moment_id INTEGER NOT NULL REFERENCES moments(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS moment_likes_moment_id_idx ON moment_likes (moment_id);
CREATE INDEX IF NOT EXISTS moment_likes_user_id_idx ON moment_likes (user_id);
CREATE INDEX IF NOT EXISTS moment_likes_moment_user_idx ON moment_likes (moment_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS moment_likes_moment_user_unique_idx ON moment_likes (moment_id, user_id);

CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  key VARCHAR(64) NOT NULL,
  value TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_settings_user_id_idx ON user_settings (user_id);
CREATE INDEX IF NOT EXISTS user_settings_user_key_idx ON user_settings (user_id, key);
CREATE UNIQUE INDEX IF NOT EXISTS user_settings_user_key_unique_idx ON user_settings (user_id, key);

CREATE TABLE IF NOT EXISTS group_role_mappings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  group_id INTEGER NOT NULL REFERENCES groups(id),
  role_type VARCHAR(32) NOT NULL,
  role_name VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS group_role_mappings_user_idx ON group_role_mappings (user_id);
CREATE INDEX IF NOT EXISTS group_role_mappings_group_idx ON group_role_mappings (group_id);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name VARCHAR(128) NOT NULL,
  description TEXT DEFAULT '',
  cron_expression VARCHAR(64) NOT NULL,
  task_type VARCHAR(64) NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_tasks_user_id_idx ON scheduled_tasks (user_id);
CREATE INDEX IF NOT EXISTS scheduled_tasks_enabled_idx ON scheduled_tasks (enabled);
CREATE INDEX IF NOT EXISTS scheduled_tasks_next_run_at_idx ON scheduled_tasks (next_run_at);

CREATE TABLE IF NOT EXISTS task_execution_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES scheduled_tasks(id),
  status VARCHAR(20) NOT NULL,
  output TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS task_execution_logs_task_id_idx ON task_execution_logs (task_id);
CREATE INDEX IF NOT EXISTS task_execution_logs_status_idx ON task_execution_logs (status);
CREATE INDEX IF NOT EXISTS task_execution_logs_started_at_idx ON task_execution_logs (started_at);
