import { NextResponse } from 'next/server';

export function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ id: params.id });
}

export function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ message: `Deleted item ${params.id}` });
} 