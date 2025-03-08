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
  const [streamAudio, setStreamAudio] = useState(false); // Default to OFF
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
    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const processNextAudio = async () => {
      try {
        if (!isMounted) return;
        setIsProcessingAudio(true);
        
        const textToProcess = audioQueue[0];
        const newQueue = audioQueue.slice(1);
        setAudioQueue(newQueue);
        
        // Only proceed if there's text to process
        if (!textToProcess.trim()) {
          setIsProcessingAudio(false);
          return;
        }
        
        // Create a new AbortController for this request
        controller = new AbortController();
        
        // Set a timeout that won't cause issues if component unmounts
        timeoutId = setTimeout(() => {
          if (controller) {
            controller.abort();
          }
        }, 15000); // 15 second timeout, increased from 10
        
        try {
          const response = await fetch('/api/text-to-speech', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: textToProcess }),
            signal: controller.signal
          });
          
          // Clear timeout as soon as we get a response
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || 'Failed to generate speech');
          }
          
          // If component unmounted while waiting, exit early
          if (!isMounted) return;
          
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          currentAudioRef.current = audio;
          
          // Set up event listeners
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setIsProcessingAudio(false);
            currentAudioRef.current = null;
            // If the queue is empty and we're done with AI response, we can set isPlaying to false
            if (newQueue.length === 0 && aiResponse?.isComplete) {
              setIsPlaying(false);
            }
          };
          
          audio.onerror = () => {
            console.error('Audio playback error');
            URL.revokeObjectURL(audioUrl);
            setIsProcessingAudio(false);
            currentAudioRef.current = null;
          };
          
          // Play the audio
          await audio.play();
          setIsPlaying(true);
        } catch (error: unknown) {
          console.error('Text-to-speech fetch error:', error);
          
          // Handle abort error differently - no need to show error for normal timeouts
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              // Silent handling for abort errors
            } else {
              setError('Failed to generate speech. Please try again.');
            }
          } else {
            setError('Failed to generate speech. Please try again.');
          }
          
          // Still need to reset state
          setIsProcessingAudio(false);
          currentAudioRef.current = null;
        }
      } catch (err) {
        console.error('Audio processing error:', err);
        setIsProcessingAudio(false);
        currentAudioRef.current = null;
      }
    };
    
    processNextAudio();
    
    // Cleanup function to prevent memory leaks and state updates after unmount
    return () => {
      isMounted = false;
      
      // Clean up any ongoing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Clean up any ongoing fetch request
      if (controller) {
        controller.abort();
      }
    };
  }, [audioQueue, isProcessingAudio, aiResponse?.isComplete]);

  // Add text to audio queue for processing (used when new chunks arrive)
  const addToAudioQueue = (text: string) => {
    if (!streamAudio || !text.trim()) return;
    setAudioQueue(prev => [...prev, text]);
  };

  // Manually play description (used for the play button)
  const playDescription = async (text: string) => {
    if (isPlaying) {
      // If already playing, stop current playback
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
      // Split text into chunks for better processing
      const textChunks = splitTextIntoChunks(text);
      // Enqueue all chunks
      setAudioQueue(textChunks);
    } catch (err) {
      console.error('Speech playback error:', err);
      setError('Failed to play audio description');
    }
  };

  // Toggle streaming audio on/off
  const toggleStreamAudio = () => {
    setStreamAudio(prev => !prev);
    
    // If turning off, clear any existing playback
    if (streamAudio) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setIsPlaying(false);
      setAudioQueue([]);
      setIsProcessingAudio(false);
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
      
      formData.append('language', language);
      
      // Set a timeout to handle potential long requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout
      
      try {
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
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = '';
        let lastProcessedChunk = '';
        
        // Manual stream processing
        while (true) {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              // Stream complete
              setAiResponse({ content: streamedContent, isComplete: true });
              break;
            }
            
            // Decode chunk and append to content
            const chunk = decoder.decode(value, { stream: true });
            
            // Find the new content that was just added
            const newContent = chunk;
            streamedContent += newContent;
            
            // Split into sentences for better TTS chunking
            const sentences = extractSentences(newContent, lastProcessedChunk);
            
            if (sentences.length > 0) {
              // Add sentences to audio queue for processing
              sentences.forEach(sentence => {
                if (sentence.trim()) {
                  addToAudioQueue(sentence);
                }
              });
              
              // Remember the last part for context in next chunk
              lastProcessedChunk = sentences[sentences.length - 1];
            }
            
            // Update UI with current content
            setAiResponse({ content: streamedContent, isComplete: false });
          } catch (readError) {
            console.error('Error reading from stream:', readError);
            throw new Error('Failed to read streaming data');
          }
        }
        
        // If we're not streaming audio in chunks or if no chunks were played yet,
        // we can play the full content when complete
        if (!streamAudio && streamedContent) {
          playDescription(streamedContent);
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        throw fetchError;
      }
    } catch (error) {
      console.error('API processing error:', error);
      let errorMessage = 'Failed to analyze image';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // If it's an abort error from the timeout
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out. Please try again with a smaller image.';
        }
      }
      
      setError(errorMessage);
      setAiResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to extract complete sentences from chunks with improved NLP
  const extractSentences = (newText: string, previousContext: string = ''): string[] => {
    const textToProcess = previousContext + newText;
    
    // Nothing to process
    if (!textToProcess.trim()) {
      return [];
    }
    
    // Common abbreviations that contain periods but don't end sentences
    const commonAbbreviations = [
      'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.', 'St.',
      'etc.', 'e.g.', 'i.e.', 'vs.', 'p.m.', 'a.m.', 'U.S.', 'U.K.',
      // German
      'bzw.', 'ca.', 'evtl.', 'ggf.', 'z.B.',
      // Spanish
      'Sr.', 'Sra.', 'Dr.', 'Dra.', 'Ud.', 'Uds.',
      // French
      'M.', 'Mme.', 'Mlle.', 'Dr.', 'St.'
    ];
    
    // Regular expressions to match different types of sentence boundaries
    const sentenceBoundaryRegex = new RegExp(
      // Match end punctuation followed by space or quote
      `([.!?]+['"])(?=\\s|$)` +
      // Match end punctuation at end of string or followed by space
      `|([.!?]+)(?=\\s|$)` +
      // Match ellipsis followed by capital letter
      `|(…\\s+)(?=[A-ZÀ-ÖØ-Þ])`,
      'g'
    );
    
    // First, handle special cases like abbreviations to avoid false sentence breaks
    let processedText = textToProcess;
    for (const abbr of commonAbbreviations) {
      // Replace periods in abbreviations with a special marker
      const pattern = new RegExp(`\\b${abbr.replace(/\./g, '\\.').replace(/\s/g, '\\s')}\\s`, 'g');
      processedText = processedText.replace(pattern, (match) => match.replace('.', '###PERIOD###'));
    }
    
    // Find all sentence boundaries in the processed text
    const matches = [...processedText.matchAll(sentenceBoundaryRegex)];
    
    // For minimal text or no matches, just return as a single chunk
    if (matches.length === 0 || textToProcess.length < 30) {
      return [textToProcess];
    }
    
    const sentences: string[] = [];
    let lastIndex = 0;
    
    // Extract each sentence using the original text (not processed text)
    for (const match of matches) {
      if (match.index !== undefined) {
        const sentenceEnd = match.index + match[0].length;
        
        // Get the raw sentence from original text
        const sentence = textToProcess.substring(lastIndex, sentenceEnd);
        
        // Check if sentence appears to be incomplete (heuristic)
        const wordCount = sentence.split(/\s+/).length;
        const hasQuotationBalance = (sentence.match(/"/g) || []).length % 2 === 0;
        const hasParenthesisBalance = 
          (sentence.match(/\(/g) || []).length === (sentence.match(/\)/g) || []).length;
        
        // If the sentence seems incomplete or too short, and we have more text, keep it for the next round
        if ((wordCount < 3 || !hasQuotationBalance || !hasParenthesisBalance) && 
            matches.length > 1 && match !== matches[matches.length - 1]) {
          continue;
        }
        
        sentences.push(sentence);
        lastIndex = sentenceEnd;
      }
    }
    
    // Add any remaining text as the final chunk
    if (lastIndex < textToProcess.length) {
      const remainingText = textToProcess.substring(lastIndex);
      // Only add non-trivial remaining text
      if (remainingText.trim().length > 0) {
        sentences.push(remainingText);
      }
    }
    
    // If we couldn't extract any valid sentences, return the whole text
    if (sentences.length === 0) {
      return [textToProcess];
    }
    
    // Restore any abbreviation periods we masked
    return sentences.map(sentence => 
      sentence.replace(/###PERIOD###/g, '.')
    );
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
                        {aiResponse.isComplete ? t('description') : t('processingResponse')}
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
                    <div>
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




