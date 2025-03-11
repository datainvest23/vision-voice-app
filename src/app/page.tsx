"use client";

import Image from 'next/image';
import ImageUpload from './components/ImageUpload';
import LanguageSelector from './components/LanguageSelector';
import NavBar from './components/NavBar';
import { useState } from 'react';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();
  const { isLoading: authLoading } = useAuth(); // Remove 'user'

  // If auth is loading, show a loading indicator
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 
      flex flex-col items-center relative">
      
      {/* NavBar at the top */}
      <NavBar />
      
      {/* Added top padding for fixed navbar */}
      <div className="w-full p-6 pt-20">
        {/* Language Selector in top-right corner */}
        <div className="w-full max-w-[2000px] flex justify-end mb-2">
          <LanguageSelector />
        </div>
        
        <div className="w-full max-w-[2000px] space-y-6">
          {/* Logo Section */}
          <div className="flex flex-col items-center">
            <div className="w-40 h-40 relative">
              <Image 
                src="/aa_logo.png" 
                alt="Antiques Appraisal Logo" 
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>
          
          {/* Upload Section */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="p-6">
              <ImageUpload setIsLoading={setIsLoading} />
              {isLoading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center z-10 backdrop-blur-sm">
                  <div className="flex flex-col items-center">
                    <div className="loader mb-4"></div>
                    <p className="text-lg text-gray-600 dark:text-gray-300">{t('processingImage')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="w-full max-w-[2000px] mt-auto pt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Antiques Appraisal</p>
        </footer>
      </div>
    </main>
  );
}