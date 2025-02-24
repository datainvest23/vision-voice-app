"use client";

import Image from "next/image";
import ImageUpload from './components/ImageUpload';
import { useState } from 'react';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
            VisionVoice
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Upload an image and let AI describe it for you
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <ImageUpload setIsLoading={setIsLoading} />
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 flex items-center justify-center z-10">
              <div className="flex flex-col items-center">
                <div className="loader mb-4"></div>
                <p className="text-lg text-gray-600 dark:text-gray-300">Processing your image...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
