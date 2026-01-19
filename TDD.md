# Technical Design Document (TDD) & Implementation Plan

## User Review Required
> [!IMPORTANT]
> **Spotify Developer Account**: You will need to create a Spotify App in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and get a `Client ID` and `Client Secret`. You'll also need to add `http://localhost:3000/callback` as a Redirect URI.

> [!NOTE]
> **LLM Setup**: This plan assumes you have **Ollama** running locally (e.g., `ollama serve`) with a model like `llama3` or `mistral`. We will communicate with it via HTTP.

## Proposed Changes

### Tech Stack
- **Backend**: Node.js + Express
    - Why? Simple, fast, excellent JSON handling, easy integration with Spotify Web API.
- **Frontend**: Vanilla HTML5 + CSS3 + JavaScript (ES6+)
    - Why? "Keep things as simple as possible". No build steps (Webpack/Vite) required, just run the server.
- **Data Persistence**: `node-persist` (Simple file-based storage) or just a `.env` + in-memory session.
    - We need to store: `access_token`, `refresh_token`, and user `system_prompt`.

### Architecture

```mermaid
graph TD
    Browser[Web Browser] <-->|HTTP/WebSocket| Server[Node.js Express Server]
    Server <-->|REST API| Spotify[Spotify Web API]
    Server <-->|REST API| Ollama[Local LLM (Ollama)]
    Spotify -.->|Playback| GoogleTV[Google TV (Spotify Connect)]
```

### Component Breakdown

#### Backend (Node.js)
1.  **`server.js`**: Main entry point.
2.  **`routes/auth.js`**: Handles `/login` and `/callback` for Spotify OAuth.
3.  **`routes/api.js`**:
    -   `POST /chat`: Receives user message -> Sends to LLM -> Parses tool calls (song requests) -> Calls Spotify -> Returns DJ response.
    -   `GET /player/devices`: Lists available Spotify Connect devices.
    -   `POST /player/play`: Internal tool-endpoint to trigger playback.
4.  **`services/spotify.js`**: Wrapper for Spotify API calls.
5.  **`services/llm.js`**: Wrapper for Ollama API interaction.

#### Frontend
1.  **`public/index.html`**: Chat view, controls, and settings.
2.  **`public/style.css`**: "Boba" theme. Vibrant colors, rounded corners, fun fonts.
3.  **`public/script.js`**: Fetches messages, updates UI, handles "typing" states.

### Data Flow: "Play a song"
1.  **User** types "Play 'Levitating'" in Chat.
2.  **Frontend** POSTs message to `/api/chat`.
3.  **Backend** constructs prompt for LLM including "Available Tools" (e.g., `play_song(query)`).
4.  **LLM** responds with JSON indicating function call: `{ "tool": "play_song", "args": "Levitating" }`.
5.  **Backend** detects tool call:
    -   Calls Spotify Search API for "Levitating".
    -   Gets URI of first result.
    -   Calls Spotify Play API with URI and Target Device (Google TV).
6.  **Backend** asks LLM to generate a verbal confirmation (e.g., "Spinning that track for you!").
7.  **Backend** returns text response to Frontend.

## Verification Plan

### Automated Tests
- We will rely on manual verification for this playful prototype, given the heavy external dependency (Spotify/Hardware).

### Manual Verification
1.  **Authentication**:
    -   Go to `http://localhost:3000`.
    -   Click "Login with Spotify".
    -   Verify redirect back to app.
2.  **Device Discovery**:
    -   Ensure Google TV shows up in device list (must be open/active on Spotify).
3.  **Chat & Playback**:
    -   Type "Play Daft Punk".
    -   Verify LLM responds in character.
    -   Verify music starts on TV.
