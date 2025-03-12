"use client";

import Image from 'next/image';
import ImageUpload from './components/ImageUpload';
import LanguageSelector from './components/LanguageSelector';
import NavBar from './components/NavBar';
import { useState } from 'react';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import SimpleImageUpload from './components/SimpleImageUpload';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();
  const { isLoading: authLoading } = useAuth(); // Remove 'user'

  // Add console log to track re-renders
  console.log("Home component rendering");

  // If auth is loading, show a loading indicator
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader"></div>
      </div>
    );
  }

  // Define a test mode flag
  const testMode = true;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 
      flex flex-col items-center relative">
      
      {/* NavBar at the top */}
      <NavBar />
      
      {/* Added top padding for fixed navbar */}
      <div className="w-full p-6 pt-20 flex flex-col items-center">
        {/* Language Selector in top-right corner */}
        <div className="w-full max-w-[2000px] flex justify-end mb-2">
          <LanguageSelector />
        </div>
        
        <div className="w-full max-w-[2000px] flex flex-col items-center space-y-10">
          {/* Logo Section - Made Bigger */}
          <div className="flex flex-col items-center">
            <div className="w-56 h-56 relative">
              <Image 
                src="/aa_logo.png" 
                alt="Antiques Appraisal Logo" 
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>
          
          {/* Upload Section - Removed frame/border and simplified to just the component */}
          <div className="w-full max-w-lg">
            {isLoading ? (
              <div className="p-8 bg-white/80 dark:bg-gray-800/80 rounded-xl shadow-lg flex flex-col items-center justify-center z-10 backdrop-blur-sm">
                <div className="loader mb-4"></div>
                <p className="text-lg text-gray-600 dark:text-gray-300">{t('processingImage')}</p>
              </div>
            ) : (
              testMode ? <SimpleImageUpload setIsLoading={setIsLoading} /> : <ImageUpload setIsLoading={setIsLoading} />
            )}
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