import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/utils/auth';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Check if user is authenticated
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  // Get the user session to ensure we have valid authentication
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication session expired. Please login again.' },
      { status: 401 }
    );
  }

  // Instead of directly saving to Supabase, forward the request to our new create-valuation API
  // which will handle monetization rules
  try {
    const requestData = await request.json();

    // Format the data for the create-valuation API
    const valuationData = {
      title: requestData.title || `Antique Valuation ${new Date().toLocaleDateString()}`,
      fullDescription: requestData.fullDescription || '',
      summary: requestData.summary || '',
      userComment: requestData.userComment || '',
      images: requestData.images || [],
      assistantResponse: requestData.assistantResponse || '',
      assistantFollowUp: requestData.assistantFollowUp || '',
      isDetailed: requestData.isDetailed || false
    };

    // Call the create-valuation API
    const valuationResponse = await fetch(new URL('/api/create-valuation', request.url).href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass through cookie header if it exists
        ...(request.headers.get('cookie') 
          ? { 'cookie': request.headers.get('cookie')! } 
          : {})
      },
      body: JSON.stringify(valuationData)
    });

    // Get the response data
    const responseData = await valuationResponse.json();

    // Return the same status and data from the valuation API
    return NextResponse.json(responseData, { status: valuationResponse.status });

  } catch (error) {
    console.error('Error saving to database:', error);
    return NextResponse.json(
      { error: 'Failed to save data to the database' },
      { status: 500 }
    );
  }
} 