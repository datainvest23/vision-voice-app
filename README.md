# Antiques Appraisal App

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

- User Authentication (Supabase)
- User Interface (UI)
- Image Upload
- Audio Recording
- Transcription
- AI Appraisal Submission
- AI-Generated Report and Valuation
- Data Storage
- User Feedback

---

## 3. Non-Functional Requirements

- Performance
- Security
- Usability
- Reliability
- Scalability
- Maintainability

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

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
