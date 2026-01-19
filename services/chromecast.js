const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const mdns = require('mdns-js');

// Store discovered devices
let discoveredDevices = [];
let currentPlayer = null;
let currentClient = null;
let isPlaying = false;
let currentMedia = null;

/**
 * Discover Chromecast devices on the network
 * @param {number} timeout - Discovery timeout in ms (default 5000)
 * @returns {Promise<Array>} Array of discovered devices
 */
async function discoverDevices(timeout = 5000) {
    return new Promise((resolve) => {
        discoveredDevices = [];

        try {
            const browser = mdns.createBrowser(mdns.tcp('googlecast'));

            browser.on('ready', () => {
                browser.discover();
            });

            browser.on('update', (service) => {
                if (service.addresses && service.addresses.length > 0) {
                    const device = {
                        id: service.fullname || service.host,
                        name: service.txt?.find(t => t.startsWith('fn='))?.replace('fn=', '') || service.host || 'Unknown Device',
                        host: service.addresses[0],
                        port: service.port || 8009,
                        type: service.txt?.find(t => t.startsWith('md='))?.replace('md=', '') || 'Chromecast'
                    };

                    // Avoid duplicates
                    if (!discoveredDevices.find(d => d.host === device.host)) {
                        discoveredDevices.push(device);
                        console.log(`📺 Found: ${device.name} (${device.host})`);
                    }
                }
            });

            setTimeout(() => {
                browser.stop();
                resolve(discoveredDevices);
            }, timeout);
        } catch (error) {
            console.error('mDNS discovery error:', error);
            resolve(discoveredDevices);
        }
    });
}

/**
 * Get cached devices or discover new ones
 * @returns {Promise<Array>} Array of devices
 */
async function getDevices() {
    if (discoveredDevices.length === 0) {
        await discoverDevices();
    }
    return discoveredDevices;
}

/**
 * Refresh the device list
 * @returns {Promise<Array>} Array of devices
 */
async function refreshDevices() {
    discoveredDevices = [];
    return discoverDevices();
}

/**
 * Cast a YouTube video to a Chromecast device
 * @param {string} videoId - YouTube video ID
 * @param {string} deviceHost - Device IP address
 * @param {object} metadata - Video metadata (title, author, thumbnail)
 * @returns {Promise<void>}
 */
async function castYouTube(videoId, deviceHost, metadata = {}) {
    return new Promise((resolve, reject) => {
        // Close existing connection if any
        if (currentClient) {
            try {
                currentClient.close();
            } catch (e) {
                // Ignore close errors
            }
        }

        const client = new Client();
        currentClient = client;

        client.on('error', (err) => {
            console.error('Chromecast client error:', err);
            client.close();
            reject(err);
        });

        console.log(`📺 Connecting to ${deviceHost}...`);

        client.connect(deviceHost, () => {
            console.log(`📺 Connected! Launching YouTube...`);

            // Use the YouTube receiver app
            client.launch(DefaultMediaReceiver, (err, player) => {
                if (err) {
                    console.error('Failed to launch:', err);
                    client.close();
                    return reject(err);
                }

                currentPlayer = player;

                const media = {
                    contentId: videoId,
                    contentType: 'video/youtube',
                    streamType: 'BUFFERED',
                    metadata: {
                        type: 0,
                        metadataType: 0,
                        title: metadata.title || 'YouTube Video',
                        subtitle: metadata.author || '',
                        images: metadata.thumbnail ? [{ url: metadata.thumbnail }] : []
                    }
                };

                // For YouTube, we need to use the YouTube app URL format
                const youtubeMedia = {
                    contentId: `https://www.youtube.com/watch?v=${videoId}`,
                    contentType: 'video/mp4',
                    streamType: 'BUFFERED',
                    metadata: media.metadata
                };

                player.load(youtubeMedia, { autoplay: true }, (err, status) => {
                    if (err) {
                        console.error('Failed to load media:', err);
                        client.close();
                        return reject(err);
                    }

                    console.log(`🎵 Now playing: ${metadata.title || videoId}`);
                    isPlaying = true;
                    currentMedia = {
                        ...metadata,
                        videoId
                    };
                    resolve(status);
                });

                player.on('status', (status) => {
                    isPlaying = status.playerState === 'PLAYING' || status.playerState === 'BUFFERING';
                });
            });
        });
    });
}

/**
 * Get currently playing info
 * @returns {object|null} Current media info or null
 */
function getNowPlaying() {
    if (isPlaying && currentMedia) {
        return {
            isPlaying: true,
            title: currentMedia.title,
            author: currentMedia.author,
            thumbnail: currentMedia.thumbnail,
            videoId: currentMedia.videoId
        };
    }
    return { isPlaying: false };
}

/**
 * Stop playback
 */
function stop() {
    if (currentPlayer) {
        currentPlayer.stop();
        isPlaying = false;
        currentMedia = null;
    }
}

module.exports = {
    discoverDevices,
    getDevices,
    refreshDevices,
    castYouTube,
    getNowPlaying,
    stop
};
