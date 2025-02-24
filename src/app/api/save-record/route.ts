import { NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configure Airtable
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID!);

export async function POST(request: Request) {
  try {
    const { imageUrl, description, userComment } = await request.json();

    console.log('Received data:', { imageUrl, description, userComment });

    // Create the record
    const records = await base('Table 1').create([
      {
        fields: {
          'Image': imageUrl ? [{ url: imageUrl }] : [],
          'Image_Description': description || '',
          'Audio_Note': userComment || '',
        }
      }
    ]);

    console.log('Record created successfully:', records[0].id);

    return NextResponse.json({ 
      success: true, 
      id: records[0].id,
      message: 'Record created successfully'
    });

  } catch (error: any) {
    console.error('Full Airtable error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: `Failed to save to Airtable: ${error.message}`,
        details: error.toString()
      },
      { status: 500 }
    );
  }
} 