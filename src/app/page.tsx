"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import LanguageSelector from './components/LanguageSelector';
import NavBar from './components/NavBar';
import { useAuth } from './context/AuthContext';
import ImageUpload from './components/ImageUpload';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  // const { t } = useLanguage();
  const { isLoading: authLoading } = useAuth();
  
  // Define a test mode flag
  const testMode = true;
  
  // Add console log to track re-renders
  console.log("Home component rendering");
  
  // Move useEffect here, before any conditional returns
  useEffect(() => {
    console.log('Main page component rendered');
    console.log('isLoading:', isLoading);
    console.log('testMode:', testMode);
  }, [isLoading, testMode]);

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
      <div className="w-full p-4 sm:p-6 pt-20 flex flex-col items-center">
        {/* Language Selector in top-right corner */}
        <div className="w-full max-w-[2000px] flex justify-end mb-2">
          <LanguageSelector />
        </div>
        
        <div className="w-full flex flex-col items-center">
          {/* Logo Section - Made Bigger */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-40 h-40 sm:w-56 sm:h-56 relative">
              <Image 
                src="/aa_logo.png" 
                alt="Antiques Appraisal Logo" 
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>
          
          {/* Upload Section - Allow more width for better content display */}
          <div className="w-full max-w-[1800px]">
            <ImageUpload setIsLoading={setIsLoading} externalLoading={isLoading} />
          </div>
        </div>
        
        {/* Footer */}
        <footer className="w-full max-w-[2000px] mt-8 pt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Antiques Appraisal</p>
        </footer>
      </div>
    </main>
  );
}