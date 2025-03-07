'use client';

import { useState, useRef, Dispatch, SetStateAction } from 'react';
import { AudioRecorder } from '@/app/components/AudioRecorder';
import { useLanguage } from '../context/LanguageContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ImageUploadProps {
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

interface AIResponse {
  description: string;
  remarks: string;
}

export default function ImageUpload({ setIsLoading }: ImageUploadProps) {
  // Updated to arrays to handle multiple images
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string>('');
  
  // Voice recording state
  const [transcription, setTranscription] = useState<string>('');
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Reference to file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Get translation function
  const { t, language } = useLanguage();

  // Image compression function
  const compressImage = async (file: File, quality = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate the new dimensions to maintain aspect ratio
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round(height * (MAX_WIDTH / width));
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round(width * (MAX_HEIGHT / height));
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to JPEG with quality setting (quality parameter)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Canvas to Blob conversion failed'));
                return;
              }
              
              // Create a new filename that indicates this file has been compressed
              const originalName = file.name.split('.')[0];
              const qualityStr = Math.round(quality * 100);
              const newFileName = `compressed_${originalName}_q${qualityStr}_${Date.now()}.jpg`;
              
              // Create a new file from the blob
              const compressedFile = new File([blob], newFileName, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => {
          reject(new Error('Error loading image'));
        };
      };
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
    });
  };
  
  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const playDescription = async (text: string) => {
    try {
      setIsPlaying(true);
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.play();
    } catch (err) {
      console.error('Speech playback error:', err);
      setError('Failed to play audio description');
      setIsPlaying(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setError('');

    try {
      // Create new arrays with existing images and new images
      const newImageUrls = [...selectedImages];
      const newFiles = [...selectedFiles];

      // Process each file (up to 3 total)
      for (let i = 0; i < files.length; i++) {
        if (newFiles.length >= 3) {
          setError("Maximum of 3 images allowed");
          break;
        }

        const file = files[i];
        
        // Check file size and compress if needed
        let processedFile = file;
        if (file.size > 900 * 1024) { // If larger than ~900KB
          try {
            setCompressionStatus(`Optimizing image ${i+1}/${files.length}...`);
            processedFile = await compressImage(file);
            console.log(`Compressed image from ${Math.round(file.size/1024)}KB to ${Math.round(processedFile.size/1024)}KB`);
            setCompressionStatus('');
          } catch (compressionError) {
            console.error('Image compression error:', compressionError);
            setCompressionStatus('');
            // Continue with original file if compression fails
          }
        }
        
        const imageUrl = URL.createObjectURL(processedFile);

        newImageUrls.push(imageUrl);
        newFiles.push(processedFile);
      }

      setSelectedImages(newImageUrls);
      setSelectedFiles(newFiles);

      // If this is the first image, get AI description for it
      if (selectedFiles.length === 0 && newFiles.length > 0) {
        await processImageWithRetry(newFiles[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsLoading(false);
      setShowUploadOptions(false); // Hide options after upload
      setCompressionStatus('');
    }
  };

  // New function to process image with retry logic
  const processImageWithRetry = async (file: File, retryCount = 0) => {
    try {
      const formData = new FormData();
      
      // Determine compression quality based on file size
      let compressionQuality = 0.7; // Default quality
      
      if (file.size > 5 * 1024 * 1024) { // > 5MB
        compressionQuality = 0.5;
      } else if (file.size > 2 * 1024 * 1024) { // > 2MB
        compressionQuality = 0.6;
      }
      
      // Adjust quality based on retry count - more aggressive compression for retries
      if (retryCount > 0) {
        compressionQuality = Math.max(0.3, compressionQuality - (retryCount * 0.1));
      }
      
      // Compress image before sending if it's too large
      let processedFile = file;
      if (file.size > 900 * 1024) { // If larger than ~900KB
        try {
          setCompressionStatus('Optimizing image for AI analysis...');
          processedFile = await compressImage(file, compressionQuality);
          console.log(`Compressed image for upload from ${Math.round(file.size/1024)}KB to ${Math.round(processedFile.size/1024)}KB (quality: ${compressionQuality})`);
          setCompressionStatus('');
        } catch (compressionError) {
          console.error('Image compression error during upload:', compressionError);
          setCompressionStatus('');
          // Continue with original file if compression fails
        }
      }
      
      formData.append('file', processedFile);
      formData.append('language', language);

      // Set up timeout for fetch - abort after 120 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        
        // Check if the error is related to file size
        if (errorData.error?.includes('Body exceeded 1 MB limit') || 
            errorData.error?.includes('limit') || 
            errorData.error?.includes('too large')) {
          
          // If we've already tried aggressive compression or this is a retry
          if (retryCount >= 2 || compressionQuality <= 0.4) {
            throw new Error('Image is still too large after compression. Please try a smaller image.');
          } else {
            // Try more aggressive compression and retry
            try {
              // Use a more aggressive compression quality
              const moreCompressedFile = await compressImage(file, Math.max(0.3, compressionQuality - 0.2));
              
              console.log(`Further compressed from ${Math.round(processedFile.size/1024)}KB to ${Math.round(moreCompressedFile.size/1024)}KB with higher compression`);
              return processImageWithRetry(moreCompressedFile, retryCount + 1);
            } catch (err) {
              // If additional compression fails, just report the original error
              throw new Error('Failed to compress image sufficiently. Please try a smaller image.');
            }
          }
        }
        
        throw new Error(errorData.error || 'Failed to analyze image');
      }

      const data = await response.json();
      setAiResponse(data);

      // Automatically play description
      await playDescription(data.description + '. ' + data.remarks);
    } catch (err) {
      console.error('Image processing error:', err);

      // Check if this is a timeout or aborted request
      if (
        err instanceof Error &&
        (err.name === 'AbortError' ||
         err.message.includes('timeout') ||
         err.message.includes('taking too long'))
      ) {
        if (retryCount < 2) {  // Try up to 3 times total
          setError(`Image analysis taking longer than expected. Retrying... (${retryCount + 1}/3)`);
          // Retry with a smaller file if possible
          try {
            // Use more aggressive compression for retries
            const compressionQuality = Math.max(0.4, 0.7 - (retryCount * 0.15));
            const compressedFile = await compressImage(file, compressionQuality);
            return processImageWithRetry(compressedFile, retryCount + 1);
          } catch (compressionError) {
            // If compression fails, retry with original file
            return processImageWithRetry(file, retryCount + 1);
          }
        } else {
          setError('The image analysis is taking too long. Please try with a smaller image or try again later.');
        }
      } else if (err instanceof Error && (
          err.message.includes('Body exceeded 1 MB limit') || 
          err.message.includes('too large') ||
          err.message.includes('still too large')
        )) {
        setError('The image is too large. Please try again with a smaller image or lower resolution photo.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to process image');
      }
    }
  };

  const handleTranscriptionComplete = (transcribedText: string) => {
    setTranscription(transcribedText);
    setIsReadyToSubmit(true);
  };

  const saveToAirtable = async () => {
    try {
      setError('');
      setIsLoading(true);

      // First, upload the images and get their URLs
      const imageUrls: string[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // Compress image if needed before uploading to database
        let fileToUpload = file;
        
        // If file is larger than 900KB and not already a compressed JPEG from our earlier compression
        if (file.size > 900 * 1024 && !file.name.includes('compressed_')) {
          try {
            setCompressionStatus(`Optimizing image ${i+1}/${selectedFiles.length} for database...`);
            fileToUpload = await compressImage(file);
            console.log(`Compressed image for database upload from ${Math.round(file.size/1024)}KB to ${Math.round(fileToUpload.size/1024)}KB`);
          } catch (compressionError) {
            console.error('Image compression error for database upload:', compressionError);
            // Continue with original file if compression fails
          }
        }
        
        setCompressionStatus(`Uploading image ${i+1}/${selectedFiles.length} to database...`);
        const imageFormData = new FormData();
        imageFormData.append('file', fileToUpload);

        console.log('Uploading image...');
        const uploadResponse = await fetch('/api/upload-file', {
          method: 'POST',
          body: imageFormData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(`Failed to upload image: ${errorData.error}`);
        }

        const uploadData = await uploadResponse.json();
        imageUrls.push(uploadData.url);
        console.log('Image uploaded successfully:', uploadData.url);
      }

      // Save all data to Airtable
      const response = await fetch('/api/save-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrls, // Now an array of URLs
          description: aiResponse?.description,
          userComment: transcription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save to Airtable');
      }

      console.log('Successfully saved to Airtable');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save to Airtable';
      setError(errorMessage);
      console.error('Airtable save error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToAirtable = async () => {
    try {
      await saveToAirtable();
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to database');
    }
  };

  const handleAddNew = () => {
    // Reset all states
    setSelectedImages([]);
    setSelectedFiles([]);
    setAiResponse(null);
    setError('');
    setIsPlaying(false);
    setTranscription('');
    setIsReadyToSubmit(false);
    setIsSubmitted(false);
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prevImages => {
      const newImages = [...prevImages];
      newImages.splice(index, 1);
      return newImages;
    });
    
    setSelectedFiles(prevFiles => {
      const newFiles = [...prevFiles];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleUploadOptionClick = () => {
    setShowUploadOptions(true);
  };

  const handleTakePhoto = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleChooseFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col items-center relative w-full">
      {/* Display compression status if any */}
      {compressionStatus && (
        <div className="mb-2 text-sm text-gray-500">{compressionStatus}</div>
      )}

      {/* Hidden inputs for file and camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Initial state with upload options button or the two-option UI */}
      {selectedImages.length === 0 && (
        <div className="flex flex-col items-center justify-center w-full">
          {!showUploadOptions ? (
            <button 
              onClick={handleUploadOptionClick}
              className="upload-button"
            >
              <span className="flex items-center text-base">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('uploadButton')}
              </span>
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <button 
                onClick={handleTakePhoto} 
                className="upload-option-button bg-blue-500 hover:bg-blue-600 text-white"
              >
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('takePhoto')}
              </button>
              <button 
                onClick={handleChooseFile} 
                className="upload-option-button bg-purple-500 hover:bg-purple-600 text-white"
              >
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {t('uploadImage')}
              </button>
            </div>
          )}
          
          {selectedImages.length < 3 && selectedImages.length > 0 && (
            <div className="mt-4">
              <button 
                onClick={handleUploadOptionClick}
                className="text-blue-500 hover:text-blue-700 font-medium"
              >
                {t('addAnother')} ({3 - selectedImages.length} {t('remaining')})
              </button>
            </div>
          )}
        </div>
      )}

      {selectedImages.length > 0 && (
        <div className="w-full">
          <div className="grid-layout">
            {/* Left column - Images and Play button */}
            <div className="flex flex-col space-y-4">
              <div className="images-container">
                {selectedImages.map((image, index) => (
                  <div key={index} className="relative rounded-lg overflow-hidden mb-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image} 
                      alt={`Selected ${index + 1}`}
                      className="mx-auto" /* Center image */
                    />
                    <button
                      className="absolute top-2 right-2 bg-red-500 rounded-full p-1 text-white"
                      onClick={() => handleRemoveImage(index)}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {selectedFiles[index] && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1">
                        {selectedFiles[index].name.includes('compressed_') ? (
                          <span className="flex items-center">
                            <svg className="w-3 h-3 mr-1 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Compressed: {formatFileSize(selectedFiles[index].size)}
                          </span>
                        ) : (
                          <span>{formatFileSize(selectedFiles[index].size)}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {selectedImages.length < 3 && (
                  <button 
                    onClick={handleUploadOptionClick}
                    className="mt-4 text-blue-500 hover:text-blue-700 font-medium"
                  >
                    {t('addAnother')} ({3 - selectedImages.length} {t('remaining')})
                  </button>
                )}
              </div>

              {/* Play button below images */}
              {aiResponse && (
                <div className="card">
                  {isPlaying ? (
                    <div className="text-blue-500 flex items-center justify-center text-lg">
                      <span className="loader mr-3"></span>
                      {t('audioPlaying')}
                    </div>
                  ) : (
                    <button
                      onClick={() => playDescription(aiResponse.description + '. ' + aiResponse.remarks)}
                      className="play-button w-full"
                    >
                      <span className="flex items-center justify-center">
                        {/* Play icon */}
                        <svg 
                          className="w-5 h-5 mr-2" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {t('description')}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right column - Content */}
            <div className="content-container">
              {aiResponse && (
                <div className="card">
                  <div className="text-container">
                    <div>
                      <div className="description-text text-gray-700 dark:text-gray-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {aiResponse.description}
                        </ReactMarkdown>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-2xl font-semibold mb-6">{t('aiRemarks')}</h2>
                      <div className="description-text text-gray-600 dark:text-gray-400 italic">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {aiResponse.remarks}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recording Section - Simplified */}
              <div className="card">
                <div className="flex justify-center">
                  <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />
                </div>
                
                {transcription && (
                  <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="description-text italic text-gray-600 dark:text-gray-400">
                      {transcription}
                    </p>
                  </div>
                )}
              </div>

              {/* Submit and Success States */}
              <div className="card">
                {isReadyToSubmit && !isSubmitted && (
                  <button 
                    onClick={handleSaveToAirtable} 
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-5 px-10 
                      rounded-xl text-xl shadow-lg transform hover:scale-105 transition-transform"
                  >
                    {t('saveToDatabase')}
                  </button>
                )}

                {isSubmitted && (
                  <div className="text-center">
                    <div className="text-green-500 text-xl mb-6">{t('successfullySaved')}</div>
                    <button 
                      onClick={handleAddNew} 
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-5 px-10 
                        rounded-xl text-xl shadow-lg transform hover:scale-105 transition-transform"
                    >
                      {t('addNewImage')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 left-4 right-4 p-6 bg-red-50 dark:bg-red-900/50 
          text-red-600 dark:text-red-200 rounded-xl text-lg shadow-lg max-w-2xl mx-auto">
          {error}
        </div>
      )}
    </div>
  );
}
