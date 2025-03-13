import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkAuth } from '@/utils/auth';

export const dynamic = 'force-dynamic';

// Use the exact pattern Next.js 15 expects for dynamic routes
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check if user is authenticated
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    const valuationId = params.id;
    
    if (!valuationId) {
      return NextResponse.json(
        { error: 'Valuation ID is required' },
        { status: 400 }
      );
    }
    
    // Get the specific valuation
    const { data: valuation, error } = await supabase
      .from('valuations')
      .select('*')
      .eq('id', valuationId)
      .eq('user_id', userId) // Ensure user owns this valuation
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Not found or not authorized
        return NextResponse.json(
          { error: 'Valuation not found or you do not have permission to view it' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching valuation:', error);
      return NextResponse.json(
        { error: 'Failed to fetch valuation' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(valuation);
    
  } catch (error) {
    console.error('Valuation fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch valuation' },
      { status: 500 }
    );
  }
} 