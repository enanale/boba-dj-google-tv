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
/**
 * Process song requests (search, play, queue)
 * @param {string[]} queries - List of search terms
 */
async function handleSongRequests(queries) {
    const output = {
        songPlayed: null,
        queuedSongs: [],
        notFound: [],
        error: null
    };

    for (const q of queries) {
        try {
            const videos = await youtube.search(q);
            if (videos.length > 0) {
                const track = {
                    id: videos[0].id,
                    title: videos[0].title,
                    author: videos[0].author,
                    thumbnail: videos[0].thumbnail
                };

                // Play immediately if idle and haven't played yet in this batch
                if (!output.songPlayed && !chromecast.getIsPlaying()) {
                    const success = await playTrack(track);
                    if (success) {
                        output.songPlayed = {
                            name: track.title,
                            artist: track.author,
                            thumbnail: track.thumbnail,
                            videoId: track.id
                        };
                    } else {
                        // If play failed due to no device
                        if (!selectedDevice && !chromecast.getSelectedDevice()) {
                            output.error = "Yo, I can't find any Chromecast devices! Make sure your Google TV is on. 📺";
                            break;
                        }
                        // If play failed but device exists, add to queue as fallback
                        queue.addToQueue(track);
                        output.queuedSongs.push(track);
                    }
                } else {
                    queue.addToQueue(track);
                    output.queuedSongs.push(track);
                }
            } else {
                output.notFound.push(q);
            }
        } catch (e) {
            console.error(`Search error for ${q}:`, e);
            output.notFound.push(q);
        }
    }
    return output;
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
        const toolCall = llm.parseToolCall(response);

        let actionResult = {
            songPlayed: null,
            queuedSongs: [],
            notFound: [],
            error: null
        };

        if (toolCall) {
            let queries = [];
            if (toolCall.tool === 'play_song') {
                queries = [toolCall.query + ' official audio'];
            } else if (toolCall.tool === 'queue_songs') {
                if (toolCall.songs && toolCall.songs.length > 0) {
                    queries = toolCall.songs;
                }
            }

            if (queries.length > 0) {
                actionResult = await handleSongRequests(queries);

                // Handle specific scenarios for response text
                if (actionResult.error) {
                    response = actionResult.error;
                } else if (toolCall.tool === 'play_song' && actionResult.notFound.length > 0) {
                    response = `Hmm, couldn't find anything for "${toolCall.query}". Try again? 🤔`;
                } else if (toolCall.tool === 'queue_songs' && actionResult.queuedSongs.length === 0 && actionResult.songPlayed === null) {
                    response = "I lost my train of thought and didn't queue anything! 🧋";
                }

                if (actionResult.songPlayed || actionResult.queuedSongs.length > 0) {
                    console.log(`📋 Processed requests. Played: ${!!actionResult.songPlayed}, Queued: ${actionResult.queuedSongs.length}`);
                }
            }
        }

        // Clean any remaining tool call JSON from response
        response = response.replace(/\{[\s]*"tool"[\s]*:.*?\}/gs, '').trim();

        res.json({
            response,
            songPlayed: actionResult.songPlayed,
            queuedSongs: actionResult.queuedSongs,
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
