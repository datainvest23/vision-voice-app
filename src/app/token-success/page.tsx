'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Create a client component that uses useSearchParams
function TokenSuccess() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    async function verifySession() {
      if (!sessionId) {
        setError('No session ID provided');
        setIsVerifying(false);
        return;
      }
      
      try {
        // Call an API to verify the payment session
        const response = await fetch(`/api/verify-payment?session_id=${sessionId}`);
        
        if (!response.ok) {
          throw new Error('Failed to verify payment');
        }
        
        const data = await response.json();
        
        // If this is a token purchase, show the token count
        if (data.purchaseType === 'tokens' && data.tokenAmount) {
          setTokenCount(parseInt(data.tokenAmount, 10));
        } else {
          // For other purchase types, we can handle differently
          router.push('/my-valuations');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setError(error instanceof Error ? error.message : 'Failed to verify payment');
      } finally {
        setIsVerifying(false);
      }
    }
    
    verifySession();
  }, [sessionId, router]);

  if (isVerifying) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
        <h1 className="text-2xl font-bold mb-4">Verifying your purchase...</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Please wait while we verify your payment.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="flex justify-center mb-6 text-red-500">
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-4 text-center">Payment Verification Failed</h1>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
          {error}
        </p>
        <div className="flex justify-center">
          <Link 
            href="/buy-tokens"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
      <div className="flex justify-center mb-6 text-green-500">
        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold mb-4 text-center">Purchase Successful!</h1>
      
      {tokenCount && (
        <div className="text-center mb-8">
          <p className="text-xl mb-2">
            <span className="font-semibold">{tokenCount}</span> tokens have been added to your account
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            You can now use these tokens to create valuations.
          </p>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Link 
          href="/"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-center"
        >
          Create a Valuation
        </Link>
        <Link 
          href="/my-valuations"
          className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors text-center"
        >
          View My Valuations
        </Link>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function TokenSuccessPage() {
  return (
    <main className="container mx-auto py-16 px-4 max-w-2xl">
      <Suspense fallback={
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      }>
        <TokenSuccess />
      </Suspense>
    </main>
  );
} 