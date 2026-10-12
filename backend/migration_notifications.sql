-- Notifications Table Migration
-- This adds support for notifications between Admin and Doctor pages

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    queue_number INTEGER,
    patient_name VARCHAR(255),
    message TEXT,
    notification_type VARCHAR(50) DEFAULT 'patient_call',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_id ON notifications(id);
