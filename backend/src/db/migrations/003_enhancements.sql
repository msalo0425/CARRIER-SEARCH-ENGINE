-- ============================================================
-- Enhancement Migration — adds columns needed by frontend pages
-- ============================================================

-- Proposals: add period/place of performance
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS period_of_performance VARCHAR(500);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS place_of_performance VARCHAR(500);

-- Certifications: add issuing body and cert number
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS issuing_body VARCHAR(500);
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS certification_number VARCHAR(300);

-- Sub quotes: add status and naics columns
ALTER TABLE sub_quotes ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'Not Requested';
ALTER TABLE sub_quotes ADD COLUMN IF NOT EXISTS naics_code VARCHAR(20);

-- Agencies: add extra contact/metadata fields
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS acronym VARCHAR(50);
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS primary_contact_title VARCHAR(255);
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS naics_focus VARCHAR(500);
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS set_aside_focus VARCHAR(255);
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS last_interaction_date DATE;

-- Calendar events: add event_date alias column
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_date DATE;
UPDATE calendar_events SET event_date = start_date WHERE event_date IS NULL;

-- Carrier CRM: store notes as crm_notes (visible alias)
ALTER TABLE carrier_crm ADD COLUMN IF NOT EXISTS crm_notes TEXT;
UPDATE carrier_crm SET crm_notes = notes WHERE crm_notes IS NULL;

-- Documents: add uploaded_by_name (denormalized for quick display)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by_name VARCHAR(255);

-- Opportunities: add agency alias (for frontend compatibility)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS agency VARCHAR(500);
UPDATE opportunities SET agency = agency_name WHERE agency IS NULL;

-- Sources sought: add status and response_submitted fields (frontend uses these)
ALTER TABLE sources_sought ADD COLUMN IF NOT EXISTS status VARCHAR(100) DEFAULT 'Identified';
ALTER TABLE sources_sought ADD COLUMN IF NOT EXISTS response_submitted BOOLEAN DEFAULT false;
ALTER TABLE sources_sought ADD COLUMN IF NOT EXISTS solicitation_number VARCHAR(300);
ALTER TABLE sources_sought ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(15,2);
ALTER TABLE sources_sought ADD COLUMN IF NOT EXISTS response_due_date DATE;

-- Update status from outcome for existing records
UPDATE sources_sought SET status = CASE
  WHEN outcome = 'Response Submitted' THEN 'Response Submitted'
  WHEN outcome = 'No Response' THEN 'No Follow-Up'
  ELSE 'Identified'
END WHERE status IS NULL OR status = 'Identified';
