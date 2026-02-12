const WebSocket = require('ws');
const { tokens } = require('./routes/login');
const fs = require('fs');
const path = require('path');

// Map of userId -> socket connection
const clients = new Map();

// Load users from users.json
const usersFile = path.join(__dirname, './users.json');
let usersList = [];
let usersObj = {};
let chatViews = {}; // userId -> contactId they are viewing

function loadUsersList() {
    try {
        const data = fs.readFileSync(usersFile, 'utf-8');
        usersObj = JSON.parse(data);
        usersList = Object.values(usersObj).map(u => ({ id: u.id, name: Object.keys(usersObj).find(k => usersObj[k].id === u.id), picture: u.picture }));
    } catch (e) {
        usersList = [];
        usersObj = {};
    }
}
loadUsersList();
fs.watchFile(usersFile, loadUsersList);

// Load contacts from contacts.json
const contactsFile = path.join(__dirname, './contacts.json');
let contactsList = [];
function loadContactsList() {
    try {
        const data = fs.readFileSync(contactsFile, 'utf-8');
        contactsList = JSON.parse(data);
    } catch (e) {
        console.log('Error loading contacts.json:', e);
        contactsList = [];
    }
}
loadContactsList();
fs.watchFile(contactsFile, loadContactsList);

const chatsFile = path.join(__dirname, './chats.json');
let chats = {};
function loadChats() {
    try {
        const data = fs.readFileSync(chatsFile, 'utf-8');
        chats = JSON.parse(data);
    } catch (e) {
        chats = {};
    }
}
function saveChats() {
    fs.writeFileSync(chatsFile, JSON.stringify(chats, null, 2));
}
loadChats();

// Pending messages
const pendingFile = path.join(__dirname, './pending.json');
let pending = {};
function loadPending() {
    try {
        const data = fs.readFileSync(pendingFile, 'utf-8');
        pending = JSON.parse(data);
    } catch (e) {
        pending = {};
    }
}
function savePending() {
    fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
}
loadPending();
function getChatArray(userId, contactId) {
    if (!chats[userId]) chats[userId] = {};
    if (!chats[userId][contactId]) chats[userId][contactId] = [];
    return chats[userId][contactId];
}

function isContact(userId, contactId) {
    //console.log('[IS CONTACT CHECK]', { userId, contactId, contactsList });
    // Only allow chat if there is a relationship in contacts.json
    return contactsList.some(rel => rel.userId === Number(userId) && rel.contactId === Number(contactId));
}

function is_in_the_chat_view(userId, contactId) {
    console.log("WS: Checking if user", userId, "is viewing contact", contactId);
    console.log(chatViews);
    userId = Number(userId);
    contactId = Number(contactId);
    return chatViews[userId] && chatViews[userId] === contactId;
}

function clearChatView(userId) {
    console.log("WS: Clearing chat view for user", userId);
    delete chatViews[userId];
}

