// src/app/api/text-to-speech/stream.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAuth } from '@/utils/auth';

// Initialize the OpenAI client with a per-call timeout (9 seconds)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 9000, // 9 seconds per TTS API call
});

// Fallback function: returns a silent audio buffer (customize this with an actual silent audio snippet if needed)
function getSilentAudioBuffer(): Buffer {
  // For demonstration, we return an empty buffer.
  // In production, consider returning a small, pre-generated silent MP3 snippet.
  return Buffer.from([]);
}

export const dynamic = 'force-dynamic';
export const maxDuration = 10; // Ensure the function completes within Vercel's limits

export async function POST(request: Request) {
  // Check authentication first
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }
  
  try {
    const { text } = await request.json();
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Split the text into manageable chunks to avoid long processing times
    const MAX_CHARS = 500; // Adjust chunk size as needed for performance
    const textChunks: string[] = [];
    for (let i = 0; i < text.length; i += MAX_CHARS) {
      textChunks.push(text.substring(i, i + MAX_CHARS));
    }

    // Create a ReadableStream to stream audio data as chunks are processed
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < textChunks.length; i++) {
          const chunkText = textChunks[i];
          try {
            // Call the OpenAI TTS API for the current text chunk
            const ttsResponse = await openai.audio.speech.create({
              model: 'tts-1', // Fast, lightweight model
              voice: 'ash',   // Example voice – adjust as necessary
              input: chunkText,
              speed: 1.2,     // Slightly faster playback to reduce processing time
            });

            // Convert the API response into a Buffer
            const arrayBuffer = await ttsResponse.arrayBuffer();
            const audioBuffer = Buffer.from(arrayBuffer);

            // Enqueue this audio chunk into the stream
            controller.enqueue(audioBuffer);
          } catch (err) {
            console.error(`Error processing TTS chunk ${i}:`, err);
            // On error, enqueue a fallback silent audio chunk so playback continues gracefully
            controller.enqueue(getSilentAudioBuffer());
          }
        }
        // Close the stream once all chunks are processed
        controller.close();
      },
    });

    // Return the streaming response with proper headers so that the client recognizes it as audio
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: unknown) {
    console.error('TTS Streaming Error:', error);
    return NextResponse.json(
      { error: `TTS Streaming Error: ${error instanceof Error ? error.message : 'unknown error'}` },
      { status: 500 }
    );
  }
}
