import { NextResponse } from 'next/server';

// Disable TypeScript checking with explicit any types
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