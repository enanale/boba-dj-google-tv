/**
 * Queue service - manages the DJ's playlist queue
 */

// The queue of upcoming songs
let queue = [];

// Currently playing track
let currentTrack = null;

// Callback for when we need to play the next track
let onPlayNext = null;

/**
 * Set the callback for playing the next track
 * @param {Function} callback - Function to call when next track should play
 */
function setPlayNextCallback(callback) {
    onPlayNext = callback;
}

/**
 * Add a track to the queue
 * @param {object} track - Track object with id, title, author, thumbnail
 */
function addToQueue(track) {
    queue.push(track);
    console.log(`📋 Queue: Added "${track.title}" (${queue.length} in queue)`);
}

/**
 * Add multiple tracks to the queue
 * @param {Array} tracks - Array of track objects
 */
function addMultipleToQueue(tracks) {
    tracks.forEach(track => queue.push(track));
    console.log(`📋 Queue: Added ${tracks.length} tracks (${queue.length} total in queue)`);
}

/**
 * Get all tracks in the queue
 * @returns {Array} Queue of tracks
 */
function getQueue() {
    return [...queue];
}

/**
 * Get the current track
 * @returns {object|null} Current track or null
 */
function getCurrentTrack() {
    return currentTrack;
}

/**
 * Set the current track (when playback starts)
 * @param {object} track - Track that's now playing
 */
function setCurrentTrack(track) {
    currentTrack = track;
}

/**
 * Get the next track from the queue
 * @returns {object|null} Next track or null if queue is empty
 */
function getNextTrack() {
    return queue.length > 0 ? queue[0] : null;
}

/**
 * Pop the next track from the queue and set it as current
 * @returns {object|null} Next track or null
 */
function popNextTrack() {
    if (queue.length === 0) {
        currentTrack = null;
        return null;
    }

    currentTrack = queue.shift();
    console.log(`📋 Queue: Now playing "${currentTrack.title}" (${queue.length} remaining)`);
    return currentTrack;
}

/**
 * Clear the entire queue
 */
function clearQueue() {
    queue = [];
    console.log('📋 Queue: Cleared');
}

/**
 * Remove a track from the queue by index
 * @param {number} index - Index to remove
 * @returns {object|null} Removed track or null
 */
function removeFromQueue(index) {
    if (index >= 0 && index < queue.length) {
        const removed = queue.splice(index, 1)[0];
        console.log(`📋 Queue: Removed "${removed.title}"`);
        return removed;
    }
    return null;
}

/**
 * Skip to the next track
 * @returns {object|null} The next track, or null if queue is empty
 */
function skipToNext() {
    const nextTrack = popNextTrack();
    if (nextTrack && onPlayNext) {
        onPlayNext(nextTrack);
    }
    return nextTrack;
}

/**
 * Called when the current track finishes playing
 */
function onTrackFinished() {
    console.log('📋 Queue: Track finished');
    const nextTrack = popNextTrack();
    if (nextTrack && onPlayNext) {
        console.log(`📋 Queue: Auto-playing next: "${nextTrack.title}"`);
        onPlayNext(nextTrack);
    } else {
        console.log('📋 Queue: No more tracks');
        currentTrack = null;
    }
}

/**
 * Get queue status
 * @returns {object} Queue status with current track and upcoming
 */
function getStatus() {
    return {
        currentTrack,
        queue: [...queue],
        queueLength: queue.length,
        hasNext: queue.length > 0
    };
}

module.exports = {
    addToQueue,
    addMultipleToQueue,
    getQueue,
    getCurrentTrack,
    setCurrentTrack,
    getNextTrack,
    popNextTrack,
    clearQueue,
    removeFromQueue,
    skipToNext,
    onTrackFinished,
    getStatus,
    setPlayNextCallback
};
