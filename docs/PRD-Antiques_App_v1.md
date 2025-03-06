# Product Requirements Document (PRD) – Antiques Appraisal

## 1. Introduction

### 1.1. Product Overview

**Antiques Appraisal** is a web application that enables users to:

- Upload images of antique items.
- Record audio notes describing the items.
- Have their audio automatically transcribed.
- Receive an AI-powered antiques appraisal (report and valuation).
- Save all data securely to Airtable for future reference.

With the introduction of **Supabase** authentication, **users must be logged in** before accessing any core functionality (uploading images, recording audio, or receiving appraisals).

### 1.2. Key Objectives

- Provide a secure, user-friendly interface for authenticated users to upload images and record voice notes describing their antiques.
- Transcribe audio recordings and send both images and transcriptions to a specialized “Antiques_Appraisal” assistant for a report and valuation.
- Store images, transcriptions, and AI-generated appraisal reports in Airtable, tied to individual user accounts via Supabase.

### 1.3. Target Users

- Collectors, hobbyists, and professionals who want quick appraisals of their antiques.
- Museums, auction houses, and curators needing initial valuations or background details on artifacts.
- Individuals documenting family heirlooms or rare finds, with secure login for privacy.
- Anyone requiring an accessible, AI-driven solution for cataloging and evaluating antiques.

---

## 2. Functional Requirements

### 2.1. User Authentication (Supabase)

- **Sign Up & Login**
    - New users can create an account using email/password (or other supported providers) through Supabase.
    - Existing users can log in via Supabase authentication endpoints.
- **Session Management**
    - Maintain user sessions securely; automatically expire or refresh tokens based on standard best practices.
- **Access Control**
    - All key app features (image upload, audio recording, transcription, appraisal) require an authenticated session.
    - Users who are not logged in should be redirected to a login page or receive an appropriate error message.

### 2.2. User Interface (UI)

### **Image Upload**

- Allows authenticated users to upload image files (JPEG, PNG).
- Preview uploaded images with basic zoom/pan.
- Display clear progress states or error messages as needed.

### **Audio Recording**

- Provide a user-friendly interface for capturing a voice note.
- Indicate recording status (time elapsed, waveform visualization).
- Let users pause, resume, and review the recording before finalizing.

### **Transcription**

- Automatically transcribe recorded audio via AI.
- Display and allow minor edits to the transcribed text.
- Mark the transcription as “final” upon user confirmation.

### **AI Appraisal Submission**

- Send the user’s images and transcribed note to the “Antiques_Appraisal” assistant.
- Show a loading/progress indicator (“Generating appraisal…”) until the AI response is received.
- Render the returned report in a structured, easy-to-read format.

### **AI-Generated Report and Valuation**

- Present a detailed appraisal with fields like item description, historical context, condition notes, references, and estimated value.
- Allow the user to download or share the appraisal.
- Permit saving of the final results to Airtable.

### **Data Storage**

- Store the following in Airtable, linked to the authenticated user:
    - Uploaded images
    - Audio transcriptions
    - AI-generated appraisals
- Include timestamps and user identifiers for each record.

### **User Feedback**

- Provide loading indicators for any AI processing or data storage.
- Show user-friendly errors in case of network or system failures.
- Offer tooltip guidance for features like capturing clear images or providing descriptive voice notes.

---

## 3. Non-Functional Requirements

### **Performance**

- Ensure image uploads, transcription, and AI appraisals are processed quickly.
- Maintain responsive interactions even under increasing user loads.

### **Security**

- Require Supabase authentication for all key actions.
- Keep API keys and other sensitive data in secure environment variables.
- Adhere to encryption best practices for data in transit and at rest.

### **Usability**

- Provide a simple, intuitive flow from login to antique appraisal.
- Ensure accessible design for voice recording and text display.

### **Reliability**

- Handle errors gracefully during authentication, file uploads, or AI processing.
- Provide consistent logs for troubleshooting.

### **Scalability**

- Design for future expansion: more users, more advanced features (e.g., multi-item uploads, batch transcription).
- Maintain modular code to integrate further AI models or databases if needed.

