'use client';

import { useState, useRef, Dispatch, SetStateAction, useEffect } from 'react';
import { AudioRecorder } from '@/app/components/AudioRecorder';
import { useLanguage } from '../context/LanguageContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import NextImage from 'next/image';

interface ImageUploadProps {
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

interface AIResponse {
  content: string;
  isComplete: boolean;
  summary?: string;
}

export default function ImageUpload({ setIsLoading }: ImageUploadProps) {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string>('');
  
  // New state for streaming audio
  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [streamAudio, setStreamAudio] = useState(true); // Default to ON
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Voice recording state
  const [transcription, setTranscription] = useState<string>('');
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Reference to file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Get translation function
  const { t, language } = useLanguage();

  // Simplified image compression function
  const compressImage = async (file: File, quality = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        // Use HTMLImageElement instead of new Image() to avoid conflicts
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
            width = width * ratio;
            height = height * ratio;
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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Helper function to split text into manageable chunks
  const splitTextIntoChunks = (text: string, maxChars = 1000) => {
    // If text is short enough, return it as is
    if (text.length <= maxChars) return [text];
    
    const chunks = [];
    let startIndex = 0;
    
    while (startIndex < text.length) {
      // Find a good breaking point (sentence ending)
      let endIndex = startIndex + maxChars;
      if (endIndex >= text.length) {
        endIndex = text.length;
      } else {
        // Try to find a sentence end
        const possibleBreak = text.substring(startIndex, endIndex).lastIndexOf('.');
        if (possibleBreak > 0) {
          endIndex = startIndex + possibleBreak + 1;
        } else {
          // If no sentence break, try to find a space
          const possibleWordBreak = text.substring(startIndex, endIndex).lastIndexOf(' ');
          if (possibleWordBreak > 0) {
            endIndex = startIndex + possibleWordBreak + 1;
          }
        }
      }
      
      chunks.push(text.substring(startIndex, endIndex));
      startIndex = endIndex;
    }
    
    return chunks;
  };

  // Process audio queue
  useEffect(() => {
    // Skip if audio is already playing or there's nothing in the queue
    if (isProcessingAudio || audioQueue.length === 0) return;
    
    let isMounted = true; // Track component mount state
    const controller = new AbortController(); // Create new controller
    
    const processNextAudio = async () => {
      try {
        if (!isMounted) return;
        setIsProcessingAudio(true);
        
        const textToProcess = audioQueue[0];
        const newQueue = audioQueue.slice(1);
        setAudioQueue(newQueue);
        
        // Check if text is valid before sending
        if (!textToProcess || textToProcess.trim() === '') {
          setIsProcessingAudio(false);
          return;
        }

        console.log('Sending text to TTS API...');
        
        // Use the controller.signal in your fetch calls
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: textToProcess }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error('Text-to-speech request failed');
        }

        const audioBlob = await response.blob();
        
        // Check if component is still mounted before proceeding
        if (!isMounted) {
          console.log('Component unmounted after fetch, aborting audio playback');
          return;
        }

        console.log('Creating audio from blob...');
        const audio = new Audio(URL.createObjectURL(audioBlob));
        currentAudioRef.current = audio;

        // Play audio and wait for it to complete
        await new Promise((resolve, reject) => {
          audio.onended = resolve;
          audio.onerror = reject;
          audio.play().catch(reject);
        });

        // Only update state if still mounted
        if (isMounted) {
          setIsProcessingAudio(false);
          currentAudioRef.current = null;
        }
      } catch (error: unknown) {
        // Type-safe error handling
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Audio processing aborted - component unmounted or cleanup triggered');
        } else {
          console.error('Audio processing error:', error);
        }
        
        // Only update state if component is still mounted
        if (isMounted) {
          setIsProcessingAudio(false);
          currentAudioRef.current = null;
        }
      }
    };
    
    processNextAudio();
    
    // Cleanup function to prevent memory leaks and state updates after unmount
    return () => {
      console.log('Audio processing useEffect cleanup triggered');
      isMounted = false;
      
      try {
        // Abort any ongoing fetch requests
        controller.abort();
        
        // Clean up any ongoing audio playback
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
    };
  }, [isProcessingAudio, audioQueue]);

  // Manually play description (used for the play button)
  const playDescription = async (text: string) => {
    // If already playing, stop the current playback
    if (isPlaying) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsPlaying(false);
      setAudioQueue([]);
      setIsProcessingAudio(false);
      return;
    }
    
