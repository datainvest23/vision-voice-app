'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define available languages
export type Language = 'en' | 'de' | 'es' | 'fr';

// Define language context type
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

// Create the context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translations for all text in the application
const translations: Record<Language, Record<string, string>> = {
  en: {
    title: 'Antiques Appraisal',
    subtitle: 'Upload Images and Description of the Item you want to evaluate',
    uploadButton: 'Upload Image or Take Photo',
    takePhoto: 'Take Photo',
    uploadImage: 'Upload Image',
    addAnother: '+ Add another image',
    remaining: 'remaining',
    aiDescription: 'AI Description',
    aiRemarks: 'AI Remarks',
    description: 'Description',
    saveToDatabase: 'Save to Database',
    successfullySaved: 'Successfully saved!',
    addNewImage: 'Add New Image',
    processingImage: 'Processing image...',
    audioPlaying: 'Audio playing...',
    recordComment: 'Record Comment',
    processingResponse: 'Processing response...',
    streamingOn: 'Streaming Audio: On',
    streamingOff: 'Streaming Audio: Off',
    summary: 'Summary',
    fullAnalysis: 'Full Analysis',
    playSummary: 'Play Summary',
    playFullAnalysis: 'Play Full Analysis',
    processingComment: 'Processing your comment...',
    analyzeImages: 'Analyze Images',
  },
  de: {
    title: 'Antiquitäten Bewertung',
    subtitle: 'Laden Sie Bilder und Beschreibung des Gegenstands hoch, den Sie bewerten möchten',
    uploadButton: 'Bild hochladen oder Foto aufnehmen',
    takePhoto: 'Foto aufnehmen',
    uploadImage: 'Bild hochladen',
    addAnother: '+ Weiteres Bild hinzufügen',
    remaining: 'übrig',
    aiDescription: 'KI-Beschreibung',
    aiRemarks: 'KI-Bemerkungen',
    description: 'Beschreibung',
    saveToDatabase: 'In Datenbank speichern',
    successfullySaved: 'Erfolgreich gespeichert!',
    addNewImage: 'Neues Bild hinzufügen',
    processingImage: 'Bild wird verarbeitet...',
    audioPlaying: 'Audio wird abgespielt...',
    recordComment: 'Kommentar aufnehmen',
    processingResponse: 'Antwort wird verarbeitet...',
    streamingOn: 'Audio-Streaming: Ein',
    streamingOff: 'Audio-Streaming: Aus',
    summary: 'Zusammenfassung',
    fullAnalysis: 'Vollständige Analyse',
    playSummary: 'Zusammenfassung abspielen',
    playFullAnalysis: 'Vollständige Analyse abspielen',
    processingComment: 'Verarbeitung Ihres Kommentars...',
    analyzeImages: 'Bilder analysieren',
  },
  es: {
    title: 'Tasación de Antigüedades',
    subtitle: 'Suba imágenes y descripción del objeto que desea evaluar',
    uploadButton: 'Subir imagen o tomar foto',
    takePhoto: 'Tomar foto',
    uploadImage: 'Subir imagen',
    addAnother: '+ Agregar otra imagen',
    remaining: 'restantes',
    aiDescription: 'Descripción de IA',
    aiRemarks: 'Observaciones de IA',
    description: 'Descripción',
    saveToDatabase: 'Guardar en base de datos',
    successfullySaved: '¡Guardado con éxito!',
    addNewImage: 'Agregar nueva imagen',
    processingImage: 'Procesando imagen...',
    audioPlaying: 'Audio reproduciéndose...',
    recordComment: 'Grabar comentario',
    processingResponse: 'Procesando respuesta...',
    streamingOn: 'Transmisión de audio: Activada',
    streamingOff: 'Transmisión de audio: Desactivada',
    summary: 'Resumen',
    fullAnalysis: 'Análisis Completo',
    playSummary: 'Reproducir Resumen',
    playFullAnalysis: 'Reproducir Análisis Completo',
    processingComment: 'Procesando tu comentario...',
    analyzeImages: 'Analizar imágenes',
  },
  fr: {
    title: 'Évaluation d\'Antiquités',
    subtitle: 'Téléchargez des images et une description de l\'objet que vous souhaitez évaluer',
    uploadButton: 'Télécharger une image ou prendre une photo',
    takePhoto: 'Prendre une photo',
    uploadImage: 'Télécharger une image',
    addAnother: '+ Ajouter une autre image',
    remaining: 'restants',
    aiDescription: 'Description IA',
    aiRemarks: 'Remarques IA',
    description: 'Description',
    saveToDatabase: 'Enregistrer dans la base de données',
    successfullySaved: 'Enregistré avec succès !',
    addNewImage: 'Ajouter une nouvelle image',
    processingImage: 'Traitement de l\'image...',
    audioPlaying: 'Audio en cours de lecture...',
    recordComment: 'Enregistrer un commentaire',
    processingResponse: 'Traitement de la réponse...',
    streamingOn: 'Streaming audio: Activé',
    streamingOff: 'Streaming audio: Désactivé',
    summary: 'Résumé',
    fullAnalysis: 'Analyse Complète',
    playSummary: 'Jouer le Résumé',
    playFullAnalysis: 'Jouer l\'Analyse Complète',
    processingComment: 'Traitement de votre commentaire...',
    analyzeImages: 'Analyser les images',
  }
};

// Provider component
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  // Translation function
  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const value = {
    language,
    setLanguage,
    t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// Hook to use the language context
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
} 