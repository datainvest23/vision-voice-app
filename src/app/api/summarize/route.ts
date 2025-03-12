import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAuth } from '@/utils/auth';
import { Language } from '@/app/context/LanguageContext';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000, // 20 second timeout for Vercel
});

export const dynamic = 'force-dynamic';
export const maxDuration = 25; // 25 seconds max for the function (Vercel limit)

export async function POST(request: NextRequest) {
  // Check authentication first
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  try {
    // Parse and validate request body
    const requestBody = await request.text();
    let text: string;
    let language: Language = 'en';
    
    try {
      if (!requestBody.trim()) {
        return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
      }
      
      const parsed = JSON.parse(requestBody);
      text = parsed.text || '';
      language = (parsed.language as Language) || 'en';
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Limit text length to avoid timeouts
    const MAX_TEXT_LENGTH = 10000; // 10K character limit
    if (text.length > MAX_TEXT_LENGTH) {
      console.log(`Truncating text from ${text.length} to ${MAX_TEXT_LENGTH} characters`);
      text = text.substring(0, MAX_TEXT_LENGTH) + '...';
    }

    // Create language-specific prompts
    const prompts: Record<Language, string> = {
      en: "Create a concise summary of this antique item analysis. Focus on the key details about what the item is, its period, value range, and any crucial characteristics. Keep it under 150 words and make it suitable for audio playback.",
      de: "Erstellen Sie eine prägnante Zusammenfassung dieser Antiquitätenanalyse. Konzentrieren Sie sich auf die wichtigsten Details darüber, was der Gegenstand ist, seine Periode, Wertbereich und alle entscheidenden Eigenschaften. Halten Sie es unter 150 Wörtern und machen Sie es geeignet für die Audiowiedergabe.",
      es: "Crea un resumen conciso de este análisis de antigüedades. Céntrate en los detalles clave sobre qué es el objeto, su período, rango de valor y cualquier característica crucial. Mantenlo en menos de 150 palabras y hazlo adecuado para reproducción de audio.",
      fr: "Créez un résumé concis de cette analyse d'objet antique. Concentrez-vous sur les détails essentiels concernant ce qu'est l'objet, sa période, sa fourchette de valeur et toutes les caractéristiques cruciales. Gardez-le en moins de 150 mots et rendez-le adapté à la lecture audio."
    };

    console.log(`Processing summary request for ${text.length} chars in ${language}`);

    try {
      // Use GPT-4o-mini for summarization with optimized parameters
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: prompts[language] || prompts.en
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const summary = completion.choices[0]?.message?.content || '';

      // Return the summary
      return NextResponse.json({ summary }, { status: 200 });
    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Create a simple fallback summary from the first few sentences
      const sentences = text.split(/[.!?]+\s+/);
      const fallbackSummary = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
        
        return NextResponse.json(
        { summary: fallbackSummary, error: 'Failed to generate summary, using fallback' },
        { status: 200 }
        );
    }
  } catch (error: unknown) {
    console.error('Summarization error:', error);
    let errorMessage = 'Failed to summarize text';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: `Summarization error: ${errorMessage}` },
      { status: 500 }
    );
  }
} 