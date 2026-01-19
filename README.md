# 🧋 Boba DJ

A playful, AI-powered DJ chatbot that casts YouTube music to your Google TV or Chromecast.

## Features

- 🎵 **Chat with DJ Boba** – An AI DJ with a fun, customizable personality
- 🔍 **YouTube Search** – Find any song, no API keys needed
- 📺 **Chromecast Integration** – Cast directly to your Google TV or speakers
- 🎨 **Boba-themed UI** – Vibrant, playful interface with animations

## Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.ai/) running locally with a model (e.g., `ollama run llama3.1`)
- A Chromecast or Google TV on the same network

### 2. Install & Run

```bash
# Install dependencies
npm install

# Copy env file (optional, defaults work fine)
cp .env.example .env

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Select Your Device

1. Click the 📺 button in the header
2. Choose your Google TV or Chromecast
3. Start chatting!

## Usage

Just chat with DJ Boba:

- *"Play some Daft Punk"*
- *"I need chill vibes"*
- *"Drop a banger!"*

DJ Boba will search YouTube and cast the video to your selected device.

## Customizing the DJ

Click the ⚙️ button to edit DJ Boba's personality. Change the system prompt to create your own unique DJ persona!

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JS
- **AI**: Ollama (local LLM)
- **Music**: YouTube (via `ytsr`)
- **Casting**: Chromecast protocol (`castv2-client`)

## Troubleshooting

### No devices found?
- Make sure your Google TV/Chromecast is powered on
- Check that your computer and TV are on the same WiFi network
- Click the 🔄 Refresh button in the device picker

### Cast not working?
- Try selecting the device again
- Make sure no other app is currently casting to it

## License

MIT
