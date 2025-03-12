import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Checks if the user is authenticated
 * Returns a NextResponse error if not authenticated, otherwise null
 */
export async function checkAuth() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.error('Authentication error:', error?.message || 'User not authenticated');
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to continue.' },
        { status: 401 }
      );
    }
    
    return null;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 500 }
    );
  }
}

/**
 * Checks if a user ID exists and has necessary permissions
 * Used for routes that require specific user ID validation
 */
export async function validateUserId(requestUserId: string) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to continue.' },
        { status: 401 }
      );
    }
    
    // Check if the logged-in user matches the requested user ID
    if (user.id !== requestUserId) {
      return NextResponse.json(
        { error: 'You do not have permission to access this resource' },
        { status: 403 }
      );
    }
    
    return null;
  } catch (error) {
    console.error('User validation error:', error);
    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 500 }
    );
  }
}