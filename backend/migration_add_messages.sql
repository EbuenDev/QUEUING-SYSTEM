-- Messages table for admin-doctor communication
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_role VARCHAR(20) NOT NULL,
    receiver_role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_role);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);

-- Add check constraints for data integrity
ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_sender_role;
ALTER TABLE messages
ADD CONSTRAINT chk_sender_role
CHECK (sender_role IN ('admin', 'doctor'));

ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_receiver_role;
ALTER TABLE messages
ADD CONSTRAINT chk_receiver_role
CHECK (receiver_role IN ('admin', 'doctor'));
