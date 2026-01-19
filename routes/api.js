const express = require('express');
const router = express.Router();
const youtube = require('../services/youtube');
const chromecast = require('../services/chromecast');
const llm = require('../services/llm');
const queue = require('../services/queue');

// Selected device for casting
let selectedDevice = null;

// Set up auto-advance when track finishes
chromecast.setOnPlaybackFinished(async () => {
    const nextTrack = queue.getNextTrack();
    if (nextTrack) {
        console.log(`📋 Auto-advancing to: ${nextTrack.title}`);
        await playTrack(nextTrack);
    }
});

/**
 * Play a track (used for both direct play and queue auto-advance)
 */
async function playTrack(track) {
    const device = chromecast.getSelectedDevice();
    if (!device) {
        console.error('No device selected for playback');
        return false;
    }

    try {
        const streamInfo = await youtube.getStreamUrl(track.id);
        await chromecast.castStream(
            streamInfo.streamUrl,
            streamInfo.contentType,
            device.host,
            {
                title: track.title,
                author: track.author,
                thumbnail: track.thumbnail
            }
        );
        queue.setCurrentTrack(track);
        return true;
    } catch (error) {
        console.error('Failed to play track:', error);
        return false;
    }
}

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
        let queuedSongs = [];

        // Check for tool calls
        const toolCall = llm.parseToolCall(response);

        if (toolCall) {
            if (toolCall.tool === 'play_song') {
                // Single song - play immediately
                try {
                    const videos = await youtube.search(toolCall.query + ' official audio');

                    if (videos.length > 0) {
                        const video = videos[0];
                        const devices = await chromecast.getDevices();
                        const targetDevice = selectedDevice
                            ? devices.find(d => d.id === selectedDevice)
                            : devices[0];

                        if (targetDevice) {
                            const streamInfo = await youtube.getStreamUrl(video.id);
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

                            queue.setCurrentTrack({
                                id: video.id,
                                title: video.title,
                                author: video.author,
                                thumbnail: video.thumbnail
                            });

                            songPlayed = {
                                name: video.title,
                                artist: video.author,
                                thumbnail: video.thumbnail,
                                videoId: video.id
                            };

                            response = await llm.chat(`[SYSTEM: You just played "${video.title}" by ${video.author}. Give a short, excited DJ confirmation!]`);
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
            } else if (toolCall.tool === 'queue_songs') {
                // Multiple songs - generate queries and add to queue
                try {
                    const { count, theme } = toolCall;

                    // Generate song queries based on theme
                    const songQueries = await llm.generateSongQueries(count, theme);

                    if (songQueries.length === 0) {
                        response = `Hmm, I couldn't think of songs for "${theme}". Try a different theme? 🤔`;
                    } else {
                        // Search YouTube for each query and add to queue
                        const devices = await chromecast.getDevices();
                        const targetDevice = selectedDevice
                            ? devices.find(d => d.id === selectedDevice)
                            : devices[0];

                        if (!targetDevice) {
                            response = "Yo, I can't find any Chromecast devices! Make sure your Google TV is on. 📺";
                        } else {
                            let firstTrack = null;

                            for (const query of songQueries) {
                                const videos = await youtube.search(query);
                                if (videos.length > 0) {
                                    const video = videos[0];
                                    const track = {
                                        id: video.id,
                                        title: video.title,
                                        author: video.author,
                                        thumbnail: video.thumbnail
                                    };

                                    if (!firstTrack && !chromecast.getIsPlaying()) {
                                        // Play the first track immediately if nothing playing
                                        firstTrack = track;
                                    } else {
                                        // Add to queue
                                        queue.addToQueue(track);
                                        queuedSongs.push(track);
                                    }
                                }
                            }

                            // Start playing the first track if nothing is playing
                            if (firstTrack) {
                                const streamInfo = await youtube.getStreamUrl(firstTrack.id);
                                await chromecast.castStream(
                                    streamInfo.streamUrl,
                                    streamInfo.contentType,
                                    targetDevice.host,
                                    {
                                        title: firstTrack.title,
                                        author: firstTrack.author,
                                        thumbnail: firstTrack.thumbnail
                                    }
                                );
                                queue.setCurrentTrack(firstTrack);
                                songPlayed = {
                                    name: firstTrack.title,
                                    artist: firstTrack.author,
                                    thumbnail: firstTrack.thumbnail
                                };
                            }

                            const totalQueued = queuedSongs.length + (firstTrack ? 1 : 0);
                            response = await llm.chat(`[SYSTEM: You just queued ${totalQueued} songs about "${theme}". The first one is now playing${queuedSongs.length > 0 ? ` and ${queuedSongs.length} more are in the queue` : ''}. Give an excited DJ announcement about the theme!]`);
                            response = response.replace(/\{[\s]*"tool"[\s]*:.*?\}/g, '').trim();
                        }
                    }
                } catch (queueError) {
                    console.error('Queue error:', queueError);
                    response = "Oof, hit a snag building that playlist! Try again? 🎵";
                }
            }
        }

        // Clean any remaining tool call JSON from response
        response = response.replace(/\{[\s]*"tool"[\s]*:.*?\}/gs, '').trim();

        res.json({
            response,
            songPlayed,
            queuedSongs,
            queueLength: queue.getQueue().length
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: 'Failed to process message',
            response: "My circuits are a bit fuzzy right now... try again? 🧋"
        });
    }
});

// Get queue status
router.get('/queue', (req, res) => {
    const status = queue.getStatus();
    res.json({
        currentTrack: status.currentTrack,
        queue: status.queue,
        queueLength: status.queueLength
    });
});

// Skip to next track
router.post('/queue/skip', async (req, res) => {
    const nextTrack = queue.popNextTrack();
    if (nextTrack) {
        const success = await playTrack(nextTrack);
        res.json({ success, nowPlaying: nextTrack });
    } else {
        res.json({ success: false, message: 'Queue is empty' });
    }
});

// Clear the queue
router.post('/queue/clear', (req, res) => {
    queue.clearQueue();
    res.json({ success: true });
});

// Remove a track from queue
router.delete('/queue/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const removed = queue.removeFromQueue(index);
    res.json({ success: !!removed, removed });
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
    const queueStatus = queue.getStatus();

    if (nowPlaying.isPlaying) {
        res.json({
            isPlaying: true,
            name: nowPlaying.title,
            artist: nowPlaying.author,
            albumArt: nowPlaying.thumbnail,
            queueLength: queueStatus.queueLength
        });
    } else {
        res.json({ isPlaying: false, queueLength: queueStatus.queueLength });
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
