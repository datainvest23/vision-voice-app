'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Valuation {
  id: string;
  title: string;
  full_description?: string;
  summary?: string;
  user_comment?: string;
  images?: string[];
  assistant_response?: string;
  assistant_follow_up?: string;
  created_at: string;
  is_detailed: boolean;
}

// Function to extract and render the structured summary from the text
const extractStructuredSummary = (text?: string) => {
  if (!text) return null;
  
  // Look for either lines starting with '- **Item Type:' or the entire Structured Summary section
  const structuredSummaryRegex = /(###\s*Structured\s*Summary(?:\s*\n(?:[-*]\s*\*\*[^:]+:\*\*[^\n]+|\s*\n)*)?|(?:[-*]\s*\*\*Item\s*Type:\*\*[^\n]+\s*\n?[-*]\s*\*\*Timeframe:\*\*[^\n]+\s*\n?[-*]\s*\*\*Artist:\*\*[^\n]+\s*\n?[-*]\s*\*\*Observations:\*\*[^\n]+\s*\n?[-*]\s*\*\*Estimated\s*Valuation:\*\*[^\n]+))/i;
  
  const summaryMatch = text.match(structuredSummaryRegex);
  
  if (summaryMatch && summaryMatch[0]) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-900/50 mb-6">
        <h3 className="text-xl font-semibold mb-3 text-amber-800 dark:text-amber-300">Structured Summary</h3>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Customize list rendering
            ul: ({children}) => <ul className="space-y-1">{children}</ul>,
            li: ({children}) => (
              <li className="flex">
                <span className="text-amber-500 mr-2">•</span>
                <span>{children}</span>
              </li>
            ),
            // Fix link rendering if needed
            a: ({href, children}) => <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
            // Optimize paragraph rendering
            p: ({children}) => <p className="my-1">{children}</p>,
          }}
        >
          {summaryMatch[0]}
        </ReactMarkdown>
      </div>
    );
  }
  
  return null;
};

export default function ValuationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const fetchValuationDetails = async () => {
      if (!params.id) return;
      
      try {
        setIsLoading(true);
        setError('');
        
        const response = await fetch(`/api/my-valuations/${params.id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Valuation not found');
          }
          throw new Error('Failed to fetch valuation details');
        }
        
        const data = await response.json();
        setValuation(data.valuation);
        
      } catch (error) {
        console.error('Error fetching valuation details:', error);
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchValuationDetails();
  }, [params.id]);

  const handleDelete = async () => {
    if (!valuation) return;
    
    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/my-valuations/${valuation.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete valuation');
      }
      
      // Redirect back to valuations list
      router.push('/my-valuations');
      
    } catch (error) {
      console.error('Error deleting valuation:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
      setShowConfirmation(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Image carousel controls
  const nextImage = () => {
    if (!valuation?.images?.length) return;
    setCurrentImage((prev) => (prev + 1) % valuation.images!.length);
  };

  const prevImage = () => {
    if (!valuation?.images?.length) return;
    setCurrentImage((prev) => (prev - 1 + valuation.images!.length) % valuation.images!.length);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg mb-8">
          {error}
        </div>
        <Link href="/my-valuations" className="text-blue-600 hover:underline">
          &larr; Back to My Valuations
        </Link>
      </div>
    );
  }

  if (!valuation) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-lg mb-8">
          Valuation couldn&apos;t be found. It may have been deleted or doesn&apos;t exist.
        </div>
        <Link href="/my-valuations" className="text-blue-600 hover:underline">
          &larr; Back to My Valuations
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Back Button */}
      <div className="mb-6">
        <Link href="/my-valuations" className="text-blue-600 hover:underline inline-flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to My Valuations
        </Link>
      </div>
      
      {/* Header and Metadata */}
      <div className="mb-6">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{valuation.title}</h1>
          
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
              valuation.is_detailed 
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200' 
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
            }`}>
              {valuation.is_detailed ? 'Detailed' : 'Standard'}
            </span>
            
            <button
              onClick={() => setShowConfirmation(true)}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formatDate(valuation.created_at)}</span>
        </div>
      </div>
      
      {/* Main Content Area - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Image gallery and Structured Summary */}
        <div className="lg:col-span-1">
          {/* Image Gallery */}
          {valuation.images && valuation.images.length > 0 ? (
            <div className="mb-8">
              <div className="relative h-64 sm:h-80 md:h-96 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {/* Main Image */}
                <Image
                  src={valuation.images[currentImage]}
                  alt={`Valuation image ${currentImage + 1}`}
                  fill
                  className="object-contain"
                />
                
                {/* Navigation Arrows for larger screens */}
                {valuation.images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 rounded-full p-2 shadow-md text-gray-800 dark:text-gray-200 opacity-75 hover:opacity-100"
                      aria-label="Previous image"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 rounded-full p-2 shadow-md text-gray-800 dark:text-gray-200 opacity-75 hover:opacity-100"
                      aria-label="Next image"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              
              {/* Thumbnail Navigation */}
              {valuation.images.length > 1 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {valuation.images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImage(index)}
                      className={`relative w-16 h-16 rounded-md overflow-hidden ${
                        currentImage === index 
                          ? 'ring-2 ring-blue-500 dark:ring-blue-400' 
                          : 'ring-1 ring-gray-200 dark:ring-gray-700'
                      }`}
                      aria-label={`View image ${index + 1}`}
                    >
                      <Image 
                        src={img} 
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-8 bg-gray-100 dark:bg-gray-800 h-64 rounded-lg flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          
          {/* Structured Summary */}
          {extractStructuredSummary(valuation.assistant_follow_up || valuation.assistant_response)}
          
          {/* User Comments Section */}
          {valuation.user_comment && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Your Comments</h3>
              <p className="text-gray-700 dark:text-gray-300">{valuation.user_comment}</p>
            </div>
          )}
        </div>
        
        {/* Right Column - Full Analysis */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Full Analysis</h2>
            
            <div className="prose prose-sm sm:prose max-w-none dark:prose-invert prose-headings:mb-2 prose-p:mb-2 prose-ul:mb-2 prose-li:mb-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {valuation.assistant_follow_up || valuation.assistant_response || ''}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Confirm Deletion</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this valuation? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Image 
                      src="/spinner.gif" 
                      alt="Loading spinner" 
                      width={16}
                      height={16}
                      className="mr-2"
                    />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 