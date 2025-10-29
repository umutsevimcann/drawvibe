/**
 * Module that manages Socket.io connections and drawing events
 */

const { generateRoomId, generateUserColor } = require('../utils/helpers');

// User rooms
const rooms = new Map();

// Socket connection manager
function setupSocketManager(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    let currentUser = null;
    let currentRoom = null;
    
    // Join room
    socket.on('joinRoom', ({ username, roomId }) => {
      // Check username
      if (!username || username.trim() === '') {
        username = 'Guest' + Math.floor(Math.random() * 1000);
      }
      
      // Generate random room ID if none provided
      const finalRoomId = roomId || generateRoomId();
      
      // Leave old room (if exists)
      if (currentRoom) {
        socket.leave(currentRoom);
        removeUserFromRoom(socket.id, currentRoom);
      }
      
      // Create new room (if doesn't exist)
      if (!rooms.has(finalRoomId)) {
        rooms.set(finalRoomId, {
          users: [],
          canvasState: null
        });
      }
      
      // Create user information
      currentUser = {
        id: socket.id,
        username,
        color: generateUserColor()
      };
      
      // Add user to room
      currentRoom = finalRoomId;
      socket.join(currentRoom);
      
      // Add to room's user list
      const roomData = rooms.get(currentRoom);
      roomData.users.push(currentUser);
      
      // Send current canvas state to user
      socket.emit('roomJoined', { roomId: currentRoom, user: currentUser });
      
      if (roomData.canvasState) {
        socket.emit('canvasUpdate', {
          type: 'historyChange',
          imageData: roomData.canvasState
        });
      }
      
      // Update room user count
      updateRoomUserCount(currentRoom);
      updateActiveUsers(currentRoom);
      
      // Notify other users about new join
      socket.to(currentRoom).emit('userActivity', {
        type: 'join',
        user: currentUser
      });
      
      console.log(`${username} joined room: ${currentRoom}`);
    });
    
    // Remove user from room when disconnected
    socket.on('disconnect', () => {
      console.log(`User left: ${socket.id}`);
      if (currentRoom) {
        // Send leave notification
        socket.to(currentRoom).emit('userActivity', {
          type: 'leave',
          user: currentUser
        });
        
        // Remove user from room
        removeUserFromRoom(socket.id, currentRoom);
      }
    });
    
    // Mouse movement transmission
    socket.on('mouseMove', (data) => {
      if (!currentRoom || !currentUser) return;
      
      socket.to(currentRoom).emit('mouseMove', {
        x: data.x,
        y: data.y,
        tool: data.tool,
        user: currentUser
      });
    });
    
    // Drawing events
    socket.on('drawStart', (data) => {
      if (!currentRoom) return;
      
      // Notify drawing start event
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
    
    // Canvas state update
    socket.on('canvasUpdate', (data) => {
      if (!currentRoom) return;
      
      // Store canvas state in room
      const roomData = rooms.get(currentRoom);
      if (roomData) {
        roomData.canvasState = data.imageData;
      }
      
      // Send to other users (with user info)
      socket.to(currentRoom).emit('canvasUpdate', {
        ...data,
        user: currentUser
      });
    });
    
    // User activity events
    socket.on('userActivity', (data) => {
      if (!currentRoom || !currentUser) return;
      
      // Notify activity to other users
      socket.to(currentRoom).emit('userActivity', {
        ...data,
        user: currentUser
      });
    });
    
    // Clear board - no longer used
    socket.on('clearBoard', () => {
      if (!currentRoom) return;
      
      // Canvas clearing permission moved to action log
      // socket.to(currentRoom).emit('clearBoard');
    });
  });
  
  // Remove user from room
  function removeUserFromRoom(userId, roomId) {
    if (!rooms.has(roomId)) return;
    
    const roomData = rooms.get(roomId);
    roomData.users = roomData.users.filter(user => user.id !== userId);
    
    // Delete room if no users left
    if (roomData.users.length === 0) {
      rooms.delete(roomId);
      console.log(`Room deleted: ${roomId}`);
      return;
    }
    
    updateRoomUserCount(roomId);
    updateActiveUsers(roomId);
  }
  
  // Update room user count
  function updateRoomUserCount(roomId) {
    if (!rooms.has(roomId)) return;
    
    const roomData = rooms.get(roomId);
    io.to(roomId).emit('userCount', roomData.users.length);
  }
  
  // Update active user list
  function updateActiveUsers(roomId) {
    if (!rooms.has(roomId)) return;
    
    const roomData = rooms.get(roomId);
    io.to(roomId).emit('activeUsers', roomData.users);
  }
}

module.exports = setupSocketManager; 