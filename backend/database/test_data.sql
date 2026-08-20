-- Test Data for RHU II Patient Queuing System
-- This script inserts sample data for testing purposes

-- Clear existing test data (optional - uncomment if needed)
-- DELETE FROM patients WHERE name LIKE 'Test%';
-- DELETE FROM consultation_history WHERE name LIKE 'Test%';

-- Insert test patients
INSERT INTO patients (id, name, phil_health_id, queue_number, status, patient_status, phil_health_status) VALUES
('test001', 'Test Patient 1', 'TEST001', 1, 'waiting', 'regular', 'registered'),
('test002', 'Test Senior Patient', 'TEST002', 2, 'waiting', 'senior', 'registered'),
('test003', 'Test PWD Patient', 'TEST003', 3, 'waiting', 'pwd', 'not-registered'),
('test004', 'Test Emergency Patient', 'TEST004', 4, 'waiting', 'emergency', 'no-philhealth'),
('test005', 'Test Regular Patient 2', 'TEST005', 5, 'serving', 'regular', 'other-facility'),
('test006', 'Test Skipped Patient', 'TEST006', 6, 'skipped', 'regular', 'registered')
ON CONFLICT (id) DO NOTHING;

-- Insert test consultation history
INSERT INTO consultation_history (id, name, queue_number, phil_health_id, patient_status, phil_health_status, icd_code, consultation_details, finished_at) VALUES
('hist001', 'Completed Patient 1', 10, 'HIST001', 'regular', 'registered', 'J00', 'Common cold symptoms treated', '2026-08-19 10:30:00'),
('hist002', 'Completed Senior Patient', 11, 'HIST002', 'senior', 'registered', 'I10', 'Hypertension management', '2026-08-19 11:15:00'),
('hist003', 'Completed PWD Patient', 12, 'HIST003', 'pwd', 'not-registered', 'E11', 'Type 2 diabetes consultation', '2026-08-19 14:20:00')
ON CONFLICT (id) DO NOTHING;

-- Update queue management to continue from test data
UPDATE queue_management SET next_queue_number = 7 WHERE id = 1;

-- Verify test data insertion
SELECT 'Test patients inserted:' as status, COUNT(*) as count FROM patients WHERE name LIKE 'Test%';
SELECT 'Test consultation history inserted:' as status, COUNT(*) as count FROM consultation_history WHERE name LIKE 'Completed%';
SELECT 'Next queue number set to:' as status, next_queue_number FROM queue_management WHERE id = 1;