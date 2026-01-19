const express = require('express');
const router = express.Router();
const youtube = require('../services/youtube');
const chromecast = require('../services/chromecast');
const llm = require('../services/llm');

// Selected device for casting
let selectedDevice = null;

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
                // Search YouTube for the song
                const videos = await youtube.search(toolCall.query + ' official audio');

                if (videos.length > 0) {
                    const video = videos[0];

                    // Get devices and find selected or first available
                    const devices = await chromecast.getDevices();
                    const targetDevice = selectedDevice
                        ? devices.find(d => d.id === selectedDevice)
                        : devices[0];

                    if (targetDevice) {
                        // Get the direct stream URL using yt-dlp
                        const streamInfo = await youtube.getStreamUrl(video.id);

                        // Cast the stream to the device
                        await chromecast.castStream(
                            streamInfo.streamUrl,
                            streamInfo.contentType,
                            targetDevice.host,
                            {
                                title: video.title,
                                author: video.author,
                                thumbnail: video.thumbnail
                            }
                        );

                        songPlayed = {
                            name: video.title,
                            artist: video.author,
                            thumbnail: video.thumbnail,
                            videoId: video.id
                        };

                        // Generate a confirmation response
                        response = await llm.chat(`[SYSTEM: You just played "${video.title}" by ${video.author} on the TV. Give a short, excited DJ confirmation!]`);
                        response = response.replace(/\{[\s]*"tool"[\s]*:.*?\}/g, '').trim();
                    } else {
                        response = "Yo, I can't find any Chromecast devices! Make sure your Google TV is on and connected to the same network. 📺";
                    }
                } else {
                    response = `Hmm, couldn't find anything for "${toolCall.query}" on YouTube. Try another track? 🤔`;
                }
            } catch (castError) {
                console.error('Cast error:', castError);
                response = "Oof, hit a snag casting to your TV! Make sure it's on and connected. 📺";
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

// Get available Chromecast devices
router.get('/devices', async (req, res) => {
    try {
        const devices = await chromecast.getDevices();
        res.json({
            devices: devices.map(d => ({
                id: d.id,
                name: d.name,
                type: d.type,
                is_active: selectedDevice === d.id
            }))
        });
    } catch (error) {
        console.error('Devices error:', error);
        res.status(500).json({ error: 'Failed to fetch devices', devices: [] });
    }
});

// Refresh device list
router.post('/devices/refresh', async (req, res) => {
    try {
        const devices = await chromecast.refreshDevices();
        res.json({
            devices: devices.map(d => ({
                id: d.id,
                name: d.name,
                type: d.type,
                is_active: selectedDevice === d.id
            }))
        });
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh devices' });
    }
});

// Select a device for casting
router.post('/devices/select', async (req, res) => {
    const { deviceId } = req.body;
    selectedDevice = deviceId;
    res.json({ success: true, selectedDevice });
});

// Get current playback status
router.get('/now-playing', (req, res) => {
    const nowPlaying = chromecast.getNowPlaying();
    if (nowPlaying.isPlaying) {
        res.json({
            isPlaying: true,
            name: nowPlaying.title,
            artist: nowPlaying.author,
            albumArt: nowPlaying.thumbnail
        });
    } else {
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
