# Product Requirement Document (PRD)

## 1. Product Overview

**Product Name:**  
**VisionVoice** – A minimalistic web app that allows users to upload or capture an image, receive an AI-generated description (plus interesting remarks/questions), record an audio comment in response, and finally store the image, AI description, and transcribed user comment in a database (Airtable).

**Key Objectives:**
1. Enable users to quickly take/upload an image.  
2. Generate an AI-based description of the image.  
3. Provide interesting remarks/questions about the image (from the AI).  
4. Let users record their voice note related to the image.  
5. Transcribe the recorded note.  
6. Save the image, AI-generated description, and the transcribed note to Airtable.

**Primary Users:**  
- Anyone who wants a simple interface for capturing or uploading an image and recording a quick voice note.  
- Applicable for educational, accessibility, or creative scenarios.

---

## 2. Functional Requirements

1. **User Interface (UI)**
   - **Take/Upload Image Button**: Allows camera capture (mobile) or file upload (desktop).  
   - **Image Preview**: Display a thumbnail or scaled-down preview after selection.  
   - **AI Description**: Send the image to an AI model and return a textual description plus short remarks/questions.  
   - **Record Audio Note**: Simple start/stop button for capturing user voice via browser microphone.  
   - **Transcription Display**: Display the transcribed text of the user’s recorded message.  
   - **Final Output Display**: Present the captured image, AI-generated text, and transcribed note.  
   - **Save to Airtable**: Store the final data in Airtable, with a clear success/fail indicator.

2. **Backend Logic**
   - **Image Recognition**: Use an image recognition API (OpenAI, Hugging Face, Microsoft Azure, or Google Vision) to get an image description.  
   - **Speech Generation (Optional)**: Optionally convert text to speech describing the image (using a TTS service) or simply return text remarks.  
   - **Audio Recording Handling**: Accept audio from the frontend, store or process it in memory or a temporary file.  
   - **Speech-to-Text**: Use a speech recognition service (OpenAI Whisper API, Hugging Face, or Google Speech-to-Text) to transcribe user audio.  
   - **Data Persistence**: Store the final data (image URL, AI description, user transcript) in Airtable.

3. **Data Storage & Retrieval**
   - **Airtable**:  
     - One table containing records with fields for:  
       - **Image** (attachment or URL)  
       - **AI Description** (text)  
       - **User Voice Note (Transcription)** (text)  
     - Use environment variables for storing Airtable credentials (`AIRTABLE_API_KEY`, `BASE_ID`).

---

## 3. Non-Functional Requirements

1. **Responsiveness**  
   - Should work on both mobile and desktop, with flexible layouts.
2. **Performance**  
   - Image analysis and transcription calls should be processed in the background with user-friendly loading indicators.
3. **Security & Privacy**  
   - Use HTTPS for data transfer.  
   - Securely store API keys (in environment variables).  
   - Handle personal data (images, audio) responsibly.
4. **Scalability**  
   - The solution should run on free-tier services initially, but be easily expandable as usage grows.
5. **Maintainability**  
   - Clear separation of concerns (frontend, backend, API integration).  
   - Documented code for ease of future enhancements.

---

## 4. System Architecture & Process Flow

1. **Front-End (e.g., React, Next.js)**
   1. **Image Upload**: User selects/takes a photo; preview is displayed.  
   2. **“Describe Image”**: Frontend sends the image to the backend for AI analysis.  
   3. **AI Description**: The returned text is displayed.  
   4. **Audio Recording**: User records a voice note via `MediaRecorder`.  
   5. **Transcription**: The recorded audio is sent to the backend for speech-to-text processing.  
   6. **Save to Airtable**: Once AI description and transcript are ready, the frontend calls an endpoint to store the data.

2. **Back-End (Node.js/Express or Next.js API Routes)**
   1. **Upload Image Endpoint**: Accepts an image and forwards it to an AI image recognition service.  
   2. **Image Recognition**: Integrates with the selected provider (Hugging Face, Azure, etc.) to get a description.  
   3. **(Optional) TTS**: If voice output is required, integrates with a TTS service.  
   4. **Audio Transcription Endpoint**: Accepts audio files, forwards them to a speech-to-text service.  
   5. **Airtable Write Endpoint**: Stores the result (image URL, AI text, transcription) in Airtable.

---

## 5. Tools & Services (Free or Low-Cost Options)

