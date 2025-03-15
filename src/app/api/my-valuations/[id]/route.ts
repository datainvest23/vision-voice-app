import { NextResponse } from 'next/server';

export function GET(req, { params }) {
  return NextResponse.json({ id: params.id });
}

export function DELETE(req, { params }) {
  return NextResponse.json({ message: `Deleted item ${params.id}` });
} 