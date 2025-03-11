import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAuth } from '@/utils/auth';

// Configure OpenAI with a timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 9000, // 9 seconds timeout to allow for Vercel's 10s limit
});

// Set route config to optimize for Vercel
export const dynamic = 'force-dynamic';
export const maxDuration = 10; // Maximum allowed for Vercel hobby plan

export async function POST(request: Request) {
  // Check authentication first
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  try {
    // More robust parsing of request body
    const requestBody = await request.text();
    let textToProcess: string;
    
    try {
      // Try to parse as JSON
      if (requestBody.trim()) {
        const parsed = JSON.parse(requestBody);
        textToProcess = parsed.text || '';
      } else {
        textToProcess = '';
      }
    } catch (parseError) {
      console.error('Failed to parse request body as JSON:', parseError);
      console.log('Request body:', requestBody);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate text
    if (!textToProcess || typeof textToProcess !== 'string' || !textToProcess.trim()) {
      return NextResponse.json(
        { error: 'No valid text provided' },
        { status: 400 }
      );
    }

    // Further sanitize and trim text
    textToProcess = textToProcess.trim();
    console.log(`Processing TTS request for text (${textToProcess.length} chars)`);

    // Implement text chunking for long inputs
    const MAX_CHARS = 1000; // OpenAI processes shorter text faster
    
    // If text is longer than the limit, truncate it
    if (textToProcess.length > MAX_CHARS) {
      // Find a good breaking point (sentence ending or punctuation)
      const possibleBreak = textToProcess.substring(0, MAX_CHARS).lastIndexOf('.');
      const breakPoint = possibleBreak > 0 ? possibleBreak + 1 : Math.min(textToProcess.length, MAX_CHARS);
      textToProcess = textToProcess.substring(0, breakPoint);
      
      console.log(`Text truncated from ${textToProcess.length} to ${textToProcess.length} characters`);
    }

    try {
      // Use a smaller, faster model and a lightweight voice
      const mp3Response = await openai.audio.speech.create({
        model: "tts-1", // tts-1 is faster than tts-1-hd
        voice: "ash", // Changed from "alloy" to "ash"
        input: textToProcess,
        speed: 1.2, // Slightly faster playback to reduce processing time
      });

      // Get the audio data as a buffer
      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      console.log(`Generated audio (${buffer.length} bytes)`);

      // Return the audio file with proper headers
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    } catch (openaiError) {
      console.error('OpenAI TTS API error:', openaiError);
      
      let errorMessage = 'Failed to generate speech';
      if (openaiError instanceof Error) {
        errorMessage = openaiError.message;
      }
      
      return NextResponse.json(
        { error: `OpenAI TTS error: ${errorMessage}` },
        { status: 502 }
      );
    }
  } catch (error: unknown) {
    console.error('Text-to-speech processing error:', error);
    
    // Check if it's a timeout error
    let errorMessage = 'Speech generation error';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.name === 'AbortError' || errorMessage.includes('timeout')) {
        return NextResponse.json(
          { error: 'Text-to-speech processing timed out. Please try with shorter text.' },
          { status: 504 }
        );
      }
    }
    
    return NextResponse.json(
      { error: `Speech generation error: ${errorMessage}` },
      { status: 500 }
    );
  }
}