import { NextRequest, NextResponse } from 'next/server';
import { handleDownload } from '@/lib/storefront/api/download';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  const env = {
    STOREFRONT_URL: process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000',
    DOWNLOAD_SECRET: process.env.DOWNLOAD_SECRET!,
    R2_BUCKET_URL: process.env.R2_BUCKET_URL,
  };
  
  const url = new URL(request.url);
  url.pathname = `/download/${slug}`;
  const modifiedRequest = new NextRequest(url, request);
  
  return handleDownload(modifiedRequest, env);
}
