-- =============================================================================
-- AI Dropshipping System - Database Schema
-- Project: cspshqtkxfawibdoqcpv
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron" SCHEMA "pg_catalog";

-- =============================================================================
-- 1. PRODUCTS TABLE
-- Populated by: Store Launcher workflow (CJ Dropshipping → Supabase)
-- Read by: Storefront frontend, Ad Factory workflow
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cj_product_id TEXT,                    -- CJ Dropshipping product ID
  cj_variant_id TEXT,                    -- CJ Dropshipping default variant ID
  sku TEXT,                              -- CJ Dropshipping SKU
  name TEXT NOT NULL,                    -- Product name
  slug TEXT UNIQUE,                      -- URL-friendly name for storefront
  description TEXT,                      -- Product description
  price DECIMAL(10, 2) NOT NULL,         -- Our selling price
  cost_price DECIMAL(10, 2),            -- CJ cost price (our wholesale)
  compare_at_price DECIMAL(10, 2),      -- "was" price for discounts
  images TEXT[] DEFAULT '{}',           -- Array of image URLs
  category TEXT,                         -- Product category
  cj_category_id TEXT,                  -- CJ category ID
  supplier TEXT DEFAULT 'cj_dropshipping', -- Supplier name
  supplier_url TEXT,                    -- Direct link to CJ product page
  variants JSONB DEFAULT '[]',          -- Variant data (sizes, colors, etc.)
  inventory_count INTEGER DEFAULT 0,    -- Total inventory across warehouses
  shipping_info JSONB DEFAULT '{}',     -- Shipping methods and costs
  weight_grams DECIMAL(10, 2),         -- Product weight
  dimensions JSONB,                     -- Length, width, height
  is_trending BOOLEAN DEFAULT false,   -- Flagged by Product Discovery
  is_featured BOOLEAN DEFAULT false,    -- Featured on storefront homepage
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'discontinued', 'out_of_stock')),
  trending_score DECIMAL(5, 2) DEFAULT 0, -- 0-100 trending score from discovery
  ad_copy TEXT,                         -- AI-generated ad copy
  ai_product_description TEXT,         -- AI-enhanced description for storefront
  tags TEXT[] DEFAULT '{}',            -- Searchable tags
  source_platform TEXT,                -- Where discovered (facebook, tiktok, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for storefront queries
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_trending ON public.products(is_trending, trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_cj_id ON public.products(cj_product_id);

-- =============================================================================
-- 2. ORDERS TABLE
-- Created by: Storefront checkout (Stripe webhook)
-- Processed by: Order Engine workflow (Supabase → CJ Dropshipping → Resend)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,    -- Human-readable order number (e.g., SS-10001)
  stripe_session_id TEXT,              -- Stripe checkout session ID
  stripe_payment_intent_id TEXT,       -- Stripe payment intent ID
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address JSONB NOT NULL,     -- Full shipping address object
  items JSONB NOT NULL DEFAULT '[]',   -- Order line items with product details
  subtotal DECIMAL(10, 2) NOT NULL,    -- Subtotal before shipping
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,       -- Total charged to customer
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Just placed, awaiting fulfillment
    'processing',       -- Sent to CJ Dropshipping
    'shipped',          -- CJ confirmed shipment
    'delivered',        -- Tracking shows delivered
    'cancelled',        -- Order cancelled
    'refunded'          -- Refund issued
  )),
  cj_order_id TEXT,                    -- CJ Dropshipping order ID
  cj_order_status TEXT,               -- CJ-specific order status
  tracking_number TEXT,               -- Shipping tracking number
  tracking_url TEXT,                  -- Tracking URL
  shipping_carrier TEXT,              -- Shipping carrier name
  cj_payment_url TEXT,               -- CJ payment URL (for order payment)
  notes TEXT,                         -- Internal notes
  metadata JSONB DEFAULT '{}',       -- Flexible metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe ON public.orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_cj ON public.orders(cj_order_id);

-- =============================================================================
-- 3. ORDER ITEMS TABLE (normalized for analytics)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  cj_product_id TEXT,                  -- CJ product ID at time of order
  cj_variant_id TEXT,                  -- CJ variant ID at time of order
  product_name TEXT NOT NULL,          -- Snapshot of product name
  variant_name TEXT,                   -- e.g., "Black - XL"
  sku TEXT,                            -- Product SKU
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL, -- Price per unit at time of sale
  cost_price DECIMAL(10, 2),          -- Our cost per unit
  total_price DECIMAL(10, 2) NOT NULL, -- unit_price * quantity
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);

-- =============================================================================
-- 4. REVIEWS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  is_verified BOOLEAN DEFAULT false,   -- Verified purchase
  is_featured BOOLEAN DEFAULT false,   -- Featured on storefront
  sentiment TEXT,                       -- AI-classified: positive/negative/neutral
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);

