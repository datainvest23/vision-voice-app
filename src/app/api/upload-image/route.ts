import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    try {
      // Call OpenAI API with the correct model
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this image in detail and add an interesting observation or question about it."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 300
      });

      const content = response.choices[0].message.content;
      
      // Split the content into description and remarks
      const parts = content?.split('\n\n');
      const description = parts?.[0] || content;
      const remarks = parts?.[1] || "What do you think about this image?";

      return NextResponse.json({
        description,
        remarks
      });

    } catch (openaiError: any) {
      console.error('OpenAI API Error:', openaiError.message);
      return NextResponse.json(
        { error: `AI Service Error: ${openaiError.message}` },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Request processing error:', error.message);
    return NextResponse.json(
      { error: `Upload Error: ${error.message}` },
      { status: 500 }
    );
  }
} 