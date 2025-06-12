-- Create system configuration table
CREATE TABLE IF NOT EXISTS our_system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    config_type VARCHAR(50) NOT NULL, -- 'string', 'boolean', 'json', 'array'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration for question generation permissions
INSERT INTO our_system_config (config_key, config_value, config_type, description)
VALUES 
    ('question_generation_allowed', '["admin"]', 'array', 'Roles allowed to trigger question generation: user, teacher, admin')
ON CONFLICT (config_key) DO NOTHING;

-- Create index for quick lookups
CREATE INDEX idx_system_config_key ON our_system_config(config_key);