// ===== DOM Elements =====
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const deviceBtn = document.getElementById('deviceBtn');
const settingsBtn = document.getElementById('settingsBtn');
const nowPlaying = document.getElementById('nowPlaying');
const albumArt = document.getElementById('albumArt');
const trackName = document.getElementById('trackName');
const artistName = document.getElementById('artistName');
const deviceModal = document.getElementById('deviceModal');
const settingsModal = document.getElementById('settingsModal');
const deviceList = document.getElementById('deviceList');
const refreshDevices = document.getElementById('refreshDevices');
const personaInput = document.getElementById('personaInput');
const savePersona = document.getElementById('savePersona');
const resetPersona = document.getElementById('resetPersona');

// ===== State =====
let nowPlayingInterval = null;

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    startNowPlayingPolling();
});

function setupEventListeners() {
    // Chat
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Modals
    deviceBtn.addEventListener('click', () => openModal('deviceModal'));
    settingsBtn.addEventListener('click', () => {
        loadPersona();
        openModal('settingsModal');
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.modal));
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // Devices
    refreshDevices.addEventListener('click', () => loadDevices(true));

    // Persona
    savePersona.addEventListener('click', savePersonaSettings);
    resetPersona.addEventListener('click', resetPersonaSettings);
}

// ===== Chat =====
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message
    addMessage(message, 'user');
    chatInput.value = '';
    sendBtn.disabled = true;

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        const data = await res.json();

        // Remove typing indicator
        removeTypingIndicator(typingId);

        // Add bot response
        addMessage(data.response || data.error, 'bot');

        // Update now playing if song was played
        if (data.songPlayed) {
            updateNowPlaying(data.songPlayed);
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        addMessage("Oops! Something went wrong. Try again? 🧋", 'bot');
    }

    sendBtn.disabled = false;
    chatInput.focus();
}

function addMessage(content, type) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = type === 'bot' ? '🧋' : '👤';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `<p>${escapeHtml(content)}</p>`;

    msg.appendChild(avatar);
    msg.appendChild(contentDiv);
    chatMessages.appendChild(msg);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const msg = document.createElement('div');
    msg.className = 'message bot';
    msg.id = id;

    msg.innerHTML = `
        <div class="message-avatar">🧋</div>
        <div class="message-content typing-indicator">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;

    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Now Playing =====
function startNowPlayingPolling() {
    updateNowPlayingFromApi();
    nowPlayingInterval = setInterval(updateNowPlayingFromApi, 5000);
}

async function updateNowPlayingFromApi() {
    try {
        const res = await fetch('/api/now-playing');
        const data = await res.json();

        if (data.isPlaying && data.name) {
            updateNowPlaying(data);
        } else {
            nowPlaying.classList.add('hidden');
        }
    } catch (err) {
        // Silently fail
    }
}

function updateNowPlaying(track) {
    nowPlaying.classList.remove('hidden');
    albumArt.src = track.albumArt || track.thumbnail || '';
    trackName.textContent = track.name || track.title;
    artistName.textContent = track.artist || track.author || '';
}

// ===== Devices =====
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    if (modalId === 'deviceModal') {
        loadDevices();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

async function loadDevices(refresh = false) {
    deviceList.innerHTML = '<p class="loading">Searching for Chromecast devices...</p>';

    try {
        const endpoint = refresh ? '/api/devices/refresh' : '/api/devices';
        const method = refresh ? 'POST' : 'GET';

        const res = await fetch(endpoint, { method });
        const data = await res.json();

        if (data.devices && data.devices.length > 0) {
            deviceList.innerHTML = data.devices.map(device => `
                <div class="device-item ${device.is_active ? 'active' : ''}" data-id="${device.id}">
                    <span class="device-icon">${getDeviceIcon(device.type)}</span>
                    <div class="device-info">
                        <div class="device-name">${escapeHtml(device.name)}</div>
                        <div class="device-type">${device.type}</div>
                    </div>
                    ${device.is_active ? '<span style="color: var(--success)">● Selected</span>' : ''}
                </div>
            `).join('');

            // Add click handlers
            deviceList.querySelectorAll('.device-item').forEach(item => {
                item.addEventListener('click', () => selectDevice(item.dataset.id, item.querySelector('.device-name').textContent));
            });
        } else {
            deviceList.innerHTML = `
                <p class="loading">No Chromecast devices found.</p>
                <p class="loading" style="font-size: 0.85rem; margin-top: 8px;">
                    Make sure your Google TV is on and connected to the same WiFi network.
                </p>
            `;
        }
    } catch (err) {
        deviceList.innerHTML = '<p class="loading">Failed to search for devices.</p>';
    }
}

function getDeviceIcon(type) {
    const typeLower = (type || '').toLowerCase();
    if (typeLower.includes('tv') || typeLower.includes('chromecast')) return '📺';
    if (typeLower.includes('speaker') || typeLower.includes('audio')) return '🔊';
    if (typeLower.includes('display') || typeLower.includes('hub')) return '🖼️';
    return '📺';
}

async function selectDevice(deviceId, deviceName) {
    try {
        await fetch('/api/devices/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId })
        });
        closeModal('deviceModal');
        addMessage(`Got it! I'll cast to "${deviceName}" 📺`, 'bot');
    } catch (err) {
        alert('Failed to select device');
    }
}

// ===== Persona Settings =====
async function loadPersona() {
    try {
        const res = await fetch('/api/persona');
        const data = await res.json();
        personaInput.value = data.prompt || '';
    } catch (err) {
        console.error('Failed to load persona:', err);
    }
}

async function savePersonaSettings() {
    try {
        await fetch('/api/persona', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: personaInput.value })
        });
        closeModal('settingsModal');
        addMessage("Persona updated! Let's see my new vibe~ 🧋", 'bot');
    } catch (err) {
        alert('Failed to save persona');
    }
}

async function resetPersonaSettings() {
    try {
        const res = await fetch('/api/persona/reset', { method: 'POST' });
        const data = await res.json();
        personaInput.value = data.prompt || '';
        addMessage("Back to my OG self! DJ Boba in the house! 🎵", 'bot');
    } catch (err) {
        alert('Failed to reset persona');
    }
}
