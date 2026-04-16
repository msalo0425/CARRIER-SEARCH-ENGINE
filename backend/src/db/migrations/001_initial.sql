-- ============================================================
-- Black Clover Logistics BOS — Initial Schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── USERS & AUTH ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name   VARCHAR(255),
  role        VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin','sales_rep','viewer')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_jti   VARCHAR(255) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_jti ON sessions(token_jti);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ─── CARRIER DATA ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carriers (
  id                        SERIAL PRIMARY KEY,
  dot_number                VARCHAR(20) UNIQUE NOT NULL,
  mc_mx_ff_number           VARCHAR(100),
  mc_number                 VARCHAR(100),
  legal_name                VARCHAR(500),
  dba_name                  VARCHAR(500),
  phy_street                VARCHAR(500),
  phy_city                  VARCHAR(200),
  phy_state                 VARCHAR(10),
  phy_zip                   VARCHAR(20),
  phy_country               VARCHAR(100),
  telephone                 VARCHAR(50),
  fax                       VARCHAR(50),
  email_address             VARCHAR(255),
  entity_type               VARCHAR(100),
  carrier_operation         VARCHAR(10),
  op_carrier_flag           BOOLEAN DEFAULT false,
  op_broker_flag            BOOLEAN DEFAULT false,
  op_freight_forwarder_flag BOOLEAN DEFAULT false,
  op_shipper_flag           BOOLEAN DEFAULT false,
  op_cargo_tank_flag        BOOLEAN DEFAULT false,
  hm_flag                   BOOLEAN DEFAULT false,
  pc_flag                   BOOLEAN DEFAULT false,
  record_status             VARCHAR(50),
  out_of_service_date       DATE,
  operating_status          VARCHAR(50),
  nbr_power_unit            INTEGER,
  drivers                   INTEGER,
  safety_rating             VARCHAR(100),
  safety_rating_date        DATE,
  safety_review_date        DATE,
  safety_review_type        VARCHAR(100),
  insurance_on_file         BOOLEAN DEFAULT false,
  bipd_insurance_on_file    BOOLEAN DEFAULT false,
  cargo_insurance_on_file   BOOLEAN DEFAULT false,
  bond_insurance_on_file    BOOLEAN DEFAULT false,
  -- Cargo types
  cargo_general_freight     BOOLEAN DEFAULT false,
  cargo_household_goods     BOOLEAN DEFAULT false,
  cargo_metal_sheets        BOOLEAN DEFAULT false,
  cargo_motor_vehicles      BOOLEAN DEFAULT false,
  cargo_drive_away          BOOLEAN DEFAULT false,
  cargo_logs_poles          BOOLEAN DEFAULT false,
  cargo_building_materials  BOOLEAN DEFAULT false,
  cargo_mobile_homes        BOOLEAN DEFAULT false,
  cargo_machinery_equipment BOOLEAN DEFAULT false,
  cargo_fresh_produce       BOOLEAN DEFAULT false,
  cargo_liquids_gases       BOOLEAN DEFAULT false,
  cargo_intermodal          BOOLEAN DEFAULT false,
  cargo_passengers          BOOLEAN DEFAULT false,
  cargo_oilfield_equipment  BOOLEAN DEFAULT false,
  cargo_livestock           BOOLEAN DEFAULT false,
  cargo_grain               BOOLEAN DEFAULT false,
  cargo_coal                BOOLEAN DEFAULT false,
  cargo_meat                BOOLEAN DEFAULT false,
  cargo_garbage_refuse      BOOLEAN DEFAULT false,
  cargo_us_mail             BOOLEAN DEFAULT false,
  cargo_chemicals           BOOLEAN DEFAULT false,
  cargo_commodities_dry_bulk BOOLEAN DEFAULT false,
  cargo_refrigerated        BOOLEAN DEFAULT false,
  cargo_beverages           BOOLEAN DEFAULT false,
  cargo_paper_products      BOOLEAN DEFAULT false,
  cargo_utilities           BOOLEAN DEFAULT false,
  cargo_agriculture_products BOOLEAN DEFAULT false,
  cargo_construction        BOOLEAN DEFAULT false,
  cargo_water_well          BOOLEAN DEFAULT false,
  cargo_other               BOOLEAN DEFAULT false,
  mcs150_date               DATE,
  added_date                DATE,
  oic_state                 VARCHAR(10),
  last_synced_at            TIMESTAMPTZ DEFAULT NOW(),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_carriers_fts ON carriers USING GIN (
  to_tsvector('english',
    coalesce(legal_name,'') || ' ' ||
    coalesce(dba_name,'') || ' ' ||
    coalesce(dot_number,'') || ' ' ||
    coalesce(mc_number,'') || ' ' ||
    coalesce(phy_city,'')
  )
);
CREATE INDEX IF NOT EXISTS idx_carriers_dot        ON carriers(dot_number);
CREATE INDEX IF NOT EXISTS idx_carriers_mc         ON carriers(mc_number);
CREATE INDEX IF NOT EXISTS idx_carriers_name       ON carriers(legal_name);
CREATE INDEX IF NOT EXISTS idx_carriers_state      ON carriers(phy_state);
CREATE INDEX IF NOT EXISTS idx_carriers_zip        ON carriers(phy_zip);
CREATE INDEX IF NOT EXISTS idx_carriers_status     ON carriers(operating_status);
CREATE INDEX IF NOT EXISTS idx_carriers_safety     ON carriers(safety_rating);
CREATE INDEX IF NOT EXISTS idx_carriers_power      ON carriers(nbr_power_unit);
CREATE INDEX IF NOT EXISTS idx_carriers_entity     ON carriers(entity_type);

