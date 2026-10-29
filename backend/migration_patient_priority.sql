-- RHU II Patient Queuing System - Patient Priority Order Migration
-- Adds priority_order column to patients table for drag-and-drop queue manipulation and urgent patient prioritization

ALTER TABLE patients ADD COLUMN IF NOT EXISTS priority_order INTEGER DEFAULT 0;

-- Populate existing rows with their queue_number as default priority_order
UPDATE patients SET priority_order = queue_number WHERE priority_order IS NULL OR priority_order = 0;

-- Create index for priority_order
CREATE INDEX IF NOT EXISTS idx_patients_priority_order ON patients(priority_order);

