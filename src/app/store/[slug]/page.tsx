import { Metadata } from 'next';
import { getProductBySlug } from '@/lib/storefront/product-catalog';
import ProductDetail from '@/components/storefront/ProductDetail';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  
  if (!product) {
    return { title: 'Product Not Found' };
  }
  
  return {
    title: `${product.name} | SyncScript Store`,
    description: product.tagline,
    openGraph: {
      title: product.name,
      description: product.tagline,
      type: 'website',
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  
  if (!product) {
    notFound();
  }
  
  return <ProductDetail />;
}
