import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';
import { Language } from '@/app/context/LanguageContext';
import { checkAuth } from '@/utils/auth';

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
export const maxDuration = 120; // 2 minutes

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
  // Check authentication first without casting to any
  const authError = await checkAuth(request);
  if (authError) {
    return authError;
  }

  try {
    // Handle formData with larger sizes
    const formData = await request.formData();
    const file = formData.get('file') as File;
    // Get user's selected language, default to English if not provided
    const language = (formData.get('language') as Language) || 'en';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Convert file to buffer for Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary first
    const cloudinaryResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          resource_type: 'auto',
          timeout: 60000 // 60 second timeout for Cloudinary
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    const imageUrl = (cloudinaryResult as any).secure_url;

    try {
      // Call OpenAI Vision API with the image URL and language-specific prompt
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${promptTemplates[language]} Please respond in ${language}.`
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 1500
      });

      // Extract the content from the response
      const content = response.choices[0]?.message?.content || '';

      // Process the response to extract structured information
      const sections = content.split(/\n\n(?=[A-Za-zÀ-ÖØ-öø-ÿ])/);
      const description = sections[0] || content;
      const remarks = sections.length > 1 
        ? sections.slice(1).join('\n\n')
        : "What do you think about this image?";

      return NextResponse.json({ description, remarks });

    } catch (openaiError: unknown) {
      console.error('OpenAI API Error:', openaiError);
      let errorMessage = 'AI Service Error';
      if (openaiError instanceof Error) {
        errorMessage = openaiError.message;
        if (openaiError.name === 'TimeoutError' || openaiError.message.includes('timeout')) {
          return NextResponse.json(
            { error: 'The image analysis is taking too long. Please try with a smaller image or try again later.' },
            { status: 504 }
          );
        }
      }
      return NextResponse.json(
        { error: `AI Service Error: ${errorMessage}` },
        { status: 500 }
      );
    }

  } catch (error: unknown) {
    console.error('Request processing error:', error);
    let errorMessage = 'Upload Error';
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
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
