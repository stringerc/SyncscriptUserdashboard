# SyncScript Storefront — Deployment Checklist

## ✅ Completed (Code Ready)

### Product Catalog (500 products)
- [x] `generated-catalog.ts` — 500 products from `generation_summary_500.json`
- [x] `product-catalog.ts` — Query functions, tier definitions, search, stats
- [x] Tier breakdown: 140×$27, 108×$37, 117×$47, 45×$37, 90×$27

### Stripe Integration (One-time Purchases)
- [x] `stripe-create-products.mjs` — Creates 500 Stripe Products + Prices
- [x] `api/checkout/route.ts` — Creates Checkout Sessions
- [x] `api/webhook/route.ts` — Handles `checkout.session.completed`
- [x] Fulfillment: Generates signed download tokens (7-day expiry)

### Download Delivery
- [x] `api/download/[slug]/route.ts` — Validates tokens, redirects to R2
- [x] `r2-upload.mjs` — Uploads all 500 ZIPs to Cloudflare R2

### Gumroad (Discoverability)
- [x] `gumroad-upload.mjs` — Browser automation (10/day limit)
- [x] `GUMROAD_UPLOAD_LOG.md` — Tracks uploaded products

### Storefront UI (Next.js App Router)
- [x] `/store` — Landing page with hero, tier cards, featured products
- [x] `/store/all` — Full catalog with tier filter, search, grid/list view
- [x] `/store/[slug]` — Product detail with specs, categories, purchase CTA
- [x] `/checkout?product=...` — Redirects to Stripe Checkout
- [x] `/purchase/success` — Verifies session, shows download link
- [x] `/purchase/cancel` — Friendly cancellation page

### Components
- [x] `ProductCard` — Tier badge, stats, tags, price, buy button
- [x] `ProductGrid` — Tier tabs, search, view toggle, pagination ready
- [x] `ProductDetail` — Full spec sheet, requirements, guarantee, sidebar

---

## 🔧 Required Configuration (Before Deploy)

### 1. Stripe Dashboard
- [ ] Create Stripe account at https://dashboard.stripe.com
- [ ] Get `STRIPE_SECRET_KEY` (sk_test_... or sk_live_...)
- [ ] Get `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_... or pk_live_...)
- [ ] Run `stripe listen --forward-to localhost:3000/api/webhook` for local dev
- [ ] Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`
- [ ] **Enable "One-time payments" in Stripe settings**

### 2. Cloudflare R2 (File Hosting)
- [ ] Create R2 bucket at https://dash.cloudflare.com/r2
- [ ] Get `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- [ ] Set bucket to public or configure custom domain
- [ ] Note `R2_BUCKET_URL` (e.g., `https://pub-xxx.r2.dev`)

### 3. Environment Variables
Copy `.env.storefront.example` → `.env.local` and fill:
```bash
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STOREFRONT_URL=https://store.syncscript.io
DOWNLOAD_SECRET=$(openssl rand -base64 32)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=syncscript-products
R2_BUCKET_URL=https://pub-xxx.r2.dev
```

### 4. Email (Fulfillment)
- [ ] Sign up for Resend (recommended) or SendGrid
- [ ] Add `RESEND_API_KEY` or `SENDGRID_API_KEY`
- [ ] Verify `FROM_EMAIL` domain
- [ ] Update `sendFulfillmentEmail` in `webhook.ts` to use real provider

---

## 🚀 Deployment Steps

### Local Development
```bash
# 1. Install dependencies
cd /Users/Apple/syncscript
npm install stripe @aws-sdk/client-s3 puppeteer

# 2. Set env vars
cp .env.storefront.example .env.local
# Edit .env.local with your values

# 3. Create Stripe products (one-time)
STRIPE_SECRET_KEY=sk_test_... node src/lib/storefront/stripe-create-products.mjs

# 4. Upload ZIPs to R2
node src/lib/storefront/r2-upload.mjs

# 5. Start dev server
npm run dev
# Visit http://localhost:3000/store

# 6. Test checkout
# - Go to product page, click "Buy Now"
# - Complete with Stripe test card (4242 4242 4242 4242)
# - Verify webhook fires, download link works
```

### Production Deploy (Vercel)
```bash
# 1. Push to GitHub
git add .
git commit -m "Storefront: 500 products, Stripe checkout, R2 downloads"
git push

# 2. Import to Vercel
# - Connect repo at https://vercel.com/new
# - Add all env vars from .env.local
# - Deploy

# 3. Configure Stripe webhook for production
stripe listen --forward-to https://store.syncscript.io/api/webhook
# Copy new webhook secret to Vercel env vars

# 4. Run Stripe product creation against live key
STRIPE_SECRET_KEY=sk_live_... node src/lib/storefront/stripe-create-products.mjs

# 5. Upload ZIPs to R2 (if not done)
node src/lib/storefront/r2-upload.mjs
```

### Gumroad Discoverability (Ongoing)
```bash
# Daily batch (10 products/day limit)
GUMROAD_EMAIL=thecsholdinggroup@gmail.com \
GUMROAD_PASSWORD=@Sup3rDup3rChris1991 \
node src/lib/storefront/gumroad-upload.mjs

# Schedule via cron: 0 10 * * * /path/to/upload.sh
# 50 days to upload all 500 products
```

---

## 📊 Revenue Projections

| Tier | Products | Price | Monthly (1 sale/day each) |
|------|----------|-------|---------------------------|
| Deep Dives | 140 | $27 | $3,780 |
| Role Bundles | 108 | $37 | $3,996 |
| Vertical Packs | 117 | $47 | $5,499 |
| Cloud Specs | 45 | $37 | $1,665 |
| Tool Packs | 90 | $27 | $2,430 |
| **Total** | **500** | **avg $35** | **~$17,370/mo** |

**Gumroad**: Same catalog, 10/day upload = 50 days to full catalog
**Storefront**: All 500 live immediately after Stripe sync + R2 upload

---

## 🔒 Security Checklist

- [ ] `DOWNLOAD_SECRET` is 32+ random bytes (not committed)
- [ ] `STRIPE_SECRET_KEY` only in server env (never client)
- [ ] Webhook signature verification enabled
- [ ] Download tokens expire (7 days implemented)
- [ ] Rate limiting on checkout/download endpoints
- [ ] CORS configured for storefront domain only
- [ ] HTTPS enforced (Vercel default)

---

## 📝 Post-Launch

- [ ] Monitor Stripe Dashboard for payments
- [ ] Check webhook delivery logs
- [ ] Verify download analytics (R2 logs)
- [ ] Set up Gumroad upload cron
- [ ] Add analytics (Plausible/GA)
- [ ] A/B test pricing/tier presentation
- [ ] Collect customer emails for updates
