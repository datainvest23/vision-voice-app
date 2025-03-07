import { createClient } from './supabase/server';
import { NextResponse } from 'next/server'; // Removed NextRequest

export async function checkAuth() { // Removed request parameter
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  return null; // No error, user is authenticated
}