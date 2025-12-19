-- Add revenue tracking tables for ethical monetization

-- Revenue events table for tracking all revenue-generating activities
CREATE TABLE IF NOT EXISTS revenue_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL, -- 'subscription_upgrade', 'affiliate_conversion', 'subscription_cancellation'
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT 0, -- Amount in cents
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription history for tracking tier changes
CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_tier VARCHAR(20),
    to_tier VARCHAR(20) NOT NULL,
    change_reason VARCHAR(100), -- 'upgrade', 'downgrade', 'cancellation', 'initial'
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Affiliate performance tracking
CREATE TABLE IF NOT EXISTS affiliate_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_revenue INTEGER DEFAULT 0, -- Revenue in cents
    conversion_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(partner_id, period_start, period_end)
);

-- Usage analytics for understanding user behavior
CREATE TABLE IF NOT EXISTS usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    products_tracked INTEGER DEFAULT 0,
    price_checks INTEGER DEFAULT 0,
    notifications_sent INTEGER DEFAULT 0,
    api_requests INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Ethical compliance tracking
CREATE TABLE IF NOT EXISTS ethical_compliance_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    compliance_type VARCHAR(50) NOT NULL, -- 'affiliate_disclosure', 'data_consent', 'privacy_policy'
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    compliance_status BOOLEAN NOT NULL,
    details JSONB DEFAULT '{}',
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_revenue_events_user_id ON revenue_events(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_type ON revenue_events(event_type);
CREATE INDEX IF NOT EXISTS idx_revenue_events_created_at ON revenue_events(created_at);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_effective_date ON subscription_history(effective_date);

CREATE INDEX IF NOT EXISTS idx_affiliate_performance_partner_id ON affiliate_performance(partner_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_performance_period ON affiliate_performance(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_date ON usage_analytics(date);

CREATE INDEX IF NOT EXISTS idx_ethical_compliance_type ON ethical_compliance_log(compliance_type);
CREATE INDEX IF NOT EXISTS idx_ethical_compliance_status ON ethical_compliance_log(compliance_status);
CREATE INDEX IF NOT EXISTS idx_ethical_compliance_checked_at ON ethical_compliance_log(checked_at);

-- Function to automatically track subscription changes
CREATE OR REPLACE FUNCTION track_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track if subscription_tier actually changed
    IF OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier THEN
        INSERT INTO subscription_history (user_id, from_tier, to_tier, change_reason, effective_date)
        VALUES (
            NEW.id,
            OLD.subscription_tier,
            NEW.subscription_tier,
            CASE 
                WHEN OLD.subscription_tier = 'free' THEN 'upgrade'
                WHEN NEW.subscription_tier = 'free' THEN 'downgrade'
                ELSE 'tier_change'
            END,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically track subscription changes
DROP TRIGGER IF EXISTS subscription_change_trigger ON users;
CREATE TRIGGER subscription_change_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION track_subscription_change();

-- Function to update affiliate performance metrics
CREATE OR REPLACE FUNCTION update_affiliate_performance()
RETURNS void AS $$
DECLARE
    partner_record RECORD;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Calculate for current month
    start_date := DATE_TRUNC('month', CURRENT_DATE);
    end_date := start_date + INTERVAL '1 month' - INTERVAL '1 day';
    
    -- Update performance for each partner
    FOR partner_record IN SELECT id FROM affiliate_partners WHERE is_active = true LOOP
        INSERT INTO affiliate_performance (
            partner_id, 
            period_start, 
            period_end, 
            total_clicks, 
            total_conversions, 
            total_revenue,
            conversion_rate
        )
        SELECT 
            partner_record.id,
            start_date,
            end_date,
            COALESCE(SUM(click_count), 0),
            COALESCE(SUM(conversion_count), 0),
            COALESCE(SUM(revenue), 0),
            CASE 
                WHEN SUM(click_count) > 0 THEN (SUM(conversion_count)::DECIMAL / SUM(click_count)) * 100
                ELSE 0
            END
        FROM affiliate_links 
        WHERE partner_id = partner_record.id
          AND created_at >= start_date 
          AND created_at <= end_date + INTERVAL '1 day'
        ON CONFLICT (partner_id, period_start, period_end) 
        DO UPDATE SET
            total_clicks = EXCLUDED.total_clicks,
            total_conversions = EXCLUDED.total_conversions,
            total_revenue = EXCLUDED.total_revenue,
            conversion_rate = EXCLUDED.conversion_rate;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job placeholder (would use pg_cron in production)
-- SELECT cron.schedule('update-affiliate-performance', '0 1 * * *', 'SELECT update_affiliate_performance();');