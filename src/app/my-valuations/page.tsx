'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import Link from 'next/link';

interface Valuation {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  is_detailed: boolean;
}

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function MyValuationsPage() {
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { t } = useLanguage();

  const fetchValuations = async (page = 1) => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch(`/api/my-valuations?page=${page}&pageSize=${pagination.pageSize}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch valuations');
      }
      
      const data = await response.json();
      setValuations(data.valuations || []);
      setPagination(data.pagination || {
        total: 0,
        page,
        pageSize: pagination.pageSize,
        totalPages: 0
      });
      
    } catch (error) {
      console.error('Error fetching valuations:', error);
      setError(error instanceof Error ? error.message : 'Failed to load valuations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchValuations(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchValuations(newPage);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <main className="container mx-auto py-12 px-4 max-w-5xl">
      <h1 className="text-3xl font-bold mb-8 text-center">{t('valuationsHeading')}</h1>
      
      {isLoading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg mb-8">
          {error}
        </div>
      ) : valuations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
          <h2 className="text-xl font-semibold mb-4">{t('noValuationsYet')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Upload an image to get an expert analysis of your antique items.
          </p>
          <Link 
            href="/"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-block"
          >
            {t('createFirstValuation')}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-6">
            {valuations.map((valuation) => (
              <Link 
                key={valuation.id}
                href={`/my-valuations/${valuation.id}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-transform hover:scale-[1.01] block"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold mb-2">{valuation.title}</h2>
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-2">{valuation.summary}</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                      {t('createdOn')}: {formatDate(valuation.created_at)}
                    </p>
                  </div>
                  
                  <div className="flex items-center">
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      valuation.is_detailed 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {valuation.is_detailed ? t('detailed') : t('standard')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <nav className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
                >
                  &laquo;
                </button>
                
                {[...Array(pagination.totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handlePageChange(i + 1)}
                    className={`px-3 py-1 rounded ${
                      pagination.page === i + 1
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
                >
                  &raquo;
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </main>
  );
} 