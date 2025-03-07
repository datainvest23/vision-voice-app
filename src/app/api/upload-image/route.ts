// src/app/api/upload-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';
import { Language } from '@/app/context/LanguageContext';
import { checkAuth } from '@/utils/auth';
import { MessageContentPartParam } from 'openai/resources/beta/threads/messages';

// Configure OpenAI and Cloudinary
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // Increase timeout to 120 seconds
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure route options for handling larger files
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for hobby plan

// Define the expected Cloudinary result type
interface CloudinaryUploadResult {
  secure_url: string;
  // ... other properties ...
}

// Define types for assistant message content
type MessageContentParam = MessageContentPartParam | {
  type: "image_url";
  image_url: { url: string };
};

// Prompt templates for different languages
const promptTemplates: Record<Language, string> = {
  en: `You are "Antiques_Appraisal," an expert in evaluating antique items. Your goal is to receive images (e.g., paintings, drawings, sculptures, artifacts), then:

Item Description & Observations
- Summarize visible features (materials, condition) and distinctive markings.

Historical & Cultural Context
- Outline origin, time period, artist (if known), and cultural significance.
- Reference relevant art movements or historical events.

Recommended Next Steps
- Suggest further research, conservation, restoration, or potential selling/display avenues.
- Propose follow-up if key details are missing.

Questions
- Ask any questions needed to provide a reasoned monetary estimate based on rarity, condition, demand, and historical importance.`,
  de: `Sie sind "Antiques_Appraisal", ein Experte für die Bewertung antiker Objekte. Ihr Ziel ist es, Bilder (z. B. Gemälde, Zeichnungen, Skulpturen, Artefakte) zu erhalten und dann:

Objektbeschreibung & Beobachtungen
- Fassen Sie sichtbare Merkmale (Materialien, Zustand) und markante Kennzeichen zusammen.

Historischer & Kultureller Kontext
- Skizzieren Sie Herkunft, Epoche, Künstler (falls bekannt) und kulturelle Bedeutung.
- Beziehen Sie relevante Kunstströmungen oder historische Ereignisse ein.

Empfohlene Nächste Schritte
- Schlagen Sie weitere Nachforschungen, Konservierungen, Restaurierungen oder Verkaufs-/Ausstellungsoptionen vor.
- Fragen Sie nach fehlenden Details, falls erforderlich.

Fragen
- Stellen Sie alle nötigen Fragen, um eine fundierte Preisschätzung hinsichtlich Seltenheit, Zustand, Nachfrage und geschichtlichem Wert vorzunehmen.`,
  es: `Usted es "Antiques_Appraisal", un experto en la evaluación de artículos antiguos. Su objetivo es recibir imágenes (p. ej., pinturas, dibujos, esculturas, artefactos) y luego:

Descripción y Observaciones
- Resuma las características visibles (materiales, estado) y marcas distintivas.

Contexto Histórico y Cultural
- Describa el origen, el periodo, el artista (si se conoce) y la relevancia cultural.
- Mencione movimientos artísticos o eventos históricos pertinentes.

Próximos Pasos Recomendados
- Sugiera investigación adicional, conservación, restauración o posibles vías de venta/exhibición.
- Proponga seguimiento si faltan detalles claves.

Preguntas
- Haga las preguntas necesarias para ofrecer una estimación monetaria basada en la rareza, el estado, la demanda y la importancia histórica.`,
  fr: `Vous êtes "Antiques_Appraisal", un expert dans l'évaluation d'objets anciens. Votre objectif est de recevoir des images (peintures, dessins, sculptures, artefacts, etc.) puis :

Description & Observations
- Résumez les caractéristiques visibles (matériaux, état) et les marques distinctives.

Contexte Historique & Culturel
- Indiquez l'origine, la période, l'artiste (si connu) et l'importance culturelle.
- Évoquez tout mouvement artistique ou événement historique pertinent.

Prochaines Étapes Conseillées
- Suggérez des pistes de recherche, de conservation, de restauration ou des possibilités de vente/exposition.
- Proposez un suivi si des informations essentielles manquent.

Questions
- Posez toutes les questions nécessaires pour fournir une estimation monétaire fondée sur la rareté, l'état, la demande et l'importance historique.`
};

