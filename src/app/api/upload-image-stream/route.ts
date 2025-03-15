import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';
import { Language } from '@/app/context/LanguageContext';
import { checkAuth } from '@/utils/auth';
import { MessageContentPartParam } from 'openai/resources/beta/threads/messages';

// Text encoder for the stream
const encoder = new TextEncoder();

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

/* eslint-disable @typescript-eslint/no-unused-vars */
// The combined content type that OpenAI expects
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type MessageContent = any; // Using any since the OpenAI type is not available
/* eslint-enable @typescript-eslint/no-unused-vars */

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
  console.log("🔵 upload-image-stream API endpoint called");
  
  // Check authentication first
  const authError = await checkAuth();
  if (authError) {
    console.log("🔴 Authentication failed in upload-image-stream API");
    return authError;
  }
  
  console.log("✅ Authentication passed in upload-image-stream API");

  try {
    // Handle formData with larger sizes
    const formData = await request.formData();
    console.log("📦 FormData received, processing files...");
    
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
      return new Response(
        JSON.stringify({ error: 'No files uploaded' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Upload all images to Cloudinary FIRST and get their URLs
            const imageUrls: string[] = [];
            
            for (let i = 0; i < filesToProcess.length; i++) {
              const file = filesToProcess[i];
        console.log(`Processing file ${i+1}/${filesToProcess.length}: ${file.name}`);
        
              // Convert file to buffer for Cloudinary
              const bytes = await file.arrayBuffer();
              const buffer = Buffer.from(bytes);

              // Upload to Cloudinary
        try {
          console.log(`Uploading to Cloudinary: ${file.name}`);
              const cloudinaryResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                  {
                    resource_type: 'auto',
                    timeout: 60000 // 60 second timeout for Cloudinary
                  },
                  (error, result) => {
                if (error) {
                  console.error("Cloudinary upload error:", error);
                  reject(error);
                } else if (!result) {
                  reject(new Error("No result from Cloudinary upload"));
                } else {
                  console.log(`Image ${i+1} uploaded successfully to Cloudinary`);
                  resolve(result as CloudinaryUploadResult);
                }
                  }
                ).end(buffer);
              });

              imageUrls.push(cloudinaryResult.secure_url);
          console.log(`Added image ${i+1} URL: ${cloudinaryResult.secure_url.substring(0, 50)}...`);
        } catch (cloudinaryError) {
          console.error(`Cloudinary upload failed for file ${i+1}:`, cloudinaryError);
          throw new Error(`Failed to upload image ${i+1}: ${cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error'}`);
        }
      }
      
      // Step 1: Create a Thread BEFORE creating the stream
      console.log("Creating thread for assistant...");
            const thread = await openai.beta.threads.create();
      const threadId = thread.id; // Store the thread ID for header
      console.log(`Thread created with ID: ${threadId}`);
            
            // Step 2: Prepare message with instructions and images
            const messageText = `${promptTemplates[language]} Please respond in ${language}. ${
              imageUrls.length > 1 ? `I'm providing ${imageUrls.length} images of the same item from different angles.` : ''
            }`;
            
            // Create message content array with text and images
            const messageContent: MessageContentParam[] = [];
            messageContent.push({ type: "text", text: messageText });
            
            // Add image URLs to the message content
            for (const url of imageUrls) {
              messageContent.push({
                type: "image_url",
                image_url: { url }
              });
            }
            
      // Add message to thread
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        content: messageContent as unknown as any
      });
      
      // NOW create the stream with the threadId captured in closure
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send initial message
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'status', 
              content: 'Starting image processing...' 
            }) + '\n'));
            
            // Send status updates for the steps we've already completed
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'status', 
              content: 'Images uploaded. Creating assistant thread...' 
            }) + '\n'));
            
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'status', 
              content: 'Processing images with AI...' 
            }) + '\n'));
            
            // Step 3: Run the Assistant on the Thread with streaming
            console.log(`Running assistant ${process.env.OPENAI_ASSISTANT_ID} on thread ${thread.id} with streaming...`);
            const runStream = await openai.beta.threads.runs.createAndStream(
              thread.id,
              {
                assistant_id: process.env.OPENAI_ASSISTANT_ID!,
                model: "gpt-4o", // Explicitly use gpt-4o
              }
            );
            
            let isFirstChunk = true;
            let fullText = '';
            
            // Process the stream chunks
            for await (const chunk of runStream) {
              // Only process text message creation events
              if (
                chunk.event === 'thread.message.created' ||
                chunk.event === 'thread.message.delta' ||
                chunk.event === 'thread.run.completed'
              ) {
                try {
                  if (chunk.event === 'thread.message.created') {
                    // A new message has been created
                    if (isFirstChunk) {
                      isFirstChunk = false;
                      controller.enqueue(encoder.encode(JSON.stringify({ 
                        type: 'start', 
                        content: 'Analysis starting...' 
                      }) + '\n'));
                    }
                  } 
                  else if (chunk.event === 'thread.message.delta') {
                    // We got a delta (partial content) update
                    if (chunk.data?.delta?.content?.[0]?.type === 'text') {
                      // Safely access the text value with nullish coalescing
                      const textContent = chunk.data?.delta?.content?.[0]?.text;
                      const textDelta = textContent && 'value' in textContent ? textContent.value : '';
                      
                      fullText += textDelta;
                      
                      // Send the delta to the client
                      controller.enqueue(encoder.encode(JSON.stringify({ 
                        type: 'delta', 
                        content: textDelta 
                      }) + '\n'));
                    }
                  }
                  else if (chunk.event === 'thread.run.completed') {
                    // Send the final message when we know it's complete
                    // Process the response to extract structured information
                    const sections = fullText.split(/\n\n(?=[A-Za-zÀ-ÖØ-öø-ÿ])/);
                    const description = sections[0] || fullText;
                    const remarks = sections.length > 1
                      ? sections.slice(1).join('\n\n')
                      : "What do you think about this item?";
                    
                    // Send structured response
                    controller.enqueue(encoder.encode(JSON.stringify({ 
                      type: 'complete', 
                      content: {
                        description,
                        remarks
                      }
                    }) + '\n'));
                  }
                } catch (err) {
                  console.error('Error processing stream chunk:', err);
                  controller.enqueue(encoder.encode(JSON.stringify({ 
                    type: 'error', 
                    content: 'Error processing response stream' 
                  }) + '\n'));
                }
              }
            }
            
            // End the stream
            controller.close();
            
          } catch (error) {
            console.error('Streaming error:', error);
            controller.enqueue(encoder.encode(JSON.stringify({ 
              type: 'error', 
              content: error instanceof Error ? error.message : 'Unknown error' 
            }) + '\n'));
            controller.close();
          }
        }
      });

      // Create and return a streaming response with thread ID header
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'x-thread-id': threadId  // Use the stored variable
        }
      });
      
    } catch (assistantError: unknown) {
      console.error('OpenAI Assistant API Error:', assistantError);
      let errorMessage = 'AI Assistant Error';
      if (assistantError instanceof Error) {
        errorMessage = assistantError.message;
      }
      return new Response(
        JSON.stringify({ error: `AI Assistant Error: ${errorMessage}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: unknown) {
    console.error('Request processing error:', error);
    let errorMessage = 'Upload Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return new Response(
      JSON.stringify({ error: `Upload Error: ${errorMessage}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 