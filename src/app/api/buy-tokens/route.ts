import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkAuth } from '@/utils/auth';
import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  // @ts-expect-error - API version compatibility issue
  apiVersion: '2023-10-16',
});

export const dynamic = 'force-dynamic';

interface TokenPurchaseRequest {
  amount: 5 | 10; // Only allow 5 or 10 token packages
}

export async function POST(request: NextRequest) {
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
    
    // Parse request body
    const { amount }: TokenPurchaseRequest = await request.json();
    
    // Validate amount
    if (amount !== 5 && amount !== 10) {
      return NextResponse.json(
        { error: 'Invalid token amount. Choose either 5 or 10 tokens.' },
        { status: 400 }
      );
    }
    
    // Calculate price based on amount (5 tokens for $5, 10 tokens for $9)
    const unitAmount = amount === 5 ? 500 : 900; // In cents
    
    // Create a Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { 
            name: `${amount} Antique Valuation Tokens`,
            description: `Purchase ${amount} tokens for antique valuations on our platform.`
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/token-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
      metadata: {
        userId,
        tokenAmount: amount.toString(),
        purchaseType: 'tokens'
      }
    });
    
    return NextResponse.json({
      status: 'success',
      sessionId: session.id,
      url: session.url
    });
    
  } catch (error) {
    console.error('Token purchase error:', error);
    return NextResponse.json(
      { error: 'Failed to process token purchase' },
      { status: 500 }
    );
  }
} 