// src/app/api/save-record/route.ts
import { NextResponse } from 'next/server';
import Airtable from 'airtable';
import { checkAuth } from '@/utils/auth'; // Import the checkAuth function

// 1. Define the Attachment type (for Airtable images)
interface Attachment {
  url: string;
  filename?: string; // Optional, but good practice to include
}

// 2. Define the *exact* structure of YOUR Airtable records.
//    IMPORTANT: Use the *exact* field names from your Airtable base.
interface MyRecordFields {
  ID?: string | number; //ID might not be needed on creation
  Image?: Attachment[]; // Array of attachments
  Image_Description: string;
  Audio_Note?: string;
  user_email?: string;
}

// 3. Define an error interface (optional, but good practice)
interface AirtableError extends Error {
  statusCode?: number;
}

// 4. Initialize Airtable (using your environment variables)
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

// 5. The POST handler function
export async function POST(request: Request) {
  // --- Authentication (using a placeholder for now) ---
  const authError = await checkAuth(); // Call your auth function
  if (authError) {
    return authError; // Return if unauthorized
  }

  // --- Request Handling and Record Creation ---
  try {
    // Get data from the request body
    const { imageUrls, description, userComment, userEmail } = await request.json();

    // Basic validation (always a good idea)
    if (!description) {
      return NextResponse.json({ error: 'Image Description is required' }, { status: 400 });
    }

    // Create the record in Airtable.  IMPORTANT: Use the MyRecordFields type here.
    const records = await base<MyRecordFields>('Table 1').create([ // Use 'Table 1' or your table name
      {
        fields: {
          Image_Description: description,  // Match Airtable field name
          Audio_Note: userComment,        // Match Airtable field name
          Image: imageUrls
            ? imageUrls.map((url: string) => ({ url })) // Convert URLs to Attachment objects
            : [],
          user_email: userEmail,           // Match Airtable field name
        },
      },
    ]);

    // Return a success response
    return NextResponse.json({
      success: true,
      id: records[0].id, //  Get the ID of the created record
      message: 'Record created successfully!',
    }, { status: 201 }); // Use 201 Created for successful creation


  } catch (error: unknown) {
    // --- Error Handling ---
    console.error('Airtable error:', error); // Log the error for debugging
    let errorMessage = 'Failed to save record';
    let statusCode = 500; // Default to Internal Server Error

    // Improve error handling (check if it's an Airtable error)
    if (error instanceof Error) {
      errorMessage = error.message;
      if ((error as AirtableError).statusCode) {
        statusCode = (error as AirtableError).statusCode;
      }
    }

    // Return an error response
    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}