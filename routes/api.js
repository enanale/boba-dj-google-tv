const express = require('express');
const router = express.Router();
const spotify = require('../services/spotify');
const llm = require('../services/llm');

// Chat endpoint
router.post('/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // Get LLM response
        let response = await llm.chat(message);
        let songPlayed = null;

        // Check for tool calls
        const toolCall = llm.parseToolCall(response);

        if (toolCall && toolCall.tool === 'play_song') {
            try {
                // Search for the song
                const searchResults = await spotify.search(toolCall.query);
                const tracks = searchResults.tracks?.items || [];

                if (tracks.length > 0) {
                    const track = tracks[0];

                    // Get active device
                    const devices = await spotify.getDevices();
                    const activeDevice = devices.find(d => d.is_active) || devices[0];

                    if (activeDevice) {
                        await spotify.play(track.uri, activeDevice.id);
                        songPlayed = {
                            name: track.name,
                            artist: track.artists.map(a => a.name).join(', '),
                            album: track.album.name,
                            albumArt: track.album.images[0]?.url
                        };

                        // Generate a confirmation response
                        response = await llm.chat(`[SYSTEM: You just played "${track.name}" by ${track.artists[0].name}. Give a short, excited DJ confirmation!]`);
                        // Clean up the tool call from the response
                        response = response.replace(/\{[\s]*"tool"[\s]*:.*?\}/g, '').trim();
                    } else {
                        response = "Yo, I can't find any speakers! Make sure Spotify is open on your device. 🎧";
                    }
                } else {
                    response = `Hmm, couldn't find anything for "${toolCall.query}". Try another track? 🤔`;
                }
            } catch (spotifyError) {
                console.error('Spotify error:', spotifyError);
                response = "Oof, hit a snag with Spotify! Make sure you're logged in and a device is active. 🎵";
            }
        }

        // Clean any remaining tool call JSON from response
        response = response.replace(/\{[\s]*"tool"[\s]*:.*?\}/gs, '').trim();

        res.json({
            response,
            songPlayed
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: 'Failed to process message',
            response: "My circuits are a bit fuzzy right now... try again? 🧋"
        });
    }
});

// Get available devices
router.get('/devices', async (req, res) => {
    try {
        const devices = await spotify.getDevices();
        res.json({ devices });
    } catch (error) {
        console.error('Devices error:', error);
        res.status(500).json({ error: 'Failed to fetch devices', devices: [] });
    }
});

// Set active device
router.post('/devices/select', async (req, res) => {
    const { deviceId } = req.body;

    try {
        // Transfer playback to selected device
        await spotify.play(null, deviceId);
        res.json({ success: true });
    } catch (error) {
        console.error('Device select error:', error);
        res.status(500).json({ error: 'Failed to select device' });
    }
});

// Get current playback
router.get('/now-playing', async (req, res) => {
    try {
        const current = await spotify.getCurrentlyPlaying();
        if (current && current.item) {
            res.json({
                isPlaying: current.is_playing,
                name: current.item.name,
                artist: current.item.artists.map(a => a.name).join(', '),
                album: current.item.album.name,
                albumArt: current.item.album.images[0]?.url,
                progress: current.progress_ms,
                duration: current.item.duration_ms
            });
        } else {
            res.json({ isPlaying: false });
        }
    } catch (error) {
        res.json({ isPlaying: false });
    }
});

// Get/Set persona
router.get('/persona', (req, res) => {
    res.json({ prompt: llm.getSystemPrompt() });
});

router.post('/persona', (req, res) => {
    const { prompt } = req.body;
    llm.setSystemPrompt(prompt);
    llm.clearHistory();
    res.json({ success: true });
});

router.post('/persona/reset', (req, res) => {
    llm.setSystemPrompt(null);
    llm.clearHistory();
    res.json({ success: true, prompt: llm.DEFAULT_SYSTEM_PROMPT });
});

module.exports = router;
