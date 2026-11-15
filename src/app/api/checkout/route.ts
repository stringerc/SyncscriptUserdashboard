import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/storefront/api/checkout';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const productSlug = searchParams.get('product');
  const email = searchParams.get('email');
  
  if (!productSlug) {
    return NextResponse.json({ error: 'Product slug required' }, { status: 400 });
  }
  
  try {
    const { url, sessionId } = await createCheckoutSession(productSlug, email || undefined);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
