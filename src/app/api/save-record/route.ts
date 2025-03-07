import { NextResponse } from 'next/server';
import Airtable from 'airtable';
import { checkAuth } from '@/utils/auth';

interface Attachment {
  url: string;
}

// Corrected Fields interface:  No longer extends Airtable.FieldSet
interface Fields {
  Image_Description: string;
  Audio_Note?: string;
  Image?: Attachment[]; // Corrected:  Attachment[], not readonly
}

interface AirtableError extends Error {
  statusCode?: number;
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

export async function POST(request: Request) {
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  try {
    // Use imageUrls (plural) to match ImageUpload.tsx
    const { imageUrls, description, userComment } = await request.json();

    if (!description) {
      throw new Error('Description is required');
    }

    console.log('Creating record with:', { imageUrls, description, userComment });

    // Correctly map imageUrls to the Attachment format:
    const attachments = imageUrls ? imageUrls.map((url: string) => ({ url })) : [];

    const record = await base<Fields>('Table 1').create({
      Image_Description: description,
      Audio_Note: userComment || '',
      Image: attachments, // Pass the correctly formatted attachments
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
      const anyError = error as AirtableError;
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