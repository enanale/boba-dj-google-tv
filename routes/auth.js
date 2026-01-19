const express = require('express');
const router = express.Router();
const spotify = require('../services/spotify');

// Login redirect to Spotify
router.get('/login', (req, res) => {
    const authUrl = spotify.getAuthUrl();
    res.redirect(authUrl);
});

// OAuth callback
router.get('/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.redirect('/?error=' + encodeURIComponent(error));
    }

    if (!code) {
        return res.redirect('/?error=no_code');
    }

    try {
        await spotify.exchangeCode(code);
        res.redirect('/?success=true');
    } catch (err) {
        console.error('Auth error:', err);
        res.redirect('/?error=auth_failed');
    }
});

// Check auth status
router.get('/auth/status', (req, res) => {
    const tokens = spotify.getTokens();
    res.json({
        authenticated: !!tokens.access_token,
        expiresAt: tokens.expires_at
    });
});

// Logout
router.post('/logout', (req, res) => {
    spotify.setTokens({ access_token: null, refresh_token: null, expires_in: 0 });
    res.json({ success: true });
});

module.exports = router;
