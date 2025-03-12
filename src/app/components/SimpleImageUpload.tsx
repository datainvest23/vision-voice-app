'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useLanguage } from '../context/LanguageContext';

interface SimpleImageUploadProps {
  setIsLoading: (loading: boolean) => void;
}

interface AIResponse {
  content: string;
  isComplete: boolean;
  summary?: string;
}

export default function SimpleImageUpload({ setIsLoading }: SimpleImageUploadProps) {
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState('');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Get language from context
  const { language } = useLanguage();
  
  const handleUploadClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowOptions(true);
  };
  
  const handleFileSelect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleCameraSelect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    console.log('File input changed');
    
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) {
      console.log('No files selected');
      return;
    }
    
    console.log(`Selected ${selectedFiles.length} files`);
    setIsLoading(true);
    
    try {
      // Create new arrays for the state update
      const newImages = [...images];
      const newFiles = [...files];
      
      // Process each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Create URL for the image
        const imageUrl = URL.createObjectURL(file);
        newImages.push(imageUrl);
        newFiles.push(file);
        
        console.log(`Added image: ${imageUrl}`);
      }
      
      // Update state
      setImages(newImages);
      setFiles(newFiles);
      
      // Reset options
      setShowOptions(false);
      
      // Reset file input
      if (e.target) {
        e.target.value = '';
      }
      
    } catch (err) {
      console.error('Error processing files:', err);
      setError('Failed to process files');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      // Release the object URL
      URL.revokeObjectURL(newImages[index]);
      newImages.splice(index, 1);
      return newImages;
    });
    
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };
  
  // This matches the original component's processImageWithAPI function
  const processImageWithAPI = async () => {
    if (files.length === 0) {
      setError('No images to process');
      return;
    }
    
    try {
      // Initialize state but don't show full loading overlay during streaming
      setAiResponse({ content: '', isComplete: false });
      
      // Show loading only during initial API setup
      setIsLoading(true);
      
      const formData = new FormData();
      
      // Instead of sending a single file, send all selected files
      files.forEach(file => {
        formData.append('files', file);
      });
      
      // Add language preference
      formData.append('language', language || 'en');
      
      console.log(`Sending ${files.length} image(s) for analysis...`);
      
      // Set a timeout for the API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('API request timeout triggered');
        controller.abort();
      }, 60000); // 60 second timeout
      
      try {
        // STEP 1: Send image to Assistant API
        // -----------------------------------
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        // Remove loading overlay as we're about to stream the response
        setIsLoading(false);
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Try to parse error as JSON first
          try {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to analyze image');
          } catch {
            // If not JSON, use text or status
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(errorText || `Failed with status: ${response.status}`);
          }
        }
        
        // Get the thread ID from the response headers
        const responseThreadId = response.headers.get('x-thread-id');
        if (responseThreadId) {
          console.log(`Thread ID received: ${responseThreadId}`);
          setThreadId(responseThreadId);
        }
        
        // Make sure we have a readable stream
        if (!response.body) {
          throw new Error('No response body available');
        }
        
        // STEP 2: Process the streaming response from the Assistant
        // --------------------------------------------------------
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = '';
        
        console.log('Starting to stream Assistant response...');
        
        // Manual stream processing
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('Stream complete');
            
            // Final update with complete flag
            setAiResponse(prev => {
              if (!prev) return { content: streamedContent, isComplete: true };
              return { ...prev, content: streamedContent, isComplete: true };
            });
            break;
          }
          
          // Process the chunk
          const chunk = decoder.decode(value, { stream: true });
          streamedContent += chunk;
          
          // Update the UI with the new content
          setAiResponse(prev => {
            if (!prev) return { content: streamedContent, isComplete: false };
            return { ...prev, content: streamedContent };
          });
        }
      } catch (streamError) {
        if (streamError instanceof Error && streamError.name === 'AbortError') {
          console.log('Request aborted due to timeout');
          throw new Error('Analysis timed out. Please try again with a clearer image.');
        }
        throw streamError;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Image processing error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center w-full">
      {/* Debug info */}
      <div className="bg-gray-100 p-2 mb-4 w-full text-xs">
        <div>Images count: {images.length}</div>
        <div>Files count: {files.length}</div>
        <div>Show options: {showOptions ? 'true' : 'false'}</div>
        <div>Has AI response: {aiResponse ? 'true' : 'false'}</div>
        <div>Thread ID: {threadId || 'none'}</div>
      </div>
      
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {/* Main content based on state */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center w-full">
          {!showOptions ? (
            <button
              onClick={handleUploadClick}
              type="button"
              className="upload-button-home"
            >
              <span className="flex items-center text-xl">
                <svg className="w-7 h-7 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upload Image or Take Photo
              </span>
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <button 
                onClick={handleCameraSelect} 
                className="upload-option-button-home bg-blue-500 hover:bg-blue-600 text-white"
                type="button"
              >
                <svg className="w-7 h-7 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-lg">Take Photo</span>
              </button>
              <button 
                onClick={handleFileSelect} 
                className="upload-option-button-home bg-purple-500 hover:bg-purple-600 text-white"
                type="button"
              >
                <svg className="w-7 h-7 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-lg">Upload Image</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full">
          {/* Grid layout matching the original component */}
          <div className="grid-layout">
            <div className="flex flex-col space-y-4">
              <div className="images-container">
                {/* Image thumbnails */}
                {images.map((imageUrl, index) => (
                  <div key={index} className="image-container relative">
                    <Image 
                      src={imageUrl} 
                      alt={`Selected ${index + 1}`} 
                      width={200}
                      height={120}
                      className="selected-image"
                      style={{ objectFit: 'contain', maxHeight: '120px' }}
                    />
                    <button 
                      className="absolute top-1 right-1 bg-red-500 rounded-full p-1 text-white"
                      onClick={() => handleRemoveImage(index)}
                      type="button"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="content-container">
              {/* AI response display */}
              {aiResponse && (
                <div className="card">
                  <div className="text-container">
                    {/* Full Analysis Section */}
                    <div>
                      <h2 className="text-xl font-semibold mb-3">Analysis</h2>
                      <div className="description-text text-gray-700 dark:text-gray-300">
                        {!aiResponse.isComplete && (
                          <div className="flex items-center mb-2">
                            <div className="mr-2 flex space-x-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                            <span className="text-sm text-blue-500">Processing response...</span>
                          </div>
                        )}
                        <div className="prose prose-sm max-w-none border border-gray-100 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/50">
                          {aiResponse.content}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Analyze button - matches the original layout */}
          {files.length > 0 && !aiResponse && (
            <div className="mt-8 mb-8 flex justify-center">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  processImageWithAPI();
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-5 px-12 rounded-lg shadow-lg text-xl transition-all duration-200 max-w-md w-full transform hover:scale-105"
                type="button"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-7 h-7 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Analyze Images
                </div>
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Error display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
} 