-- =============================================================================
-- 5. AD PERFORMANCE TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ad_performance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id),
  platform TEXT NOT NULL,              -- facebook, tiktok, instagram, etc.
  ad_type TEXT,                        -- video, image, carousel, etc.
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5, 4) DEFAULT 0,         -- Click-through rate
  spend DECIMAL(10, 2) DEFAULT 0,     -- Ad spend
  revenue DECIMAL(10, 2) DEFAULT 0,   -- Attributed revenue
  roas DECIMAL(5, 2) DEFAULT 0,       -- Return on ad spend
  conversions INTEGER DEFAULT 0,
  cpa DECIMAL(10, 2) DEFAULT 0,       -- Cost per acquisition
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  ad_copy TEXT,                         -- The ad copy used
  ad_creative_url TEXT,                -- URL to ad creative
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_perf_product ON public.ad_performance(product_id);
CREATE INDEX IF NOT EXISTS idx_ad_perf_platform ON public.ad_performance(platform);
CREATE INDEX IF NOT EXISTS idx_ad_perf_date ON public.ad_performance(date);

-- =============================================================================
-- 6. BUSINESS INSIGHTS TABLE
-- Populated by: Intelligence Feedback Loop workflow
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.business_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  analysis_period TEXT NOT NULL,       -- e.g., "2026-06-01 to 2026-06-07"
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_ad_spend DECIMAL(10, 2) DEFAULT 0,
  avg_order_value DECIMAL(10, 2) DEFAULT 0,
  top_products JSONB DEFAULT '[]',    -- Top performing products
  top_categories JSONB DEFAULT '[]',  -- Top categories
  customer_sentiment TEXT,             -- Overall sentiment summary
  insights JSONB NOT NULL DEFAULT '{}', -- Full AI-generated insights
  recommendations JSONB DEFAULT '[]', -- AI recommendations
  alert_level TEXT DEFAULT 'green' CHECK (alert_level IN ('green', 'yellow', 'red')),
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_period ON public.business_insights(analysis_period);

-- =============================================================================
-- 7. ACTION ITEMS TABLE
-- Populated by: Intelligence Feedback Loop workflow
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.action_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  insight_id UUID REFERENCES public.business_insights(id),
  category TEXT NOT NULL,              -- sourcing, advertising, store, customer_service
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  impact_estimate TEXT,                -- Expected impact description
  automated BOOLEAN DEFAULT false,     -- Can this be auto-executed?
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_action_items_status ON public.action_items(status);
CREATE INDEX IF NOT EXISTS idx_action_items_priority ON public.action_items(priority);

-- =============================================================================
-- 8. PRODUCT DISCOVERY CACHE TABLE
-- Tracks products found by the Product Discovery workflow
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.discovered_products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_platform TEXT NOT NULL,       -- facebook, tiktok, reddit, etc.
  source_url TEXT,                     -- URL where the product was discovered
  cj_product_id TEXT,                  -- Matched CJ product (if found)
  product_name TEXT,
  product_image_url TEXT,
  engagement_score DECIMAL(5, 2) DEFAULT 0, -- Engagement metric from source
  viral_score DECIMAL(5, 2) DEFAULT 0,     -- Our calculated viral potential
  category TEXT,
  estimated_margin DECIMAL(5, 2),     -- Estimated profit margin %
  is_listed BOOLEAN DEFAULT false,    -- Has it been added to our store?
  discovery_data JSONB DEFAULT '{}',  -- Raw discovery data
  discovered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovered_products_platform ON public.discovered_products(source_platform);
CREATE INDEX IF NOT EXISTS idx_discovered_products_viral ON public.discovered_products(viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_discovered_products_cj ON public.discovered_products(cj_product_id);

-- =============================================================================
-- 9. STRIPE EVENTS TABLE (webhook audit log)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON public.stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON public.stripe_events(processed) WHERE processed = false;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Public read access for products and reviews (storefront needs this)
CREATE POLICY "Products are publicly readable" ON public.products FOR SELECT USING (status = 'active');
CREATE POLICY "Reviews are publicly readable" ON public.reviews FOR SELECT USING (status = 'approved');

-- Authenticated users can read their own orders
CREATE POLICY "Users can read own orders" ON public.orders FOR SELECT USING (auth.jwt() ->> 'email' = customer_email);

-- Service role has full access (used by n8n workflows and API routes)
CREATE POLICY "Service role full access on products" ON public.products FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on orders" ON public.orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on order_items" ON public.order_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on reviews" ON public.reviews FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on ad_performance" ON public.ad_performance FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on business_insights" ON public.business_insights FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on action_items" ON public.action_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on discovered_products" ON public.discovered_products FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on stripe_events" ON public.stripe_events FOR ALL USING (auth.role() = 'service_role');

-- Allow anyone to insert orders (checkout flow)
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create order_items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create reviews" ON public.reviews FOR INSERT WITH CHECK (true);

-- =============================================================================
-- UPDATED_AT TRIGGER (automatic timestamp updates)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- ORDER NUMBER GENERATOR
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 10001;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'SS-' || nextval('public.order_number_seq')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- REALTIME SUBSCRIPTIONS (for storefront live updates)
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;

-- =============================================================================
-- GRANT ANON ACCESS FOR STOREFRONT (read products, create orders)
-- =============================================================================
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT INSERT ON public.order_items TO anon, authenticated;
GRANT INSERT ON public.reviews TO anon, authenticated;
GRANT ALL ON public.order_number_seq TO anon, authenticated;

-- =============================================================================
-- DONE! Run 'SELECT * FROM products LIMIT 1;' to verify.
-- =============================================================================