### **Maintainability**

- Keep code organized, documented, and consistent.
- Use version control (Git) and maintain an up-to-date README.

---

## 4. System Architecture

- **Frontend:**
    - Next.js with React (TypeScript or JavaScript) for the user interface and routing.
    - Integration with Supabase client libraries for user authentication.
- **Backend:**
    - Next.js API routes (Node.js) for handling file uploads, transcriptions, and AI appraisal requests.
    - OpenAI API for transcription (Whisper) and antiques appraisal (GPT-based assistant).
- **Database & Authentication:**
    - **Supabase** for user accounts, sessions, and authentication flows.
    - **Airtable** for storing images, transcripts, and appraisal reports.

---

## 5. Development Tools and Technologies

- **Frontend:**
    - Next.js (React, TypeScript)
    - Tailwind CSS (or other styling frameworks as used in your project)
    - Supabase client (for auth and possibly data fetches)
- **Backend:**
    - Node.js (via Next.js API routes)
    - OpenAI API (audio transcription, antiques appraisal)
    - Airtable API (data persistence)
- **Version Control and Deployment:**
    - Git (local or remote repository)
    - CI/CD pipeline (optional)
    - Cloud hosting (e.g., Vercel, Netlify)

---

## 6. Folder Structure

As shown in your screenshot (and indicated below), **the folder structure remains largely unchanged** to avoid breaking existing code. Adjust filenames or add new routes minimally, primarily for authentication:

```
arduino
CopyEdit
VISION-VOICE-APP/
├── .next/
├── docs/
├── node_modules/
├── public/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── save-record/
│   │   │   ├── text-to-speech/
│   │   │   ├── transcribe/
│   │   │   ├── upload-file/
│   │   │   ├── upload-image/
│   │   │   └── ... (any additional routes)
│   │   ├── components/
│   │   │   ├── AudioRecorder.tsx
│   │   │   ├── ImageUpload.tsx
│   │   │   └── ...
│   │   ├── login/
│   │   │   └── (authentication pages/forms handled here)
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── ui/...
│   ├── lib/
│   ├── utils/
│   │   └── supabase/
│   └── types/
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── ...

```

**Key Additions**:

- A `login` folder or page to handle signup/login via Supabase.
- A `utils/supabase/` directory containing Supabase configuration and helper functions.
- Minimal route changes for securing existing API endpoints (checking Supabase auth tokens).

---

## 7. API Specifications

### **Supabase Authentication**

- **Sign Up / Login / Logout** endpoints or hooks via `@supabase/auth-helpers`.
- Secure user session management in the frontend.

### **OpenAI**

- **Transcription (Whisper)**
- **Antiques Valuation**: GPT-based assistant endpoint

### **Airtable**

- For storing and retrieving images, transcripts, and appraisals with user references.

---

## 8. Testing and Deployment

### **Testing**

- Unit tests for authentication flows (successful login/logout, restricted access).
- Integration tests to confirm that only authenticated users can reach core features (image upload, transcription, AI appraisal).
- Comprehensive end-to-end tests to verify entire workflows (login → upload → appraisal → data saved in Airtable).

### **Deployment**

- Deploy on Vercel or similar to host both Next.js frontend and serverless API routes.
- Ensure environment variables for Supabase, Airtable, and OpenAI are set securely.
- Optionally set up a CI/CD pipeline to automate builds, tests, and deployments.

---

## 9. Success Metrics

- **User Retention & Engagement**: How many users sign up and continue using the platform.
- **Authentication Flow Completion**: Rates of successful logins vs. drop-offs.
- **Appraisal Volume**: Number of images and audio recordings processed.
- **Performance**: Response times for transcription and AI-driven valuation.

---

## 10. Future Enhancements

- **Role-Based Access**: Different account roles (e.g., “Regular User,” “Curator,” “Admin”) for advanced permissions.
- **Advanced Analytics**: Provide data dashboards or usage insights within the user’s account.
- **Multi-Item Appraisals**: Batch uploads or multi-file flows for larger collections.
- **In-App Collaboration**: Enable user-to-user item sharing or group valuations.

---

**End of Document**