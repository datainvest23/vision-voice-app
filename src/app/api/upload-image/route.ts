// src/app/api/upload-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';
import { Language } from '@/app/context/LanguageContext';
import { checkAuth } from '@/utils/auth';
import { MessageContentPartParam } from 'openai/resources/beta/threads/messages';

// Configure OpenAI and Cloudinary
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // Increase timeout to 120 seconds
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure route options for handling larger files
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for hobby plan

// Define the expected Cloudinary result type
interface CloudinaryUploadResult {
  secure_url: string;
  // ... other properties ...
}

// Define types for assistant message content
type MessageContentParam = MessageContentPartParam | {
  type: "image_url";
  image_url: { url: string };
};

/* eslint-disable @typescript-eslint/no-unused-vars */
// Type for image URL content that matches OpenAI's expected format
// This is used as documentation for the structure expected by OpenAI
type ImageUrlContent = {
  type: "image_url";
  image_url: { url: string };
};

// The combined content type that OpenAI expects in message creation
/* eslint-disable @typescript-eslint/no-explicit-any */
type MessageContent = any; // Using any since the original type is not available
/* eslint-enable @typescript-eslint/no-explicit-any */
/* eslint-enable @typescript-eslint/no-unused-vars */

// Text encoder for the stream
const encoder = new TextEncoder();

// This sets body parser config for Next.js 15+
export async function POST(request: NextRequest) {
  console.log("🔵 upload-image API endpoint called");
  
  // Check authentication first
  const authError = await checkAuth();
  if (authError) {
    console.log("🔴 Authentication failed in upload-image API");
    return authError;
  }
  
  console.log("✅ Authentication passed in upload-image API");

  try {
    // Handle formData with larger sizes
    const formData = await request.formData();
    console.log("📦 FormData received, processing files...");
    
    // Get all files with the 'files' key (for multiple files)
    const files = formData.getAll('files') as File[];
    // Also try to get a single file with the 'file' key for backward compatibility
    const singleFile = formData.get('file') as File | null;
    
    // Combine both approaches to handle different client implementations
    let filesToProcess: File[] = [];
    if (files && files.length > 0) {
      filesToProcess = files;
    } else if (singleFile) {
      filesToProcess = [singleFile];
    }
    
    console.log(`📊 Processing ${filesToProcess.length} files`);
    
    // Get user's selected language, default to English if not provided
    const language = (formData.get('language') as Language) || 'en';
    console.log(`🌐 Using language: ${language}`);

    if (filesToProcess.length === 0) {
      console.log("❌ Error: No files to process");
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    // Upload all images to Cloudinary and get their URLs
    const imageUrls: string[] = [];
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      console.log(`🖼️ Processing file ${i+1}/${filesToProcess.length}: ${file.name}`);
      
      // Convert file to buffer for Cloudinary
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Upload to Cloudinary
      try {
        console.log(`☁️ Uploading to Cloudinary: ${file.name}`);
        const cloudinaryResult = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              resource_type: 'auto',
              timeout: 60000 // 60 second timeout for Cloudinary
            },
            (error, result) => {
              if (error) {
                console.error("Cloudinary upload error:", error);
                reject(error);
              } else {
                console.log(`✅ Cloudinary upload success for ${file.name}`);
                resolve(result as CloudinaryUploadResult);
              }
            }
          ).end(buffer);
        });

        imageUrls.push(cloudinaryResult.secure_url);
        console.log(`📝 Added URL to image list: ${cloudinaryResult.secure_url.substring(0, 50)}...`);
      } catch (cloudinaryError) {
        console.error(`❌ Cloudinary upload failed for file ${i+1}:`, cloudinaryError);
        throw new Error(`Failed to upload image ${i+1}: ${cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error'}`);
      }
    }

    console.log(`Sending ${filesToProcess.length} image(s) for analysis...`);

    try {
      // Step 1: Create a Thread
      console.log("Creating thread for assistant...");
      const thread = await openai.beta.threads.create();
      console.log(`Thread created with ID: ${thread.id}`);
      
      // Step 2: Add a message with instructions and images to the Thread
      // Just specify language preference and mention multiple images if applicable
      const messageText = `Please respond in ${language}. ${
        imageUrls.length > 1 ? `I'm providing ${imageUrls.length} images of the same item from different angles.` : ''
      }`;
      
      // Create message content array with text and images
      const messageContent: MessageContentParam[] = [];
      
      // Add text prompt
      messageContent.push({
        type: "text",
        text: messageText
      });
      
      // Add image URLs to the message content
      for (const url of imageUrls) {
        messageContent.push({
          type: "image_url",
          image_url: { url }
        });
      }
      
      console.log(`Adding message with ${imageUrls.length} image(s) to thread ${thread.id}...`);
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        content: messageContent as unknown as any
      });
      
      // Step 3: Run the Assistant on the Thread with streaming
      console.log(`Running assistant ${process.env.OPENAI_ASSISTANT_ID} on thread with streaming...`);
      
      // Create a stream using ReadableStream for streaming the response
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Start the run with the Antiques_Appraisal assistant
            console.log(`Thread ID received: ${thread.id}`);
            const stream = await openai.beta.threads.runs.createAndStream(
              thread.id,
              {
                assistant_id: process.env.OPENAI_ASSISTANT_ID!,
                instructions: `Analyze the provided antique item image(s) in ${language}. 
                  Focus on historical context, materials, style, and notable features.
                  Provide a detailed analysis that can later be summarized.
                  End your response with 2-3 specific questions to the user about the item, which could help you clear any doubts and make a better assessment of the object and its value. These questions should focus on aspects that are not clearly visible in the images or details that would enhance your appraisal.`
              }
            );
            
            console.log("Starting to stream Assistant response...");
            
            // Process the stream events
            for await (const chunk of stream) {
              if (chunk.event === 'thread.message.delta' && chunk.data?.delta?.content) {
                for (const content of chunk.data.delta.content) {
                  if (content.type === 'text' && content.text) {
                    // Stream text delta directly to client without accumulating
                    controller.enqueue(encoder.encode(content.text.value));
                  }
                }
              }
            }
            
            console.log("Stream complete");
            controller.close();
          } catch (error) {
            console.error('Assistant streaming error:', error);
            controller.error(error);
          }
        }
      });

      // Return the streaming response with thread ID header
      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'x-thread-id': thread.id
        }
      });
      
    } catch (assistantError: unknown) {
      console.error('OpenAI Assistant API Error:', assistantError);
      let errorMessage = 'AI Assistant Error';
      if (assistantError instanceof Error) {
        errorMessage = assistantError.message;
      }
      return NextResponse.json(
        { error: `AI Assistant Error: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('Request processing error:', error);
    let errorMessage = 'Upload Error';
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.name === 'TimeoutError' || errorMessage.includes('timeout')) {
        return NextResponse.json(
          { error: 'Request timed out. Please try with a smaller image or try again later.' },
          { status: 504 }
        );
      }
    }
    return NextResponse.json(
      { error: `Upload Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}