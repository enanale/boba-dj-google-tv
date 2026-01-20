# Product Requirements Document (PRD): Boba DJ 🧋🎧

## 1. Product Overview
**Boba DJ** is a local web service hosting a playful, AI-powered Chatbot DJ. The DJ has a customizable persona and controls music playback on the user's **Google TV (Chromecast)** via YouTube. The interface is fun, vibrant, and includes a playlist queue with "Pop-up Video" style fun facts.

## 2. Goals & Objectives
- **Fun**: Create a delightful, playful user experience with a "Boba" theme and witty AI personality.
- **Simple**: Minimalist tech stack (Node.js/Express) running locally.
- **Smart**: The DJ actively suggests songs, manages a queue, and shares interesting trivia about tracks.
- **Integrated**: Seamless control of Chromecast devices using YouTube audio streams.

## 3. User Stories
- **As a user**, I want to chat with a DJ (e.g., "DJ Boba") who responds with enthusiasm and emojis.
- **As a user**, I want the DJ to create themed playlists (e.g., "Play 5 sci-fi theme songs") and queue them up automatically.
- **As a user**, I want to learn fun facts about the songs playing, delivered right in the chat.
- **As a user**, I want to easily select which Chromecast device to play on.

## 4. Feature Requirements

### 4.1. Web Interface
- **Chat Interface**: Main hub for talking to the DJ and seeing fun facts.
- **Visuals**: Vibrant "Boba" theme with floating pearls and animations.
- **Queue Management**: View, skip, and clear tracks in the playlist queue.
- **Device Picker**: Select target Chromecast from discovered devices.

### 4.2. Chatbot & AI
- **LLM Integration**: Uses local LLM (Ollama) for chat and song generation.
- **Creative Agency**: The DJ proactively selects songs and explains choices without needing a second prompt.
- **Fun Facts**: Automatically generates and shares trivia when a new song starts.

### 4.3. YouTube & Chromecast Integration
- **YouTube Search**: Finds songs and extracts stream URLs (via `yt-dlp`).
- **Casting**: Streams audio directly to Chromecast devices.
- **Auto-Advance**: Automatically plays the next song in the queue when one finishes.

## 5. Non-Functional Requirements
- **Local First**: Runs on `localhost` without external cloud accounts (Spotify not required).
- **Security**: Validates video IDs to prevent command injection.

## 6. Decisions
- **Source**: Switched from Spotify to YouTube/`yt-dlp` for easier local playback without premium accounts.
- **Facts**: Moved "Pop-up Video" facts from a bubble UI to the main chat for better visibility.
