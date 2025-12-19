-- Picksy API Gateway Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- User consent management table
CREATE TABLE IF NOT EXISTS user_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL,
    granted BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    version VARCHAR(20) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    legal_basis VARCHAR(50) NOT NULL,
    purpose TEXT NOT NULL,
    data_categories JSONB NOT NULL DEFAULT '[]',
    retention_period_days INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Consent audit logs
CREATE TABLE IF NOT EXISTS consent_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'granted', 'revoked', 'updated'
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data deletion requests
CREATE TABLE IF NOT EXISTS deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
    deletion_type VARCHAR(30) NOT NULL, -- 'user_requested', 'retention_policy', 'admin_requested'
    reason TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    verification_token VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deletion audit logs
CREATE TABLE IF NOT EXISTS deletion_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deletion_request_id UUID NOT NULL REFERENCES deletion_requests(id) ON DELETE CASCADE,
    table_name VARCHAR(100) NOT NULL,
    records_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    checksum VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for consent management
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON user_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_user_consents_granted ON user_consents(granted);
CREATE INDEX IF NOT EXISTS idx_consent_audit_user_id ON consent_audit_logs(user_id);

-- Create indexes for deletion management
CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled ON deletion_requests(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_deletion_audit_request_id ON deletion_audit_logs(deletion_request_id);

-- Financial data violations tracking
CREATE TABLE IF NOT EXISTS financial_data_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    violation_type VARCHAR(50) NOT NULL, -- 'pattern_match', 'prohibited_field', 'suspicious_content'
    detected_pattern TEXT,
    field_name VARCHAR(200),
    content_sample VARCHAR(100) NOT NULL, -- First 50 chars for audit
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(200),
    ip_address INET,
    user_agent TEXT,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    action_taken VARCHAR(20) NOT NULL, -- 'blocked', 'sanitized', 'logged_only'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data breach alerts
CREATE TABLE IF NOT EXISTS data_breach_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL, -- 'financial_data_detected', 'unauthorized_access', 'data_exfiltration'
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    affected_users JSONB DEFAULT '[]',
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for financial data protection
CREATE INDEX IF NOT EXISTS idx_financial_violations_user_id ON financial_data_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_violations_severity ON financial_data_violations(severity);
CREATE INDEX IF NOT EXISTS idx_financial_violations_detected_at ON financial_data_violations(detected_at);
CREATE INDEX IF NOT EXISTS idx_data_breach_alerts_severity ON data_breach_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_data_breach_alerts_resolved ON data_breach_alerts(resolved_at);

-- Add triggers for updated_at columns
CREATE TRIGGER update_user_consents_updated_at 
    BEFORE UPDATE ON user_consents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deletion_requests_updated_at 
    BEFORE UPDATE ON deletion_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: Admin123!)
-- Note: In production, this should be done through a secure setup process
INSERT INTO users (email, password_hash, role) 
VALUES (
    'admin@picksy.com', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PJ/..G', -- Admin123!
    'admin'
) ON CONFLICT (email) DO NOTHING;