-- ============================================================
-- Game Plan — weekly recurring goals + daily task list
-- ============================================================

CREATE TABLE IF NOT EXISTS game_plan_goals (
  id             SERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  category       VARCHAR(100),
  target_per_week INTEGER NOT NULL DEFAULT 1,
  notes          TEXT,
  sort_order     INTEGER DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goal_log (
  id         SERIAL PRIMARY KEY,
  goal_id    INTEGER NOT NULL REFERENCES game_plan_goals(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  note       TEXT,
  logged_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goal_log_week_idx ON goal_log(goal_id, week_start);

-- Pre-seed realistic weekly goals for a one-person WOSB logistics company
INSERT INTO game_plan_goals (title, category, target_per_week, notes, sort_order)
VALUES
  ('Submit Proposals',              'Gov Contracting', 2,  'Quality over quantity — 2 strong proposals beats 7 rushed ones', 1),
  ('Respond to Sources Sought',     'Gov Contracting', 3,  'SSN responses build name recognition with agencies even before solicitations drop', 2),
  ('Review New Solicitations',      'Gov Contracting', 5,  'Check SAM.gov aggregator for new freight/logistics opportunities', 3),
  ('Agency Relationship Outreach',  'Gov Contracting', 1,  'One call or email to a program office or contracting officer per week', 4),
  ('Cold Call New Carriers',        'Carriers',        10, 'Build your subcontractor bench for capacity and surge support', 5),
  ('Follow Up on Pipeline Leads',   'Carriers',        5,  'Consistent follow-up is how deals close — don''t let leads go cold', 6),
  ('Check SAM.gov for New Matches', 'Gov Contracting', 3,  'Run a fresh search with your NAICS codes for anything posted this week', 7)
ON CONFLICT DO NOTHING;
