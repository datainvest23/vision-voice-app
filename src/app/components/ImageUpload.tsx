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

  // Add useEffect to log important state changes and debug issues
  useEffect(() => {
    console.log('ImageUpload component mounted');
    
    // Cleanup function when component unmounts
    return () => {
      console.log('ImageUpload component unmounted');
      // Release any object URLs to prevent memory leaks
      selectedImages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [selectedImages]);

  // Completely rewrite the handleImageUpload function to be more robust
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('🔄 handleImageUpload triggered');
    
    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('❌ No files selected');
      return;
    }
    
    console.log(`✅ ${files.length} files selected`);
    
    // Show loading state
    setIsLoading(true);
    setError('');
    
    try {
      // Create new arrays for images and files
      const currentImageUrls = [...selectedImages];
      const currentFiles = [...selectedFiles];
      let newImagesAdded = 0;
      
      // Process each file
      for (let i = 0; i < files.length; i++) {
        // Check if we've reached the maximum
        if (currentFiles.length + newImagesAdded >= 3) {
          setError('Maximum of 3 images allowed');
          break;
        }
        
        const file = files[i];
        console.log(`🔄 Processing file: ${file.name} (${formatFileSize(file.size)})`);
        
        // Process file (compression if needed)
        let processedFile = file;
        if (file.size > 900 * 1024) {
          setCompressionStatus(`Optimizing image ${i + 1}/${Math.min(files.length, 3 - currentFiles.length)}...`);
          try {
            processedFile = await compressImage(file);
            console.log(`📊 Compressed from ${formatFileSize(file.size)} to ${formatFileSize(processedFile.size)}`);
          } catch (error) {
            console.error('❌ Compression error:', error);
            processedFile = file; // Use original on error
          } finally {
            setCompressionStatus('');
          }
        }
        
        // Create URL and add to arrays
        const imageUrl = URL.createObjectURL(processedFile);
        currentImageUrls.push(imageUrl);
        currentFiles.push(processedFile);
        newImagesAdded++;
        
        console.log(`✅ Added image ${newImagesAdded}: ${imageUrl.substring(0, 30)}...`);
      }
      
      console.log(`📊 Final count - Images: ${currentImageUrls.length}, Files: ${currentFiles.length}`);
      
      // Update state atomically
      setSelectedImages(currentImageUrls);
      setSelectedFiles(currentFiles);
      
      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
      
      // Done with options when files are added
      setShowUploadOptions(false);
      
    } catch (error) {
      console.error('❌ Error in handleImageUpload:', error);
      setError(error instanceof Error ? error.message : 'Failed to process images');
    } finally {
      console.log('🏁 Upload handling complete');
      setIsLoading(false);
    }
  };
  
  // Modify the handleChooseFile function to ensure it works correctly
  const handleChooseFile = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🔄 handleChooseFile clicked');
    if (fileInputRef.current) {
      console.log('✅ Triggering file input click');
      fileInputRef.current.click();
    } else {
      console.log('❌ fileInputRef is null');
    }
  };

  // Add useEffect to log state changes
  useEffect(() => {
    console.log("selectedImages changed:", selectedImages.length);
  }, [selectedImages]);

  useEffect(() => {
    console.log("selectedFiles changed:", selectedFiles.length);
  }, [selectedFiles]);

  useEffect(() => {
    console.log("showUploadOptions changed:", showUploadOptions);
  }, [showUploadOptions]);

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
          
          // Set isReadyToSubmit to true after receiving and processing the second message
          // This will allow the "Create Valuation" button to be shown
          setIsReadyToSubmit(true);
          
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

  // Save to Supabase function
  const saveToSupabase = async () => {
    try {
      setError('');
      setIsLoading(true);

      // Save all data to Supabase
      const response = await fetch('/api/save-to-supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: selectedImages,
          fullDescription: aiResponse?.content || '',
          summary: aiResponse?.summary,
          userComment: transcription,
          assistantResponse: aiResponse?.content || '',
          assistantFollowUp: aiResponse?.content, // This is the second response after user comment
          title: `Antique Valuation ${new Date().toLocaleDateString()}`
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

  const handleSaveToDatabase = async () => {
    await saveToSupabase();
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

  const handleUploadOptionClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowUploadOptions(true);
  };

  const handleTakePhoto = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
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
      {/* Debug info */}
      <div className="bg-gray-100 p-2 mb-4 w-full text-xs">
        <div>Selected Images Count: {selectedImages.length}</div>
        <div>Selected Files Count: {selectedFiles.length}</div>
        <div>Show Upload Options: {showUploadOptions ? 'true' : 'false'}</div>
        </div>

      {/* Hidden file inputs */}
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

      {/* Main content based on state */}
      {selectedImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center w-full">
          {!showUploadOptions ? (
            <button 
              onClick={handleUploadOptionClick}
              className="upload-button-home"
              type="button"
            >
              <span className="flex items-center text-xl">
                <svg className="w-7 h-7 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="upload-option-button-home bg-blue-500 hover:bg-blue-600 text-white"
                type="button"
              >
                <svg className="w-7 h-7 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-lg">{t('takePhoto')}</span>
              </button>
              <button 
                onClick={handleChooseFile} 
                className="upload-option-button-home bg-purple-500 hover:bg-purple-600 text-white"
                type="button"
              >
                <svg className="w-7 h-7 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-lg">{t('uploadImage')}</span>
              </button>
            </div>
          )}
            </div>
      ) : (
        <div className="w-full">
          {/* Show images */}
          <div className="grid-layout">
            <div className="flex flex-col space-y-4">
              <div className="images-container">
                {/* Image thumbnails */}
                {selectedImages.map((imageUrl, index) => (
                  <div key={index} className="image-container relative">
                    <NextImage
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
            </div>

          {/* Analyze button */}
          {selectedFiles.length > 0 && !aiResponse && (
            <div className="mt-8 mb-8 flex justify-center">
                          <button
                onClick={(e) => {
                  e.preventDefault();
                  processImageWithAPI(selectedFiles[0]);
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-5 px-12 rounded-lg shadow-lg text-xl transition-all duration-200 max-w-md w-full transform hover:scale-105"
                type="button"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-7 h-7 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                  {t('analyzeImages')}
                        </div>
                    </button>
                  </div>
                )}
        </div>
      )}

      {/* Show errors */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}




