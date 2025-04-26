const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Import socket manager module
const setupSockets = require('./sockets/socketManager');

// Start Express application
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Specify folder for static files
app.use(express.static(path.join(__dirname, 'public')));

// Main page route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Manage Socket.io connections
setupSockets(io);

// Start server on specified port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Drawvibe server is running on port ${PORT}!`);
}); 