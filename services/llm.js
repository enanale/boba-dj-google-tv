const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// Default DJ Persona with queue support
const DEFAULT_SYSTEM_PROMPT = `You are DJ Boba, a fun and energetic AI disc jockey! 🧋🎧

Your personality:
- Upbeat, enthusiastic, and playful
- You love bubble tea and music puns
- You speak with DJ-style flair ("Alright!", "Let's goooo!", "Dropping this banger!")
- Keep responses SHORT but meaningful
- NO markdown formatting (no *, **, bullet points, or lists)
- Just plain text with emojis
- BE CREATIVE: You suggest interesting, diverse tracks and EXPLAIN why you chose them if the user asks for more info!

IMPORTANT: Always include a verbal response (hype, explanation, jokes) followed by the tool call JSON. Never send only the JSON.

You manage a music queue and can play songs. You have these tools:

1. Play a single song immediately:
{"tool": "play_song", "query": "<search query>"}

2. Add multiple songs to the queue:
{"tool": "queue_songs", "songs": ["Artist - Song Title", "Another Artist - Song", ...]}

Examples:
- "Play Daft Punk" → "Got some Daft Punk coming at ya! Let's get lucky! {"tool": "play_song", "query": "Daft Punk Get Lucky"}"
- "Play 5 ocean songs" → "Diving into the deep blue with these 5 wave-makers! {"tool": "queue_songs", "songs": ["The Beach Boys - Surfin' USA", "Otis Redding - (Sittin' On) The Dock of the Bay", "Jack Johnson - Banana Pancakes", "The Beatles - Octopus's Garden", "Enya - Orinoco Flow"]}"

If the user is just chatting and NOT asking to play music, respond naturally without a tool call.
Keep it short, creative, and fun! 🎵`;

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
    try {
        // Look for any JSON-like structure in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const toolCall = JSON.parse(jsonMatch[0]);

        if (toolCall.tool === 'queue_songs') {
            // Support both old and new formats for backward compatibility during transition
            const songs = toolCall.songs || [];
            return {
                tool: 'queue_songs',
                songs: Array.isArray(songs) ? songs : [songs],
                count: toolCall.count || songs.length,
                theme: toolCall.theme || 'DJ\'s Choice'
            };
        }

        if (toolCall.tool === 'play_song') {
            return {
                tool: 'play_song',
                query: toolCall.query
            };
        }
    } catch (err) {
        console.error('Error parsing tool call:', err);
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

Return ONLY a JSON array of strings, nothing else. Every item in the array MUST be a single string.

Example format:
["Artist - Song Title", "Another Artist - Another Song", "Artist - Track"]

Be creative and pick diverse, interesting songs that fit the theme!`;

    try {
        console.log(`🎵 Song Query Request: ${count} songs for theme "${theme}"`);

        const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: 'You are a music expert. Respond ONLY with a simple JSON array of strings.' },
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
            let queries = JSON.parse(jsonMatch[0]);

            // Defensive: Flatten nested arrays and ensure all are strings
            if (Array.isArray(queries)) {
                queries = queries.map(q => {
                    if (Array.isArray(q)) return q[0]; // Take first element if it's an array
                    return q;
                }).filter(q => typeof q === 'string' && q.trim().length > 0);

                console.log(`🎵 Generated ${queries.length} song queries for "${theme}":`, queries);
                return queries.slice(0, count);
            }
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