-- ─── CRM ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carrier_crm (
  id            SERIAL PRIMARY KEY,
  dot_number    VARCHAR(20) UNIQUE NOT NULL,
  crm_status    VARCHAR(100) DEFAULT 'New',
  is_in_pipeline BOOLEAN DEFAULT false,
  is_contacted  BOOLEAN DEFAULT false,
  do_not_call   BOOLEAN DEFAULT false,
  notes         TEXT,
  assigned_to   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  pipeline_contract VARCHAR(500),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_logs (
  id              SERIAL PRIMARY KEY,
  dot_number      VARCHAR(20) NOT NULL,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  call_date       DATE NOT NULL,
  call_time       TIME,
  outcome         VARCHAR(100) NOT NULL,
  notes           TEXT,
  duration_minutes INTEGER,
  contact_name    VARCHAR(255),
  contact_title   VARCHAR(255),
  callback_date   DATE,
  callback_time   TIME,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_logs_dot  ON call_logs(dot_number);
CREATE INDEX IF NOT EXISTS idx_call_logs_date ON call_logs(call_date DESC);

CREATE TABLE IF NOT EXISTS follow_ups (
  id            SERIAL PRIMARY KEY,
  dot_number    VARCHAR(20),
  entity_type   VARCHAR(50) DEFAULT 'carrier',
  entity_id     VARCHAR(100),
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  due_date      DATE NOT NULL,
  due_time      TIME,
  notes         TEXT,
  title         VARCHAR(500),
  is_completed  BOOLEAN DEFAULT false,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_follow_ups_dot  ON follow_ups(dot_number);
CREATE INDEX IF NOT EXISTS idx_follow_ups_due  ON follow_ups(due_date, is_completed);
CREATE INDEX IF NOT EXISTS idx_follow_ups_user ON follow_ups(user_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(50),
  entity_id   VARCHAR(100),
  dot_number  VARCHAR(20),
  action      VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_dot    ON activity_log(dot_number);
CREATE INDEX IF NOT EXISTS idx_activity_date   ON activity_log(created_at DESC);

-- ─── OPPORTUNITIES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS opportunities (
  id                      SERIAL PRIMARY KEY,
  title                   VARCHAR(1000) NOT NULL,
  solicitation_number     VARCHAR(300),
  agency_name             VARCHAR(500),
  naics_code              VARCHAR(20),
  set_aside_type          VARCHAR(100),
  posted_date             DATE,
  response_due_date       DATE,
  contract_value_estimate DECIMAL(15,2),
  status                  VARCHAR(100) DEFAULT 'New',
  poc_name                VARCHAR(255),
  poc_email               VARCHAR(255),
  poc_phone               VARCHAR(100),
  sam_gov_link            TEXT,
  notes                   TEXT,
  created_by              INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opp_status   ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opp_sol_num  ON opportunities(solicitation_number);
CREATE INDEX IF NOT EXISTS idx_opp_due      ON opportunities(response_due_date);
CREATE INDEX IF NOT EXISTS idx_opp_naics    ON opportunities(naics_code);

-- ─── SOURCES SOUGHT ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sources_sought (
  id                        SERIAL PRIMARY KEY,
  agency_name               VARCHAR(500),
  title                     VARCHAR(1000),
  notice_number             VARCHAR(300),
  naics_code                VARCHAR(20),
  date_posted               DATE,
  response_submitted_date   DATE,
  response_document_url     TEXT,
  co_name                   VARCHAR(255),
  co_email                  VARCHAR(255),
  co_phone                  VARCHAR(100),
  follow_up_date            DATE,
  outcome                   VARCHAR(100) DEFAULT 'Pending',
  notes                     TEXT,
  created_by                INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROPOSALS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposals (
  id                        SERIAL PRIMARY KEY,
  contract_name             VARCHAR(1000) NOT NULL,
  solicitation_number       VARCHAR(300),
  agency                    VARCHAR(500),
  naics_code                VARCHAR(20),
  set_aside_type            VARCHAR(100),
  contract_value            DECIMAL(15,2),
  proposal_due_date         DATE,
  submitted_date            DATE,
  status                    VARCHAR(100) DEFAULT 'Opportunity Identified',
  status_updated_at         TIMESTAMPTZ DEFAULT NOW(),
  team_members              TEXT[] DEFAULT '{}',
  notes                     TEXT,
  win_loss                  VARCHAR(20),
  -- Document checklist
  doc_technical_approach    BOOLEAN DEFAULT false,
  doc_past_performance      BOOLEAN DEFAULT false,
  doc_pricing               BOOLEAN DEFAULT false,
  doc_capability_statement  BOOLEAN DEFAULT false,
  doc_certifications        BOOLEAN DEFAULT false,
  doc_teaming_agreements    BOOLEAN DEFAULT false,
  created_by                INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prop_status  ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_prop_sol_num ON proposals(solicitation_number);
CREATE INDEX IF NOT EXISTS idx_prop_due     ON proposals(proposal_due_date);
CREATE INDEX IF NOT EXISTS idx_prop_fts     ON proposals USING GIN (
  to_tsvector('english',
    coalesce(contract_name,'') || ' ' ||
    coalesce(solicitation_number,'') || ' ' ||
    coalesce(agency,'') || ' ' ||
    coalesce(naics_code,'') || ' ' ||
    coalesce(notes,'')
  )
);

CREATE TABLE IF NOT EXISTS proposal_activity (
  id          SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  description TEXT,
  old_status  VARCHAR(100),
  new_status  VARCHAR(100),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prop_activity ON proposal_activity(proposal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sub_quotes (
  id                    SERIAL PRIMARY KEY,
  proposal_id           INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  company_name          VARCHAR(500) NOT NULL,
  contact_name          VARCHAR(255),
  contact_phone         VARCHAR(100),
  quote_requested_date  DATE,
  quote_due_date        DATE,
  quote_received        BOOLEAN DEFAULT false,
  quote_amount          DECIMAL(15,2),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_quotes_proposal ON sub_quotes(proposal_id);

CREATE TABLE IF NOT EXISTS proposal_documents (
  id                SERIAL PRIMARY KEY,
  proposal_id       INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
  filename          VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500),
  file_path         TEXT NOT NULL,
  file_size         BIGINT,
  mime_type         VARCHAR(200),
  uploaded_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AGENCIES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agencies (
  id                        SERIAL PRIMARY KEY,
  agency_name               VARCHAR(500) NOT NULL,
  department                VARCHAR(500),
  sb_contact_name           VARCHAR(255),
  sb_contact_email          VARCHAR(255),
  sb_contact_phone          VARCHAR(100),
  co_name                   VARCHAR(255),
  co_email                  VARCHAR(255),
  co_phone                  VARCHAR(100),
  pm_name                   VARCHAR(255),
  pm_email                  VARCHAR(255),
  pm_phone                  VARCHAR(100),
  last_contact_date         DATE,
  next_follow_up_date       DATE,
  relationship_status       VARCHAR(100) DEFAULT 'Cold',
  cap_statement_sent        BOOLEAN DEFAULT false,
  cap_statement_sent_date   DATE,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_interactions (
  id                SERIAL PRIMARY KEY,
  agency_id         INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  interaction_type  VARCHAR(100),
  interaction_date  TIMESTAMPTZ NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agency_interactions ON agency_interactions(agency_id, interaction_date DESC);

-- ─── CERTIFICATIONS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certifications (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(500) NOT NULL,
  cert_type             VARCHAR(100),
  status                VARCHAR(100) DEFAULT 'Active',
  issued_date           DATE,
  expiration_date       DATE,
  renewal_reminder_days INTEGER DEFAULT 60,
  document_url          TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DOCUMENTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(1000) NOT NULL,
  category          VARCHAR(200),
  description       TEXT,
  filename          VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500),
  file_path         TEXT NOT NULL,
  file_size         BIGINT,
  mime_type         VARCHAR(200),
  version           INTEGER DEFAULT 1,
  parent_id         INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  uploaded_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_parent   ON documents(parent_id);

-- ─── CALENDAR EVENTS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_events (
  id                  SERIAL PRIMARY KEY,
  title               VARCHAR(1000) NOT NULL,
  description         TEXT,
  event_type          VARCHAR(100),
  start_date          DATE NOT NULL,
  start_time          TIME,
  end_date            DATE,
  color               VARCHAR(50) DEFAULT '#D4AF37',
  related_entity_type VARCHAR(50),
  related_entity_id   INTEGER,
  is_reminder         BOOLEAN DEFAULT false,
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(start_date);

-- ─── SYNC LOG ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_log (
  id              SERIAL PRIMARY KEY,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  records_fetched INTEGER DEFAULT 0,
  records_upserted INTEGER DEFAULT 0,
  status          VARCHAR(50) DEFAULT 'running',
  error_message   TEXT
);
