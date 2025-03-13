'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export function AuthSetup() {
  useEffect(() => {
    const supabase = createClient();
    
    // Listen for authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        // NOTE: Initial token granting on signup has been disabled
        console.log('User signed in:', session.user.id);
        // await grantInitialTokens(session.user.id);
      }
    });
    
    // Cleanup function
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // This is just a component to set up the listener, it doesn't render anything
  return null;
}

/* DISABLED: This feature has been temporarily removed
// Function to grant initial tokens to new users
async function grantInitialTokens(userId: string) {
  try {
    console.log('Attempting to grant initial tokens to user:', userId);
    
    // Call the signup-tokens API to grant tokens
    const response = await fetch('/api/auth/signup-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Initial tokens granted successfully:', data);
    } else {
      // Log more detailed error information
      console.error('Failed to grant initial tokens:', {
        status: response.status,
        statusText: response.statusText,
        errorDetails: data.details || data.error || 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in token grant process:', error);
  }
}
*/ 