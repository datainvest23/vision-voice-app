// src/app/api/save-record/route.ts
import { NextResponse } from 'next/server';
import Airtable from 'airtable';
import { checkAuth } from '@/utils/auth';

// Define types for Airtable
interface Attachment {
  url: string;
}

interface Fields {
  Image_Description: string;
  Audio_Note?: string;
  Image?: Attachment[];
}

// Add this interface for the error
interface AirtableError extends Error {
    statusCode?: number;
}

// Initialize Airtable base using environment variables
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

export async function POST(request: Request) {
  // Check authentication first (ensure checkAuth accepts Request type)
  const authError = await checkAuth(request);
  if (authError) {
    return authError;
  }

  try {
    const { imageUrl, description, userComment } = await request.json();

    if (!description) {
      throw new Error('Description is required');
    }

    console.log('Creating record with:', { imageUrl, description, userComment });

    // Create record with proper typing
    const record = await base<Fields>('Table 1').create({
      Image_Description: description,
      Audio_Note: userComment || '',
      Image: imageUrl ? [{ url: imageUrl }] : []
    });

    console.log('Airtable response:', record);

    return NextResponse.json({
      success: true,
      id: record.id,
      message: 'Record created successfully'
    });

  } catch (error: unknown) {
    console.error('Airtable error:', error);
    let errorMessage = 'Failed to save record';
    let status = 500;
    if (error instanceof Error) {
      errorMessage = error.message;
      // If the error contains a statusCode property, use it
      const anyError = error as AirtableError; // Use the defined interface
      if (anyError.statusCode) {
        status = anyError.statusCode;
      }
    }
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}