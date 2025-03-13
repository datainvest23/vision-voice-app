// src/app/components/ImageUpload.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useLanguage } from '../context/LanguageContext';
import { AudioRecorder } from './AudioRecorder'; // Assuming AudioRecorder is in the same directory
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AIResponse {
  content: string;
  isComplete: boolean;
}

interface ImageUploadProps {
    setIsLoading: (loading: boolean) => void;
}

export default function ImageUpload({ setIsLoading }: ImageUploadProps) {
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState('');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);  // Tracks overall analysis process
  // _transcription isn't directly used in the component, but we need to keep the state
  // as it's updated by handleTranscriptionComplete and may be needed for future features
  const [_transcription, setTranscription] = useState(''); // Store the transcribed text
  const [hasRecordedComment, setHasRecordedComment] = useState(false); // Track if user has recorded a comment
  const [isSaving, setIsSaving] = useState(false); // Track save operation state

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { language } = useLanguage();
  const { t } = useLanguage();

  // Log the state values for debugging
  useEffect(() => {
    console.log("ImageUpload state: ", { 
      imagesCount: images.length, 
      filesCount: files.length,
      aiResponse: aiResponse ? `Content length: ${aiResponse.content.length}, isComplete: ${aiResponse.isComplete}` : 'null',
      threadId,
      isAnalyzing,
      hasRecordedComment
    });
  }, [images.length, files.length, aiResponse, threadId, isAnalyzing, hasRecordedComment]);

    // Cleanup URLs on unmount or when images change
    useEffect(() => {
        return () => {
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
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }
      console.log("🔄 handleFileChange: Beginning to process selected files");
        // Reset error and previous analysis
        setError('');
        setAiResponse(null);
      setIsAnalyzing(true); // Set Loading
      setIsLoading(true); // Update parent loading state

        const newImages: string[] = [];
        const newFiles: File[] = [];
        let totalFiles = files.length; // Keep track of existing + new files

        try {
            for (let i = 0; i < selectedFiles.length; i++) {
                if (totalFiles >= 3) { // Limit to 3 images total
                    setError(t('remaining'));
                    break; // Stop processing if limit is reached
                }
                const file = selectedFiles[i];
              console.log(`🖼️ Processing file ${i+1}: ${file.name} (${formatFileSize(file.size)})`);

              // Basic validation: Check if the file is an image.
                if (!file.type.startsWith('image/')) {
                    setError('Only image files are allowed.');
                    return; // Stop if a non-image file is encountered
                }

              // Compress image if larger than 900KB
              let processedFile = file;
              if (file.size > 900 * 1024) {
                  try {
                      processedFile = await compressImage(file);
                      console.log(`✅ Compressed image from ${formatFileSize(file.size)} to ${formatFileSize(processedFile.size)}`);
                  } catch (compressionError) {
                      console.error('❌ Image compression error:', compressionError);
                      // Use original file if compression fails
                      processedFile = file;
                  }
              }

              const imageUrl = URL.createObjectURL(processedFile);
                newImages.push(imageUrl);
              newFiles.push(processedFile);
                totalFiles++; // Increment count for each valid file
            }
          console.log(`📊 Total files ready for upload: ${newFiles.length}`);
        } catch (err) {
          console.error("❌ Error processing files on the client:", err);
            setError("Error processing files.");

        } finally {
          // Update state with new images and files
            setImages(prevImages => [...prevImages, ...newImages]);
            setFiles(prevFiles => [...prevFiles, ...newFiles]);
            setShowOptions(false); // Hide options after handling files
            if (e.target) {
                e.target.value = '';  //Clear file input
            }
            setIsAnalyzing(false);
          setIsLoading(false);
          console.log("🔄 handleFileChange: Files prepared and ready for analysis");
          
          // Automatically start processing if files were added successfully
          if (newFiles.length > 0) {
              console.log("🔄 Auto-starting analysis with new files:", newFiles.length);
              // Call processImagesWithAPI with the newly created files
              setTimeout(() => {
                  // Get the CURRENT files plus newly added files
                  const allFiles = [...files, ...newFiles];
                  console.log(`🔍 Sending ${allFiles.length} files for processing (${files.length} existing + ${newFiles.length} new)`);
                  processImagesWithAPI(allFiles);
              }, 100);
          }
        }
    };

  const handleRemoveImage = (index: number) => {
    setImages(prevImages => {
      const newImages = [...prevImages];
      const removedImageUrl = newImages.splice(index, 1)[0]; // Remove and get the URL
      URL.revokeObjectURL(removedImageUrl); // Revoke the object URL
      return newImages;
    });

    setFiles(prevFiles => {
      const newFiles = [...prevFiles];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

    //Added a reset function
    const handleReset = () => {
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
    setTranscription("");
  };


  const processImagesWithAPI = async (filesToProcess?: File[]) => {
    // Use provided files or fall back to state
    const processFiles = filesToProcess || files;
    
    if (processFiles.length === 0) {
        setError('No images to process');
        console.log("❌ processImagesWithAPI: No files to process");
        return;
    }
    
    console.log("🚀 Starting processImagesWithAPI with", processFiles.length, "files");
    setError('');  //Clear previous errors
    setIsAnalyzing(true); // Set loading state
    setAiResponse(null); // Clear previous response
    setThreadId(null); // Clear previous thread ID
    //Added set isLoading
    setIsLoading(true);
    console.log("⏳ Loading states set: isAnalyzing=true");

    const formData = new FormData();
    processFiles.forEach((file, index) => {
        console.log(`📎 Adding file ${index + 1} to FormData:`, file.name, `(${formatFileSize(file.size)} bytes)`);
        formData.append('files', file);
    });
    formData.append('language', language);
    console.log("📝 FormData prepared with language:", language);

   try {
        console.log("📤 Sending request to /api/upload-image-stream...");
        
        // Use a try-catch specifically around the fetch call
        let response;
        try {
          // Using the streaming endpoint
          response = await fetch('/api/upload-image-stream', {
          method: 'POST',
          body: formData,
        });
          console.log("📥 Received response with status:", response.status, response.statusText);
          
          // Log headers
          const headers: {[key: string]: string} = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });
          console.log("📥 Response headers:", headers);
          
        } catch (fetchError) {
          console.error("❌ Fetch network error:", fetchError);
          if (fetchError instanceof Error) {
            throw new Error(`Network error during fetch: ${fetchError.message}`);
          } else {
            throw new Error(`Network error during fetch: ${String(fetchError)}`);
          }
        }

        if (!response.ok) {
          console.error(`❌ API error: ${response.status} ${response.statusText}`);
          try {
          const errorData = await response.json();
            console.error("❌ Error details:", errorData);
            throw new Error(errorData.error || `Server error: ${response.status}`);
          } catch (parseError) {
            console.error("❌ Failed to parse error as JSON:", parseError);
            // If we can't parse the JSON, try to get the response text
            try {
              const errorText = await response.text();
              console.error("❌ Error response text:", errorText);
              throw new Error(errorText || `Server error: ${response.status}`);
            } catch (textError) {
              console.error("❌ Failed to get error text:", textError);
              // If all else fails, just use the status
              throw new Error(`Failed to analyze images: ${response.status} ${response.statusText}`);
            }
          }
        }

        // Get thread ID from headers
        const threadId = response.headers.get('x-thread-id');
        if (threadId) {
          setThreadId(threadId);
          console.log("🧵 Thread ID received:", threadId);
          console.log("🧵 Thread ID state updated");
        } else {
          console.error("❌ No thread ID in response headers - this will break conversation continuity");
        }

        if (!response.body) {
            console.error("❌ Response has no body");
            throw new Error('No response body available');
          }

        console.log("📥 Starting to read response stream...");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = '';

        // Process the stream
        try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                  console.log("📥 Stream complete");
                  // Make sure we mark the response as complete
                  setAiResponse(prev => {
                      const newState = {
                          content: streamedContent || prev?.content || '', 
                          isComplete: true
                      };
                      console.log("✅ Setting aiResponse complete:", { 
                          contentLength: newState.content.length,
                          isComplete: true
                      });
                      return newState;
                  });
                break;
            }

              // Decode the chunk
             const chunk = decoder.decode(value, { stream: true });
              console.log(`📥 Received chunk of ${chunk.length} bytes`);
              
              // Handle each line separately (chunks might contain multiple lines)
              const lines = chunk.split('\n').filter(line => line.trim());
              console.log(`📥 Processing ${lines.length} lines from chunk`);
              
              for (const line of lines) {
                  try {
                      // Try to parse as JSON
                      const parsedData = JSON.parse(line);
                      console.log(`📥 Parsed JSON message of type: ${parsedData.type}`);
                      
                      // Handle different message types
                      switch (parsedData.type) {
                          case 'status':
                              // Status updates - could show in UI
                              console.log("📊 Status update:", parsedData.content);
                              break;
                              
                          case 'delta':
                              // Content deltas - add to the accumulated content
                              streamedContent += parsedData.content;
                              setAiResponse(() => {
                                  console.log(`📝 Updating aiResponse with delta: content length=${streamedContent.length}, isComplete=false`);
                                  return { 
                                      content: streamedContent, 
                                      isComplete: false 
                                  };
                              });
                              break;
                              
                          case 'complete':
                              // Final content - could be structured with description/remarks
                              console.log("✅ Received complete message from server");
                              if (typeof parsedData.content === 'object') {
                                  // Handle structured content
                                  const { description, remarks } = parsedData.content;
                                  const formattedContent = `${description}\n\n${remarks}`;
                                  streamedContent = formattedContent;
                              } else {
                                  // Handle simple content
                                  streamedContent = parsedData.content;
                              }
                              
                              console.log(`✅ Setting complete response: content length ${streamedContent.length} chars, isComplete: true`);
                              // Set with a callback to ensure we can log the before/after state
                              setAiResponse(prev => {
                                  console.log("🔄 Setting aiResponse complete:", {
                                      prevContent: prev?.content?.length || 0,
                                      newContent: streamedContent.length,
                                      prevComplete: prev?.isComplete || false,
                                      newComplete: true
                                  });
                                  return {
                                      content: streamedContent,
                                      isComplete: true
                                  };
                              });
                              break;
                              
                          case 'error':
                              // Error message
                              console.error("❌ Error from server:", parsedData.content);
                              throw new Error(parsedData.content);
                              
                          default:
                              // Unknown type, just log
                              console.log("⚠️ Unknown message type:", parsedData);
                      }
                  } catch (e) {
                      console.log("⚠️ Failed to parse line as JSON, treating as plain text:", e);
                      // Not valid JSON or other error, treat as plain text
                      if (line.trim()) {
                          streamedContent += line;
                          setAiResponse(prev => {
                              const newState = {
                                  content: streamedContent, 
                                  isComplete: false
                              };
                              console.log("🔄 Updating aiResponse state:", {
                                  prevLength: prev?.content?.length || 0,
                                  newLength: streamedContent.length,
                                  isComplete: false
                              });
                              return newState;
                          });
                      }
                  }
              }
          }
        } catch (streamError) {
          console.error("❌ Error processing stream:", streamError);
          throw streamError;
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to process images';
        console.error('❌ Error during image analysis:', error);
        
        // Display a user-friendly error message
        setError(errorMessage);
        
        // If analyzing state is still true, reset it
        setIsAnalyzing(false);
        setIsLoading(false);
        
        // Alert the console for easier debugging
        console.warn('❌ Image upload failed:', errorMessage);
        console.log('⏹️ Reset loading states: isAnalyzing=false');
        
        // Return to prevent further execution
        return;
    } finally {
        console.log('⏹️ Finally block: Resetting loading states');
        setIsAnalyzing(false);
        setIsLoading(false); //Added set isLoading
        console.log("🔄 processImagesWithAPI complete: isAnalyzing=false");
    }
};

