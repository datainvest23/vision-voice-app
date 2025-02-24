'use client';

import { useState, useRef, Dispatch, SetStateAction } from 'react';
import { AudioRecorder } from '@/app/components/AudioRecorder';

interface ImageUploadProps {
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

interface AIResponse {
  description: string;
  remarks: string;
}

export default function ImageUpload({ setIsLoading }: ImageUploadProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  // New states for voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const getAiDescription = async (file: File) => {
    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get image description');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAiResponse(data);
      
      // Automatically play the speech after getting description
      if (data.description) {
        playDescription(data.description + '. ' + data.remarks);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze image. Please try again.';
      setError(errorMessage);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
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
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      setError('');
      
      try {
        // 1. Display image preview immediately
        const imageUrl = URL.createObjectURL(file);
        setSelectedImage(imageUrl);
        setSelectedFile(file);

        // 2. Get AI description
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to analyze image');
        const data = await response.json();
        setAiResponse(data);

        // 3. Automatically play description
        await playDescription(data.description + '. ' + data.remarks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process image');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleTranscriptionComplete = async (transcribedText: string) => {
    setTranscription(transcribedText);
    // 4. Save everything to Airtable
    await saveToAirtable();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // Specify codec
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio(audioUrl);
        
        // Convert to mp3 before transcribing
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        // Transcribe the audio
        await transcribeAudio(formData);
        
        // Stop all tracks on the stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (formData: FormData) => {
    try {
      setError('');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const data = await response.json();
      console.log('Transcription received:', data.text);
      setTranscription(data.text);

      // Save to Airtable only after successful transcription
      if (selectedImage && aiResponse && data.text) {
        console.log('Starting Airtable save with transcription:', data.text);
        await saveToAirtable();
      } else {
        console.log('Missing data for Airtable:', { 
          hasImage: !!selectedImage, 
          hasAiResponse: !!aiResponse, 
          hasTranscription: !!data.text 
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setError(errorMessage);
      console.error('Transcription error:', err);
    }
  };

  const saveToAirtable = async () => {
    try {
      setError('');
      setIsLoading(true);

      // First, upload the image and get its URL
      let imageUrl = null;
      if (selectedFile) {
        const imageFormData = new FormData();
        imageFormData.append('file', selectedFile);
        
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
        imageUrl = uploadData.url;
        console.log('Image uploaded successfully:', imageUrl);
      }

      // Then save the record to Airtable with the image URL
      console.log('Saving to Airtable...', {
        imageUrl,
        description: aiResponse?.description,
        userComment: transcription
      });

      const response = await fetch('/api/save-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          description: aiResponse?.description || '',
          userComment: transcription || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save to Airtable');
      }

      setError('');
      console.log('Successfully saved to Airtable:', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save to Airtable';
      setError(errorMessage);
      console.error('Airtable save error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-8 relative">
      {!selectedImage && (
        <label className="upload-button cursor-pointer">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload}
            className="hidden"
          />
          <span className="flex items-center">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload Image or Take Photo
          </span>
        </label>
      )}

      {selectedImage && (
        <div className="w-full space-y-6">
          <div className="relative w-full max-h-[50vh] rounded-lg overflow-hidden shadow-lg">
            <img 
              src={selectedImage} 
              alt="Selected" 
              className="object-contain w-full h-full"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-200 rounded-lg">
              {error}
            </div>
          )}

          {aiResponse && (
            <div className="space-y-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">AI Description</h2>
                <p className="text-gray-700 dark:text-gray-300">{aiResponse.description}</p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">AI Remarks</h2>
                <p className="text-gray-600 dark:text-gray-400 italic">{aiResponse.remarks}</p>
              </div>
              
              <div className="pt-4">
                {isPlaying ? (
                  <div className="text-blue-500 flex items-center">
                    <span className="loader mr-2"></span>
                    Playing audio description...
                  </div>
                ) : (
                  <button
                    onClick={() => playDescription(aiResponse.description + '. ' + aiResponse.remarks)}
                    className="play-button"
                  >
                    <span className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                      </svg>
                      Play Description
                    </span>
                  </button>
                )}
              </div>

              <div className="pt-6 border-t">
                <h2 className="text-xl font-semibold mb-4">Record Your Response</h2>
                <AudioRecorder onTranscriptionComplete={handleTranscriptionComplete} />
                
                {transcription && (
                  <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="font-semibold mb-2">Your Transcribed Comment:</h3>
                    <p className="italic text-gray-600 dark:text-gray-400">{transcription}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 