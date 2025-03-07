import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAuth } from '@/utils/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  // Check authentication first (ensure checkAuth accepts Request type)
  const authError = await checkAuth(request);
  if (authError) {
    return authError;
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Convert Blob to File with proper name and type
    const file = new File([audioFile], 'audio.webm', { type: 'audio/webm' });

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: "whisper-1",
        language: "en", // Specify language if known
        response_format: "json",
      });

      return NextResponse.json({ text: transcription.text });
    } catch (openaiError: unknown) {
      console.error('OpenAI API Error:', openaiError);
      let openaiErrorMessage = 'OpenAI API Error';
      if (openaiError instanceof Error) {
        openaiErrorMessage = openaiError.message;
      }
      return NextResponse.json(
        { error: `OpenAI API Error: ${openaiErrorMessage}` },
        { status: 500 }
      );
    }

  } catch (error: unknown) {
    console.error('Request processing error:', error);
    let errorMessage = 'Failed to process audio';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: `Failed to process audio: ${errorMessage}` },
      { status: 500 }
    );
  }
}
