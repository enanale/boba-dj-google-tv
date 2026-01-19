# Product Requirements Document (PRD): Boba DJ 🧋🎧

## 1. Product Overview
**Boba DJ** is a local web service hosting a playful, AI-powered Chatbot DJ. The DJ has a customizable persona and controls music playback on the user's Google TV via Spotify. The interface aims to be fun, vibrant, and simple.

## 2. Goals & Objectives
- **Fun**: Create a delightful, playful user experience (think: bubble tea, arcade vibes, or retro futurism).
- **Simple**: Minimalist tech stack for easy maintenance and setup.
- **Smart**: The DJ shouldn't just play songs; it should chat, take requests, and have a personality.
- **Integrated**: Seamless control of Spotify on Google TV.

## 3. User Stories
- **As a user**, I want to chat with a DJ (e.g., "DJ Boba") who responds with a distinct personality.
- **As a user**, I want to ask the DJ to play specific songs or genres (e.g., "Play some lo-fi beats").
- **As a user**, I want the music to start playing automatically on my Google TV (Spotify Connect device).
- **As a user**, I want to easily customize the DJ's persona text to change their vibe.

## 4. Feature Requirements

### 4.1. Web Interface
- **Chat Interface**: A central chat window for interacting with the DJ.
- **Visuals**: "Playful" aesthetics. Animated elements (e.g., dancing boba pearls, equalizers).
- **Now Playing**: Display current song info (Album Art, Title, Artist).
- **Persona Settings**: A simple settings pane/modal to edit the "System Prompt" for the AI.

### 4.2. Chatbot & AI
- **LLM Integration**: Use a local LLM (e.g., via Ollama) or a simple API to power the conversation.
- **Tool Calling**: The AI must be able to understand intent (e.g., "User wants to hear X") and output a command to trigger Spotify.
- **Context Awareness**: The DJ should remember the last few interactions for continuity.

### 4.3. Spotify Integration
- **Spotify Web API**: Used for Search and Player Control.
- **Device Targeting**: Specifically target the "Google TV" device ID (or auto-discover active devices).
- **Auth**: handling Spotify OAuth flow.

## 5. Non-Functional Requirements
- **Performance**: Instant chat response (streaming preferred).
- **Local First**: Runs on `localhost`.
- **Tech Stack**: Node.js (Express), Vanilla HTML/CSS/JS.

## 6. Decisions
- **LLM Provider**: Ollama (local). User has it installed.
- **Device Discovery**: Device Picker UI for selecting Spotify Connect target.
