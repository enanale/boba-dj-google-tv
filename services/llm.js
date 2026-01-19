const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// Default DJ Persona
const DEFAULT_SYSTEM_PROMPT = `You are DJ Boba, a fun and energetic AI disc jockey! 🧋🎧

Your personality:
- Upbeat, enthusiastic, and playful
- You love bubble tea and music puns
- You speak with DJ-style flair ("Alright alright alright!", "Let's goooo!", "Dropping this banger!")
- You're knowledgeable about all music genres
- Keep responses short and punchy (1-3 sentences max)

You have the ability to play music. When a user asks you to play a song, artist, or genre, you MUST respond with a JSON tool call in this exact format:
{"tool": "play_song", "query": "<search query>"}

Examples:
- User: "Play something by Daft Punk" → {"tool": "play_song", "query": "Daft Punk"}
- User: "I want to hear Levitating" → {"tool": "play_song", "query": "Levitating Dua Lipa"}
- User: "Play some lo-fi beats" → {"tool": "play_song", "query": "lo-fi hip hop beats"}

If the user is just chatting and NOT asking to play music, respond naturally without a tool call.
Always be fun and keep the vibe going! 🎵`;

let systemPrompt = DEFAULT_SYSTEM_PROMPT;
let conversationHistory = [];

function setSystemPrompt(prompt) {
    systemPrompt = prompt || DEFAULT_SYSTEM_PROMPT;
}

function getSystemPrompt() {
    return systemPrompt;
}

function clearHistory() {
    conversationHistory = [];
}

async function chat(userMessage) {
    // Add user message to history
    conversationHistory.push({ role: 'user', content: userMessage });

    // Keep history manageable (last 10 exchanges)
    if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory
    ];

    try {
        const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: messages,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status}`);
        }

        const data = await response.json();
        const assistantMessage = data.message?.content || "Yo, my brain just skipped a beat! Try again?";

        // Add assistant response to history
        conversationHistory.push({ role: 'assistant', content: assistantMessage });

        return assistantMessage;
    } catch (error) {
        console.error('LLM Error:', error);
        throw error;
    }
}

// Parse tool calls from LLM response
function parseToolCall(response) {
    // Look for JSON tool call pattern
    const jsonMatch = response.match(/\{[\s]*"tool"[\s]*:[\s]*"play_song"[\s]*,[\s]*"query"[\s]*:[\s]*"([^"]+)"[\s]*\}/);

    if (jsonMatch) {
        return {
            tool: 'play_song',
            query: jsonMatch[1]
        };
    }

    return null;
}

module.exports = {
    chat,
    parseToolCall,
    setSystemPrompt,
    getSystemPrompt,
    clearHistory,
    DEFAULT_SYSTEM_PROMPT
};
