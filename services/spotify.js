const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const DEMO_MODE = process.env.DEMO_MODE === 'true';

const SCOPES = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming'
].join(' ');

// ===== DEMO MODE MOCK DATA =====
const MOCK_TRACKS = [
    {
        name: "Get Lucky",
        artist: "Daft Punk",
        album: "Random Access Memories",
        uri: "spotify:track:demo1",
        albumArt: "https://i.scdn.co/image/ab67616d0000b273b33d46dfa2f8e36a16e0e7d8"
    },
    {
        name: "Blinding Lights",
        artist: "The Weeknd",
        album: "After Hours",
        uri: "spotify:track:demo2",
        albumArt: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36"
    },
    {
        name: "Levitating",
        artist: "Dua Lipa",
        album: "Future Nostalgia",
        uri: "spotify:track:demo3",
        albumArt: "https://i.scdn.co/image/ab67616d0000b273bd26ede1ae69327010d49946"
    },
    {
        name: "Lofi Hip Hop Beats",
        artist: "Chillhop Music",
        album: "Lofi Study",
        uri: "spotify:track:demo4",
        albumArt: "https://i.scdn.co/image/ab67616d0000b273c414e7daf34690c9f983f76e"
    },
    {
        name: "Uptown Funk",
        artist: "Bruno Mars",
        album: "Uptown Special",
        uri: "spotify:track:demo5",
        albumArt: "https://i.scdn.co/image/ab67616d0000b2737b1b6f41c1645af9757d5616"
    }
];

const MOCK_DEVICES = [
    { id: "demo-tv", name: "Living Room TV", type: "TV", is_active: false },
    { id: "demo-speaker", name: "Kitchen Speaker", type: "Speaker", is_active: false },
    { id: "demo-computer", name: "My Computer", type: "Computer", is_active: true }
];

let mockCurrentTrack = null;
let mockActiveDevice = MOCK_DEVICES[2]; // Computer is active by default

// ===== TOKEN STORAGE =====
let tokens = {
    access_token: DEMO_MODE ? 'demo_token' : null,
    refresh_token: DEMO_MODE ? 'demo_refresh' : null,
    expires_at: DEMO_MODE ? Date.now() + 3600000 : null
};

function setTokens(newTokens) {
    tokens = {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || tokens.refresh_token,
        expires_at: Date.now() + (newTokens.expires_in * 1000)
    };
}

function getTokens() {
    return tokens;
}

function isDemo() {
    return DEMO_MODE;
}

// ===== AUTH FUNCTIONS =====
function getAuthUrl() {
    if (DEMO_MODE) {
        return '/callback?code=demo';
    }
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI
    });
    return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code) {
    if (DEMO_MODE || code === 'demo') {
        console.log('🎭 Demo mode: Simulating Spotify auth');
        tokens = {
            access_token: 'demo_token',
            refresh_token: 'demo_refresh',
            expires_at: Date.now() + 3600000
        };
        return tokens;
    }

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        },
        body: body.toString()
    });

    if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
    }

    const data = await response.json();
    setTokens(data);
    return tokens;
}

async function refreshAccessToken() {
    if (DEMO_MODE) {
        tokens.expires_at = Date.now() + 3600000;
        return tokens;
    }

    if (!tokens.refresh_token) {
        throw new Error('No refresh token available');
    }

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        },
        body: body.toString()
    });

    if (!response.ok) {
        throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    setTokens(data);
    return tokens;
}

async function getValidToken() {
    if (DEMO_MODE) {
        return 'demo_token';
    }

    if (!tokens.access_token) {
        throw new Error('Not authenticated');
    }

    if (tokens.expires_at && Date.now() > tokens.expires_at - 60000) {
        await refreshAccessToken();
    }

    return tokens.access_token;
}

async function apiRequest(endpoint, options = {}) {
    const token = await getValidToken();

    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (response.status === 204) {
        return null;
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Spotify API error: ${response.status}`);
    }

    return response.json();
}

// ===== PUBLIC API METHODS =====
async function getDevices() {
    if (DEMO_MODE) {
        console.log('🎭 Demo mode: Returning mock devices');
        return MOCK_DEVICES;
    }
    const data = await apiRequest('/me/player/devices');
    return data.devices || [];
}

async function search(query, type = 'track') {
    if (DEMO_MODE) {
        console.log(`🎭 Demo mode: Searching for "${query}"`);
        // Fuzzy match against mock tracks
        const q = query.toLowerCase();
        let matches = MOCK_TRACKS.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q)
        );

        // If no matches, return a random track
        if (matches.length === 0) {
            matches = [MOCK_TRACKS[Math.floor(Math.random() * MOCK_TRACKS.length)]];
        }

        return {
            tracks: {
                items: matches.map(t => ({
                    uri: t.uri,
                    name: t.name,
                    artists: [{ name: t.artist }],
                    album: {
                        name: t.album,
                        images: [{ url: t.albumArt }]
                    }
                }))
            }
        };
    }

    const params = new URLSearchParams({ q: query, type, limit: 5 });
    return apiRequest(`/search?${params.toString()}`);
}

async function play(uri, deviceId) {
    if (DEMO_MODE) {
        console.log(`🎭 Demo mode: Playing ${uri} on device ${deviceId}`);
        // Find the track and set as current
        const track = MOCK_TRACKS.find(t => t.uri === uri);
        if (track) {
            mockCurrentTrack = track;
        }
        // Update active device
        if (deviceId) {
            MOCK_DEVICES.forEach(d => d.is_active = d.id === deviceId);
            mockActiveDevice = MOCK_DEVICES.find(d => d.id === deviceId);
        }
        return;
    }

    const body = uri ? { uris: [uri] } : {};
    const params = deviceId ? `?device_id=${deviceId}` : '';

    await apiRequest(`/me/player/play${params}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

async function getCurrentlyPlaying() {
    if (DEMO_MODE) {
        if (mockCurrentTrack) {
            return {
                is_playing: true,
                item: {
                    name: mockCurrentTrack.name,
                    artists: [{ name: mockCurrentTrack.artist }],
                    album: {
                        name: mockCurrentTrack.album,
                        images: [{ url: mockCurrentTrack.albumArt }]
                    },
                    duration_ms: 210000
                },
                progress_ms: Math.floor(Math.random() * 100000)
            };
        }
        return null;
    }
    return apiRequest('/me/player/currently-playing');
}

module.exports = {
    getAuthUrl,
    exchangeCode,
    getTokens,
    setTokens,
    getDevices,
    search,
    play,
    getCurrentlyPlaying,
    isDemo
};