// This sets body parser config for Next.js 15+
export async function POST(request: NextRequest) {
  // Check authentication first
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  try {
    // Handle formData with larger sizes
    const formData = await request.formData();
    
    // Get all files with the 'files' key (for multiple files)
    const files = formData.getAll('files') as File[];
    // Also try to get a single file with the 'file' key for backward compatibility
    const singleFile = formData.get('file') as File | null;
    
    // Combine both approaches to handle different client implementations
    let filesToProcess: File[] = [];
    if (files && files.length > 0) {
      filesToProcess = files;
    } else if (singleFile) {
      filesToProcess = [singleFile];
    }
    
    // Get user's selected language, default to English if not provided
    const language = (formData.get('language') as Language) || 'en';

    if (filesToProcess.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    // Upload all images to Cloudinary and get their URLs
    const imageUrls: string[] = [];
    
    for (const file of filesToProcess) {
      // Convert file to buffer for Cloudinary
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Upload to Cloudinary
      const cloudinaryResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto',
            timeout: 60000 // 60 second timeout for Cloudinary
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result as CloudinaryUploadResult);
          }
        ).end(buffer);
      });

      imageUrls.push(cloudinaryResult.secure_url);
    }

    try {
      // Step 1: Create a Thread
      console.log("Creating thread for assistant...");
      const thread = await openai.beta.threads.create();
      
      // Step 2: Add a message with instructions and images to the Thread
      // Prepare message context and intro - mentions we have multiple images if applicable
      const messageText = `${promptTemplates[language]} Please respond in ${language}. ${
        imageUrls.length > 1 ? `I'm providing ${imageUrls.length} images of the same item from different angles.` : ''
      }`;
      
      // Create message content array with text and images
      const messageContent: MessageContentParam[] = [];
      
      // Add text prompt
      messageContent.push({
        type: "text",
        text: messageText
      });
      
      // Add image URLs to the message content
      for (const url of imageUrls) {
        messageContent.push({
          type: "image_url",
          image_url: { url }
        });
      }
      
      console.log(`Adding message with ${imageUrls.length} image(s) to thread ${thread.id}...`);
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: messageContent as any // Type assertion needed due to OpenAI SDK typing limitations
      });
      
      // Step 3: Run the Assistant on the Thread (without streaming)
      console.log(`Running assistant ${process.env.OPENAI_ASSISTANT_ID} on thread...`);
      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: process.env.OPENAI_ASSISTANT_ID!,
        model: "gpt-4o-mini", // Explicitly use gpt-4o-mini as requested
        // Note: streaming is handled differently, see below
      });
      
      // Step 4: Wait for the run to complete (poll)
      console.log(`Waiting for assistant run ${run.id} to complete...`);
      let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      
      // Poll for completion with a timeout (45 seconds max to stay under 60s limit)
      const startTime = Date.now();
      const timeout = 45000; // 45 seconds
      
      while (
        !['completed', 'failed', 'cancelled', 'expired'].includes(runStatus.status) &&
        Date.now() - startTime < timeout
      ) {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check status again
        runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        
        // Handle failures
        if (runStatus.status === 'failed' || runStatus.status === 'cancelled' || runStatus.status === 'expired') {
          console.error(`Assistant run failed with status: ${runStatus.status}`);
          console.error(`Last error: ${JSON.stringify(runStatus.last_error)}`);
          throw new Error(`Assistant run failed: ${runStatus.last_error?.message || `Status: ${runStatus.status}`}`);
        }
      }
      
      // If we timed out or the run is still in progress
      if (runStatus.status !== 'completed') {
        console.warn(`Assistant run timed out after ${Date.now() - startTime}ms with status: ${runStatus.status}`);
        return NextResponse.json(
          { error: 'Assistant processing timed out. Please try with fewer or smaller images.' },
          { status: 504 }
        );
      }
      
      // Step 5: Retrieve the Assistant's response
      console.log(`Assistant run completed. Retrieving messages...`);
      const messages = await openai.beta.threads.messages.list(thread.id, {
        order: "desc", // Get newest messages first
        limit: 1 // We only need the latest message
      });
      
      // Get the latest message from the assistant (should be the first one in the list with role=assistant)
      const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
      
      if (!assistantMessage) {
        throw new Error('No response from assistant');
      }
      
      // Extract the text content from the message
      let responseText = '';
      for (const item of assistantMessage.content) {
        if (item.type === 'text') {
          responseText += item.text.value;
        }
      }
      
      // Process the response to extract structured information
      const sections = responseText.split(/\n\n(?=[A-Za-zÀ-ÖØ-öø-ÿ])/);
      const description = sections[0] || responseText;
      const remarks = sections.length > 1
        ? sections.slice(1).join('\n\n')
        : "What do you think about this item?";
      
      console.log(`Successfully processed analysis with assistant`);
      return NextResponse.json({ description, remarks });
      
    } catch (assistantError: unknown) {
      console.error('OpenAI Assistant API Error:', assistantError);
      let errorMessage = 'AI Assistant Error';
      if (assistantError instanceof Error) {
        errorMessage = assistantError.message;
        console.error('Error details:', errorMessage);
      }
      return NextResponse.json(
        { error: `AI Assistant Error: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('Request processing error:', error);
    let errorMessage = 'Upload Error';
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.name === 'TimeoutError' || errorMessage.includes('timeout')) {
        return NextResponse.json(
          { error: 'Request timed out. Please try with a smaller image or try again later.' },
          { status: 504 }
        );
      }
    }
    return NextResponse.json(
      { error: `Upload Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}