const handleTranscriptionComplete = async (transcribedText: string) => {
        if (!threadId) {
          setError("No active thread to send the comment to.");
          return;
        }

        setTranscription(transcribedText);

        try {
          setIsAnalyzing(true);
            //Added set isLoading
            setIsLoading(true);
          const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              threadId,
              message: transcribedText,
              language,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to send comment');
          }

          // Stream the response
          if (!response.body) {
            throw new Error('No response body available');
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let streamedContent = '';

           while (true) {
                const { done, value } = await reader.read();

                if (done) {
                  setAiResponse(() => ({ content: streamedContent, isComplete: true }));
                  break;
                }
                const chunk = decoder.decode(value, { stream: true });
                streamedContent += chunk; // Accumulate content
                setAiResponse(() => ({ content: streamedContent, isComplete: false }));
            }

            // Mark that a comment has been recorded and processed
            setHasRecordedComment(true);

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to send comment';
          setError(errorMessage);
          console.error('Error sending comment to assistant:', error);
        } finally {
          setIsAnalyzing(false);
            //Added set isLoading
            setIsLoading(false);
        }
      };

  // New function to handle saving the appraisal
  const handleSaveAppraisal = async () => {
    if (!aiResponse || !aiResponse.isComplete || !hasRecordedComment) {
      return; // Don't proceed if conditions aren't met
    }

    setIsSaving(true);
    setError('');

    try {
      // Prepare the data for saving
      const appraisalData = {
        title: `Antique Appraisal - ${new Date().toLocaleDateString()}`,
        fullDescription: aiResponse.content,
        summary: aiResponse.content.split('\n\n')[0] || 'Appraisal Summary',
        userComment: _transcription,
        images: images,
        assistantResponse: aiResponse.content,
        assistantFollowUp: '', // This would be the follow-up response if any
        isDetailed: true
      };

      // Call the save-to-supabase API
      const response = await fetch('/api/save-to-supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appraisalData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save appraisal');
      }

      // Handle successful save
      console.log('Appraisal saved successfully!');
      
      // Maybe show some success message to the user
      alert('Your appraisal has been saved successfully!');
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save appraisal';
      setError(errorMessage);
      console.error('Error saving appraisal:', error);
    } finally {
      setIsSaving(false);
        }
      };

  return (
    <div className="w-full">
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

      {/* Main content */}
      {images.length === 0 && !isAnalyzing ? (
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
                {t('uploadButton')}
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
                <span className="text-lg">{t('takePhoto')}</span>
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
                <span className="text-lg">{t('uploadImage')}</span>
              </button>
            </div>
           )}
        </div>
      ) : (
         <div className="w-full">
          {/* Show images */}
          <div className="grid-layout">
            {/* Image thumbnails column */}
            <div className="flex flex-col">
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
              
              {/* Analyze button moved to the image column for better layout */}
              {files.length > 0 && !aiResponse && !isAnalyzing && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      processImagesWithAPI(files);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg text-lg transition-all duration-200 w-full transform hover:scale-105"
                    type="button"
                  >
                    <div className="flex items-center justify-center">
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {t('analyzeImages')}
                    </div>
                  </button>
                </div>
              )}
              
              {/* Save Appraisal Button - only active when aiResponse is complete and user has recorded a comment */}
              {aiResponse?.isComplete && hasRecordedComment && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleSaveAppraisal}
                    disabled={isSaving}
                    className={`${
                      isSaving 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-amber-500 hover:bg-amber-600'
                    } text-white font-semibold py-3 px-6 rounded-lg shadow-lg text-lg transition-all duration-200 w-full transform hover:scale-105`}
                    type="button"
                  >
                    <div className="flex items-center justify-center">
                      <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                      {isSaving ? 'Saving...' : 'Save Appraisal'}
                    </div>
                  </button>
                </div>
              )}
            </div>
            
            {/* AI response display column - wider and more optimized */}
            <div className="content-container">
              {/* Show loading indicator if analyzing but no AI response yet */}
              {isAnalyzing && !aiResponse && (
                <div className="card">
                  <div className="text-container">
                    <h2 className="text-xl font-semibold mb-3">{t('fullAnalysis')}</h2>
                    <div className="loading-analysis-container">
                      <div className="loading-analysis-spinner"></div>
                      <p className="loading-analysis-text">Analyzing your antique...</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* AI response display */}
              {aiResponse && (
                <div className="card">
                  <div className="text-container">
                    {/* Full Analysis Section */}
                    <div>
                      <h2 className="text-xl font-semibold mb-3">{t('fullAnalysis')}</h2>
                      <div className="description-text text-gray-700 dark:text-gray-300">
                        {!aiResponse.isComplete && (
                          <div className="flex items-center mb-2">
                            <div className="mr-2 flex space-x-1">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                            <span className="text-sm text-blue-500">{t('processingResponse')}</span>
                          </div>
                        )}
                         {/* Using the new prose-container class for better content display */}
                         <div className="prose-container">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  // Override paragraph to reduce spacing
                                  p: (props) => <p className="mb-3 leading-relaxed" {...props} />,
                                  // Optimize list spacing
                                  ul: (props) => <ul className="mb-3 pl-5 list-disc" {...props} />,
                                  li: (props) => <li className="mb-1 pl-1" {...props} />,
                                  // Better heading spacing
                                  h1: (props) => <h1 className="text-xl font-bold mb-2 mt-3" {...props} />,
                                  h2: (props) => <h2 className="text-lg font-bold mb-2 mt-2 border-b pb-1 border-gray-200 dark:border-gray-700" {...props} />,
                                  h3: (props) => <h3 className="text-md font-bold mb-1 mt-2" {...props} />,
                                  // Fix pre and code formatting
                                  pre: (props) => <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded mb-2 overflow-x-auto" {...props} />,
                                  code: (props) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm" {...props} />
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
              
              {/* Audio Recorder and Reset button container */}
              <div className="flex flex-wrap gap-4 justify-center mt-4">
          {/* Display Audio Recorder component */}
          {aiResponse?.isComplete && (
                  <div className="w-full max-w-md">
              <AudioRecorder
                onTranscriptionComplete={handleTranscriptionComplete}
                language={language}
                />
            </div>
            )}
                
             {/* Reset button */}
                {aiResponse && (
                <button
                  onClick={handleReset}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg text-lg transition-all duration-200 transform hover:scale-105"
                  type="button"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    New Analysis
                  </div>
                </button>
              )}
              </div>
            </div>
          </div>
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