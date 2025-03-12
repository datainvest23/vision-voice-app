'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';

export default function BuyTokensPage() {
  const [selectedAmount, setSelectedAmount] = useState<5 | 10>(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const { t } = useLanguage();

  const handlePurchase = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch('/api/buy-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: selectedAmount
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process purchase');
      }
      
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL provided');
      }
      
    } catch (error) {
      console.error('Token purchase error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process purchase');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container mx-auto py-12 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">{t('buyTokens')}</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-lg mb-6">{t('buyTokensDescription')}</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* 5 Tokens Package */}
          <div 
            className={`border-2 rounded-lg p-6 cursor-pointer transition-colors ${
              selectedAmount === 5 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => setSelectedAmount(5)}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{t('tokenPackage5')}</h2>
              <span className="text-2xl font-bold text-emerald-600">{t('priceTokens5')}</span>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Perfect for occasional valuations.
            </p>
          </div>
          
          {/* 10 Tokens Package */}
          <div 
            className={`border-2 rounded-lg p-6 cursor-pointer transition-colors relative ${
              selectedAmount === 10 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => setSelectedAmount(10)}
          >
            {/* Best Value badge */}
            <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-2">
              <span className="bg-emerald-500 text-white text-xs uppercase font-semibold px-2 py-1 rounded-full">
                {t('bestValue')}
              </span>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{t('tokenPackage10')}</h2>
              <span className="text-2xl font-bold text-emerald-600">{t('priceTokens10')}</span>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Save 10% with our most popular package.
            </p>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}
        
        <div className="flex justify-between">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={isLoading}
          >
            {t('cancel')}
          </button>
          <button
            onClick={handlePurchase}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t('processing')}
              </span>
            ) : (
              t('purchase')
            )}
          </button>
        </div>
      </div>
    </main>
  );
} 