-- ============================================================
-- Tasks / To-Do List
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  notes       TEXT,
  is_done     BOOLEAN NOT NULL DEFAULT FALSE,
  due_date    DATE,
  priority    VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  done_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_created_by_idx ON tasks(created_by);
CREATE INDEX IF NOT EXISTS tasks_is_done_idx ON tasks(is_done);
