# Product Requirements Document (PRD) – Antiques Appraisal v2.1

## 1. Introduction

### 1.1 Product Overview

**Antiques Appraisal** is a web application designed to assist users in analyzing and valuing antique items. The application leverages artificial intelligence (AI) and user feedback to provide detailed appraisals, now enhanced with monetization features to sustain and grow the platform. Key functionalities include:

- **Image Upload**: Users can upload images of antiques for analysis.
- **AI Analysis**: An AI assistant, "Antiques_Appraisal," processes the images and provides an initial analysis.
- **Summary Generation**: A GPT4o-mini model summarizes the analysis into a concise format.
- **Text-to-Speech (TTS)**: The summary is converted to audio for user playback.
- **Voice Feedback**: Users can record feedback to refine the analysis, which is transcribed and processed by the AI.
- **Valuation Creation**: After refinement, users can create a valuation, stored securely and accessible via a "My Valuations" menu.
- **Monetization Features**:
    - **Daily Free Valuation Limit**: One free valuation per day, with additional valuations requiring payment.
    - **Token System**: Users receive free tokens upon sign-up and can purchase more for extra valuations.
    - **Detailed Valuation Premium Feature**: An optional paid upgrade for enhanced valuation details.

The application operates behind Supabase authentication, ensuring secure access, with data stored in Supabase and linked to user accounts.

### 1.2 Key Objectives

1. Deliver a seamless, secure experience for users to:
    - Upload antique images and receive AI-driven analyses.
    - Review concise summaries via text and audio.
    - Refine analyses with voice feedback.
    - Create and store valuations.
2. Introduce monetization to generate revenue while maintaining user engagement:
    - Encourage daily use with a free valuation limit.
    - Offer flexible payment options via tokens.
    - Provide premium value through detailed valuations.
3. Ensure data security and accessibility, linking valuations and tokens to user accounts in Supabase.
4. Maintain a multi-step workflow: image upload → AI analysis → summarization → TTS → feedback → refined analysis → valuation creation with monetization.

### 1.3 Target Users

- **Casual Users**: Hobbyists and individuals exploring antiques, likely using the free daily valuation.
- **Collectors**: Enthusiasts needing frequent valuations, potential token buyers.
- **Professionals**: Auctioneers, curators, or antique dealers requiring detailed valuations for business purposes.
- **Museums and Institutions**: Entities documenting items, possibly interested in premium features.

---

## 2. Functional Requirements

### 2.1 User Authentication (Supabase)

- **Sign Up & Login**:
    - Users register or log in via email/password or OAuth (e.g., Google) using Supabase.
    - Invalid credentials trigger an error message prompting re-authentication.
- **Session Management**:
    - Secure session handling with automatic token refresh or expiration.
- **Access Control**:
    - All features (upload, analysis, valuation) require authentication.
    - Non-authenticated users are redirected to the login page.

### 2.2 User Interface (UI)

### Image Upload

- **Formats**: JPEG, PNG (max size: 10MB).
- **UI Elements**:
    - Drag-and-drop or file picker.
    - Progress bar during upload.
    - Thumbnail preview post-upload.
- **Validation**: Reject unsupported formats or oversized files with clear error messages.

### Assistant Analysis

1. **Image Processing**:
    - Uploaded images are sent to the "Antiques_Appraisal" AI assistant.
    - Response includes item description, historical context, and condition estimate.
2. **Summarization**:
    - The analysis is processed by GPT4o-mini to produce a concise summary (e.g., 2-3 sentences).
3. **Text-to-Speech**:
    - The summary is converted to audio and played via a clickable "Play" button.

### Voice Feedback

- **Recording**:
    - Users record feedback via a "Record" button, with pause/resume options.
    - Waveform visualization and timer display.
- **Playback**:
    - Option to replay the recording before submission.
- **Transcription**:
    - Audio is transcribed using OpenAI Whisper and sent to the assistant for refinement.
- **Error Handling**:
    - Alerts for microphone access issues or recording failures.

### Valuation Creation

- **Trigger**: Post-refinement, a **"Create Valuation"** button appears.
- **Monetization Logic**:
    1. **Daily Limit Check**:
        - Query Supabase for valuations created by the user in the last 24 hours.
        - If none, allow one free valuation.
        - If limit reached, proceed to token or payment check.
    2. **Token Check**:
        - Check user’s token balance in the "user_tokens" table.
        - If tokens available, offer to use one.
        - If none, prompt to buy tokens or pay directly.
    3. **Detailed Valuation Option**:
        - Offer an upgrade to "Detailed Valuation" for a fee, enhancing the analysis with extra details (e.g., auction data, references).
- **Creation Process**:
    - Standard valuation: Stores the refined analysis as-is.
    - Detailed valuation: Triggers additional AI processing and/or external data integration.
- **Storage**: Saved in the Supabase "valuations" table with fields:
    - id (uuid)
    - user_id (uuid)
    - created_at (timestamp)
    - title (string)
    - full_description (text)
    - summary (text)
    - user_comment (text)
    - images (array of URLs)
    - assistant_response (text)
    - assistant_follow_up (text)
    - is_detailed (boolean)
- **UI Feedback**:
    - Messages like "Valuation Created!" or "Please purchase a token to continue."

### My Valuations Page

- **List View**:
    - Displays all user valuations with title, date, and summary.
    - Pagination for large lists (10 per page).
- **Detail View**:
    - Clicking a valuation shows full details, including images and comments.
- **Indicators**:
    - "Detailed" badge for premium valuations.

### 2.3 Monetization Features

### Daily Free Valuation Limit

- **Rule**: One free valuation per user per day (00:00-23:59 UTC).
- **Enforcement**: Check created_at timestamps in the "valuations" table.
- **UI**: Show status (e.g., "1 free valuation left today" or "Limit reached").

