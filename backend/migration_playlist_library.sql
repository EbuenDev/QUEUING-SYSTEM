-- Playlist Library Migration
-- This adds support for multiple YouTube playlists that can be saved and switched between

CREATE TABLE IF NOT EXISTS playlist_library (
    id SERIAL PRIMARY KEY,
    playlist_id VARCHAR(100) NOT NULL,
    playlist_title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    playlist_url VARCHAR(500) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by VARCHAR(50) DEFAULT 'admin'
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_playlist_library_playlist_id ON playlist_library(playlist_id);
