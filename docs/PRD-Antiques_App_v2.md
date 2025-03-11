# Product Requirements Document (PRD) – Antiques Appraisal v2.1

## 1. Introduction

### 1.1 Product Overview

**Antiques Appraisal** is a web application that enables users to:

- **Upload images of antique items** to receive an AI-driven analysis.
- **Review the AI’s analysis**, which is then summarized by a GPT4o-mini model.
- **Hear the summary as speech** (text-to-speech playback).
- **Record a voice note** providing feedback or additional information, which is:
    - Transcribed.
    - Sent back to the Assistant (in the same conversation thread) to refine or complete the analysis.

With the introduction of **Supabase** authentication, **users must be logged in** before accessing any core functionality (image upload, AI analysis, and voice recording).

### 1.2 Key Objectives

1. Provide a secure, user-friendly interface for authenticated users to:
    - Upload antique images.
    - Receive initial AI-based item analyses.
    - Obtain a concise GPT4o-mini summary of the AI’s analysis.
    - Hear that summary via text-to-speech playback.
    - Record voice feedback that is integrated back into the AI’s analysis pipeline for a refined output.
2. Store or reference essential user data (e.g., uploaded images, final analyses) in Airtable, linked to the specific user account.
3. Enable a multi-step conversational loop:
    1. **Images → Assistant** for a broad analysis.
    2. **Assistant Output → GPT4o-mini** for summarization.
    3. **Summary → Text-to-Speech** for audible feedback.
    4. **User Voice Feedback → Assistant** for refining or completing the analysis.

### 1.3 Target Users

- **Collectors, hobbyists, and professionals** seeking quick analyses or references for antiques.
- **Museums, auction houses, curators** needing preliminary background information on items.
- **Individuals** documenting family heirlooms who desire a private login for secure access.
- **Anyone** seeking an accessible, AI-driven process for understanding and cataloging antiques, enhanced by voice interaction.

---

## 2. Functional Requirements

### 2.1 User Authentication (Supabase)

- **Sign Up & Login**
    - Users create or access accounts via email/password (or OAuth providers) using Supabase.
    - Invalid credentials or expired tokens prompt re-authentication.
- **Session Management**
    - Maintain user sessions securely and automatically refresh or expire tokens based on best practices.
- **Access Control**
    - All core features (image upload, AI analysis, voice recording) require authentication.
    - Non-logged-in users are prompted to log in or receive an error message.

### 2.2 User Interface (UI)

### Image Upload

- **Supported Formats**: JPEG, PNG.
- **Progress Indicators**: Show upload status (loading bar or spinner).
- **Preview & Validation**: Display uploaded images; handle errors such as invalid formats or exceeding file size limits.

### Assistant Analysis

1. **Send Uploaded Images to Assistant**
    - Upon successful upload, images go to the “Antiques_Appraisal” Assistant.
    - The response includes details like item description, historical context, and preliminary condition.
2. **Analysis → GPT4o-mini Summarization**
    - The Assistant’s detailed analysis is fed into a GPT4o-mini model for a concise summary.
3. **GPT4o-mini Output → Text-to-Speech**
    - The summarized text is converted to audio and played for the user.

### Voice Recording (User Feedback)

- **Purpose**: Capture additional user details to refine the analysis.
    - The recorded audio is transcribed (e.g., via OpenAI Whisper).
    - The transcript is sent back to the Assistant (same thread) to refine or finalize the analysis.
- **UI Mechanics**:
    - **Record/Pause/Resume**: Users see a waveform or a timer.
    - **Playback & Confirm**: Users can review recordings before finalizing.
    - **Error Handling**: Clear messages for microphone issues or other recording errors.

### Final (Refined) Assistant Analysis

- The Assistant updates its analysis based on the user’s recorded feedback.
- The refined analysis can be displayed again (and optionally summarized + played back if needed).
- Users can view, download, or store the final result.

### Data Storage in Airtable

- **What to Store**:
    - References to the uploaded images.
    - The final or refined analysis from the Assistant (text or structured data).
    - User identifiers for linking items to accounts.
- **Optional**: Store audio or transcripts, depending on product needs.
- **Security**: Ensure that only the authenticated user can access their own data.

### User Feedback & Guidance

- **Loading Indicators** for image uploads, AI processing, summarization, TTS, and voice recording.
- **Tooltips & Help**: Provide short guidelines for capturing clear images or offering relevant spoken details.

---

## 3. Non-Functional Requirements

### Performance

- **Responsive AI Processing**: Summaries and text-to-speech should be quick.
- **Scalable Architecture**: Handle concurrent uploads and AI calls efficiently.

### Security

- **Supabase Authentication** for all sensitive actions.
- **API Keys** (OpenAI, GPT4o-mini, TTS) as environment variables.
- **Encryption** of data in transit (HTTPS) and at rest where applicable.

### Usability

- **Accessible Design**: Clear labeling, keyboard shortcuts, and support for visually or hearing-impaired users where possible.
- **Intuitive Flow**: Simple steps from login → upload → analysis → voice feedback → final output.

### Reliability

- **Error Handling**: Graceful fallbacks for upload or AI service failures.
- **Logging & Alerts**: Sufficient logs for debugging.

### Scalability

- **Future Growth**: Easily integrate advanced AI models, batch uploads, multi-lingual speech recognition, or more robust text-to-speech engines.

### Maintainability

- **Code Organization**: Adhere to Next.js best practices, properly structured folders.
- **Documentation**: Maintain an up-to-date README, inline comments, and architectural diagrams.
- **Version Control**: Use Git and optional CI/CD for streamlined collaboration.

