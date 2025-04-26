/**
 * Socket.io bağlantılarını ve çizim olaylarını yöneten modül
 */

const { generateRoomId, generateUserColor } = require('../utils/helpers');

// Kullanıcı odaları
const rooms = new Map();

// Socket bağlantı yöneticisi
function setupSocketManager(io) {
  io.on('connection', (socket) => {
    console.log(`Kullanıcı bağlandı: ${socket.id}`);
    let currentUser = null;
    let currentRoom = null;
    
    // Odaya katılma
    socket.on('joinRoom', ({ username, roomId }) => {
      // Kullanıcı adını kontrol et
      if (!username || username.trim() === '') {
        username = 'Misafir' + Math.floor(Math.random() * 1000);
      }
      
      // Oda ID'si yoksa rastgele oluştur
      const finalRoomId = roomId || generateRoomId();
      
      // Eski odadan çık (eğer varsa)
      if (currentRoom) {
        socket.leave(currentRoom);
        removeUserFromRoom(socket.id, currentRoom);
      }
      
      // Yeni oda oluştur (yoksa)
      if (!rooms.has(finalRoomId)) {
        rooms.set(finalRoomId, {
          users: [],
          canvasState: null
        });
      }
      
      // Kullanıcı bilgisini oluştur
      currentUser = {
        id: socket.id,
        username,
        color: generateUserColor()
      };
      
      // Kullanıcıyı odaya ekle
      currentRoom = finalRoomId;
      socket.join(currentRoom);
      
      // Odanın kullanıcı listesine ekle
      const roomData = rooms.get(currentRoom);
      roomData.users.push(currentUser);
      
      // Kullanıcıya mevcut canvas durumunu gönder
      socket.emit('roomJoined', { roomId: currentRoom, user: currentUser });
      
      if (roomData.canvasState) {
        socket.emit('canvasUpdate', {
          type: 'historyChange',
          imageData: roomData.canvasState
        });
      }
      
      // Oda kullanıcı sayısını güncelle
      updateRoomUserCount(currentRoom);
      updateActiveUsers(currentRoom);
      
      // Diğer kullanıcılara katılma bildirimi yap
      socket.to(currentRoom).emit('userActivity', {
        type: 'join',
        user: currentUser
      });
      
      console.log(`${username} odaya katıldı: ${currentRoom}`);
    });
    
    // Kullanıcı devre dışı kalırsa odadan çıkar
    socket.on('disconnect', () => {
      console.log(`Kullanıcı ayrıldı: ${socket.id}`);
      if (currentRoom) {
        // Odadan ayrılma bildirimini gönder
        socket.to(currentRoom).emit('userActivity', {
          type: 'leave',
          user: currentUser
        });
        
        // Kullanıcıyı odadan çıkar
        removeUserFromRoom(socket.id, currentRoom);
      }
    });
    
    // Fare hareketi iletme
    socket.on('mouseMove', (data) => {
      if (!currentRoom || !currentUser) return;
      
      socket.to(currentRoom).emit('mouseMove', {
        x: data.x,
        y: data.y,
        tool: data.tool,
        user: currentUser
      });
    });
    
    // Çizim olayları
    socket.on('drawStart', (data) => {
      if (!currentRoom) return;
      
      // Çizime başlama olayını bildir
      socket.to(currentRoom).emit('userActivity', {
        type: 'drawStart',
        tool: data.tool,
        user: currentUser
      });
      
      socket.to(currentRoom).emit('drawStart', {
        x: data.x,
        y: data.y,
        color: data.color,
        size: data.size,
        tool: data.tool
      });
    });
    
    socket.on('drawMove', (data) => {
      if (!currentRoom) return;
      
      socket.to(currentRoom).emit('drawMove', {
        x: data.x,
        y: data.y,
        color: data.color,
        size: data.size,
        tool: data.tool
      });
    });
    
    socket.on('drawEnd', (data) => {
      if (!currentRoom) return;
      
      socket.to(currentRoom).emit('drawEnd', {
        tool: data.tool
      });
    });
    
    // Canvas durumu güncelleme
    socket.on('canvasUpdate', (data) => {
      if (!currentRoom) return;
      
      // Canvas durumunu odada sakla
      const roomData = rooms.get(currentRoom);
      if (roomData) {
        roomData.canvasState = data.imageData;
      }
      
      // Diğer kullanıcılara gönder (kullanıcı bilgisi ile)
      socket.to(currentRoom).emit('canvasUpdate', {
        ...data,
        user: currentUser
      });
    });
    
    // Kullanıcı aktivite olayları
    socket.on('userActivity', (data) => {
      if (!currentRoom || !currentUser) return;
      
      // Aktiviteyi diğer kullanıcılara bildir
      socket.to(currentRoom).emit('userActivity', {
        ...data,
        user: currentUser
      });
    });
    
    // Tahtayı temizleme - artık kullanılmıyor
    socket.on('clearBoard', () => {
      if (!currentRoom) return;
      
      // Odanın canvas durumunu temizleme yetkisi işlem günlüğüne taşındı
      // socket.to(currentRoom).emit('clearBoard');
    });
  });
  
  // Odadan kullanıcı çıkarma
  function removeUserFromRoom(userId, roomId) {
    if (!rooms.has(roomId)) return;
    
    const roomData = rooms.get(roomId);
    roomData.users = roomData.users.filter(user => user.id !== userId);
    
    // Odada hiç kullanıcı kalmadıysa odayı sil
    if (roomData.users.length === 0) {
      rooms.delete(roomId);
      console.log(`Oda silindi: ${roomId}`);
      return;
    }
    
    updateRoomUserCount(roomId);
    updateActiveUsers(roomId);
  }
  
  // Oda kullanıcı sayısını güncelle
  function updateRoomUserCount(roomId) {
    if (!rooms.has(roomId)) return;
    
    const roomData = rooms.get(roomId);
    io.to(roomId).emit('userCount', roomData.users.length);
  }
  
  // Aktif kullanıcı listesini güncelle
  function updateActiveUsers(roomId) {
    if (!rooms.has(roomId)) return;
    
    const roomData = rooms.get(roomId);
    io.to(roomId).emit('activeUsers', roomData.users);
  }
}

module.exports = setupSocketManager; 