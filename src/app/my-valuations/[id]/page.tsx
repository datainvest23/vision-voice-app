'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/app/context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import NavBar from '@/app/components/NavBar';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DetailedValuation {
  id: string;
  title: string;
  full_description: string;
  summary: string | null;
  user_comment: string | null;
  created_at: string;
  images: string[];
  assistant_response: string;
  assistant_follow_up: string | null;
}

export default function ValuationDetails() {
  const [valuation, setValuation] = useState<DetailedValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    async function fetchValuationDetails() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('valuations')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('Valuation not found');
        }

        setValuation(data as DetailedValuation);
      } catch (err) {
        console.error('Error fetching valuation details:', err);
        setError('Failed to load valuation details. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchValuationDetails();
  }, [id, user, router, supabase]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center">
        <NavBar />
        <div className="w-full p-6 pt-20 flex justify-center">
          <div className="loader"></div>
        </div>
      </main>
    );
  }

  if (error || !valuation) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center">
        <NavBar />
        <div className="w-full p-6 pt-20 max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-6 rounded-lg text-center">
            <h1 className="text-2xl font-bold mb-4">Error</h1>
            <p>{error || 'Valuation not found'}</p>
            <button 
              onClick={() => router.push('/my-valuations')}
              className="mt-6 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
            >
              Back to My Valuations
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center">
      <NavBar />
      
      <div className="w-full p-6 pt-20 max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/my-valuations')}
            className="flex items-center text-blue-500 hover:text-blue-600"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to My Valuations
          </button>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(valuation.created_at)}
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">{valuation.title}</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Images */}
          <div className="lg:col-span-1">
            {valuation.images && valuation.images.length > 0 ? (
              <div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-4">
                  <div className="relative aspect-square">
                    <Image 
                      src={valuation.images[activeImageIndex]} 
                      alt={`${valuation.title} - Image ${activeImageIndex + 1}`} 
                      fill
                      style={{ objectFit: 'contain' }}
                      className="p-2"
                    />
                  </div>
                </div>
                
                {valuation.images.length > 1 && (
                  <div className="flex overflow-x-auto gap-2 pb-2">
                    {valuation.images.map((img, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveImageIndex(index)}
                        className={`relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border-2 ${
                          index === activeImageIndex ? 'border-blue-500' : 'border-transparent'
                        }`}
                      >
                        <Image
                          src={img}
                          alt={`Thumbnail ${index + 1}`}
                          fill
                          style={{ objectFit: 'cover' }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-64 flex items-center justify-center">
                <span className="text-gray-500 dark:text-gray-400">No images available</span>
              </div>
            )}

            {/* Summary Section */}
            {valuation.summary && (
              <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-white">Summary</h2>
                <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {valuation.summary}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
          
          {/* Right column - Content */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Full Analysis</h2>
              <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({...props}) => <p className="mb-3 leading-relaxed" {...props} />,
                    ul: ({...props}) => <ul className="mb-3 pl-5 list-disc" {...props} />,
                    li: ({...props}) => <li className="mb-1 pl-1" {...props} />,
                    h1: ({...props}) => <h1 className="text-xl font-bold mb-2 mt-3" {...props} />,
                    h2: ({...props}) => <h2 className="text-lg font-bold mb-2 mt-2 border-b pb-1 border-gray-200 dark:border-gray-700" {...props} />,
                    h3: ({...props}) => <h3 className="text-md font-bold mb-1 mt-2" {...props} />,
                  }}
                >
                  {valuation.full_description}
                </ReactMarkdown>
              </div>
              
              {/* User Comment Section */}
              {valuation.user_comment && (
                <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Your Comment</h2>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="text-gray-800 dark:text-gray-200 italic">&quot;{valuation.user_comment}&quot;</p>
                  </div>
                </div>
              )}
              
              {/* Follow-up Response Section */}
              {valuation.assistant_follow_up && (
                <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Follow-up Analysis</h2>
                  <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({...props}) => <p className="mb-3 leading-relaxed" {...props} />,
                        ul: ({...props}) => <ul className="mb-3 pl-5 list-disc" {...props} />,
                        li: ({...props}) => <li className="mb-1 pl-1" {...props} />,
                        h1: ({...props}) => <h1 className="text-xl font-bold mb-2 mt-3" {...props} />,
                        h2: ({...props}) => <h2 className="text-lg font-bold mb-2 mt-2 border-b pb-1 border-gray-200 dark:border-gray-700" {...props} />,
                        h3: ({...props}) => <h3 className="text-md font-bold mb-1 mt-2" {...props} />,
                      }}
                    >
                      {valuation.assistant_follow_up}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 