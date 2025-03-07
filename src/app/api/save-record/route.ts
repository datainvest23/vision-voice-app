import { NextResponse } from 'next/server';
import Airtable from 'airtable';
import { checkAuth } from '@/utils/auth';

interface Attachment {
  url: string;
}

// Extend Airtable.FieldSet to satisfy the constraint.
interface Fields extends Airtable.FieldSet {
  Image_Description: string;
  Audio_Note?: string;
  Image?: Attachment[];
}

interface AirtableError extends Error {
  statusCode?: number;
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

export async function POST(request: Request) {
  // Check authentication first. Note: checkAuth expects no arguments.
  const authError = await checkAuth();
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
