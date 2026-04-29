-- Migration: Add scheduled_tasks and task_execution_logs tables
-- Date: 2026-04-29

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
