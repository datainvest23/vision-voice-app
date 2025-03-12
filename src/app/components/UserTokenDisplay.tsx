'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLanguage } from '../context/LanguageContext';

interface UserTokenDisplayProps {
  className?: string;
}

export default function UserTokenDisplay({ className = '' }: UserTokenDisplayProps) {
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { t } = useLanguage();

  useEffect(() => {
    async function fetchTokenBalance() {
      try {
        setIsLoading(true);
        
        const response = await fetch('/api/user-status');
        
        if (!response.ok) {
          throw new Error('Failed to fetch token balance');
        }
        
        const data = await response.json();
        setTokenBalance(data.tokenBalance);
      } catch (error) {
        console.error('Error fetching token balance:', error);
        setError('Failed to load token balance');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchTokenBalance();
    
    // Refetch every 5 minutes or when the component is mounted
    const intervalId = setInterval(fetchTokenBalance, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-5 w-20 rounded"></div>
      </div>
    );
  }

  if (error || tokenBalance === null) {
    return (
      <div className={`flex items-center text-gray-600 dark:text-gray-400 ${className}`}>
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm">Error</span>
      </div>
    );
  }

  return (
    <Link 
      href="/buy-tokens"
      className={`flex items-center group ${className}`}
    >
      <div className="flex items-center space-x-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-full">
        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{tokenBalance}</span>
      </div>
      <span className="ml-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 dark:text-gray-400">
        {t('buyTokens')} +
      </span>
    </Link>
  );
} 