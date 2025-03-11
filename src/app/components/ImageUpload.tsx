/* eslint-disable @typescript-eslint/no-unused-vars */
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
  
  // Used in UI conditionals, keeping for future audio functionality
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string>('');
  
  // Audio state - keeping for future use
  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [streamAudio, setStreamAudio] = useState(true); // Default to ON
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Voice recording state
  const [transcription, setTranscription] = useState<string>('');
  const [isReadyToSubmit, setIsReadyToSubmit] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Thread management
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);

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
          throw new Error(`Text-to-speech request failed with status: ${response.status}`);
        }

        const audioBlob = await response.blob();
        
        // Check if component is still mounted before proceeding
        if (!isMounted) {
          console.log('Component unmounted after fetch, aborting audio playback');
          return;
        }

        console.log('Creating audio from blob...');
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        // Debug audio data
        console.log(`Audio blob type: ${audioBlob.type}, size: ${audioBlob.size} bytes`);
        
        // Add error handler
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          if (isMounted) {
            setError('Failed to play audio. Please try again.');
            setIsProcessingAudio(false);
          }
        };
        
        // Add ended handler
        audio.onended = () => {
          console.log('Audio playback completed');
          if (isMounted) {
            setIsProcessingAudio(false);
            currentAudioRef.current = null;
            
            // Revoke the URL to prevent memory leaks
            URL.revokeObjectURL(audioUrl);
            
            // Process next item in queue if any
            if (newQueue.length > 0) {
              setTimeout(() => {
                setAudioQueue(newQueue);
              }, 100);
            } else {
              setIsPlaying(false);
            }
          }
        };
        
        console.log('Starting audio playback...');
        try {
          await audio.play();
          console.log('Audio playback started successfully');
        } catch (playError) {
          console.error('Failed to start audio playback:', playError);
          throw playError;
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
          setError('Audio playback failed. Please try again.');
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
  const playDescription = async (_: string) => {
    console.log("Audio playback functionality disabled as requested");
    // Implementation removed to disable audio playback
    return;
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
      
      // Don't automatically process images with API after upload
      // Let the user decide when to analyze after they've added all desired images
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
      // Initialize state but don't show full loading overlay during streaming
      setAiResponse({ content: '', isComplete: false });
      
      // Show loading only during initial API setup
      setIsLoading(true);
      
      // Clear any existing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsPlaying(false);
      setAudioQueue([]);
      setIsProcessingAudio(false);
      
      // Reset thread state
      setThreadId(null);
      
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
                  
                  // STEP 4: Play the summary audio (DISABLED)
                  // ------------------------------
                  console.log("Audio playback disabled as requested");
                  // playDescription(summarizedText); // Commented out to disable audio
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
    // Instead of just preparing for Airtable, send the comment back to the Assistant
    if (transcribedText.trim() && threadId) {
      sendUserCommentToAssistant(transcribedText);
    } else if (!threadId) {
      setError('No active conversation thread found');
    } else {
      setError('No transcription text to send');
    }
  };

  // New function to send user comment to Assistant
  const sendUserCommentToAssistant = async (userComment: string) => {
    if (!threadId) {
      setError('No thread ID available');
      return;
    }

    try {
      setIsAwaitingResponse(true);
      
      // Create request body
      const requestBody = {
        threadId,
        message: userComment,
        language
      };
      
      // Send the request to add the user message to the thread
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        // Handle error
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(errorText || `Failed with status: ${response.status}`);
      }
      
      // Process the streaming response
      if (!response.body) {
        throw new Error('No response body available');
      }
      
      // Stream the assistant's response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';
      
      console.log('Starting to stream Assistant response to user comment...');
      
      // Manual stream processing, similar to the initial processing
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream complete for user comment response');
          
          // Final update with complete flag
          setAiResponse(prev => {
            if (!prev) return { content: streamedContent, isComplete: true };
            return { ...prev, content: streamedContent, isComplete: true };
          });
          
          // Generate summary for the updated response
          if (streamedContent && streamedContent.trim()) {
            try {
              const summarizedText = await getSummary(streamedContent);
              
              if (summarizedText && summarizedText.trim()) {
                console.log(`Received updated summary (${summarizedText.length} chars)`);
                
                // Update state with the summary
                setAiResponse(prev => {
                  if (!prev) return { content: streamedContent, isComplete: true, summary: summarizedText };
                  return { ...prev, summary: summarizedText };
                });
              }
            } catch (error) {
              console.error('Error generating summary for updated response:', error);
            }
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
    } catch (error) {
      console.error('Error sending user comment to Assistant:', error);
      setError(error instanceof Error ? error.message : 'Failed to send comment');
    } finally {
      setIsAwaitingResponse(false);
    }
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
          animation-delay: 0s;
        }
        
        .typing-indicator::after {
          left: 8px;
          animation-delay: 0.3s;
        }
        
        .typing-indicator span {
          left: 16px;
          animation-delay: 0.6s;
        }
        
        @keyframes typing {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        
        .grid-layout {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 1.5rem;
          width: 100%;
        }
        
        /* Improved responsive layout */
        @media (max-width: 768px) {
          .grid-layout {
            grid-template-columns: 1fr;
          }
        }
        
        .images-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .image-container {
          border-radius: 0.5rem;
          overflow: hidden;
          position: relative;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .selected-image {
          width: 100%;
          height: auto;
          object-fit: contain;
          border-radius: 0.375rem;
          background-color: #f8f9fa;
        }
        
        /* Optimize text for better readability */
        .description-text {
          line-height: 1.5;
          letter-spacing: 0.01em;
        }
        
        /* Make sure content doesn't overflow container */
        .content-container {
          width: 100%;
          overflow-wrap: break-word;
          word-wrap: break-word;
          hyphens: auto;
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
                {selectedImages.map((imageUrl, index) => (
                  <div key={index} className="image-container relative">
                    <NextImage 
                      src={imageUrl} 
                      alt={`Selected ${index + 1}`} 
                      width={500}
                      height={300}
                      className="selected-image"
                      style={{ objectFit: 'contain' }}
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
                    onClick={() => {
                      setShowUploadOptions(true);
                    }}
                    className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded shadow"
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('addAnotherImage')}
                    </div>
                  </button>
                )}
                
                {/* Analyze button to process images after all uploads are complete */}
                {selectedFiles.length > 0 && !aiResponse && (
                  <div className="mt-6 mb-4">
                    <button
                      onClick={() => processImageWithAPI(selectedFiles[0])}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg shadow-lg text-lg transition-colors duration-200"
                    >
                      <div className="flex items-center justify-center">
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {t('analyzeImages')}
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Add Summary below images when available */}
              {aiResponse && aiResponse.summary && (
                <div className="mt-6 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-semibold">{t('summary')}</h2>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                    <div className="text-gray-800 dark:text-gray-200 prose prose-sm max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Override paragraph to reduce spacing
                          p: ({node, ...props}) => <p className="mb-2" {...props} />,
                          // Optimize list spacing
                          ul: ({node, ...props}) => <ul className="mb-2 pl-5" {...props} />,
                          li: ({node, ...props}) => <li className="mb-1" {...props} />
                        }}
                      >
                        {aiResponse.summary}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {aiResponse && (
                <div className="card">
                  <button
                    onClick={() => {
                      setShowUploadOptions(true);
                    }}
                    className="mb-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded shadow"
                  >
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('addAnotherImage')}
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div className="content-container">
              {aiResponse && (
                <div className="card">
                  <div className="text-container">
                    {/* Summary Section moved to left column */}
                    
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
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              // Override paragraph to reduce spacing
                              p: ({node, ...props}) => <p className="mb-2" {...props} />,
                              // Optimize list spacing
                              ul: ({node, ...props}) => <ul className="mb-2 pl-5" {...props} />,
                              li: ({node, ...props}) => <li className="mb-1" {...props} />,
                              // Better heading spacing
                              h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2 mt-4" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2 mt-3" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-md font-bold mb-1 mt-2" {...props} />
                            }}
                          >
                            {aiResponse.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
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

      {/* Footer Record Comment Button */}
      {aiResponse && aiResponse.isComplete && !isReadyToSubmit && !isSubmitted && (
        <div className="fixed bottom-0 left-0 right-0 py-4 px-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-10">
          <div className="container mx-auto max-w-[2000px] flex justify-center">
            {isAwaitingResponse ? (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-6 py-4 rounded-lg">
                <div className="flex items-center justify-center">
                  <div className="typing-indicator mr-2">
                    <span></span>
                  </div>
                  <span className="font-medium">{t('processingComment')}</span>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md">
                <AudioRecorder 
                  onTranscriptionComplete={handleTranscriptionComplete} 
                  language={language}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spacer for fixed footer */}
      {aiResponse && aiResponse.isComplete && !isReadyToSubmit && !isSubmitted && (
        <div className="h-28 w-full"></div>
      )}
      
      {error && (
        <div className="fixed bottom-4 left-4 right-4 p-6 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-200 rounded-xl text-lg shadow-lg max-w-2xl mx-auto">
          {error}
        </div>
      )}
    </div>
  );
}




