-- ============================================================
-- Module: Solicitation Aggregator + Settings
-- ============================================================

CREATE TABLE IF NOT EXISTS aggregator_settings (
  id              SERIAL PRIMARY KEY,
  key             VARCHAR(200) UNIQUE NOT NULL,
  value           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Default NAICS codes to monitor
INSERT INTO aggregator_settings (key, value) VALUES
  ('naics_codes', '488510,541614,484121,484122,484110,492110'),
  ('set_aside_types', 'WOSB,EDWOSB,SB,FULL'),
  ('sam_api_key', ''),
  ('sam_enabled', 'true'),
  ('usaspending_enabled', 'true'),
  ('dla_enabled', 'false'),
  ('gsa_enabled', 'false'),
  ('sync_schedule', '0 6,18 * * *'),
  ('alert_new_opps', 'true')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS aggregated_solicitations (
  id                  SERIAL PRIMARY KEY,
  source              VARCHAR(100) NOT NULL,            -- 'sam.gov', 'usaspending', 'dla', 'gsa'
  external_id         VARCHAR(500) NOT NULL,
  solicitation_number VARCHAR(500),
  title               TEXT,
  agency_name         VARCHAR(500),
  sub_agency          VARCHAR(500),
  naics_code          VARCHAR(20),
  set_aside_type      VARCHAR(200),
  posted_date         DATE,
  response_due_date   DATE,
  contract_value_min  DECIMAL(15,2),
  contract_value_max  DECIMAL(15,2),
  poc_name            VARCHAR(500),
  poc_email           VARCHAR(500),
  poc_phone           VARCHAR(200),
  description         TEXT,
  original_url        TEXT,
  full_data           JSONB,
  status              VARCHAR(100) DEFAULT 'New',       -- New, Reviewed, Added to Pipeline, No Bid, Expired
  proposal_id         INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
  is_wosb_eligible    BOOLEAN DEFAULT false,
  is_edwosb_eligible  BOOLEAN DEFAULT false,
  first_seen_at       TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_agg_sol_number  ON aggregated_solicitations(solicitation_number);
CREATE INDEX IF NOT EXISTS idx_agg_agency      ON aggregated_solicitations(agency_name);
CREATE INDEX IF NOT EXISTS idx_agg_naics       ON aggregated_solicitations(naics_code);
CREATE INDEX IF NOT EXISTS idx_agg_due_date    ON aggregated_solicitations(response_due_date);
CREATE INDEX IF NOT EXISTS idx_agg_status      ON aggregated_solicitations(status);
CREATE INDEX IF NOT EXISTS idx_agg_source      ON aggregated_solicitations(source);
CREATE INDEX IF NOT EXISTS idx_agg_wosb        ON aggregated_solicitations(is_wosb_eligible, is_edwosb_eligible);
CREATE INDEX IF NOT EXISTS idx_agg_fts         ON aggregated_solicitations USING GIN (
  to_tsvector('english',
    coalesce(title,'') || ' ' ||
    coalesce(solicitation_number,'') || ' ' ||
    coalesce(agency_name,'') || ' ' ||
    coalesce(naics_code,'') || ' ' ||
    coalesce(description,'')
  )
);

CREATE TABLE IF NOT EXISTS aggregator_sync_log (
  id              SERIAL PRIMARY KEY,
  source          VARCHAR(100),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  new_count       INTEGER DEFAULT 0,
  updated_count   INTEGER DEFAULT 0,
  total_fetched   INTEGER DEFAULT 0,
  status          VARCHAR(50) DEFAULT 'running',
  error_message   TEXT
);

-- USASpending market intelligence
CREATE TABLE IF NOT EXISTS usa_spending_awards (
  id                  SERIAL PRIMARY KEY,
  award_id            VARCHAR(200) UNIQUE,
  generated_id        VARCHAR(200),
  agency_name         VARCHAR(500),
  sub_agency          VARCHAR(500),
  recipient_name      VARCHAR(500),
  naics_code          VARCHAR(20),
  naics_description   VARCHAR(500),
  award_amount        DECIMAL(15,2),
  start_date          DATE,
  end_date            DATE,
  description         TEXT,
  place_of_performance VARCHAR(500),
  full_data           JSONB,
  first_seen_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usa_agency ON usa_spending_awards(agency_name);
CREATE INDEX IF NOT EXISTS idx_usa_naics  ON usa_spending_awards(naics_code);
CREATE INDEX IF NOT EXISTS idx_usa_amount ON usa_spending_awards(award_amount DESC);
