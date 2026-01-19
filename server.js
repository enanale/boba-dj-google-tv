require('dotenv').config();
const express = require('express');
const path = require('path');
const storage = require('node-persist');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize storage
storage.init({ dir: './.node-persist' });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', authRoutes);
app.use('/api', apiRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`🧋 Boba DJ is spinning at http://localhost:${PORT}`);
});
