import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { mkdir } from 'fs/promises';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'public/uploads');

export async function POST(request: Request) {
  try {
    // Ensure the uploads directory exists
    await mkdir(uploadsDir, { recursive: true });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Create a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = file.name.split('.').pop();
    const filename = `image-${uniqueSuffix}.${extension}`;
    const filepath = path.join(uploadsDir, filename);

    // Convert file to buffer and save it
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(filepath, buffer);

    // Return the full URL that can be used to access the file
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/uploads/${filename}`;

    return NextResponse.json({ url });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: `Failed to upload file: ${error.message}` },
      { status: 500 }
    );
  }
} 