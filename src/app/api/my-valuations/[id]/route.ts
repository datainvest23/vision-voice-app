/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

// Minimal implementation with non-specific types
export function GET(
  req: any,
  context: any
) {
  const id = context.params.id;
  return NextResponse.json({ id });
}

export function DELETE(
  req: any,
  context: any
) {
  const id = context.params.id;
  return NextResponse.json({ message: `Deleted item ${id}` });
} 