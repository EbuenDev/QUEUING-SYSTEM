-- Video Configuration Migration
-- This adds support for YouTube playlist configuration for the patient waiting room display

CREATE TABLE IF NOT EXISTS video_config (
    id SERIAL PRIMARY KEY,
    playlist_id VARCHAR(100) NOT NULL,
    playlist_title VARCHAR(255),
    playlist_url VARCHAR(500),
    is_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_video_config_enabled ON video_config(is_enabled);

-- Insert default disabled configuration
INSERT INTO video_config (playlist_id, playlist_title, playlist_url, is_enabled, updated_by)
VALUES ('', '', '', false, 'system')
ON CONFLICT (id) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_video_config_updated_at BEFORE UPDATE ON video_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
