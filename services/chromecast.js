const http = require('http');
const dgram = require('dgram');
const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;

// Store discovered devices
let discoveredDevices = [];
let selectedDeviceId = null;
let isPlaying = false;
let currentMedia = null;
let currentClient = null;

// SSDP discovery settings
const SSDP_ADDRESS = '239.255.255.250';
const SSDP_PORT = 1900;
const DIAL_URN = 'urn:dial-multiscreen-org:service:dial:1';

/**
 * Discover DIAL devices (Chromecast, Google TV) on the network
 */
async function discoverDevices(timeout = 5000) {
    return new Promise((resolve) => {
        discoveredDevices = [];
        const seen = new Set();

        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        const searchMessage = [
            'M-SEARCH * HTTP/1.1',
            `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`,
            'MAN: "ssdp:discover"',
            'MX: 3',
            `ST: ${DIAL_URN}`,
            '',
            ''
        ].join('\r\n');

        socket.on('message', async (msg, rinfo) => {
            const response = msg.toString();
            const locationMatch = response.match(/LOCATION:\s*(.+)/i);
            if (!locationMatch) return;

            const location = locationMatch[1].trim();
            if (seen.has(location)) return;
            seen.add(location);

            try {
                const deviceInfo = await fetchDeviceInfo(location);
                if (deviceInfo) {
                    discoveredDevices.push(deviceInfo);
                    console.log(`📺 Found: ${deviceInfo.name} (${deviceInfo.host})`);
                }
            } catch (e) { }
        });

        socket.on('error', (err) => {
            console.error('SSDP error:', err);
        });

        socket.bind(() => {
            socket.addMembership(SSDP_ADDRESS);
            socket.send(searchMessage, 0, searchMessage.length, SSDP_PORT, SSDP_ADDRESS);
        });

        setTimeout(() => {
            try { socket.close(); } catch (e) { }
            resolve(discoveredDevices);
        }, timeout);
    });
}

/**
 * Fetch device info from DIAL device description URL
 */
async function fetchDeviceInfo(location) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 3000);

        try {
            const url = new URL(location);

            const req = http.get(location, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    clearTimeout(timeout);

                    const nameMatch = data.match(/<friendlyName>([^<]+)<\/friendlyName>/);
                    const modelMatch = data.match(/<modelName>([^<]+)<\/modelName>/);

                    if (nameMatch) {
                        resolve({
                            id: url.host,
                            name: nameMatch[1],
                            host: url.hostname,
                            port: 8009,
                            type: modelMatch ? modelMatch[1] : 'Chromecast'
                        });
                    } else {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => {
                clearTimeout(timeout);
                resolve(null);
            });
        } catch (e) {
            clearTimeout(timeout);
            resolve(null);
        }
    });
}

function getDevices() {
    return discoveredDevices.map(d => ({
        id: d.id,
        name: d.name,
        host: d.host,
        type: d.type,
        is_active: selectedDeviceId === d.id
    }));
}

async function refreshDevices() {
    discoveredDevices = [];
    return discoverDevices(5000);
}

/**
 * Cast a video stream to a Chromecast device
 * @param {string} streamUrl - Direct video stream URL
 * @param {string} contentType - MIME type (e.g., 'video/mp4')
 * @param {string} deviceId - Device ID
 * @param {object} metadata - Video metadata
 */
async function castStream(streamUrl, contentType, deviceId, metadata = {}) {
    const device = discoveredDevices.find(d => d.id === deviceId || d.host === deviceId);

    if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
    }

    selectedDeviceId = device.id;

    // Close existing connection
    if (currentClient) {
        try { currentClient.close(); } catch (e) { }
    }

    return new Promise((resolve, reject) => {
        const client = new Client();
        currentClient = client;

        client.on('error', (err) => {
            console.error('Cast client error:', err);
            reject(err);
        });

        console.log(`📺 Connecting to ${device.name} (${device.host})...`);

        client.connect(device.host, () => {
            console.log(`📺 Connected! Launching media player...`);

            client.launch(DefaultMediaReceiver, (err, player) => {
                if (err) {
                    console.error('Failed to launch receiver:', err);
                    client.close();
                    return reject(err);
                }

                const media = {
                    contentId: streamUrl,
                    contentType: contentType,
                    streamType: 'BUFFERED',
                    metadata: {
                        type: 0,
                        metadataType: 0,
                        title: metadata.title || 'Now Playing',
                        subtitle: metadata.author || '',
                        images: metadata.thumbnail ? [{ url: metadata.thumbnail }] : []
                    }
                };

                console.log(`📺 Loading stream...`);

                player.load(media, { autoplay: true }, (err, status) => {
                    if (err) {
                        console.error('Load failed:', err.message);
                        client.close();
                        return reject(err);
                    }

                    console.log(`🎵 Now playing: ${metadata.title || 'Video'}`);
                    isPlaying = true;
                    currentMedia = { ...metadata };
                    resolve(status);
                });

                player.on('status', (status) => {
                    if (status.playerState === 'IDLE' && status.idleReason === 'FINISHED') {
                        isPlaying = false;
                    } else {
                        isPlaying = status.playerState === 'PLAYING' || status.playerState === 'BUFFERING';
                    }
                });
            });
        });
    });
}

function getNowPlaying() {
    if (isPlaying && currentMedia) {
        return {
            isPlaying: true,
            title: currentMedia.title,
            author: currentMedia.author,
            thumbnail: currentMedia.thumbnail
        };
    }
    return { isPlaying: false };
}

async function stop() {
    if (currentClient) {
        try { currentClient.close(); } catch (e) { }
        isPlaying = false;
        currentMedia = null;
    }
}

module.exports = {
    discoverDevices,
    getDevices,
    refreshDevices,
    castStream,
    getNowPlaying,
    stop
};
