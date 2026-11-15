import { getProductBySlug } from '../product-catalog';

/**
 * Create Stripe Checkout Session for one-time product purchase
 * Returns session URL for redirect
 */
export async function createCheckoutSession(productSlug: string, customerEmail?: string): Promise<{ url: string; sessionId: string }> {
  const product = getProductBySlug(productSlug);
  if (!product) {
    throw new Error(`Product not found: ${productSlug}`);
  }
  if (!product.stripe_price_id) {
    throw new Error(`Product not synced to Stripe: ${productSlug}`);
  }
  
  const stripe = getStripeClient();
  
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: product.stripe_price_id,
        quantity: 1,
      },
    ],
    success_url: `${process.env.STOREFRONT_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.STOREFRONT_URL}/purchase/cancel`,
    customer_email: customerEmail,
    metadata: {
      product_slug: productSlug,
      product_id: product.id,
      type: 'digital_download',
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 min
  });
  
  return { url: session.url!, sessionId: session.id };
}

/**
 * Verify checkout session and return product for fulfillment
 */
export async function verifyCheckoutSession(sessionId: string): Promise<{ product: any; customerEmail: string } | null> {
  const stripe = getStripeClient();
  
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'customer'],
  });
  
  if (session.payment_status !== 'paid') {
    return null;
  }
  
  const productSlug = session.metadata?.product_slug;
  if (!productSlug) {
    throw new Error('No product_slug in session metadata');
  }
  
  const product = getProductBySlug(productSlug);
  if (!product) {
    throw new Error(`Product not found: ${productSlug}`);
  }
  
  const customerEmail = session.customer_details?.email || session.metadata?.customer_email;
  if (!customerEmail) {
    throw new Error('No customer email in session');
  }
  
  return { product, customerEmail };
}

/**
 * Generate signed download URL (expires in 24h)
 */
export function generateDownloadUrl(productSlug: string, customerEmail: string): string {
  // In production, use signed URLs with Cloudflare R2 / AWS S3
  // For now, return a tokenized URL that the download endpoint validates
  const token = Buffer.from(`${productSlug}:${customerEmail}:${Date.now() + 24*60*60*1000}`).toString('base64url');
  return `${process.env.STOREFRONT_URL}/download/${productSlug}?token=${token}`;
}

function getStripeClient() {
  const Stripe = require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-06-20',
  });
}
