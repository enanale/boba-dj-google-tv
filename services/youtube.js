const ytsr = require('ytsr');

/**
 * Search YouTube for videos matching a query
 * @param {string} query - Search query
 * @param {number} limit - Max results (default 5)
 * @returns {Promise<Array>} Array of video results
 */
async function search(query, limit = 5) {
    try {
        const searchResults = await ytsr(query, { limit });

        // Filter to only video items (not playlists, channels, etc.)
        const videos = searchResults.items
            .filter(item => item.type === 'video')
            .slice(0, limit)
            .map(video => ({
                id: video.id,
                title: video.title,
                author: video.author?.name || 'Unknown',
                duration: video.duration,
                thumbnail: video.bestThumbnail?.url || video.thumbnails?.[0]?.url,
                url: video.url,
                views: video.views
            }));

        console.log(`🔍 YouTube: Found ${videos.length} results for "${query}"`);
        return videos;
    } catch (error) {
        console.error('YouTube search error:', error);
        throw error;
    }
}

/**
 * Get a YouTube video URL for casting
 * @param {string} videoId - YouTube video ID
 * @returns {string} Full YouTube URL
 */
function getVideoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}

module.exports = {
    search,
    getVideoUrl
};
