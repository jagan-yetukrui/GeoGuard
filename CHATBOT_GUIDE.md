# GeoGuard Chatbot & Voice Assistant

## Overview

The GeoGuard chatbot is an **emergency response AI assistant** that helps users understand the current earthquake situation and provides actionable guidance on what to do and how to react. It integrates with:

- **Context-aware responses** based on real-time earthquake data, risk assessment, and response plans
- **Voice input** using browser's Web Speech API for situations where typing isn't practical
- **Voice output** using ElevenLabs text-to-speech for quick audio briefings  
- **Multi-turn conversations** that maintain context across multiple messages

## Features

### 1. Context-Aware Guidance
The chatbot analyzes the current earthquake situation and provides relevant suggestions by understanding:
- **Earthquake parameters**: Magnitude, depth, location, time
- **Risk assessment**: Damage scores (0-10), confidence levels (low/medium/high)
- **Response plan**: Priority actions, help stations, evacuation routes
- **Risk zones**: High, medium, and low severity areas with radius information

### 2. Voice Interaction
- **Voice Input**: Click the microphone button to speak your query (requires browser support for Web Speech API)
- **Voice Output**: Responses are automatically converted to speech and played to the user
- **Manual Voice Control**: Click "Play" button on any assistant message to hear it read aloud

### 3. Quick Actions
When approaching critical severity (damage score > 5), the chatbot provides quick action suggestions without waiting for full AI analysis.

## Setup & Configuration

### Backend Setup

#### 1. Install Dependencies
All required packages are already in `requirements.txt`:
```bash
cd backend
pip install -r requirements.txt
```

#### 2. Configure API Keys
Create or update `.env` file in the `backend` directory:

```env
# Required for chatbot AI responses
GOOGLE_API_KEY=your_google_api_key_here

# Required for voice synthesis
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Optional: Override default CORS origin
CORS_ORIGINS=http://localhost:3000,http://localhost:5000
```

#### 3. Get API Keys

**Google Generative AI (Chatbot)**:
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Get API Key"
3. Create a new API key in your Google Cloud project
4. Copy and paste into `.env` as `GOOGLE_API_KEY`

