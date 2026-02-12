const express = require('express');
const router = express.Router();
const wsmng = require('../ws');
const { notifyUser } = require('../ws');
const { tokens } = require('./login');
// Middleware to authenticate and set req.user
function authMiddleware(req, res, next) {
    const token = req.headers['authorization'];
    if (token && tokens.has(token)) {
        req.user = tokens.get(token);
        return next();
    }
    res.status(401).json({ success: false, message: 'Unauthorized' });
}
const fs = require('fs');
const path = require('path');

// File to persist chats
const chatsFile = path.join(__dirname, '../chats.json');
let chats = {};

// File to persist pending messages
const pendingFile = path.join(__dirname, '../pending.json');
let pending = {};

// Load chats from file
function loadChats() {
    try {
        const data = fs.readFileSync(chatsFile, 'utf-8');
        chats = JSON.parse(data);
    } catch (e) {
        console.error('Error loading chats:', e);
        chats = {};
    }
}

// Save chats to file
function saveChats() {
    fs.writeFileSync(chatsFile, JSON.stringify(chats, null, 2));
}

// Load pending messages from file
function loadPending() {
    try {
        const data = fs.readFileSync(pendingFile, 'utf-8');
        pending = JSON.parse(data);
    } catch (e) {
        console.error('Error loading pending messages:', e);
        pending = {};
    }
}

// Save pending messages to file
function savePending() {
    fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
}

loadChats();
loadPending();

// In-memory pending messages: { userId -> { contactId -> count } }

function getChatArray(userId, contactId) {
    if (!chats[userId]) chats[userId] = {};
    if (!chats[userId][contactId]) chats[userId][contactId] = [];
    return chats[userId][contactId];
}

function setChatView(userId, contactId) {
    console.log("Setting chat view for user", userId, "to contact", contactId);

    wsmng.markChatView(userId, contactId);
    console.log(wsmng.chatViews);
}

// Endpoint to get chat messages with a specific contact
// only called when chat is being displayed to the user
router.get('/:contactId', authMiddleware, (req, res) => {
    const user = req.user || {};
    const userId = user.id;
    const contactId = req.params.contactId;
    console.log('[GET /chats/:contactId]', { userId, contactId });
    loadChats();
    const chat = getChatArray(userId, contactId);
    console.log('[CHAT DATA]', chat);
    console.log("Clearing pending chats!");
    // Clear pending messages for this contact
    loadPending();
    if (pending[userId] && pending[userId][contactId]) {
        delete pending[userId][contactId];
        savePending();
        console.log('[PENDING CLEARED]', { userId, contactId });
    }

    // Store that user is viewing this chat to allow sending notifications
    setChatView(userId, contactId);

    res.json({ success: true, messages: chat });
});


// Endpoint to get pending messages for the logged-in user
router.get('/pending/counts', authMiddleware, (req, res) => {
    if (req === undefined) {
        console.log("req is undefined");
    }
    loadPending();

    const user = req.user || {};
    const userId = user.id;
    console.log('[GET /chats/pending/counts]', { userId });
    let counts = 0;
    let by_contact = {}; // map that contains a pair contactId: counts
    if (pending[userId]) {
        // pending[userId] is an object: { contactId: [ {msg}, ... ] }
        Object.keys(pending[userId]).forEach(contactId => {
            console.log("Processing pending for contactId:", contactId);
            const contactPending = pending[userId][contactId];
            const contactCount = contactPending.length;
            by_contact[contactId] = contactCount;
            counts += contactCount;
        });
    }

    let response = { success: true, pending: counts, by_contact: by_contact };
    console.log('Response ', JSON.stringify(response));
    res.json(response);
});

module.exports = { chatsRouter: router };
