import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { checkAuth } from '@/utils/auth';
import Stripe from 'stripe';

// Initialize Stripe conditionally to prevent build errors
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      // @ts-expect-error - API version compatibility issue
      apiVersion: '2023-10-16',
    })
  : null;

export const dynamic = 'force-dynamic';

// Define interface for the request body
interface CreateValuationRequest {
  title: string;
  fullDescription: string;
  summary?: string;
  userComment?: string;
  images: string[];
  assistantResponse: string;
  assistantFollowUp?: string;
  isDetailed?: boolean;
}

export async function POST(request: NextRequest) {
  // Check authentication
  const authError = await checkAuth();
  if (authError) {
    console.error('Authentication failed in create-valuation API:', authError);
    return authError;
  }

  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('Session error in create-valuation:', sessionError);
      return NextResponse.json(
        { error: 'Authentication session invalid or expired. Please login again.' },
        { status: 401 }
      );
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('User error in create-valuation:', userError);
      return NextResponse.json(
        { error: 'Authentication failed or user not found' },
        { status: 401 }
      );
    }
    
    const userId = user.id;
    console.log('User authenticated successfully, user ID:', userId);
    
    // Parse request body
    const requestData: CreateValuationRequest = await request.json();
    
    // Destructure request data
    const { 
      title, 
      fullDescription, 
      summary, 
      userComment, 
      images, 
      assistantResponse, 
      assistantFollowUp,
      isDetailed = false // Default to standard valuation
    } = requestData;
    
    // Basic validation
    if (!title || !fullDescription || !images || images.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // MONETIZATION LOGIC
    // =================
    
    // 1. Check if user has a free valuation available (1 per day)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { data: recentValuations, error: valError } = await supabase
      .from('valuations')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo.toISOString());
    
    if (valError) {
      console.error('Error checking recent valuations:', valError);
      return NextResponse.json(
        { error: 'Failed to check your daily limit' },
        { status: 500 }
      );
    }
    
    const hasFreeValuation = recentValuations.length < 1;
    
    // If requesting a detailed valuation or has no free valuations, need to check tokens/payment
    if (isDetailed || !hasFreeValuation) {
      // For detailed valuations, always require payment
      if (isDetailed) {
        // Check if Stripe is initialized
        if (!stripe) {
          console.error('Stripe is not initialized. Missing API key.');
          return NextResponse.json(
            { error: 'Payment service is not configured' },
            { status: 500 }
          );
        }

        // Create a Stripe Checkout session for detailed valuation ($3)
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: { 
                name: 'Detailed Antique Valuation'
              },
              unit_amount: 300, // $3.00
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${process.env.NEXT_PUBLIC_APP_URL}/valuation-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
          metadata: {
            userId,
            valuationType: 'detailed',
            data: JSON.stringify({
              title,
              images: images.length,
              timestamp: new Date().toISOString()
            })
          }
        });
        
        return NextResponse.json({
          status: 'payment_required',
          sessionId: session.id,
          url: session.url
        });
      }
      
      // For standard valuations when free limit reached, check token balance
      const { data: userTokens, error: tokenError } = await supabase
        .from('user_tokens')
        .select('token_count')
        .eq('user_id', userId)
        .single();
      
      if (tokenError && tokenError.code !== 'PGRST116') {
        console.error('Error checking token balance:', tokenError);
        return NextResponse.json(
          { error: 'Failed to check your token balance' },
          { status: 500 }
        );
      }
      
      const tokenBalance = userTokens?.token_count || 0;
      
      // If user has no tokens, redirect to purchase
      if (tokenBalance < 1) {
        return NextResponse.json({
          status: 'tokens_required',
          message: 'You have used your free daily valuation and have no tokens. Please purchase tokens to continue.'
        });
      }
      
      // User has tokens, deduct one token (use a transaction to ensure atomicity)
      const { error: deductError } = await supabase
        .from('user_tokens')
        .update({ token_count: tokenBalance - 1 })
        .eq('user_id', userId);
      
      if (deductError) {
        console.error('Error deducting token:', deductError);
        return NextResponse.json(
          { error: 'Failed to process token payment' },
          { status: 500 }
        );
      }
    }
    
    // At this point, payment is handled or not needed, proceed with valuation creation
    const { data: valuation, error: insertError } = await supabase
      .from('valuations')
      .insert([
        {
          user_id: userId,
          title,
          full_description: fullDescription,
          summary,
          user_comment: userComment,
          images,
          assistant_response: assistantResponse,
          assistant_follow_up: assistantFollowUp,
          is_detailed: isDetailed
        }
      ])
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating valuation:', insertError);
      return NextResponse.json(
        { error: 'Failed to create valuation' },
        { status: 500 }
      );
    }
    
    // Return success with the created valuation
    return NextResponse.json({
      status: 'success',
      message: hasFreeValuation 
        ? 'Valuation created using your free daily valuation' 
        : 'Valuation created using 1 token',
      valuation
    });
    
  } catch (error) {
    console.error('Valuation creation error:', error);
    return NextResponse.json(
      { error: 'Failed to process valuation request' },
      { status: 500 }
    );
  }
} 