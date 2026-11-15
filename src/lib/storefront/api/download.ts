import { getProductBySlug } from '../product-catalog';

interface DownloadToken {
  productSlug: string;
  customerEmail: string;
  sessionId: string;
  expiresAt: number;
}

/**
 * Validate download token and serve ZIP file
 */
export async function handleDownload(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const productSlug = url.pathname.split('/download/')[1];
  const token = url.searchParams.get('token');
  
  if (!productSlug || !token) {
    return new Response('Invalid download link', { status: 400 });
  }
  
  // Verify token
  const payload = verifyDownloadToken(token, env.DOWNLOAD_SECRET);
  if (!payload) {
    return new Response('Invalid or expired download link', { status: 403 });
  }
  
  if (payload.productSlug !== productSlug) {
    return new Response('Token mismatch', { status: 403 });
  }
  
  if (Date.now() > payload.expiresAt) {
    return new Response('Download link has expired (7 days). Contact support for a new link.', { status: 410 });
  }
  
  const product = getProductBySlug(productSlug);
  if (!product) {
    return new Response('Product not found', { status: 404 });
  }
  
  // In production: serve from Cloudflare R2 / AWS S3 / CDN with signed URLs
  // For now, redirect to the ZIP file location
  const zipUrl = getZipUrl(productSlug, env);
  
  // Log download
  console.log(`📥 Download: ${product.name} → ${payload.customerEmail} (session: ${payload.sessionId})`);
  
  // Redirect to actual file (or stream from object storage)
  return Response.redirect(zipUrl, 302);
}

function verifyDownloadToken(token: string, secret: string): DownloadToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    
    const [dataB64, signature] = parts;
    const expectedSig = Buffer.from(`${dataB64}.${secret}`).toString('base64url').slice(0, 32);
    
    if (signature !== expectedSig) return null;
    
    const payload = JSON.parse(Buffer.from(dataB64, 'base64url').toString()) as DownloadToken;
    return payload;
  } catch {
    return null;
  }
}

function getZipUrl(productSlug: string, env: any): string {
  // Production: return signed R2/S3 URL
  // Dev: serve from local products_500 directory
  if (env.R2_BUCKET_URL) {
    return `${env.R2_BUCKET_URL}/${productSlug}.zip`;
  }
  
  // Local development - serve from generated products
  return `${env.STOREFRONT_URL}/files/${productSlug}.zip`;
}
