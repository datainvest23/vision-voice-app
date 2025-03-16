import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { checkAuth } from '@/utils/auth';

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // 120 seconds timeout
});

// Configure route options
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for hobby plan

export async function POST(request: NextRequest) {
  // Check authentication first
  const authError = await checkAuth();
  if (authError) {
    return authError;
  }

  try {
    // Parse request body
    const requestData = await request.json();
    const { threadId, message, language = 'en' } = requestData;

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Valid message content is required' }, { status: 400 });
    }

    // Send the user message to the thread
    console.log(`Adding user message to thread ${threadId}...`);
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message.trim()
    });

    // Run the assistant on the thread with streaming
    console.log(`Running assistant ${process.env.OPENAI_ASSISTANT_ID} on thread with streaming...`);
    
    // Create a stream using ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Start the run with streaming
          const stream = await openai.beta.threads.runs.createAndStream(
            threadId,
            {
              assistant_id: process.env.OPENAI_ASSISTANT_ID!,
              instructions: `Continue the conversation in ${language}.
                Include the user's comments and review your initial analysis of the item.
                Create an updated, elaborated and complete valuation report that incorporates any new information provided by the user.
                Your updated valuation report should be comprehensive, addressing:
                - Historical context and provenance
                - Materials and craftsmanship
                - Condition assessment
                - Stylistic elements and artistic significance
                - Market value range and factors affecting value
                - Authenticity considerations
                - Any other relevant information that would help the user make an informed decision
                - DO NOT ask any further questions at this point.
                
                ## Structured Summary (Always Include)
                
                IMPORTANT: Always end your response with a concise structured summary in the exact format below:
                
                ### Structured Summary
                
                - **Item Type:** [Clearly stated type]
                - **Timeframe:** [Estimated era or exact dates]
                - **Artist:** [Identified artist or school, or clearly state "Unknown"]
                - **Observations:** [Key distinguishing observations briefly summarized]
                - **Estimated Valuation:** [Precise valuation range in EUR]
                
                This structured summary is critical as it will be displayed prominently in the UI.`
            }
          );
          
          // Process the stream events
          for await (const chunk of stream) {
            if (chunk.event === 'thread.message.delta' && chunk.data?.delta?.content) {
              for (const content of chunk.data.delta.content) {
                if (content.type === 'text' && content.text) {
                  // Stream text delta to client
                  controller.enqueue(new TextEncoder().encode(content.text.value));
                }
              }
            }
          }
          
          controller.close();
        } catch (error) {
          console.error('Assistant streaming error:', error);
          controller.error(error);
        }
      }
    });

    // Return the streaming response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'x-thread-id': threadId
      }
    });
  } catch (error) {
    console.error('Error in send-message API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 