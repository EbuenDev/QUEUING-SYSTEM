-- User Management System Migration
-- This adds support for dynamic user management with a super admin

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'doctor')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Insert default super admin (username: superadmin, password: superadmin123)
INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES ('superadmin', '$2y$10$SZmxUqlGKecirflTH4bmLe.DuI7/Oh1dIC3DN86jCBWQzCS5Fm4O.', 'Super Administrator', 'super_admin', true)
ON CONFLICT (username) DO NOTHING;

-- Insert default admin (username: admin, password: admin123)
INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES ('admin', '$2y$10$ztyCLaKexXNfyKocq0W3FuIaKUkNf8BR95j76i6Zl4rWflQD4SUXi', 'System Administrator', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- Insert default doctor (username: renz, password: renzsale)
INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES ('renz', '$2y$10$gv6DCmeno.Ue4T4nLDlzrutZ3DkuojdqKm/14QpQOGlmtsKnqtThO', 'Dr. Renz', 'doctor', true)
ON CONFLICT (username) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
