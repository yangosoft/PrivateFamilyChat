const path = require('path');
const fs = require('fs');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { tokens } = require('./login');


function authMiddleware(req, res, next) {
    const token = req.headers['authorization'];
    if (token && tokens.has(token)) {
        req.user = tokens.get(token);
        return next();
    }
    res.status(401).json({ success: false, message: 'Unauthorized' });
}


const profilePicsDir = path.join(__dirname, '../public/profile_pics');
if (!fs.existsSync(profilePicsDir)) fs.mkdirSync(profilePicsDir, { recursive: true });



const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, profilePicsDir);
    },
    filename: function (req, file, cb) {
        // Use username for filename
        const ext = path.extname(file.originalname);
        // req.user is set by authMiddleware
        cb(null, req.user.username + ext);
    }
});
const upload = multer({ storage });

const usersFile = path.join(__dirname, '../users.json');
const contactsFile = path.join(__dirname, '../contacts.json');

// Upload/change profile picture (with authMiddleware)
router.post('/picture', authMiddleware, upload.single('picture'), (req, res) => {
    console.log('Upload picture debug:', {
        user: req.user,
        file: req.file,
        headers: req.headers
    });
    if (!req.user || !req.user.username) return res.status(401).json({ success: false, message: 'Unauthorized' });
    // Update users.json with new picture URL
    let usersObj = {};
    try {
        usersObj = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Failed to read users file' });
    }
    const user = usersObj[req.user.username];
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.picture = `/profile_pics/${req.user.username}${path.extname(req.file.originalname)}`;
    usersObj[req.user.username] = user;
    fs.writeFileSync(usersFile, JSON.stringify(usersObj, null, 2));
    res.json({ success: true, picture: user.picture });
});


function requireToken(tokens) {
    return function (req, res, next) {
        const auth = req.headers['authorization'];
        if (!auth || !tokens.has(auth)) {
            return res.status(401).json({ success: false, message: 'Unauthorized: missing or invalid token' });
        }
        req.username = tokens.get(auth);
        next();
    };
}



router.get('/', (req, res) => {
    // Get userId from token (set by requireToken)
    let userId = null;
    if (req.username && typeof req.username === 'object' && req.username.id) {
        userId = req.username.id;
    } else if (req.user && req.user.id) {
        userId = req.user.id;
    }
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    // Load users and contacts
    let usersObj = {};
    let contactsList = [];
    try {
        usersObj = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
        contactsList = JSON.parse(fs.readFileSync(contactsFile, 'utf-8'));
    } catch (e) {
        return res.json({ success: true, contacts: [] });
    }
    // Find contacts for this user
    const myContacts = contactsList.filter(rel => rel.userId === userId).map(rel => {
        const user = Object.values(usersObj).find(u => u.id === rel.contactId);
        return user ? { id: user.id, name: Object.keys(usersObj).find(k => usersObj[k].id === user.id), picture: user.picture } : null;
    }).filter(Boolean);
    res.json({ success: true, contacts: myContacts });
});

module.exports = { contactsRouter: router, requireToken };
