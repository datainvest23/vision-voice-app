// src/app/api/save-record/route.ts
import { NextResponse } from 'next/server';
import Airtable from 'airtable';
import { checkAuth } from '@/utils/auth';

interface Attachment {
  url: string;
  filename?: string;
}

// Define your specific fields
interface MyRecordFields {
  Image_Description: string;
  Audio_Note?: string;
  Image?: Attachment[];
  user_email?: string;
}

// Create a mapped type to combine MyRecordFields with Airtable.FieldSet
type MyAirtableRecord = {
  [K in keyof MyRecordFields]: MyRecordFields[K];
} & Airtable.FieldSet;


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
    const { imageUrls, description, userComment, userEmail } = await request.json();

    if (!description) {
      return NextResponse.json({ error: 'Image Description is required' }, { status: 400 });
    }

    // Use the MAPPED TYPE here:
    const records = await base<MyAirtableRecord>('Table 1').create([
      {
        fields: {
          Image_Description: description,
          Audio_Note: userComment,
          Image: imageUrls
            ? imageUrls.map((url: string) => ({ url }))
            : [],
          user_email: userEmail,
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      id: records[0].id,
      message: 'Record created successfully!',
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Airtable error:', error);
    let errorMessage = 'Failed to save record';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
      if ((error as AirtableError).statusCode) {
        statusCode = (error as AirtableError).statusCode;
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}