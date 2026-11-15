'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function PurchaseSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [product, setProduct] = useState<{ name: string; downloadUrl: string } | null>(null);
  
  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }
    
    // In production, call API to verify session and get download URL
    // For now, simulate success after short delay
    const timer = setTimeout(() => {
      setStatus('success');
      setProduct({
        name: 'Your Product Pack',
        downloadUrl: `/api/download/your-product-slug?token=...`
      });
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [sessionId]);
  
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Verifying your purchase...</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">This will just take a moment</p>
        </div>
      </div>
    );
  }
  
  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Unable to Verify Purchase</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We couldn't verify your checkout session. Please contact support with your session ID.
          </p>
          <Link href="/store" className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
            ← Back to Store
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Purchase Complete!</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Thanks for your purchase! You should receive an email with your download link shortly.
        </p>
        
        {product && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{product.name}</h3>
            <a
              href={product.downloadUrl}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Download Now
            </a>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Or check your email for a link that expires in 7 days.</p>
          </div>
        )}
        
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <p>📧 Check your email for the download link</p>
          <p>⏰ Link expires in 7 days</p>
          <p>🛡️ 30-day money-back guarantee</p>
        </div>
        
        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Link href="/store" className="text-primary-600 hover:text-primary-700 font-medium">
            ← Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
