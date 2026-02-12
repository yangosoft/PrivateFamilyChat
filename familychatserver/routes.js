
const { loginRouter, tokens } = require('./routes/login');
const { contactsRouter, requireToken } = require('./routes/contacts');
const { chatsRouter } = require('./routes/chats');

// Mount login route (no token required)
const express = require('express');
const router = express.Router();
router.use('/login', loginRouter);

// Token middleware for contacts and chats
router.use('/contacts', requireToken(tokens), contactsRouter);
router.use('/chats', requireToken(tokens), (req, res, next) => {
    // propagate username to chat routes
    req.username = req.username;
    next();
}, chatsRouter);

module.exports = router;
