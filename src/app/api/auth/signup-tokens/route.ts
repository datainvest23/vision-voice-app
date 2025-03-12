import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// This endpoint can be called after a user signs up to grant initial tokens
export async function POST(request: NextRequest) {
  try {
    // Get the request body which should contain the user ID
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    // Check if the user already has tokens by using a direct select
    // This is just for the response and doesn't affect token granting
    const { data: existingTokens } = await supabase
      .from('user_tokens')
      .select('token_count')
      .eq('user_id', userId)
      .single();
    
    // If tokens already exist, don't add more
    if (existingTokens) {
      return NextResponse.json({
        message: 'User already has tokens',
        tokenCount: existingTokens.token_count
      });
    }
    
    // Initial token grant (5 tokens)
    const initialTokens = 5;
    
    // Instead of direct insertion, call the database function
    const { error: functionError } = await supabase.rpc(
      'grant_initial_tokens',
      {
        user_id: userId,
        token_count: initialTokens,
        transaction_type: 'signup_bonus'
      }
    );
    
    if (functionError) {
      console.error('Error granting initial tokens:', functionError);
      return NextResponse.json(
        { error: 'Failed to grant initial tokens', details: functionError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: `Successfully granted ${initialTokens} tokens to new user`,
      tokenCount: initialTokens
    });
    
  } catch (error) {
    console.error('Token grant error:', error);
    return NextResponse.json(
      { error: 'Failed to process token grant' },
      { status: 500 }
    );
  }
} 