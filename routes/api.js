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
    const nextTrack = queue.popNextTrack();  // Pop removes it from queue
    if (nextTrack) {
        console.log(`📋 Auto-advancing to: ${nextTrack.title}`);
        await playTrack(nextTrack);
    }
});

/**
 * Play a track (used for both direct play and queue auto-advance)
 */
/**
 * Play a track (used for both direct play and queue auto-advance)
 * @param {Object} track - Track object
 * @param {string} [deviceId] - Optional device ID to force playback on
 */
async function playTrack(track, deviceId = null) {
    // Determine target device: argument -> global var -> service selection -> first discovered
    let targetId = deviceId || selectedDevice;
    let device = null;

    // We treat getDevices as potentially async to be safe, though implementation is sync
    const devices = await chromecast.getDevices();

    if (targetId) {
        device = devices.find(d => d.id === targetId);
    }

    if (!device) {
        device = chromecast.getSelectedDevice();
    }

    // Auto-select first if still nothing
    if (!device && devices.length > 0) {
        device = devices[0];
        console.log(`📺 Auto-selecting device for playback: ${device.name}`);
    }

    if (!device) {
        console.error('No device selected for playback');
        return false;
    }

    // Update global selection
    selectedDevice = device.id;

    try {
        // Set queue status immediately so UI updates (clearing old fact)
        queue.setCurrentTrack(track, null);

        const streamInfo = await youtube.getStreamUrl(track.id);

        // Fetch fun fact in parallel to speed up total time
        const factPromise = llm.getFunFact(track.title, track.author);

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

        const funFact = await factPromise;
        queue.setFunFact(funFact);
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
            const processQueries = async (queries) => {
                const results = [];
                for (const q of queries) {
                    try {
                        const videos = await youtube.search(q);
                        if (videos.length > 0) {
                            results.push({
                                id: videos[0].id,
                                title: videos[0].title,
                                author: videos[0].author,
                                thumbnail: videos[0].thumbnail
                            });
                        }
                    } catch (e) {
                        console.error(`Search error for ${q}:`, e);
                    }
                }
                return results;
            };

            // Determine what tracks to handle
            let tracksToProcess = [];
            if (toolCall.tool === 'play_song') {
                tracksToProcess = await processQueries([toolCall.query + ' official audio']);
                if (tracksToProcess.length === 0) {
                    response = `Hmm, couldn't find anything for "${toolCall.query}". Try again? 🤔`;
                }
            } else if (toolCall.tool === 'queue_songs') {
                const { songs } = toolCall;
                if (songs && songs.length > 0) {
                    tracksToProcess = await processQueries(songs);
                } else {
                    response = "I lost my train of thought and didn't queue anything! 🧋";
                }
            }

            // Process tracks (Play first if idle, queue rest)
            // Ensure we have a device by checking before loop, or let playTrack handle it
            // playTrack now handles auto-selection, so we can check if it succeeds.

            for (const track of tracksToProcess) {
                if (!songPlayed && !chromecast.getIsPlaying()) {
                    const success = await playTrack(track); // playTrack handles device selection
                    if (success) {
                        songPlayed = {
                            name: track.title,
                            artist: track.author,
                            thumbnail: track.thumbnail,
                            videoId: track.id
                        };
                    } else {
                        // If play failed (e.g. no device), ensure user knows
                        if (!selectedDevice && !chromecast.getSelectedDevice()) {
                            response = "Yo, I can't find any Chromecast devices! Make sure your Google TV is on. 📺";
                            break;
                        }
                    }
                } else {
                    queue.addToQueue(track);
                    queuedSongs.push(track);
                }
            }

            if (tracksToProcess.length > 0) {
                console.log(`📋 Processed ${tracksToProcess.length} tracks.`);
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
            funFact: queueStatus.currentFunFact,
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
