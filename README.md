# 🧋 Boba DJ

A playful, AI-powered DJ chatbot that casts YouTube music to your Google TV or Chromecast.

## Features

- 🎵 **Chat with DJ Boba** – An AI DJ with a fun, customizable personality
- 💡 **Fun Facts** – "Pop-up Video" style trivia in the chat for every song
- 🔍 **YouTube Search** – Find any song, no API keys needed
- 📺 **Chromecast Integration** – Cast directly to your Google TV or speakers
- 📋 **Playlist Queue** – "Play 5 songs about robots" builds a themed playlist
- ⏭️ **Auto-Advance** – Next song plays automatically when current ends
- 🎨 **Boba-themed UI** – Vibrant, playful dark-mode interface

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.ai/) running locally (`ollama run llama3.1`)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (`brew install yt-dlp`)
- A Chromecast or Google TV on the same network

### Install & Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

### Select Your Device

1. Click the 📺 button in the header
2. Choose your Google TV or Chromecast
3. Start chatting!

## Usage

Chat with DJ Boba:

- *"Play some Daft Punk"* – Plays immediately
- *"Play 5 songs about the ocean"* – Queues a themed playlist
- *"Skip"* – Use the queue modal to skip tracks

As songs start, look for the **💡 Did you know?** messages in the chat!

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express |
| Frontend | Vanilla HTML/CSS/JS |
| AI | Ollama (local LLM) |
| YouTube Search | `youtube-sr` |
| Stream Extraction | `yt-dlp` |
| Casting | `castv2-client` + SSDP |

## Troubleshooting

**No devices found?**
- Ensure your Google TV/Chromecast is on and on the same WiFi
- Click the 🔄 Refresh button in the device picker

**Cast shows blank screen?**
- Make sure `yt-dlp` is installed: `brew install yt-dlp`
- Try a different song – some videos may be geo-restricted

## License

MIT