function markChatView(userId, contactId) {
    userId = Number(userId);
    contactId = Number(contactId);
    chatViews[userId] = contactId;
    console.log("WS: Setting chat view for user", userId, "to contact", contactId);
}

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws, req) => {
        let user = null;
        let heartbeatInterval = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                clearInterval(heartbeatInterval);
            } else {
                ws.ping && ws.ping();
            }
        }, 30000); // 30s ping to detect dead connections

        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg);
                console.log('[WS MESSAGE]', data);
                // Authenticate user
                if (data.type === 'auth' && data.token && tokens.has(data.token)) {
                    user = tokens.get(data.token); // { username, id }
                    clients.set(user.id, ws);
                    console.log(`[WS AUTH] User ${user.username} (ID: ${user.id}) authenticated.`);
                    ws.send(JSON.stringify({ type: 'auth', success: true, userId: user.id, username: user.username }));
                    // Deliver any pending messages (do NOT clear them here)
                    if (pending[user.id]) {
                        Object.keys(pending[user.id]).forEach(fromId => {
                            const msgs = pending[user.id][fromId];
                            if (Array.isArray(msgs)) {
                                msgs.forEach(m => {
                                    // Insert into chats.json for both sender and receiver
                                    getChatArray(user.id, fromId).push({
                                        id: Date.now(),
                                        text: m.text,
                                        from: m.from,
                                        timestamp: m.timestamp,
                                        ip: ''
                                    });
                                    getChatArray(fromId, user.id).push({
                                        id: Date.now(),
                                        text: m.text,
                                        from: m.from,
                                        timestamp: m.timestamp,
                                        ip: ''
                                    });
                                    ws.send(JSON.stringify({ type: 'chat', from: m.from, text: m.text, timestamp: m.timestamp }));
                                });
                            }
                        });
                        saveChats();
                        // Do NOT clear pending here
                        savePending();
                    }
                } else if (data.type === 'chat' && user) {
                    const to = Number(data.to);
                    const from = Number(user.id);
                    if (!isContact(from, to)) {
                        console.log('[WS CHAT] Not a valid contact:', to);
                        ws.send(JSON.stringify({ type: 'error', message: 'Not a valid contact.' }));
                        return;
                    }
                    const toUser = usersList.find(c => c.id === to);
                    if (!toUser) {
                        console.log('[WS CHAT] Contact not found:', to);
                        ws.send(JSON.stringify({ type: 'error', message: 'Contact not found.' }));
                        return;
                    }
                    // Save message to chats.json for both sender and receiver
                    const now = new Date();
                    const message = {
                        id: Date.now(),
                        text: data.text,
                        from,
                        timestamp: now.toISOString(),
                        ip: req.socket?.remoteAddress || ''
                    };
                    // Store for sender
                    getChatArray(from, to).push(message);
                    // Store for receiver
                    getChatArray(to, from).push(message);
                    saveChats();
                    // Forward message to contact if online, else store in pending
                    const contactWs = clients.get(to);
                    if (contactWs && contactWs.readyState === WebSocket.OPEN && is_in_the_chat_view(to, from)) {
                        console.log('[WS CHAT] Delivering message to contact', to);
                        contactWs.send(JSON.stringify({ type: 'chat', from, text: data.text, timestamp: message.timestamp }));
                    }
                    else if (contactWs && contactWs.readyState === WebSocket.OPEN && !is_in_the_chat_view(to, from)) {
                        console.log('[WS CHAT] Contact online but not seeing chat, storing pending message for', to);
                        // Store in pending
                        if (!pending[to]) pending[to] = {};
                        if (!pending[to][from]) pending[to][from] = [];
                        pending[to][from].push({ from, text: data.text, timestamp: message.timestamp });
                        savePending();
                        contactWs.send(JSON.stringify({ type: 'new_messages', timestamp: message.timestamp }));
                    }
                    else {

                        console.log('[WS CHAT] Contact offline, storing pending message for', to);
                        // Store in pending
                        if (!pending[to]) pending[to] = {};
                        if (!pending[to][from]) pending[to][from] = [];
                        pending[to][from].push({ from, text: data.text, timestamp: message.timestamp });
                        savePending();
                    }
                    // Also emit to sender for instant feedback
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'chat', from, text: data.text, timestamp: message.timestamp }));
                    }
                } else if (data.type === 'is_connected' && typeof data.userId !== 'undefined') {
                    // New message type: check if a user is connected
                    const checkId = Number(data.userId);
                    const isOnline = clients.has(checkId) && clients.get(checkId)?.readyState === WebSocket.OPEN;
                    ws.send(JSON.stringify({ type: 'is_connected', userId: checkId, connected: isOnline }));
                }
            } catch (e) { console.log('[WS ERROR]', e); }
        });

        ws.on('close', (code, reason) => {
            console.log('[WS CLOSE] Connection closed.');
            if (user) {
                clients.delete(user.id);
                console.log(`[WS CLOSE] User ${user.username} (ID: ${user.id}) disconnected. Code: ${code}, Reason: ${reason}`);
                // Optionally notify contacts or perform cleanup here
            }
            clearInterval(heartbeatInterval);
        });

        ws.on('error', (err) => {
            console.log('[WS ERROR]', err);
            if (user) clients.delete(user.id);
            clearInterval(heartbeatInterval);
        });
    });
}

function notifyUser(userId, payload) {
    const ws = clients.get(Number(userId));
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

module.exports = { setupWebSocket, notifyUser, markChatView, is_in_the_chat_view, clearChatView, chatViews };