**ElevenLabs (Voice Synthesis)**:
1. Sign up at [ElevenLabs](https://elevenlabs.io)
2. Go to Account Settings → API Keys
3. Create or copy your API key
4. Add to `.env` as `ELEVENLABS_API_KEY`

### Frontend Setup

No additional configuration needed. The chatbot UI is automatically available once a response plan is generated.

## API Endpoints

### POST `/api/chat`
Generate chatbot response based on user query and current situation.

**Request Body:**
```json
{
  "message": "What should I do right now?",
  "quake_id": "us7000abc123",
  "plan": {
    "summary": "...",
    "damage_score": 7,
    "priority_actions": [...],
    "zones": [...]
  },
  "chat_history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

**Response:**
```json
{
  "message": "Based on the current earthquake...",
  "error": null,
  "quick_actions": [
    "🚨 CRITICAL EARTHQUAKE - Take cover NOW!",
    "Move to interior rooms away from windows",
    "Drop, Cover, and Hold On if still shaking"
  ]
}
```

### POST `/api/voice`
Convert text to speech using ElevenLabs.

**Request Body:**
```json
{
  "text": "This is a critical earthquake..."
}
```

**Response:**
```json
{
  "audio_base64": "//NExAAR...",
  "content_type": "audio/mpeg"
}
```

## Usage

### Step 1: Load Earthquake Data
The app starts by fetching the latest earthquake from USGS feed or using mock data if offline.

### Step 2: Generate Response Plan
Click the "Generate Response Plan" button to:
- Analyze earthquake impact
- Identify risk zones
- Locate nearby help stations
- Calculate optimal rescue routes
- Generate priority actions

### Step 3: Open the Assistant
Once a plan is generated, the "Emergency Assistant" chat panel becomes active at the bottom of the sidebar.

### Step 4: Ask Questions
Type or speak your questions:
- "What should I do right now?"
- "Where are the nearest shelters?"
- "How do I get to safety?"
- "What are the priority actions?"
- "Are aftershocks likely?"

### Step 5: Listen to Responses
- Click "Play" to hear the response
- Or the response plays automatically (if audio autoplay is enabled)

## Architecture

### Backend (`backend/app/chatbot.py`)
- `get_chatbot_response()`: Main AI response generation using Google Generative AI
- `_format_context()`: Formats earthquake/plan data into context for the model
- `get_emergency_suggestions()`: Fallback quick actions when AI unavailable
- `format_voice_briefing()`: Creates concise text for TTS conversion

### Frontend (`components/ChatPanel.tsx`)
- Message display with auto-scrolling
- Text input and send functionality
- Microphone button for voice input (Web Speech API)
- Play button for voice output (ElevenLabs TTS)
- Loading states and error handling

### API Integration (`lib/api.ts`)
- `chatWithBot()`: HTTP client for chat endpoint
- Formats request with earthquake context and plan data
- Handles streaming responses

## Error Handling

### API Key Missing
If `GOOGLE_API_KEY` is not set:
- The chatbot will return an error message
- Quick actions will still be available
- User can still ask questions, but won't get AI responses

### Voice Input Not Supported
If browser doesn't support Web Speech API:
- Microphone button will show an alert
- Text input remains available
- Voice output still works with ElevenLabs

### Voice Output Disabled
If `ELEVENLABS_API_KEY` is not set:
- Messages display normally
- "Play" button is available but will fail
- Voice briefing (from "Play Briefing") won't work

## Performance Considerations

- **Chat history**: Limited to last 4 messages for context management
- **Text limits**: ChatBot truncates responses to 256 tokens for quick delivery
- **Voice limits**: ElevenLabs requests truncated to 5000 characters
- **Response time**: Typically 1-3 seconds for AI response generation

## Demo Usage

### Quick Test Without APIs
```bash
# Backend (no APIs needed for basic functionality)
cd backend
uvicorn app.main:app --reload

# Frontend (in new terminal)
npm run dev

# Visit http://localhost:3000
# Use mock data and observe the UI (chatbot won't respond without API keys)
```

### Full Demo With APIs
```bash
# Set environment variables
export GOOGLE_API_KEY="..."
export ELEVENLABS_API_KEY="..."

# Run services
cd backend && uvicorn app.main:app --reload
# Terminal 2:
npm run dev
```

## Microsoft PatriotAI Integration

This chatbot implementation:
- ✅ Uses Google Generative AI for intelligent responses
- ✅ Provides real-time contextual guidance based on earthquake data
- ✅ Integrates SMS/voice capabilities for emergency response
- ✅ Scalable architecture ready for cloud deployment (Azure, GCP, AWS)

To extend this with PatriotAI:
1. Replace Google Generative AI calls with PatriotAI API endpoints
2. Update `backend/app/chatbot.py` to use PatriotAI models
3. PatriotAI provides enterprise-grade security and compliance for emergency systems

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Chatbot error: API key not configured" | Add `GOOGLE_API_KEY` to `.env` and restart backend |
| "Voice unavailable" | Add `ELEVENLABS_API_KEY` to `.env` and restart backend |
| Microphone button shows "not supported" | Use Chrome, Edge, or Safari; check microphone permissions |
| Chat panel not showing | Generate a response plan first (click "Generate Response Plan") |
| Responses are generic | Ensure you've generated a response plan for the chatbot to have context |

## Future Enhancements

- [ ] Multi-language support for chatbot responses
- [ ] Sentiment analysis to detect user panic/distress
- [ ] Integration with emergency services APIs
- [ ] Persistent chat history (local storage/database)
- [ ] Scheduled check-in reminders during active emergencies
- [ ] Integration with PatriotAI for enterprise capabilities
- [ ] Real-time transcription for rapid response scenarios
