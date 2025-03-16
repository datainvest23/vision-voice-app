import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkAuth } from '@/utils/auth';

export const dynamic = 'force-dynamic';

// Get a single valuation by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string }}
) {
  // Check authentication
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  try {
    // Get the ID from the URL parameter
    const id = params.id;
    
    // Get authenticated user
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    // Get the valuation with the given ID
    const { data: valuation, error } = await supabase
      .from('valuations')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching valuation:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Valuation not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch valuation' }, { status: 500 });
    }

    return NextResponse.json({ valuation });
  } catch (error) {
    console.error('Valuation fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch valuation details' },
      { status: 500 }
    );
  }
}

// Delete a valuation by ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string }}
) {
  // Check authentication
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  try {
    // Get the ID from the URL parameter
    const id = params.id;
    
    // Get authenticated user
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    // Check if the valuation exists and belongs to the user
    // We don't need to use the result, just check if there's an error
    const { error: fetchError } = await supabase
      .from('valuations')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Valuation not found or you do not have permission to delete it' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to verify valuation ownership' }, { status: 500 });
    }

    // Delete the valuation
    const { error: deleteError } = await supabase
      .from('valuations')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (deleteError) {
      console.error('Error deleting valuation:', deleteError);
      return NextResponse.json({ error: 'Failed to delete valuation' }, { status: 500 });
    }

    return NextResponse.json({ message: `Valuation ${id} deleted successfully` });
  } catch (error) {
    console.error('Valuation deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete valuation' },
      { status: 500 }
    );
  }
} 