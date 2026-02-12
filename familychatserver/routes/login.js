const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Allowed users and their unique tokens and ids
let allowedUsers = {};
const usersFile = path.join(__dirname, '../users.json');
function loadUsers() {
    try {
        const data = fs.readFileSync(usersFile, 'utf-8');
        allowedUsers = JSON.parse(data);
    } catch (e) {
        allowedUsers = {};
    }
}
loadUsers();

// Map token to user object for validation
function buildTokensMap() {
    return new Map(
        Object.values(allowedUsers).map(u => [u.token, { username: Object.keys(allowedUsers).find(k => allowedUsers[k] === u), id: u.id }])
    );
}
let tokens = buildTokensMap();

// Reload users and tokens if file changes
fs.watchFile(usersFile, () => {
    loadUsers();
    tokens = buildTokensMap();
});

router.post('/', (req, res) => {
    const { username, password } = req.body;
    console.log('Received login request:', { username, password });
    if (
        typeof username === 'string' &&
        typeof password === 'string' &&
        allowedUsers[username] &&
        allowedUsers[username].password === password
    ) {
        const user = allowedUsers[username];
        const token = user.token;
        // Return all fields needed for Settings.vue (id, username, token, name, picture)
        const response = {
            success: true,
            message: 'Login successful',
            username,
            token,
            id: user.id,
            name: user.name || username,
            picture: user.picture || null
        };
        console.log('Login successful for', username, 'token:', token);
        res.json(response);
    } else {
        console.log('Login failed for', username);
        res.status(400).json({ success: false, message: 'Invalid username or password' });
    }
});

module.exports = { loginRouter: router, tokens };