### Token System

- **Initial Grant**: 5 free tokens upon sign-up.
- **Usage**: 1 token = 1 standard valuation beyond the daily limit.
- **Purchase Options**:
    - 5 tokens for $5
    - 10 tokens for $9
- **Storage**: "user_tokens" table:
    - user_id (uuid)
    - token_count (integer)
    - transaction_history (jsonb, e.g., { "date": "2023-10-01", "amount": 5, "cost": 5 })
- **UI**: Display balance (e.g., "Tokens: 3") and "Buy Tokens" button.

### Detailed Valuation Premium Feature

- **Cost**: $3 per valuation.
- **Enhancements**:
    - Additional AI prompts for deeper analysis.
    - Potential integration of external data (e.g., auction records).
- **Storage**: Marked with is_detailed = true in the "valuations" table.
- **UI**: Checkbox or button during valuation creation (e.g., "Upgrade to Detailed - $3").

### 2.4 Payment Processing

- **Provider**: Stripe (or similar).
- **Flow**:
    - User selects token purchase or detailed valuation.
    - Redirects to Stripe checkout.
    - On success, updates tokens or creates valuation.
- **Security**: No card data stored locally; handled by Stripe.

### 2.5 Data Storage in Supabase

- **Tables**:
    - **valuations**: Stores valuation data.
    - **user_tokens**: Tracks token balances and history.
- **Access**: Restricted to authenticated users’ own data via Supabase Row-Level Security (RLS).

### 2.6 User Feedback & Guidance

- **Loading States**: Spinners for uploads, analysis, TTS, and valuation creation.
- **Tooltips**: Explain tokens, daily limits, and detailed valuations.
- **Error Messages**: Clear, actionable prompts (e.g., "Payment failed, try again").

---

## 3. Non-Functional Requirements

### Performance

- **Latency**: Monetization checks and payment processing < 2 seconds.
- **Throughput**: Support 1,000 concurrent users without degradation.

### Security

- **Authentication**: Supabase JWT-based security.
- **Payments**: PCI-compliant via Stripe.
- **Data**: HTTPS encryption; sensitive fields encrypted at rest.

### Usability

- **Intuitive**: Monetization options presented clearly without overwhelming users.
- **Accessibility**: WCAG 2.1 compliance (e.g., keyboard navigation, screen reader support).

### Reliability

- **Uptime**: 99.9% availability.
- **Recovery**: Graceful handling of payment or service failures with retries.

### Scalability

- **Growth**: Handle increased users and transactions via Supabase and Stripe scalability.

### Maintainability

- **Modularity**: Separate concerns (e.g., monetization logic, UI) for easy updates.
- **Docs**: Inline code comments and updated PRD.

---

## 4. System Architecture

- **Frontend**: Next.js (React) for UI and client-side logic.
- **Backend**:
    - Next.js API routes for processing.
    - OpenAI (Whisper, GPT4o-mini) for transcription and summarization.
    - TTS provider (e.g., Google TTS).
    - Stripe for payments.
- **Database**: Supabase for auth, valuations, and tokens.
- **External Storage**: Airtable (optional) for supplementary data.

---

## 5. Development Tools and Technologies

- **Frontend**:
    - Next.js + React
    - Tailwind CSS
    - Supabase JavaScript client
- **Backend**:
    - Node.js (Next.js API)
    - OpenAI API
    - Stripe SDK
- **Deployment**:
    - Vercel hosting
    - Git for version control
    - CI/CD via GitHub Actions

---

## 6. Folder Structure

text

CollapseWrapCopy

`antiques-appraisal/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── upload-image/
│   │   │   ├── analyze/
│   │   │   ├── summarize/
│   │   │   ├── tts/
│   │   │   ├── feedback/
│   │   │   ├── create-valuation/
│   │   │   ├── user-status/
│   │   │   ├── buy-tokens/
│   │   └── pages/
│   │       ├── login/
│   │       ├── my-valuations/
│   │       └── index.tsx
│   ├── components/
│   │   ├── ImageUploader.tsx
│   │   ├── VoiceRecorder.tsx
│   │   ├── ValuationForm.tsx
│   └── utils/
│       ├── supabase.ts
│       ├── openai.ts
│       └── stripe.ts
├── package.json
└── tsconfig.json`

---

## 7. API Specifications

### POST /api/create-valuation

- **Body**: { userId, analysisData, isDetailed }
- **Response**: { valuationId, status: "success" | "payment_required" }

### GET /api/user-status

- **Response**: { freeValuationsLeft: number, tokenBalance: number }

### POST /api/buy-tokens

- **Body**: { userId, amount }
- **Response**: { success: boolean, newBalance: number }

### GET /api/my-valuations

- **Response**: { valuations: [{ id, title, summary, created_at, is_detailed }] }

---

## 8. Testing and Deployment

### Testing

- **Unit**: Monetization logic, token deduction.
- **Integration**: Payment flow with Stripe.
- **E2E**: Full user journey (free and paid).

### Deployment

- **Platform**: Vercel.
- **Pipeline**: Automated testing and deployment.

---

## 9. Success Metrics

- **Engagement**: Daily valuations created.
- **Revenue**: Token sales, detailed valuation purchases.
- **Conversion**: Free-to-paid user rate.
- **Retention**: Repeat usage post-monetization.

---

## 10. Future Enhancements

- **Subscriptions**: Unlimited valuations for a monthly fee.
- **Analytics**: Valuation trends dashboard.
- **Sharing**: Export or share valuations.

---

This PRD outlines a robust update to Antiques Appraisal v2.1, integrating monetization seamlessly into the existing workflow while prioritizing user experience and scalability.