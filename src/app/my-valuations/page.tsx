'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import Image from 'next/image';
import Link from 'next/link';

interface Valuation {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  is_detailed: boolean;
  images?: string[];
}

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Function to extract structured summary fields from markdown text
const extractStructuredSummary = (text: string) => {
  if (!text) return null;
  
  const fields = {
    itemType: '',
    timeframe: '',
    artist: '',
    observations: '',
    estimatedValuation: ''
  };
  
  // Look for specific field patterns
  const itemTypeMatch = text.match(/\*\*Item Type:\*\*\s*([^\n]+)/i);
  const timeframeMatch = text.match(/\*\*Timeframe:\*\*\s*([^\n]+)/i);
  const artistMatch = text.match(/\*\*Artist:\*\*\s*([^\n]+)/i);
  const observationsMatch = text.match(/\*\*Observations:\*\*\s*([^\n]+)/i);
  const valuationMatch = text.match(/\*\*Estimated Valuation:\*\*\s*([^\n]+)/i);
  
  if (itemTypeMatch) fields.itemType = itemTypeMatch[1].trim();
  if (timeframeMatch) fields.timeframe = timeframeMatch[1].trim();
  if (artistMatch) fields.artist = artistMatch[1].trim();
  if (observationsMatch) fields.observations = observationsMatch[1].trim();
  if (valuationMatch) fields.estimatedValuation = valuationMatch[1].trim();
  
  return fields;
};

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
    <main className="container mx-auto py-12 px-4 max-w-6xl">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {valuations.map((valuation) => {
              // Extract structured summary if available
              const summaryData = extractStructuredSummary(valuation.summary);
              
              return (
                <Link 
                  key={valuation.id}
                  href={`/my-valuations/${valuation.id}`}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-transform hover:scale-[1.02] block group h-full"
                >
                  <div className="flex flex-col h-full">
                    {/* Card Header with Image */}
                    <div className="relative h-48 bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      {valuation.images && valuation.images[0] ? (
                        <Image 
                          src={valuation.images[0]} 
                          alt={valuation.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                          valuation.is_detailed 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/80 dark:text-purple-200' 
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200'
                        }`}>
                          {valuation.is_detailed ? t('detailed') : t('standard')}
                        </span>
                      </div>
                    </div>
                    
                    {/* Card Body */}
                    <div className="p-6 flex-1 flex flex-col">
                      <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {valuation.title}
                      </h2>
                      
                      {/* Structured Summary Section */}
                      {summaryData ? (
                        <div className="grid grid-cols-1 gap-2 mb-3">
                          {summaryData.itemType && (
                            <div className="flex items-start">
                              <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[110px]">Item Type:</span>
                              <span className="text-gray-600 dark:text-gray-400">{summaryData.itemType}</span>
                            </div>
                          )}
                          
                          {summaryData.timeframe && (
                            <div className="flex items-start">
                              <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[110px]">Timeframe:</span>
                              <span className="text-gray-600 dark:text-gray-400">{summaryData.timeframe}</span>
                            </div>
                          )}
                          
                          {summaryData.artist && (
                            <div className="flex items-start">
                              <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[110px]">Artist:</span>
                              <span className="text-gray-600 dark:text-gray-400">{summaryData.artist}</span>
                            </div>
                          )}
                          
                          {summaryData.estimatedValuation && (
                            <div className="flex items-start">
                              <span className="font-semibold text-gray-700 dark:text-gray-300 min-w-[110px]">Valuation:</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">{summaryData.estimatedValuation}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                          {valuation.summary}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-auto pt-2 text-gray-500 dark:text-gray-400 text-sm">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatDate(valuation.created_at)}</span>
                        </div>
                        
                        <span className="inline-flex items-center text-blue-600 dark:text-blue-400">
                          View details
                          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center mt-10">
              <nav className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Previous page"
                >
                  &laquo;
                </button>
                
                {[...Array(pagination.totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handlePageChange(i + 1)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      pagination.page === i + 1
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Next page"
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