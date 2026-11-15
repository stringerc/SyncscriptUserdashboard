import Stripe from 'stripe';
import { getProductBySlug } from '../product-catalog';

/**
 * Stripe webhook handler for checkout.session.completed
 * Fulfills digital download by sending email with signed download link
 */
export async function handleStripeWebhook(request: Request, env: any): Promise<Response> {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }
  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
  
  // Handle checkout.session.completed for one-time purchases
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    if (session.mode === 'payment' && session.payment_status === 'paid') {
      await fulfillDigitalDownload(session, env);
    }
  }
  
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

async function fulfillDigitalDownload(session: Stripe.Checkout.Session, env: any) {
  const productSlug = session.metadata?.product_slug;
  const customerEmail = session.customer_details?.email || session.metadata?.customer_email;
  
  if (!productSlug || !customerEmail) {
    console.error('Missing product_slug or customer_email in session:', session.id);
    return;
  }
  
  const product = getProductBySlug(productSlug);
  if (!product) {
    console.error(`Product not found: ${productSlug}`);
    return;
  }
  
  // Generate signed download URL (expires in 7 days for customer convenience)
  const downloadToken = generateSignedToken({
    productSlug,
    customerEmail,
    sessionId: session.id,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  }, env.DOWNLOAD_SECRET);
  
  const downloadUrl = `${env.STOREFRONT_URL}/download/${productSlug}?token=${downloadToken}`;
  
  // Send fulfillment email
  await sendFulfillmentEmail({
    to: customerEmail,
    productName: product.name,
    productTagline: product.tagline,
    downloadUrl,
    scriptCount: product.script_count,
    supportEmail: product.support_email,
    refundPolicy: product.refund_policy,
  }, env);
  
  // Log fulfillment
  console.log(`✅ Fulfilled: ${product.name} → ${customerEmail} (session: ${session.id})`);
}

function generateSignedToken(payload: any, secret: string): string {
  // In production, use proper JWT or HMAC signing
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from(`${data}.${secret}`).toString('base64url').slice(0, 32);
  return `${data}.${signature}`;
}

async function sendFulfillmentEmail(data: {
  to: string;
  productName: string;
  productTagline: string;
  downloadUrl: string;
  scriptCount: number;
  supportEmail: string;
  refundPolicy: string;
}, env: any) {
  // Use your email provider (SendGrid, Resend, Postmark, etc.)
  // For now, log the email content
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  DIGITAL DOWNLOAD FULFILLMENT EMAIL                        ║
╠═══════════════════════════════════════════════════════════╣
║ To: ${data.to.padEnd(50)} ║
║ Subject: Your ${data.productName} is ready!                ║
║                                                              ║
║  Hi there,                                                  ║
║                                                              ║
║  Thanks for your purchase of **${data.productName}**!      ║
║  ${data.productTagline}                                      ║
║                                                              ║
║  📦 Your download: ${data.downloadUrl}                     ║
║  📊 Contains: ${data.scriptCount} production-ready scripts  ║
║  ⏰ Link expires: 7 days                                    ║
║                                                              ║
║  Need help? Reply to this email or contact                  ║
║  ${data.supportEmail}                                        ║
║                                                              ║
║  ${data.refundPolicy}                                       ║
║                                                              ║
║  — The SyncScript Team                                      ║
╚═══════════════════════════════════════════════════════════╝
  `);
  
  // TODO: Integrate with actual email service
  // await sendEmailViaProvider(data.to, subject, html);
}
