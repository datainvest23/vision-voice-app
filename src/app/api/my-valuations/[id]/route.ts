// Next.js App Router API Route with Dynamic Route Segment
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@/utils/supabase/server';
import { checkAuth } from '@/utils/auth';

export const dynamic = 'force-dynamic';

// Use NextApiRequest and NextApiResponse types
export async function GET(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

  // Check if user is authenticated
  const authError = await checkAuth();
  if (authError) {
    return res.status(401).json(authError);
  }

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    
    const userId = user.id;
    
    if (!id) {
      return res.status(400).json({ error: 'Valuation ID is required' });
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
        return res.status(404).json({ error: 'Valuation not found or you do not have permission to view it' });
      }
      
      console.error('Error fetching valuation:', error);
      return res.status(500).json({ error: 'Failed to fetch valuation' });
    }
    
    return res.json(valuation);
    
  } catch (error) {
    console.error('Valuation fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch valuation' });
  }
}

// DELETE handler using the same pattern
export async function DELETE(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;

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
      return res.status(401).json({ error: 'Authentication failed' });
    }
    
    const userId = user.id;
    
    if (!id) {
      return res.status(400).json({ error: 'Valuation ID is required' });
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
        return res.status(404).json({ error: 'Valuation not found or you do not have permission to delete it' });
      }
      
      console.error('Error checking valuation:', fetchError);
      return res.status(500).json({ error: 'Failed to verify valuation ownership' });
    }
    
    // Delete the valuation
    const { error: deleteError } = await supabase
      .from('valuations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
      
    if (deleteError) {
      console.error('Error deleting valuation:', deleteError);
      return res.status(500).json({ error: 'Failed to delete valuation' });
    }
    
    return res.json({ message: 'Valuation deleted successfully' });
  } catch (error) {
    console.error('Valuation deletion error:', error);
    return res.status(500).json({ error: 'Failed to delete valuation' });
  }
} 