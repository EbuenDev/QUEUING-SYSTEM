-- Migration script to add follow-up functionality to existing database
-- Run this script if you already have the database set up

-- Add new columns to patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS follow_up_status VARCHAR(20) NOT NULL DEFAULT 'none';

ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS follow_up_reason VARCHAR(50);

-- Update constraint to include new status
ALTER TABLE patients 
DROP CONSTRAINT IF EXISTS chk_patient_status;

ALTER TABLE patients 
ADD CONSTRAINT chk_patient_status 
CHECK (status IN ('waiting', 'serving', 'skipped', 'follow-up'));

-- Add follow-up status constraint
ALTER TABLE patients 
DROP CONSTRAINT IF EXISTS chk_follow_up_status;

ALTER TABLE patients 
ADD CONSTRAINT chk_follow_up_status 
CHECK (follow_up_status IN ('none', 'needs_lab', 'ready_for_doctor'));

-- Create index for follow-up queries
CREATE INDEX IF NOT EXISTS idx_patients_follow_up_status ON patients(follow_up_status);