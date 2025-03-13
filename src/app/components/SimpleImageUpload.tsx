'use client';

// DEPRECATED: This component is no longer needed as its functionality has been consolidated 
// into the main ImageUpload.tsx component. This file can be safely deleted.
// See ImageUpload.tsx for the current implementation with image compression.

import { useState, useRef, useEffect } from 'react';
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showUploadView, setShowUploadView] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Get language from context
  const { language } = useLanguage();
  
  // Log state changes for debugging
  useEffect(() => {
    console.log("Images state updated:", images.length);
  }, [images]);
  
  useEffect(() => {
    console.log("Files state updated:", files.length);
  }, [files]);
  
  useEffect(() => {
    console.log("AI Response state updated:", !!aiResponse);
  }, [aiResponse]);
  
  useEffect(() => {
    console.log("isAnalyzing state updated:", isAnalyzing);
  }, [isAnalyzing]);
  
  useEffect(() => {
    // Update the showUploadView based on images and analyzing state
    // If we have an AI response, we should always show the analysis view
    const shouldShowUploadView = images.length === 0 && !isAnalyzing && !aiResponse;
    console.log(`Setting showUploadView to ${shouldShowUploadView}`);
    setShowUploadView(shouldShowUploadView);
  }, [images.length, isAnalyzing, aiResponse]);
  
  // Cleanup function for when component unmounts
  useEffect(() => {
    return () => {
      // Clean up object URLs to prevent memory leaks
      images.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [images]);
  
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
  
  // Image compression function
  const compressImage = async (file: File, quality = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if image is too large
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Draw image on canvas
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert canvas to Blob with quality setting
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              // Create new file from blob
              const newFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              
              resolve(newFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
    });
  };
  
  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    console.log('File input changed');
    
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) {
      console.log('No files selected');
      return;
    }
    
    console.log(`Selected ${selectedFiles.length} files`);
    setIsLoading(true);
    setError('');
    
    try {
      // Create new arrays for the state update
      const newImages = [...images];
      const newFiles = [...files];
      
      // Process each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        console.log(`Processing file: ${file.name} (${formatFileSize(file.size)})`);
        
        // Compress image if larger than 900KB
        let processedFile = file;
        if (file.size > 900 * 1024) {
          try {
            processedFile = await compressImage(file);
            console.log(`Compressed from ${formatFileSize(file.size)} to ${formatFileSize(processedFile.size)}`);
          } catch (error) {
            console.error('Compression error:', error);
            processedFile = file; // Use original on error
          }
        }
        
        // Create URL for the image
        const imageUrl = URL.createObjectURL(processedFile);
        newImages.push(imageUrl);
        newFiles.push(processedFile);
        
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
  
  // Modified to better handle state during analysis
  const processImageWithAPI = async () => {
    if (files.length === 0) {
      setError('No images to process');
      return;
    }
    
    try {
      console.log("📸 Starting image processing workflow");
      // Set analyzing state to prevent UI from resetting
      setIsAnalyzing(true);
      
      // Initialize response state 
      setAiResponse({ content: '', isComplete: false });
      
      // Show loading overlay
      setIsLoading(true);
      
      const formData = new FormData();
      
      // Add all selected files to the form data
      files.forEach((file, index) => {
        console.log(`📄 Adding file ${index + 1}/${files.length}: ${file.name} (${formatFileSize(file.size)})`);
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
        // Send image to Assistant API using the upload-image endpoint
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        console.log(`API Response received: status ${response.status}`);
        
        // Remove loading overlay as we're about to stream the response
        setIsLoading(false);
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.log(`API Error: ${response.status} ${response.statusText}`);
          // Try to parse error as JSON first
          try {
            const errorData = await response.json();
            console.log("Error data received:", errorData);
            
            // Handle auth errors specifically
            if (response.status === 401 || response.status === 403) {
              throw new Error('Authentication failed. Please sign in again.');
            }
            
            throw new Error(errorData.error || 'Failed to analyze image');
          } catch {
            // If not JSON, use text or status
            const errorText = await response.text().catch(() => 'Unknown error');
            console.log("Error text received:", errorText);
            throw new Error(errorText || `Failed with status: ${response.status}`);
          }
        }
        
        // Make sure we have a readable stream
        if (!response.body) {
          throw new Error('No response body available');
        }
        
        // Get the thread ID from the response headers
        const responseThreadId = response.headers.get('x-thread-id');
        if (responseThreadId) {
          console.log(`Thread ID received: ${responseThreadId}`);
          setThreadId(responseThreadId);
        } else {
          console.warn('No thread ID found in response headers');
        }
        
        // Process the streaming response from the Assistant
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = '';
        
        console.log('Starting to stream Assistant response...');
        
        try {
          // Manual stream processing for plain text
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('Stream complete');
              
              // Final update with complete flag
              setAiResponse(prev => {
                if (!prev) return { content: streamedContent, isComplete: true };
                return { ...prev, content: streamedContent, isComplete: true };
              });

              // Do NOT set isAnalyzing to false here - we want to keep showing the analysis view
              console.log('Stream complete, keeping analysis view visible');
              
              break;
            }
            
            // Process the chunk as plain text
            const chunk = decoder.decode(value, { stream: true });
            
            // Add the text directly to the content
            streamedContent += chunk;
            
            // Update the UI with the new content
            setAiResponse(prev => {
              if (!prev) return { content: streamedContent, isComplete: false };
              return { ...prev, content: streamedContent };
            });
          }
        } catch (streamError) {
          console.error('Error processing stream:', streamError);
          throw streamError;
        }
      } catch (error) {
        console.error('Image processing error:', error);
        setError(error instanceof Error ? error.message : 'Failed to process image');

        // Reset isAnalyzing ONLY if we don't have a valid AI response
        if (!aiResponse?.content) {
          console.log('Setting isAnalyzing to false due to error without content');
          setIsAnalyzing(false);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Image processing error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process image');

      // Reset isAnalyzing ONLY if we don't have a valid AI response
      if (!aiResponse?.content) {
        console.log('Setting isAnalyzing to false due to outer error without content');
        setIsAnalyzing(false);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to reset the state
  const handleReset = () => {
    console.log("Resetting all state...");
    
    // Clean up object URLs
    images.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    // Reset all state
    setImages([]);
    setFiles([]);
    setAiResponse(null);
    setThreadId(null);
    setError('');
    setIsAnalyzing(false);
    setShowOptions(false);
    
    // This should trigger the useEffect to show the upload view again
    console.log("Reset complete, upload view should now be visible");
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
        <div>Is Analyzing: {isAnalyzing ? 'true' : 'false'}</div>
        <div>Show Upload View: {showUploadView ? 'true' : 'false'}</div>
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
      {showUploadView ? (
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
                      disabled={isAnalyzing}
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
          
          {/* Analyze button or Reset button based on analysis state */}
          <div className="mt-8 mb-8 flex justify-center">
            {files.length > 0 && !aiResponse && !isAnalyzing ? (
              <button
                onClick={() => processImageWithAPI()}
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
            ) : (
              aiResponse?.isComplete && (
                <button
                  onClick={handleReset}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg text-lg transition-all duration-200 max-w-md transform hover:scale-105"
                  type="button"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    New Analysis
                  </div>
                </button>
              )
            )}
          </div>
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