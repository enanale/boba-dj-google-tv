const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

const SCOPES = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming'
].join(' ');

// Token storage (in-memory, persisted via node-persist in routes)
let tokens = {
    access_token: null,
    refresh_token: null,
    expires_at: null
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

function getAuthUrl() {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI
    });
    return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code) {
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
    if (!tokens.access_token) {
        throw new Error('Not authenticated');
    }

    // Refresh if expired (with 60s buffer)
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
        return null; // No content
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Spotify API error: ${response.status}`);
    }

    return response.json();
}

// Public API methods
async function getDevices() {
    const data = await apiRequest('/me/player/devices');
    return data.devices || [];
}

async function search(query, type = 'track') {
    const params = new URLSearchParams({ q: query, type, limit: 5 });
    return apiRequest(`/search?${params.toString()}`);
}

async function play(uri, deviceId) {
    const body = uri ? { uris: [uri] } : {};
    const params = deviceId ? `?device_id=${deviceId}` : '';

    await apiRequest(`/me/player/play${params}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}

async function getCurrentlyPlaying() {
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
    getCurrentlyPlaying
};
