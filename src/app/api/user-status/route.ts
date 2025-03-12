import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkAuth } from '@/utils/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
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
    
    // Check how many valuations the user has created in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { data: recentValuations, error: valError } = await supabase
      .from('valuations')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo.toISOString());
    
    if (valError) {
      console.error('Error fetching valuations:', valError);
      return NextResponse.json(
        { error: 'Failed to check recent valuations' },
        { status: 500 }
      );
    }
    
    // Get user's token balance
    const { data: userTokens, error: tokenError } = await supabase
      .from('user_tokens')
      .select('token_count')
      .eq('user_id', userId)
      .single();
    
    if (tokenError && tokenError.code !== 'PGRST116') { // Not found is ok for new users
      console.error('Error fetching token balance:', tokenError);
      return NextResponse.json(
        { error: 'Failed to fetch token balance' },
        { status: 500 }
      );
    }
    
    // Calculate free valuations left (1 per day)
    const freeValuationsLeft = recentValuations.length < 1 ? 1 : 0;
    
    // Return user status
    return NextResponse.json({
      freeValuationsLeft,
      tokenBalance: userTokens?.token_count || 0,
      recentValuationCount: recentValuations.length,
      nextFreeValuation: freeValuationsLeft === 0 
        ? new Date(recentValuations[0].created_at).getTime() + 24 * 60 * 60 * 1000 
        : null
    });
    
  } catch (error) {
    console.error('User status error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve user status' },
      { status: 500 }
    );
  }
} 