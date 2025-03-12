import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

// Disable Next.js body parsing, we need the raw body for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export const dynamic = 'force-dynamic';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  // @ts-expect-error - API version compatibility issue
  apiVersion: '2023-10-16',
});

// Helper function to get the raw body as a string
async function getRawBody(req: NextRequest): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = req.body?.getReader();
  
  if (!reader) {
    throw new Error('Request body is empty');
  }
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  return new TextDecoder().decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))));
}

export async function POST(request: NextRequest) {
  try {
    // Get the raw body
    const rawBody = await getRawBody(request);
    
    // Get the signature header
    const signature = request.headers.get('stripe-signature');
    
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }
    
    // Verify the event
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }
    
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Make sure the payment status is paid
        if (session.payment_status !== 'paid') {
          console.log(`Payment not completed for session ${session.id}`);
          return NextResponse.json({ received: true });
        }
        
        // Get metadata
        const userId = session.metadata?.userId;
        const purchaseType = session.metadata?.purchaseType;
        
        if (!userId) {
          console.error('⚠️ Missing userId in session metadata');
          return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
        }
        
        // Connect to Supabase
        const supabase = await createClient();
        
        // Handle different purchase types
        if (purchaseType === 'tokens') {
          // Token purchase
          const tokenAmount = parseInt(session.metadata?.tokenAmount || '0', 10);
          
          if (tokenAmount <= 0) {
            console.error('⚠️ Invalid token amount:', tokenAmount);
            return NextResponse.json({ error: 'Invalid token amount' }, { status: 400 });
          }
          
          // Get current token count
          const { data: existingTokens, error: fetchError } = await supabase
            .from('user_tokens')
            .select('token_count, transaction_history')
            .eq('user_id', userId)
            .single();
          
          // Prepare transaction record
          const transaction = {
            date: new Date().toISOString(),
            amount: tokenAmount,
            cost: session.amount_total ? session.amount_total / 100 : null, // Convert from cents
            payment_id: session.id,
          };
          
          if (fetchError && fetchError.code === 'PGRST116') {
            // User not found, create new record
            const { error: insertError } = await supabase
              .from('user_tokens')
              .insert([
                {
                  user_id: userId,
                  token_count: tokenAmount,
                  transaction_history: [transaction],
                },
              ]);
            
            if (insertError) {
              console.error('⚠️ Error creating token record:', insertError);
              return NextResponse.json({ error: 'Failed to create token record' }, { status: 500 });
            }
          } else if (fetchError) {
            console.error('⚠️ Error fetching token record:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch token record' }, { status: 500 });
          } else {
            // Update existing record
            const newTokenCount = (existingTokens.token_count || 0) + tokenAmount;
            const transactionHistory = existingTokens.transaction_history || [];
            
            const { error: updateError } = await supabase
              .from('user_tokens')
              .update({
                token_count: newTokenCount,
                transaction_history: [...transactionHistory, transaction],
              })
              .eq('user_id', userId);
            
            if (updateError) {
              console.error('⚠️ Error updating token record:', updateError);
              return NextResponse.json({ error: 'Failed to update token record' }, { status: 500 });
            }
          }
          
          console.log(`✅ Added ${tokenAmount} tokens for user ${userId}`);
        } else if (purchaseType === 'detailed') {
          // Detailed valuation purchase
          // The valuation data should be stored in session.metadata.data
          try {
            const valuationData = session.metadata?.data ? JSON.parse(session.metadata.data) : null;
            
            if (!valuationData) {
              console.error('⚠️ Missing valuation data in metadata');
              return NextResponse.json({ error: 'Missing valuation data' }, { status: 400 });
            }
            
            // TODO: Create the detailed valuation record
            // This would typically be implemented based on your specific requirements
            // for detailed valuations
            
            console.log(`✅ Created detailed valuation for user ${userId}`);
          } catch (error) {
            console.error('⚠️ Error parsing valuation data:', error);
            return NextResponse.json({ error: 'Invalid valuation data' }, { status: 400 });
          }
        } else {
          console.log(`⚠️ Unknown purchase type: ${purchaseType}`);
        }
        
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 