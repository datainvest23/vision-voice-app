import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkAuth } from '@/utils/auth';
import Stripe from 'stripe';
import { cookies } from 'next/headers';

// Define transaction interface
interface Transaction {
  date: string;
  amount: number;
  cost: number;
  type: string;
  payment_id?: string;
}

// Initialize Stripe conditionally to prevent build errors
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      // @ts-expect-error - API version compatibility issue
      apiVersion: '2023-10-16',
    })
  : null;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Check authentication
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  // Check if Stripe is initialized
  if (!stripe) {
    console.error('Stripe is not initialized. Missing API key.');
    return NextResponse.json(
      { error: 'Payment service is not configured' },
      { status: 500 }
    );
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
    
    // Get the session ID from the query parameters
    const sessionId = request.nextUrl.searchParams.get('session_id');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Verify the session is completed and paid
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }
    
    // Check that the user in the session matches the authenticated user
    if (session.metadata?.userId !== userId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }
    
    // Get the purchase type and other metadata
    const purchaseType = session.metadata?.purchaseType;
    const tokenAmount = session.metadata?.tokenAmount;
    const valuationType = session.metadata?.valuationType;
    const valuationData = session.metadata?.data ? JSON.parse(session.metadata.data) : null;
    
    // If this is a token purchase that wasn't processed by the webhook yet
    if (purchaseType === 'tokens' && tokenAmount) {
      const tokens = parseInt(tokenAmount, 10);
      
      // Get current token count
      const { data: existingTokens, error: fetchError } = await supabase
        .from('user_tokens')
        .select('token_count, transaction_history')
        .eq('user_id', userId)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching token record:', fetchError);
        return NextResponse.json(
          { error: 'Failed to fetch token record' },
          { status: 500 }
        );
      }
      
      // Prepare transaction record
      const transaction = {
        date: new Date().toISOString(),
        amount: tokens,
        cost: session.amount_total ? session.amount_total / 100 : null,
        payment_id: session.id,
        verified: true
      };
      
      // Check if we need to create a new record or update existing one
      if (!existingTokens) {
        await supabase
          .from('user_tokens')
          .insert([
            {
              user_id: userId,
              token_count: tokens,
              transaction_history: [transaction],
            },
          ]);
      } else {
        // Check if this transaction is already processed
        const transactionExists = existingTokens.transaction_history?.some(
          (t: Transaction) => t.payment_id === session.id
        );
        
        if (!transactionExists) {
          // Update existing record with new tokens
          const newTokenCount = (existingTokens.token_count || 0) + tokens;
          const transactionHistory = existingTokens.transaction_history || [];
          
          await supabase
            .from('user_tokens')
            .update({
              token_count: newTokenCount,
              transaction_history: [...transactionHistory, transaction],
            })
            .eq('user_id', userId);
        }
      }
      
      return NextResponse.json({
        success: true,
        purchaseType: 'tokens',
        tokenAmount: tokens,
        message: `Successfully added ${tokens} tokens to your account`
      });
    }
    
    // If this is a detailed valuation payment
    if (purchaseType === 'detailed' && valuationType === 'detailed' && valuationData) {
      // TODO: Process the detailed valuation if not already done by webhook
      
      return NextResponse.json({
        success: true,
        purchaseType: 'detailed',
        message: 'Detailed valuation payment processed'
      });
    }
    
    // Default response
    return NextResponse.json({
      success: true,
      message: 'Payment verified'
    });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}