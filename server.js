const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Socket yöneticisi modülünü import et
const setupSockets = require('./sockets/socketManager');

// Express uygulamasını başlat
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Statik dosyalar için klasör belirt
app.use(express.static(path.join(__dirname, 'public')));

// Ana sayfa route'u
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Socket.io bağlantılarını yönet
setupSockets(io);

// Sunucuyu belirtilen portta başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Drawvibe sunucusu ${PORT} numaralı portta çalışıyor!`);
}); 