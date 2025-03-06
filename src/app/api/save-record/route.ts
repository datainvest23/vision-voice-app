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

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

export async function POST(request: Request) {
  // Check authentication first
  const authError = await checkAuth(request as any);
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

  } catch (error: any) {
    console.error('Airtable error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save record' },
      { status: error.statusCode || 500 }
    );
  }
} 