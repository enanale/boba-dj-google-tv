# 🧋 Boba DJ

A playful, AI-powered DJ chatbot that controls Spotify playback on your devices.

## Features

- 🎵 **Chat with DJ Boba** – An AI DJ with a fun, customizable personality
- 🔊 **Spotify Integration** – Search and play music via natural language
- 📺 **Device Picker** – Choose which Spotify Connect device to play on (Google TV, speakers, etc.)
- 🎨 **Boba-themed UI** – Vibrant, playful interface with animations

## Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.ai/) running locally with a model (e.g., `ollama run llama3`)
- A [Spotify Developer App](https://developer.spotify.com/dashboard)

### 2. Spotify Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:3000/callback` as a Redirect URI
4. Copy your **Client ID** and **Client Secret**

### 3. Configuration

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your Spotify credentials
```

### 4. Install & Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) and log in with Spotify!

## Usage

Just chat with DJ Boba:

- *"Play some Daft Punk"*
- *"I need chill vibes"*
- *"Drop a banger!"*

## Customizing the DJ

Click the ⚙️ button to edit DJ Boba's personality. Change the system prompt to create your own unique DJ persona!

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JS
- **AI**: Ollama (local LLM)
- **Music**: Spotify Web API

## License

MIT
