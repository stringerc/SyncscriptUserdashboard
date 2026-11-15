'use client';

import Link from 'next/link';

export default function PurchaseCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-16">
      <div className="text-center max-w-md">
        <svg className="w-16 h-16 mx-auto text-amber-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Checkout Cancelled</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          No problem — you weren't charged. Your cart is still waiting if you change your mind.
        </p>
        
        <div className="space-y-3">
          <Link
            href="/store"
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            ← Back to Store
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Or <Link href="/store" className="underline hover:no-underline text-primary-600 dark:text-primary-400">browse all products</Link>
          </p>
        </div>
        
        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          <p>Questions? Email <a href="mailto:chris@syncscript.io" className="underline">chris@syncscript.io</a></p>
        </div>
      </div>
    </div>
  );
}
