-- ============================================================
-- Sources Sought: add source tracking to support auto-sync
-- ============================================================

ALTER TABLE sources_sought ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE sources_sought ADD COLUMN IF NOT EXISTS external_id VARCHAR(500);
ALTER TABLE sources_sought ADD COLUMN IF NOT EXISTS original_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sources_sought_external_id_idx ON sources_sought(external_id) WHERE external_id IS NOT NULL;
