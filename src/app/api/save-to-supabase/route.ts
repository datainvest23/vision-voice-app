import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/utils/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Check if user is authenticated
  const authError = await checkAuth();
  if (authError) {
    return authError;
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
        // Pass through authorization headers
        ...(request.headers.get('authorization') 
          ? { 'authorization': request.headers.get('authorization')! } 
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