-- RHU II Patient Queuing System Database Schema
-- PostgreSQL Migration Script
-- This file is automatically executed by Docker during initialization

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phil_health_id VARCHAR(50),
    queue_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    patient_status VARCHAR(20) NOT NULL DEFAULT 'regular',
    phil_health_status VARCHAR(30) NOT NULL DEFAULT 'no-philhealth',
    follow_up_status VARCHAR(20) NOT NULL DEFAULT 'none',
    follow_up_reason VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consultation history table
CREATE TABLE IF NOT EXISTS consultation_history (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    queue_number INTEGER NOT NULL,
    phil_health_id VARCHAR(50),
    patient_status VARCHAR(20) NOT NULL DEFAULT 'regular',
    phil_health_status VARCHAR(30) NOT NULL DEFAULT 'no-philhealth',
    icd_code VARCHAR(20),
    consultation_details TEXT,
    finished_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Queue management table for tracking next queue number
CREATE TABLE IF NOT EXISTS queue_management (
    id INTEGER PRIMARY KEY DEFAULT 1,
    next_queue_number INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial queue management record
INSERT INTO queue_management (id, next_queue_number)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_patients_queue_number ON patients(queue_number);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients(created_at);
CREATE INDEX IF NOT EXISTS idx_consultation_history_finished_at ON consultation_history(finished_at);
CREATE INDEX IF NOT EXISTS idx_consultation_history_queue_number ON consultation_history(queue_number);

-- Add check constraints for data integrity
ALTER TABLE patients 
ADD CONSTRAINT chk_patient_status 
CHECK (status IN ('waiting', 'serving', 'skipped', 'follow-up'));

ALTER TABLE patients 
ADD CONSTRAINT chk_follow_up_status 
CHECK (follow_up_status IN ('none', 'needs_lab', 'ready_for_doctor'));

ALTER TABLE patients 
ADD CONSTRAINT chk_patient_classification 
CHECK (patient_status IN ('regular', 'pwd', 'senior', 'emergency'));

ALTER TABLE patients 
ADD CONSTRAINT chk_phil_health_status 
CHECK (phil_health_status IN ('no-philhealth', 'registered', 'not-registered', 'other-facility'));

ALTER TABLE consultation_history 
ADD CONSTRAINT chk_consultation_patient_classification 
CHECK (patient_status IN ('regular', 'pwd', 'senior', 'emergency'));

ALTER TABLE consultation_history 
ADD CONSTRAINT chk_consultation_phil_health_status 
CHECK (phil_health_status IN ('no-philhealth', 'registered', 'not-registered', 'other-facility'));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic updated_at
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_management_updated_at BEFORE UPDATE ON queue_management
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();