---

## 4. System Architecture

- **Frontend**:
    - Next.js (React, TypeScript/JavaScript) for UI and routing.
    - Supabase client for authentication flows and protected routes.
- **Backend**:
    - Next.js API routes for handling uploads, AI requests, summarization, and TTS.
    - OpenAI Whisper (or similar) for transcription of user audio feedback.
    - GPT4o-mini for summarizing the Assistant’s analysis.
- **Database & Authentication**:
    - **Supabase** for user auth and session management.
    - **Airtable** for storing references to images and final analyses (linked to user IDs).

---

## 5. Development Tools and Technologies

- **Frontend**:
    - Next.js + React
    - Tailwind CSS (or similar) for styling
    - Supabase client
- **Backend**:
    - Node.js (via Next.js API routes)
    - OpenAI API (Whisper for transcription; optional GPT if needed)
    - GPT4o-mini for summarization
    - Text-to-Speech (e.g., Google Cloud TTS, AWS Polly, or another TTS provider)
- **Data Storage**:
    - Airtable for storing final analyses, item references, timestamps, user IDs.
- **Version Control & Deployment**:
    - Git for source control.
    - Vercel (or a similar platform) for hosting Next.js.
    - CI/CD pipeline for automated builds, tests, and deployments (optional but recommended).

---

## 6. Folder Structure

```
vbnet
CopyEdit
VISION-VOICE-APP/
├── .next/
├── docs/
├── node_modules/
├── public/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── upload-file/
│   │   │   ├── analyze/
│   │   │   ├── summarize/
│   │   │   ├── text-to-speech/
│   │   │   ├── record-feedback/
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── ImageUpload.tsx
│   │   │   ├── AudioRecorder.tsx
│   │   │   ├── PlaybackComponent.tsx
│   │   │   └── ...
│   │   ├── login/
│   │   │   └── ...
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── utils/
│   │   ├── supabase/
│   │   │   └── index.ts
│   │   ├── ai/
│   │   │   └── openaiHelpers.ts
│   │   └── ...
│   ├── types/
│   └── ...
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── ...

```

**Key Additions**:

- **analyze/** route to send images to the “Antiques_Appraisal” Assistant.
- **summarize/** route to call GPT4o-mini.
- **text-to-speech/** route for TTS conversion.
- **record-feedback/** route for capturing user recordings and forwarding transcripts.

---

## 7. API Specifications

### 7.1 Supabase Authentication

- **Sign Up / Login / Logout** endpoints or hooks using `@supabase/auth-helpers`.
- Server-side checks enforce authenticated access to protected features.

### 7.2 “Antiques_Appraisal” Assistant

- **Analyze Endpoint (`POST /api/analyze`)**
    - **Request Body**: `{ userId, imageData, metadata }`
    - **Response**: `{ analysisDetails }` containing item description, historical context, etc.

### 7.3 GPT4o-mini Summarization

- **Summarize Endpoint (`POST /api/summarize`)**
    - **Request Body**: `{ analysisDetails }`
    - **Response**: `{ summary }` for TTS playback.

### 7.4 Text-to-Speech

- **TTS Endpoint (`POST /api/text-to-speech`)**
    - **Request Body**: `{ summaryText }`
    - **Response**: Audio file or URL pointing to the generated audio.

### 7.5 Voice Feedback Recording

- **Record Feedback Endpoint (`POST /api/record-feedback`)**
    - **Request Body**: `{ userId, audioData or transcript, threadId }`
    - **Process**:
        1. If `audioData`, transcribe it (OpenAI Whisper or similar).
        2. Forward the transcription to the same Assistant thread.
    - **Response**: Possibly updated or final analysis details from the Assistant.

### 7.6 Airtable Storage

- **Data Storage**:
    - Image references, final analyses, timestamps, user IDs.
- **Privacy**: Decide whether to store raw audio or transcripts based on user consent.

---

## 8. Testing and Deployment

### 8.1 Testing

1. **Unit Tests**
    - Authentication (sign-in/out), route guards, restricted feature checks.
    - Summarization logic (GPT4o-mini) with known inputs.
    - Voice recording component functionality.
2. **Integration Tests**
    - Upload → Analyze → Summarize → TTS → Record Feedback → Re-analysis.
    - Airtable writes for correct user linkage.
3. **End-to-End Tests**
    - Full real-flow tests:
        1. Log in
        2. Upload antique image
        3. Get AI analysis → Summarize → Listen to TTS
        4. Record user voice feedback
        5. Assistant updates the analysis
        6. Final result stored or displayed

### 8.2 Deployment

- **Hosting**: Vercel or a similar service for Next.js serverless deployments.
- **CI/CD**: Automated pipeline for testing and building.
- **Environment Variables**: Securely configure Supabase, GPT4o-mini, and TTS API keys.

---

## 9. Success Metrics

- **User Engagement**: Frequency of repeated usage and voice feedback sessions.
- **Authentication Flow**: Sign-up vs. drop-off rates.
- **Analysis Volume**: Number of images processed.
- **Performance**: Time from analysis submission to final TTS playback.

---

## 10. Future Enhancements

1. **Enhanced Appraisal**: Incorporate item valuations or advanced historical references.
2. **Role-Based Access**: Different tiers (admins, curators, standard users).
3. **Analytics Dashboards**: Usage tracking, performance metrics.
4. **Multi-Item Flow**: Batch uploads and group analyses for collections.
5. **Collaborative Features**: Shared reviews, group feedback.
6. **Extended Voice Interaction**: More immediate, back-and-forth conversation with TTS and speech recognition.

---

**End of Document**