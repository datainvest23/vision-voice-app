import { createClient } from './supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function checkAuth(request: NextRequest) {
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