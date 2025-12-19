-- Add subscription_tier column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free';

-- Create index on subscription_tier for performance
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

-- Create affiliate_partners table
CREATE TABLE IF NOT EXISTS affiliate_partners (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL UNIQUE,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create affiliate_links table
CREATE TABLE IF NOT EXISTS affiliate_links (
    id UUID PRIMARY KEY,
    partner_id UUID NOT NULL REFERENCES affiliate_partners(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    affiliate_url TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NULL, -- Optional reference to tracked products
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    click_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    revenue INTEGER DEFAULT 0 -- Revenue in cents
);

-- Create tracked_products table if it doesn't exist (for usage tracking)
CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_url TEXT NOT NULL,
    product_title VARCHAR(500),
    retailer VARCHAR(100),
    target_price INTEGER, -- Price in cents
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_domain ON affiliate_partners(domain);
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_active ON affiliate_partners(is_active);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_user_id ON affiliate_links(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_partner_id ON affiliate_links(partner_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_created_at ON affiliate_links(created_at);
CREATE INDEX IF NOT EXISTS idx_tracked_products_user_id ON tracked_products(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_products_active ON tracked_products(is_active);

-- Update existing users to have free tier if null
UPDATE users SET subscription_tier = 'free' WHERE subscription_tier IS NULL;

-- Make subscription_tier NOT NULL after setting defaults
ALTER TABLE users ALTER COLUMN subscription_tier SET NOT NULL;