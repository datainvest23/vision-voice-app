// Next.js App Router API Route with Dynamic Route Segment
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkAuth } from '@/utils/auth';

export const dynamic = 'force-dynamic';

// Use NextRequest and NextResponse types
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = context.params;

  // Check if user is authenticated
  const authError = await checkAuth();
  if (authError) {
    return NextResponse.json(authError, { status: 401 });
  }

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    const userId = user.id;
    
    if (!id) {
      return NextResponse.json({ error: 'Valuation ID is required' }, { status: 400 });
    }
    
    // Get the specific valuation
    const { data: valuation, error } = await supabase
      .from('valuations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId) // Ensure user owns this valuation
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // Not found or not authorized
        return NextResponse.json({ error: 'Valuation not found or you do not have permission to view it' }, { status: 404 });
      }
      
      console.error('Error fetching valuation:', error);
      return NextResponse.json({ error: 'Failed to fetch valuation' }, { status: 500 });
    }
    
    return NextResponse.json(valuation);
    
  } catch (error) {
    console.error('Valuation fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch valuation' }, { status: 500 });
  }
}

// DELETE handler using the same pattern
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = context.params;

  // Check if user is authenticated
  const authError = await checkAuth();
  if (authError) {
    return NextResponse.json(authError, { status: 401 });
  }

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    const userId = user.id;
    
    if (!id) {
      return NextResponse.json({ error: 'Valuation ID is required' }, { status: 400 });
    }
    
    // First check if the valuation exists and belongs to the user
    const { error: fetchError } = await supabase
      .from('valuations')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
      
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Valuation not found or you do not have permission to delete it' }, { status: 404 });
      }
      
      console.error('Error checking valuation:', fetchError);
      return NextResponse.json({ error: 'Failed to verify valuation ownership' }, { status: 500 });
    }
    
    // Delete the valuation
    const { error: deleteError } = await supabase
      .from('valuations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
      
    if (deleteError) {
      console.error('Error deleting valuation:', deleteError);
      return NextResponse.json({ error: 'Failed to delete valuation' }, { status: 500 });
    }
    
    return NextResponse.json({ message: 'Valuation deleted successfully' });
  } catch (error) {
    console.error('Valuation deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete valuation' }, { status: 500 });
  }
} 