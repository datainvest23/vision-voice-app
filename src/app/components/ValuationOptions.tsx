'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';

interface ValuationOptionsProps {
  aiResponseContent: string;
  aiResponseSummary?: string;
  userComment?: string;
  images: string[];
  onClose: () => void;
}

interface UserStatus {
  freeValuationsLeft: number;
  tokenBalance: number;
  nextFreeValuation: number | null;
}

export default function ValuationOptions({
  aiResponseContent,
  aiResponseSummary,
  userComment,
  images,
  onClose
}: ValuationOptionsProps) {
  const [isDetailed, setIsDetailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  
  const router = useRouter();
  const { t } = useLanguage();

  // Fetch user's status (free valuations and tokens)
  useEffect(() => {
    async function fetchUserStatus() {
      try {
        setStatusLoading(true);
        const response = await fetch('/api/user-status');
        
        if (!response.ok) {
          throw new Error('Failed to fetch user status');
        }
        
        const data = await response.json();
        setUserStatus(data);
      } catch (error) {
        console.error('Error fetching user status:', error);
        setError('Could not retrieve your account status');
      } finally {
        setStatusLoading(false);
      }
    }
    
    fetchUserStatus();
  }, []);

  const handleCreateValuation = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Format data for valuation
      const valuationData = {
        title: `Antique Valuation ${new Date().toLocaleDateString()}`,
        fullDescription: aiResponseContent,
        summary: aiResponseSummary,
        userComment,
        images,
        assistantResponse: aiResponseContent,
        assistantFollowUp: '',
        isDetailed
      };
      
      // Call the save-to-supabase API which will handle monetization
      const response = await fetch('/api/save-to-supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(valuationData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check if this is a token requirement or payment requirement
        if (data.status === 'tokens_required') {
          // Redirect to token purchase page
          router.push('/buy-tokens');
          return;
        } else if (data.status === 'payment_required' && data.url) {
          // Redirect to Stripe for detailed valuation payment
          window.location.href = data.url;
          return;
        }
        
        throw new Error(data.error || 'Failed to create valuation');
      }
      
      // Success - navigate to the valuation or my-valuations page
      if (data.valuation?.id) {
        router.push(`/my-valuations/${data.valuation.id}`);
      } else {
        router.push('/my-valuations');
      }
      
    } catch (error) {
      console.error('Error creating valuation:', error);
      setError(error instanceof Error ? error.message : 'Failed to create valuation');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNextFreeTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">{t('createValuation')}</h2>
      
      {statusLoading ? (
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg mb-4">
            <h3 className="font-medium text-blue-800 dark:text-blue-200">{t('accountStatus')}</h3>
            <div className="mt-2 text-sm">
              <p>
                {userStatus?.freeValuationsLeft 
                  ? t('freeValuationAvailable') 
                  : t('freeValuationUsed')}
              </p>
              {userStatus?.nextFreeValuation && userStatus.freeValuationsLeft === 0 && (
                <p className="mt-1">
                  {t('nextFreeValuation')}: {formatNextFreeTime(userStatus.nextFreeValuation)}
                </p>
              )}
              <p className="mt-1">
                {t('tokenBalance')}: {userStatus?.tokenBalance || 0}
              </p>
            </div>
          </div>
          
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="detailed"
              checked={isDetailed}
              onChange={(e) => setIsDetailed(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="detailed" className="ml-2 block text-sm">
              {t('upgradeToDetailed')} <span className="font-medium text-emerald-600">$3</span>
            </label>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {isDetailed ? (
              <p>{t('detailedDescription')}</p>
            ) : (
              <div>
                {userStatus?.freeValuationsLeft ? (
                  <p>{t('usingFreeValuation')}</p>
                ) : userStatus?.tokenBalance ? (
                  <p>{t('usingToken')}</p>
                ) : (
                  <p className="text-amber-600">{t('needToPayOrPurchase')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      <div className="flex justify-between">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          disabled={isLoading}
        >
          {t('cancel')}
        </button>
        <button
          onClick={handleCreateValuation}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
            t('createValuation')
          )}
        </button>
      </div>
    </div>
  );
} 