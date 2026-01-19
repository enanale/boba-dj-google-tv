const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// Default DJ Persona with queue support
const DEFAULT_SYSTEM_PROMPT = `You are DJ Boba, a fun and energetic AI disc jockey! 🧋🎧

Your personality:
- Upbeat, enthusiastic, and playful
- You love bubble tea and music puns
- You speak with DJ-style flair ("Alright!", "Let's goooo!", "Dropping this banger!")
- Keep responses SHORT (1-2 sentences max, no long lists)
- NO markdown formatting (no *, **, bullet points, or lists)
- Just plain text with emojis

You manage a music queue and can play songs. You have these tools:

1. Play a single song immediately:
{"tool": "play_song", "query": "<search query>"}

2. Add multiple songs to the queue:
{"tool": "queue_songs", "count": <number>, "theme": "<theme/description>"}

Examples:
- "Play Daft Punk" → {"tool": "play_song", "query": "Daft Punk Get Lucky"}
- "Play 5 songs about the ocean" → {"tool": "queue_songs", "count": 5, "theme": "songs about the ocean"}

If the user is just chatting and NOT asking to play music, respond naturally without a tool call.
Keep it short and fun! 🎵`;

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
        console.log(`🤖 LLM Input: "${userMessage}"`);

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

        console.log(`🤖 LLM Output: "${assistantMessage.substring(0, 200)}${assistantMessage.length > 200 ? '...' : ''}"`);

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
    // Look for queue_songs tool call
    const queueMatch = response.match(/\{[\s]*"tool"[\s]*:[\s]*"queue_songs"[\s]*,[\s]*"count"[\s]*:[\s]*(\d+)[\s]*,[\s]*"theme"[\s]*:[\s]*"([^"]+)"[\s]*\}/);

    if (queueMatch) {
        return {
            tool: 'queue_songs',
            count: parseInt(queueMatch[1]),
            theme: queueMatch[2]
        };
    }

    // Look for play_song tool call
    const playMatch = response.match(/\{[\s]*"tool"[\s]*:[\s]*"play_song"[\s]*,[\s]*"query"[\s]*:[\s]*"([^"]+)"[\s]*\}/);

    if (playMatch) {
        return {
            tool: 'play_song',
            query: playMatch[1]
        };
    }

    return null;
}

/**
 * Ask the LLM to generate song queries for a theme
 * @param {number} count - Number of songs to generate
 * @param {string} theme - Theme description
 * @returns {Promise<string[]>} Array of search queries
 */
async function generateSongQueries(count, theme) {
    const prompt = `Generate exactly ${count} YouTube search queries for songs that match this theme: "${theme}"

Return ONLY a JSON array of search queries, nothing else. Each query should include the song title and artist if known.

Example format:
["Artist - Song Title", "Another Artist - Another Song", ...]

Be creative and pick diverse, interesting songs that fit the theme!`;

    try {
        console.log(`🎵 Song Query Request: ${count} songs for theme "${theme}"`);

        const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: 'You are a music expert. Respond ONLY with a JSON array of song search queries.' },
                    { role: 'user', content: prompt }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.message?.content || '[]';

        console.log(`🎵 Song Query LLM Response: ${content}`);

        // Extract JSON array from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const queries = JSON.parse(jsonMatch[0]);
            console.log(`🎵 Generated ${queries.length} song queries for "${theme}":`, queries);
            return queries.slice(0, count);
        }

        return [];
    } catch (error) {
        console.error('Failed to generate song queries:', error);
        return [];
    }
}

module.exports = {
    chat,
    parseToolCall,
    generateSongQueries,
    setSystemPrompt,
    getSystemPrompt,
    clearHistory,
    DEFAULT_SYSTEM_PROMPT
};
