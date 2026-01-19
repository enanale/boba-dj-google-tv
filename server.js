require('dotenv').config();
const express = require('express');
const path = require('path');

const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', apiRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`🧋 Boba DJ is spinning at http://localhost:${PORT}`);
    console.log(`📺 Searching for Chromecast devices...`);

    // Pre-discover devices on startup
    const chromecast = require('./services/chromecast');
    chromecast.discoverDevices().then(devices => {
        if (devices.length > 0) {
            console.log(`📺 Found ${devices.length} device(s): ${devices.map(d => d.name).join(', ')}`);
        } else {
            console.log(`📺 No devices found yet. They'll be discovered when you open the device picker.`);
        }
    });
});
