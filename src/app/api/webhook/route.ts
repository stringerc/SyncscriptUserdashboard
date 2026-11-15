import { NextRequest, NextResponse } from 'next/server';
import { handleStripeWebhook } from '@/lib/storefront/api/webhook';

export async function POST(request: NextRequest) {
  const env = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY!,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET!,
    STOREFRONT_URL: process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000',
    DOWNLOAD_SECRET: process.env.DOWNLOAD_SECRET!,
  };
  
  return handleStripeWebhook(request, env);
}
