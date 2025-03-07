// src/app/api/upload-file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { checkAuth } from '@/utils/auth';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure route options for handling larger files
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute

// Define the expected Cloudinary result type
interface CloudinaryUploadResult {
  secure_url: string;
  // Add other properties if you need them, e.g.,
  // public_id: string;
  // ...
}

export async function POST(request: NextRequest) {
  // Check authentication first
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      throw new Error('No file uploaded');
    }

    // Convert File to buffer for Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary using a Promise
    const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => { // Use the interface
      cloudinary.uploader.upload_stream(
        { resource_type: 'auto' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as CloudinaryUploadResult); // Cast to the interface
        }
      ).end(buffer);
    });

    // Return the Cloudinary URL
    return NextResponse.json({
      url: result?.secure_url,
      message: 'File uploaded successfully',
    });

  } catch (error: unknown) {
    console.error('Upload error:', error);
    let errorMessage = 'Failed to upload file';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}