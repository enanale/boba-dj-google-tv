# Technical Design Document (TDD) & Implementation Plan

## Overview
This document outlines the final architecture of **Boba DJ**, a local AI DJ that plays music on Google TV (Chromecast) via YouTube and provides fun facts in a chat interface.

### Tech Stack
- **Backend**: Node.js + Express
    - **Libraries**: `youtube-sr` (Search), `yt-dlp-exec` (Stream Extraction), `castv2-client` (Chromecast), `ollama` (LLM).
- **Frontend**: Vanilla HTML5 + CSS3 + JavaScript (ES6+)
- **Data Persistence**: In-memory state for Queue and Current Track (sufficient for local run).

### Architecture

```mermaid
graph TD
    Browser[Web Browser] <-->|HTTP/REST| Server[Node.js Express Server]
    Server <-->|Shell| YTDLP[yt-dlp process]
    Server <-->|Network| Chromecast[Chromecast Discovery (SSDP) | ✅ Found 8 devices (Auto-selects **Den TV**) |]
    Server <-->|API| Ollama[Local LLM (Ollama)]
    YTDLP -.->|Stream URL| Server
    Server -.->|Stream Bytes| Chromecast
```

### Component Breakdown

#### Backend (`server.js`, `routes/api.js`)
- **`routes/api.js`**:
    - `POST /chat`: Main interaction loop. Sends message to LLM -> LLM returns text + tool calls -> Server executes tool (queue songs) -> Returns response.
    - `GET /now-playing`: Long-polling endpoint for UI updates. Returns track info and **Fun Facts**.
    - `POST /player/control`: Handles Skip, Device Selection, etc.
- **`services/llm.js`**:
    - Manages Ollama connection.
    - `getFunFact(song, artist)`: Generates trivia in parallel with playback.
    - `chat(message)`: Handles persona and tool definitions.
- **`services/queue.js`**:
    - Manages the playlist array and current track state.
    - Handles "Auto-Advance" logic when a song finishes.

#### Frontend
- **`public/script.js`**:
    - Polls `/api/now-playing` every 5 seconds.
    - `handleFunFact()`: Checks for new facts and displays them as chat messages.
    - Manages Chat UI, Queue Modal, and Device Picker.

### Key Logic: "Fun Fact" Delivery
1.  **Track Start**: When `playTrack()` is called, the backend triggers `llm.getFunFact()` in the background to avoid blocking playback.
2.  **Storage**: The generated fact is stored in the `queue` service with the `currentTrack` object.
3.  **Delivery**: The frontend polls `/api/now-playing`, receives the new track + fact, and `handleFunFact()` renders it into the chat window if it hasn't been shown yet.

## Verification
- **Manual Testing**:
    - Play commands ("Play 80s music") -> Verify songs queue up.
    - Playback -> Verify audio on Chromecast.
    - Chat -> Verify "**Hallucinated Fun Fact**" messages appear at start of songs.