    try {
      // Make sure we have text to play
      if (!text || text.trim() === '') {
        console.warn('No text provided for playback');
        return;
      }
      
      console.log(`Preparing to play audio for text (${text.length} chars)`);
      
      // Split text into chunks for better processing
      const textChunks = splitTextIntoChunks(text);
      console.log(`Text split into ${textChunks.length} chunks for TTS processing`);
      
      // Enqueue all chunks
      setAudioQueue(textChunks);
      setIsPlaying(true);
    } catch (err) {
      console.error('Speech playback error:', err);
      setError('Failed to play audio description');
    }
  };

  // Toggle streaming audio on/off
  const toggleStreamAudio = () => {
    const newStreamAudio = !streamAudio;
    setStreamAudio(newStreamAudio);
    
    // If turning off, clear any existing playback
    if (!newStreamAudio) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsPlaying(false);
      setAudioQueue([]);
      setIsProcessingAudio(false);
    } else {
      // If turning on and we have a summary, play it
      if (aiResponse?.summary) {
        console.log('Auto-playing summary audio after enabling streaming');
        playDescription(aiResponse.summary);
      }
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setIsLoading(true);
    setError('');
    setCompressionStatus('');
    
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
        let processedFile = file;
        
        // Only compress if file is over 900KB
        if (file.size > 900 * 1024) {
          try {
            setCompressionStatus(`Optimizing image ${i + 1}/${files.length}...`);
            processedFile = await compressImage(file);
            console.log(`Compressed image from ${formatFileSize(file.size)} to ${formatFileSize(processedFile.size)}`);
          } catch (compressionError) {
            console.error('Compression error:', compressionError);
            // Continue with original file if compression fails
            setError(`Image optimization failed. Using original image (${formatFileSize(file.size)}).`);
          } finally {
            setCompressionStatus('');
          }
        }
        
        const imageUrl = URL.createObjectURL(processedFile);
        newImageUrls.push(imageUrl);
        newFiles.push(processedFile);
      }
      
      setSelectedImages(newImageUrls);
      setSelectedFiles(newFiles);
      
      // Process images with AI after adding new ones
      // Always process all available images to get a comprehensive analysis
      if (newFiles.length > 0) {
        // Pass the first file as a parameter, but the function will use all files
        await processImageWithAPI(newFiles[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsLoading(false);
      setShowUploadOptions(false);
    }
  };

  // Modified API processing function to handle streaming and concurrent audio
  const processImageWithAPI = async (file: File) => {
    try {
      setIsLoading(true);
      setAiResponse({ content: '', isComplete: false });
      
      // Clear any existing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsPlaying(false);
      setAudioQueue([]);
      setIsProcessingAudio(false);
      
      const formData = new FormData();
      
      // Instead of sending a single file, send all selected files
      if (selectedFiles.length > 0) {
        // Use the existing selectedFiles array which may contain multiple images
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });
      } else {
        // Just use the new file if there are no previously selected files
        formData.append('files', file);
      }
      
      // Add language preference
      formData.append('language', language);
      
      console.log(`Sending ${selectedFiles.length || 1} image(s) for analysis...`);
      
      // Set a timeout for the API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('API request timeout triggered');
        controller.abort();
      }, 60000); // 60 second timeout for image processing
      
      try {
        // STEP 1: Send image to Assistant API
        // -----------------------------------
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
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
            
            // STEP 3: Generate summary with GPT-4o-mini
            // ----------------------------------------
            if (streamedContent && streamedContent.trim()) {
              console.log(`Generating summary for ${streamedContent.length} chars...`);
              
              // Run summarization in a separate try-catch to isolate errors
              try {
                const summarizedText = await getSummary(streamedContent);
                
                if (summarizedText && summarizedText.trim()) {
                  console.log(`Received summary (${summarizedText.length} chars)`);
                  
                  // Update state with the summary
                  setAiResponse(prev => {
                    if (!prev) return { content: streamedContent, isComplete: true, summary: summarizedText };
                    return { ...prev, summary: summarizedText };
                  });
                  
                  // STEP 4: Play the summary audio (only the summary, not the full response)
                  // ------------------------------
                  console.log("Playing summary audio...");
                  playDescription(summarizedText);
                } else {
                  console.warn("Received empty summary, will not play audio");
                }
              } catch (summaryError) {
                console.error('Error generating summary:', summaryError);
                // Don't let summary errors block the UI update
              }
            } else {
              console.warn("No content to summarize");
            }
            
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

  const handleTranscriptionComplete = (transcribedText: string) => {
    setTranscription(transcribedText);
    setIsReadyToSubmit(true);
  };

  const saveToAirtable = async () => {
    try {
      setError('');
      setIsLoading(true);

      // Save all data to Airtable
      const response = await fetch('/api/save-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: selectedFiles, // Use the already processed/compressed images
          description: aiResponse?.content,
          userComment: transcription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save to database');
      }

      setIsSubmitted(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save to database';
      setError(errorMessage);
      console.error('Save error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToAirtable = async () => {
    await saveToAirtable();
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

  // Optimized function to get summary of the AI response
  const getSummary = async (text: string): Promise<string> => {
    if (!text || text.trim().length === 0) {
      console.warn('Empty text provided for summarization');
      return '';
    }
    
    // Limit text length to avoid timeouts
    const maxTextLength = 8000; // Limit text to 8K characters for summarization
    const textToSummarize = text.length > maxTextLength 
      ? text.substring(0, maxTextLength) + '...' 
      : text;
    
    console.log(`Requesting summary for text (${textToSummarize.length} characters)`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Summary request timeout triggered');
        controller.abort();
      }, 25000); // 25 second timeout (optimized for Vercel)
      
      try {
        const response = await fetch('/api/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: textToSummarize }),
          signal: controller.signal
        });
        
        // Clear the timeout as soon as we get a response
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Summarization failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.summary || '';
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Summary request aborted due to timeout');
          return `Summary of the analysis (timed out): ${textToSummarize.substring(0, 200)}...`;
        }
        throw error; // Re-throw other errors
      } finally {
        clearTimeout(timeoutId); // Ensure timeout is cleared in all cases
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      // Provide a fallback summary
      return `Summary of the analysis: ${textToSummarize.substring(0, 200)}...`;
    }
  };

  return (
    <div className="flex flex-col items-center relative w-full">
      <style jsx>{`
        .typing-indicator {
          display: inline-block;
          position: relative;
          width: 20px;
          height: 10px;
        }
        
        .typing-indicator::before,
        .typing-indicator::after,
        .typing-indicator span {
          content: '';
          position: absolute;
          bottom: 0;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background-color: #3b82f6;
          animation: typing 1s infinite ease-in-out;
        }
        
        .typing-indicator::before {
          left: 0;
          animation-delay: 0.2s;
        }
        
        .typing-indicator span {
          left: 7px;
          animation-delay: 0.4s;
        }
        
        .typing-indicator::after {
          left: 14px;
          animation-delay: 0.6s;
        }
        
        @keyframes typing {
          0% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0); }
        }
      `}</style>
      
      {compressionStatus && (
        <div className="mb-2 text-sm text-gray-500 flex items-center">
          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {compressionStatus}
        </div>
      )}
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
            <div className="flex flex-col space-y-4">
              <div className="images-container">
                {selectedImages.map((image, index) => (
                  <div key={index} className="relative rounded-lg overflow-hidden mb-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <NextImage
                      src={image}
                      alt={`Selected ${index + 1}`}
                      width={500}
                      height={300}
                      className="mx-auto"
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

              {aiResponse && (
                <div className="card">
                  {isPlaying ? (
                    <div className="text-blue-500 flex items-center justify-center text-lg">
                      <span className="loader mr-3"></span>
                      {t('audioPlaying')}
                      <button 
                        onClick={() => playDescription('')} // Empty string to stop playback
                        className="ml-3 p-1 rounded-full bg-red-500 text-white"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => playDescription(aiResponse.content)}
                      className="play-button w-full"
                      disabled={!aiResponse.content}
                    >
                      <span className="flex items-center justify-center">
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
                        {aiResponse.isComplete ? t('playFullAnalysis') : t('processingResponse')}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="content-container">
              {aiResponse && (
                <div className="card">
                  <div className="text-container">
                    {/* Summary Section */}
                    {aiResponse.summary && (
                      <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-xl font-semibold">{t('summary')}</h2>
                          <button
                            onClick={() => playDescription(aiResponse.summary || '')}
                            className="text-blue-500 hover:text-blue-700 flex items-center text-sm"
                            disabled={isPlaying}
                          >
                            <svg 
                              className="w-4 h-4 mr-1" 
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
                            {t('playSummary')}
                          </button>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                          <div className="text-gray-800 dark:text-gray-200 italic">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {aiResponse.summary}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Full Analysis Section */}
                    <div>
                      <h2 className="text-xl font-semibold mb-4">{t('fullAnalysis')}</h2>
                      <div className="description-text text-gray-700 dark:text-gray-300">
                        {!aiResponse.isComplete && (
                          <div className="flex items-center mb-2">
                            <div className="typing-indicator mr-2">
                              <span></span>
                            </div>
                            <span className="text-sm text-blue-500">{t('processingResponse')}</span>
                          </div>
                        )}
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {aiResponse.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {aiResponse && aiResponse.isComplete && !isReadyToSubmit && !isSubmitted && (
                <div className="mt-8">
                  <AudioRecorder 
                    onTranscriptionComplete={handleTranscriptionComplete} 
                    language={language}
                  />
                </div>
              )}

              <div className="card">
                {isReadyToSubmit && !isSubmitted && (
                  <button 
                    onClick={handleSaveToAirtable} 
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-5 px-10 rounded-xl text-xl shadow-lg transform hover:scale-105 transition-transform"
                  >
                    {t('saveToDatabase')}
                  </button>
                )}

                {isSubmitted && (
                  <div className="text-center">
                    <div className="text-green-500 text-xl mb-6">{t('successfullySaved')}</div>
                    <button 
                      onClick={handleAddNew} 
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-5 px-10 rounded-xl text-xl shadow-lg transform hover:scale-105 transition-transform"
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
        <div className="fixed bottom-4 left-4 right-4 p-6 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-200 rounded-xl text-lg shadow-lg max-w-2xl mx-auto">
          {error}
        </div>
      )}

      {/* Add audio streaming toggle button */}
      {aiResponse && (
        <div className="mb-4">
          <button
            onClick={toggleStreamAudio}
            className={`text-sm px-3 py-1 rounded ${
              streamAudio 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {streamAudio ? t('streamingOn') : t('streamingOff')}
          </button>
        </div>
      )}
    </div>
  );
}