1. **Image Recognition**
   - [**Hugging Face Inference API**](https://huggingface.co/inference-api) (free for basic usage)  
   - **Microsoft Azure Computer Vision (Free Tier)**: Up to 5,000 transactions/month  
   - **Google Cloud Vision (Free Tier)**

2. **Speech-to-Text**
   - **OpenAI Whisper API**: Low cost  
   - [**Hugging Face Transformers**](https://huggingface.co/): Free Inference API with daily request limits  
   - **Google Cloud Speech-to-Text (Free Tier)**: 60 minutes/month

3. **Airtable**
   - **Free Plan**: Up to 1,200 records/base, limited attachment space

4. **File Storage**
   - **Cloudinary** (Free Tier)  
   - **ImageKit** (Free Tier)  
   - **Local Storage** (not recommended for production)

5. **Frontend Libraries**
   - **React** or **Next.js** (open-source)

6. **Audio Recording**
   - **MediaRecorder** (native browser API)  
   - **react-mic** or similar React-based libraries

---

## 6. API Specifications & Endpoints

### 6.1. `POST /api/upload-image`

- **Purpose:** Receive an uploaded image from the frontend, call an AI image recognition service, and return the AI-generated description.  
- **Request Body (FormData):**  
  - `file`: The image file from the user’s device.  
- **Response (JSON):**  
  ```json
  {
    "description": "A cat sitting on a windowsill."
  }
Pseudocode Example
js
Copy
Edit
// /api/upload-image.js
import formidable from 'formidable';
import axios from 'axios';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Form parse error' });

    // 1. Forward file to a free/low-cost image recognition service (e.g., Hugging Face)
    // 2. Parse response to extract description
    // 3. Return description as JSON

    // Mock demonstration:
    const aiDescription = 'A cat sitting on a windowsill.';
    return res.status(200).json({ description: aiDescription });
  });
}
6.2. POST /api/transcribe-audio
Purpose: Receive an audio file, pass it to a speech-to-text service, and return the transcription.
Request Body (FormData):
audio: The audio blob from the user’s recording.
Response (JSON):
json
Copy
Edit
{
  "transcribedText": "This is a sample transcription from the user."
}
Pseudocode Example
js
Copy
Edit
// /api/transcribe-audio.js
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Form parse error' });

    // 1. Call a speech-to-text service (OpenAI Whisper, Google, Hugging Face)
    // 2. Return the transcription

    // Mock demonstration:
    const mockTranscription = 'This is a sample transcription from the user.';
    return res.status(200).json({ transcribedText: mockTranscription });
  });
}
6.3. POST /api/save-to-airtable
Purpose: Save the image URL (or attachment), AI description, and user’s transcribed note to Airtable.
Request Body (JSON):
json
Copy
Edit
{
  "imageUrl": "https://link.to/saved-image.jpg",
  "imageDescription": "Description from AI service",
  "userNote": "Transcribed note from user"
}
Response (JSON):
json
Copy
Edit
{
  "recordId": "recABC123"
}
Pseudocode Example
js
Copy
Edit
// /api/save-to-airtable.js
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageUrl, imageDescription, userNote } = JSON.parse(req.body);

    const newRecord = await base('VisionVoiceTable').create({
      'Image': [{ url: imageUrl }],
      'Description': imageDescription,
      'User Note': userNote
    });

    return res.status(200).json({ recordId: newRecord.id });
  } catch (error) {
    return res.status(500).json({ error: 'Error saving to Airtable', details: error });
  }
}


## 7. UI/UX Requirements
Minimalistic Layout

A single page or streamlined flow to reduce complexity.
Neutral color palette (white background, black/gray text, simple buttons).
User-friendly status indicators for image uploading and audio transcription.
Responsive Design

Large tap targets for mobile.
Image preview scales to device width.
Button layout adapts to smaller screens.
Error Handling & User Guidance

Notify the user if AI image recognition fails or transcription times out.
Provide a one-time prompt for microphone permission.
Show instructions (e.g., “Click to upload/take a photo” or “Press record to start speaking”).
8. Acceptance Criteria
Core Flow

User can successfully upload or capture an image.
The app returns a textual description of the image with an optional interesting remark or question.
User can record a short voice note, see a loading indicator, and then view the transcribed text.
Clicking “Save” creates a new record in Airtable with the correct fields.
Performance

Image AI analysis within ~5 seconds under normal network conditions.
Audio transcription for a short clip (~10 seconds of audio) completes within ~10 seconds.
Data Validation

Airtable record contains correct data: URL to the image, AI description, user’s transcription.
Errors are displayed if the process fails at any step (e.g., network issue).
Cross-Platform Usability

Works in modern desktop browsers (Chrome, Firefox, Safari) and mobile browsers.
Graceful fallback if the user’s browser lacks MediaRecorder support (show a message or alternative).

## 9. Conclusion
This Product Requirement Document outlines the specifications, architecture, tools, and acceptance criteria for the VisionVoice app. By leveraging free/low-cost AI services, a developer (or AI code assistant) can quickly build a minimalistic yet powerful application that integrates image analysis, audio transcription, and Airtable storage. The structured approach ensures clarity, maintainability, and a smooth user experience.