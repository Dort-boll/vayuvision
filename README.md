# Vayu Vision

**Vayu Vision** is an AI-powered accessibility platform that uses the device camera to analyze the environment in real time and provide natural spoken descriptions, interactive voice dialogue, and contextual insights.

## Features

- **Instant Camera Activation**: Opens the camera immediately and greets the user.
- **Continuous, Human-Like Real-Time Descriptions**: Uses Puter.js AI modules to detect people, objects, text, movement, and spatial context.
- **Contextual Dialogue & Interactivity**: Voice commands allow users to ask specific questions about their surroundings.
- **Multi-Modal Accessibility**:
  - **Blind Users**: Fully voice-driven with spatial cues.
  - **Deaf Users**: Live captions with text summaries.
  - **Non-Verbal Users**: Tap/gesture commands and manual capture.
- **Blur Glass Theme**: High contrast, accessible UI with translucent layers.
- **Language & Model Selection**: Choose between different languages and AI models (Claude, GPT-4o, Gemini) at startup.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion
- **AI**: Puter.js AI modules (Claude, OpenAI, Gemini)
- **Speech**: Web Speech API (SpeechSynthesis & SpeechRecognition)
- **Deployment**: Optimized for Cloudflare Pages (or similar static hosting)

## Setup

1. Clone the repository.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
