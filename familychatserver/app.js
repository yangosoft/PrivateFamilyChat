


const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const http = require('http');
const path = require('path');
const app = express();
const port = 3000;


// Custom morgan format: timestamp, file, method, url, status, response time
const fs = require('fs');
morgan.token('date', () => new Date().toISOString());
morgan.token('file', (req) => {
  // Try to extract the route file from the stack if possible
  if (req.route && req.route.path) return req.route.path;
  return req.originalUrl;
});
const logStream = fs.createWriteStream(path.join(__dirname, 'logs/server.log'), { flags: 'a' });
app.use(morgan(':date :file :method :url :status :response-time ms', { stream: logStream }));
app.use(cors());
app.use(express.json());

// Serve ./dist folder at root for static assets (including profile_pictures)
app.use(express.static(path.join(__dirname, './dist')));
app.use(express.static(path.join(__dirname, './public')));

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const routes = require('./routes');
app.use(routes);

const server = http.createServer(app);
const { setupWebSocket } = require('./ws');
setupWebSocket(server);

server.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
