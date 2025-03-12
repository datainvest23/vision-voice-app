import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkAuth } from '@/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
    
    // Parse pagination parameters from URL
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    
    // Calculate pagination values
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    // Get all valuations for the user with pagination
    const { data: valuations, error, count } = await supabase
      .from('valuations')
      .select('id, title, summary, created_at, is_detailed', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) {
      console.error('Error fetching valuations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch valuations' },
        { status: 500 }
      );
    }
    
    // Return valuations with pagination info
    return NextResponse.json({
      valuations,
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: count ? Math.ceil(count / pageSize) : 0
      }
    });
    
  } catch (error) {
    console.error('Valuations fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch valuations' },
      { status: 500 }
    );
  }
} 