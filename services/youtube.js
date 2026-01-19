const YouTube = require('youtube-sr').default;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Search YouTube for videos matching a query
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 5)
 * @returns {Promise<Array>} Array of video results
 */
async function search(query, limit = 5) {
    try {
        const videos = await YouTube.search(query, { type: 'video', limit });

        const results = videos.map(video => ({
            id: video.id,
            title: video.title,
            author: video.channel?.name || 'Unknown',
            duration: video.durationFormatted,
            thumbnail: video.thumbnail?.url,
            url: video.url,
            views: video.views
        }));

        console.log(`🔍 YouTube: Found ${results.length} results for "${query}"`);
        return results;
    } catch (error) {
        console.error('YouTube search error:', error);
        throw error;
    }
}

/**
 * Get the direct stream URL for a YouTube video using yt-dlp
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<object>} Object with stream URL and format info
 */
async function getStreamUrl(videoId) {
    // Security: Validate videoId to prevent command injection
    // YouTube video IDs are 11 characters, alphanumeric with - and _
    if (!videoId || !/^[a-zA-Z0-9_-]{10,12}$/.test(videoId)) {
        throw new Error(`Invalid video ID: ${videoId}`);
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        // Get the best audio/video stream URL
        // Using format that Chromecast can play (mp4/m4a)
        const { stdout } = await execAsync(
            `yt-dlp -f "best[ext=mp4]/best" --get-url --no-playlist "${youtubeUrl}"`,
            { timeout: 15000 }
        );

        const streamUrl = stdout.trim();
        console.log(`🎬 Got stream URL for ${videoId}`);

        return {
            streamUrl,
            contentType: 'video/mp4'
        };
    } catch (error) {
        console.error('yt-dlp error:', error.message);

        // Fallback: try audio-only format
        try {
            const { stdout } = await execAsync(
                `yt-dlp -f "bestaudio[ext=m4a]/bestaudio" --get-url --no-playlist "${youtubeUrl}"`,
                { timeout: 15000 }
            );

            const streamUrl = stdout.trim();
            console.log(`🎵 Got audio stream URL for ${videoId}`);

            return {
                streamUrl,
                contentType: 'audio/mp4'
            };
        } catch (audioError) {
            console.error('Audio fallback also failed:', audioError.message);
            throw new Error('Failed to get stream URL');
        }
    }
}

/**
 * Get a YouTube video URL (for reference)
 * @param {string} videoId - YouTube video ID
 * @returns {string} Full YouTube URL
 */
function getVideoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

module.exports = {
    search,
    getStreamUrl,
    getVideoUrl
};
