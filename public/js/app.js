/**
 * Drawvibe main application, socket.io connections and user interface operations
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements - Welcome screen
  const welcomeScreen = document.getElementById('welcome-screen');
  const drawingApp = document.getElementById('drawing-app');
  const welcomeUsername = document.getElementById('welcome-username');
  const roomIdInput = document.getElementById('room-id');
  const joinButton = document.getElementById('join-button');
  
  // DOM elements - Drawing application
  const currentRoomIdElement = document.getElementById('current-room-id');
  const copyRoomButton = document.getElementById('copy-room-button');
  const currentUsernameElement = document.getElementById('current-username');
  const currentToolNameElement = document.getElementById('current-tool-name');
  const colorPicker = document.getElementById('color-picker');
  const brushSizeInput = document.getElementById('brush-size');
  const brushSizeDisplay = document.getElementById('brush-size-display');
  const clearButton = document.getElementById('clear-button');
  const saveButton = document.getElementById('save-button');
  const shareButton = document.getElementById('share-button');
  const undoButton = document.getElementById('undo-button');
  const redoButton = document.getElementById('redo-button');
  const userCountElement = document.getElementById('user-count');
  const activeUsersList = document.getElementById('active-users-list');
  const colorPresets = document.querySelectorAll('.color-preset');
  const cursorsLayer = document.getElementById('cursors-layer');
  
  // Activity history element
  let activityLogContainer = document.createElement('div');
  activityLogContainer.className = 'activity-log-container';
  activityLogContainer.innerHTML = '<h3><i class="fas fa-history"></i> Activity History</h3><ul id="activity-log"></ul>';
  document.querySelector('.canvas-container').appendChild(activityLogContainer);
  const activityLog = document.getElementById('activity-log');
  
  // Drawing tool buttons
  const toolButtons = document.querySelectorAll('.tool-select');
  
  // Application state
  let currentUser = null;
  let currentRoom = null;
  let currentTool = 'brush';
  
  // Generate random username
  welcomeUsername.value = 'Guest' + Math.floor(Math.random() * 1000);
  
  // Socket.io connection
  const socket = io();
  
  // Initialize Canvas class
  const drawingCanvas = new DrawingCanvas();
  
  // Tool names in English
  const toolNames = {
    'brush': 'Pen',
    'eraser': 'Eraser',
    'line': 'Line',
    'rect': 'Rectangle',
    'circle': 'Circle'
  };
  
  // Add message to activity log
  function addActivityLog(message, userName = null, color = null, action = null) {
    const li = document.createElement('li');
    
    if (color) {
      const colorDot = document.createElement('span');
      colorDot.className = 'user-color-dot';
      colorDot.style.backgroundColor = color;
      li.appendChild(colorDot);
    }
    
    if (userName) {
      const userNameSpan = document.createElement('span');
      userNameSpan.className = 'activity-username';
      userNameSpan.textContent = userName;
      li.appendChild(userNameSpan);
    }
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    li.appendChild(messageSpan);
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'activity-time';
    const now = new Date();
    timeSpan.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    li.appendChild(timeSpan);
    
    if (action) {
      li.setAttribute('data-action', action);
    }
    
    activityLog.appendChild(li);
    
    // Keep limited number of items
    if (activityLog.children.length > 30) {
      activityLog.removeChild(activityLog.children[0]);
    }
    
    // Auto scroll
    activityLogContainer.scrollTop = activityLogContainer.scrollHeight;
  }
  
  // Tool selection function
  function selectTool(toolName) {
    // Remove previous active tool
    toolButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-tool') === toolName) {
        btn.classList.add('active');
      }
    });
    
    // Set canvas tool
    drawingCanvas.setTool(toolName);
    currentTool = toolName;
    
    // Show tool name
    currentToolNameElement.textContent = toolNames[toolName] || toolName;
    
    // Add to activity log
    if (currentUser) {
      // Notify tool change event
      socket.emit('userActivity', {
        type: 'toolChange',
        tool: toolName
      });
      
      addActivityLog(`selected the ${toolNames[toolName]} tool`, currentUser.username, currentUser.color);
    }
  }
  
  // Tool selection button clicks
  toolButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tool = button.getAttribute('data-tool');
      selectTool(tool);
    });
  });
  
  // Select default tool
  selectTool('brush');
  
  // History controls event listener
  drawingCanvas.onHistoryChange = ({ canUndo, canRedo }) => {
    undoButton.disabled = !canUndo;
    redoButton.disabled = !canRedo;
  };
  
  // When canvas is updated
  drawingCanvas.onCanvasUpdated = (data) => {
    if (data.type === 'historyChange') {
      socket.emit('canvasUpdate', {
        type: 'historyChange',
        action: data.action,
        imageData: data.imageData
      });
    } else if (data.type === 'stateChange') {
      socket.emit('canvasUpdate', {
        type: 'stateChange',
        imageData: data.imageData
      });
    }
  };
  
  // Clear canvas event
  drawingCanvas.onClearCanvas = () => {
    // Only notify that our own canvas was cleared
    socket.emit('userActivity', {
      type: 'clearCanvas'
    });
  };
  
  // Enable undo/redo buttons
  undoButton.addEventListener('click', () => {
    if (drawingCanvas.undo()) {
      showNotification('Last step undone', 'undo');
      
      // Add to activity log
      if (currentUser) {
        socket.emit('userActivity', {
          type: 'undo'
        });
      }
    }
  });
  
  redoButton.addEventListener('click', () => {
    if (drawingCanvas.redo()) {
      showNotification('Step redone', 'redo');
      
      // Add to activity log
      if (currentUser) {
        socket.emit('userActivity', {
          type: 'redo'
        });
      }
    }
  });
  
  // Get room ID from URL (to support sharing links)
  function getRoomIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
  }
  
  // Add room code from URL if available when page loads
  const urlRoomId = getRoomIdFromUrl();
  if (urlRoomId) {
    roomIdInput.value = urlRoomId;
  }
  
  // Show notification
  function showNotification(message, icon = 'info-circle') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  // Create share modal
  function createShareModal() {
    // Delete existing modal if exists
    const existingModal = document.querySelector('.modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const shareUrl = `${window.location.origin}?room=${currentRoom}`;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-share-alt"></i> Share Drawing Room</div>
          <button class="modal-close">&times;</button>
        </div>
        <p>Share this link to invite friends to your drawing room:</p>
        <div class="share-link">
          <input type="text" class="share-input" value="${shareUrl}" readonly>
          <button class="copy-link-btn"><i class="fas fa-copy"></i></button>
        </div>
        <div class="social-share">
          <a href="https://wa.me/?text=${encodeURIComponent(`Join my Drawvibe drawing room: ${shareUrl}`)}" 
             target="_blank" class="social-btn whatsapp" title="Share on WhatsApp">
            <i class="fab fa-whatsapp"></i>
          </a>
          <a href="https://telegram.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Join my Drawvibe drawing room')}" 
             target="_blank" class="social-btn telegram" title="Share on Telegram">
            <i class="fab fa-telegram-plane"></i>
          </a>
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join my Drawvibe drawing room: ${shareUrl}`)}" 
             target="_blank" class="social-btn twitter" title="Share on Twitter">
            <i class="fab fa-twitter"></i>
          </a>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show modal
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
    
    // Close button
    const closeButton = modal.querySelector('.modal-close');
    closeButton.addEventListener('click', () => {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.remove();
      }, 300);
    });
    
    // Copy button
    const copyButton = modal.querySelector('.copy-link-btn');
    const shareInput = modal.querySelector('.share-input');
    
    copyButton.addEventListener('click', () => {
      shareInput.select();
      document.execCommand('copy');
      showNotification('Link copied!', 'check');
    });
    
    // Close by clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
        setTimeout(() => {
          modal.remove();
        }, 300);
      }
    });
  }
  
  // Copy room code
  copyRoomButton.addEventListener('click', () => {
    const tempInput = document.createElement('input');
    tempInput.value = currentRoom;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    
    showNotification('Room code copied!', 'check');
  });
  
  // When share button is clicked
  shareButton.addEventListener('click', () => {
    createShareModal();
  });
  
  // Welcome screen join button click
  joinButton.addEventListener('click', () => {
    const username = welcomeUsername.value.trim() || welcomeUsername.placeholder;
    const roomId = roomIdInput.value.trim(); // Random room will be created if empty
    
    // Join room
    socket.emit('joinRoom', { username, roomId });
  });
  
  // When user joins room
  socket.on('roomJoined', ({ roomId, user }) => {
    // Update state info
    currentUser = user;
    currentRoom = roomId;
    
    // Show room code
    currentRoomIdElement.textContent = roomId;
    
    // Show username
    currentUsernameElement.textContent = user.username;
    
    // Update browser history (with room code)
    const url = new URL(window.location);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url);
    
    // Switch screens
    welcomeScreen.classList.add('hidden');
    drawingApp.classList.remove('hidden');
    
    // Adjust canvas to window size
    drawingCanvas.resizeCanvas();
    
    showNotification('Connected to drawing room!', 'paint-brush');
    
    // Add to activity log
    addActivityLog('joined the room', user.username, user.color);
  });
  
  // User activity events
  socket.on('userActivity', (data) => {
    if (!data.user) return;
    
    switch (data.type) {
      case 'join':
        addActivityLog('joined the room', data.user.username, data.user.color);
        break;
        
      case 'leave':
        addActivityLog('left the room', data.user.username, data.user.color);
        break;
        
      case 'toolChange':
        addActivityLog(`selected the ${toolNames[data.tool]} tool`, data.user.username, data.user.color);
        break;
        
      case 'undo':
        addActivityLog('last step undone', data.user.username, data.user.color);
        break;
        
      case 'redo':
        addActivityLog('step redone', data.user.username, data.user.color);
        break;
        
      case 'clearCanvas':
        addActivityLog('cleared their canvas', data.user.username, data.user.color);
        break;
        
      case 'drawStart':
        // When remote user starts drawing
        if (!document.querySelector(`#activity-log li[data-action="drawing-remote-${data.user.id}"]`)) {
          addActivityLog(`${toolNames[data.tool]} is drawing`, data.user.username, data.user.color, `drawing-remote-${data.user.id}`);
        }
        break;
        
      case 'drawEnd':
        // When remote user finishes drawing
        const drawingItem = document.querySelector(`#activity-log li[data-action="drawing-remote-${data.user.id}"]`);
        if (drawingItem) {
          drawingItem.remove();
        }
        addActivityLog(`${toolNames[data.tool]} finished drawing`, data.user.username, data.user.color);
        break;
    }
  });
  
  // Mouse tracking
  drawingApp.addEventListener('mousemove', (e) => {
    if (!currentRoom) return;
    
    const rect = drawingCanvas.canvas.getBoundingClientRect();
    socket.emit('mouseMove', {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      tool: currentTool
    });
  });
  
  // User interface events
  colorPicker.addEventListener('input', () => {
    drawingCanvas.setBrushColor(colorPicker.value);
  });
  
  brushSizeInput.addEventListener('input', () => {
    const size = brushSizeInput.value;
    drawingCanvas.setBrushSize(size);
    brushSizeDisplay.textContent = `${size}px`;
  });
  
  clearButton.addEventListener('click', () => {
    // Only clear your own canvas, don't send clear command to others
    drawingCanvas.clearCanvas(true);
    showNotification('Your canvas cleared!', 'eraser');
  });
  
  saveButton.addEventListener('click', () => {
    drawingCanvas.saveAsImage();
    showNotification('Drawing saved!', 'download');
  });
  
  // Color presets
  colorPresets.forEach(preset => {
    preset.addEventListener('click', () => {
      const color = preset.getAttribute('data-color');
      colorPicker.value = color;
      drawingCanvas.setBrushColor(color);
    });
  });
  
  // Active user count
  socket.on('userCount', (count) => {
    userCountElement.textContent = count;
  });
  
  // Active users list
  socket.on('activeUsers', (users) => {
    activeUsersList.innerHTML = '';
    
    users.forEach(user => {
      const li = document.createElement('li');
      const colorDot = document.createElement('span');
      colorDot.className = 'user-color-dot';
      colorDot.style.backgroundColor = user.color;
      
      li.appendChild(colorDot);
      li.appendChild(document.createTextNode(user.username));
      
      // Mark if current user
      if (currentUser && user.id === currentUser.id) {
        li.style.fontWeight = 'bold';
      }
      
      activeUsersList.appendChild(li);
    });
  });
  
  // Other users' mouse cursors
  socket.on('mouseMove', (data) => {
    if (!data.user) return;
    if (currentUser && data.user.id === currentUser.id) return; // Don't show our own cursor
    
    let cursor = document.getElementById(`cursor-${data.user.id}`);
    
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = `cursor-${data.user.id}`;
      cursor.className = 'cursor';
      
      const label = document.createElement('div');
      label.className = 'cursor-label';
      label.textContent = `${data.user.username} (${toolNames[data.tool] || data.tool || 'Pen'})`;
      
      cursor.appendChild(label);
      cursorsLayer.appendChild(cursor);
    } else {
      // Update tool info
      const label = cursor.querySelector('.cursor-label');
      if (label) {
        label.textContent = `${data.user.username} (${toolNames[data.tool] || data.tool || 'Pen'})`;
      }
    }
    
    cursor.style.left = `${data.x}px`;
    cursor.style.top = `${data.y}px`;
    cursor.style.backgroundColor = data.user.color;
  });
  
  // Send drawing events via socket.io
  drawingCanvas.onDrawStart = (data) => {
    if (!currentRoom) return;
    
    // Add tool type to log when drawing starts
    if (!document.querySelector(`#activity-log li[data-action="drawing-${currentTool}"]`)) {
      addActivityLog(`${toolNames[currentTool]} is drawing`, currentUser.username, currentUser.color, `drawing-${currentTool}`);
    }
    
    socket.emit('drawStart', data);
  };
  
  drawingCanvas.onDrawMove = (data) => {
    if (!currentRoom) return;
    
    // Send drawing to remote users
    socket.emit('drawMove', data);
  };
  
  drawingCanvas.onDrawEnd = () => {
    if (!currentRoom) return;
    
    // Remove message when drawing ends
    const drawingItem = document.querySelector(`#activity-log li[data-action="drawing-${currentTool}"]`);
    if (drawingItem) {
      drawingItem.remove();
    }
    
    // Notify drawing ended
    addActivityLog(`${toolNames[currentTool]} finished drawing`, currentUser.username, currentUser.color);
    
    socket.emit('drawEnd', { tool: currentTool });
    socket.emit('userActivity', {
      type: 'drawEnd',
      tool: currentTool
    });
  };
  
  // Remote drawing events
  socket.on('drawStart', (data) => {
    drawingCanvas.remoteDrawStart(data);
  });
  
  socket.on('drawMove', (data) => {
    drawingCanvas.remoteDrawMove(data);
  });
  
  socket.on('drawEnd', (data) => {
    drawingCanvas.remoteDrawEnd(data);
  });
  
  // Listen for canvas update event
  socket.on('canvasUpdate', (data) => {
    if (data.type === 'historyChange') {
      if (data.user && currentUser && data.user.id !== currentUser.id) {
        // Log someone else's undo/redo operation
        const action = data.action === 'undo' ? 'last step undone' : 'step redone';
        addActivityLog(action, data.user.username, data.user.color);
      }
      
      drawingCanvas.setImageData(data.imageData);
    } else if (data.type === 'stateChange') {
      // Normal canvas changes
      drawingCanvas.setImageData(data.imageData);
    }
  });
  
  socket.on('clearBoard', () => {
    drawingCanvas.clearCanvas(false); // Just clear our panel
    showNotification('Your canvas has been cleared', 'eraser');
  });
  
  // Window resize
  window.addEventListener('resize', () => {
    drawingCanvas.resizeCanvas();
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Keys 1-5: tool switching
    if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const toolIndex = parseInt(e.key) - 1;
      const tools = ['brush', 'eraser', 'line', 'rect', 'circle'];
      if (toolIndex >= 0 && toolIndex < tools.length) {
        selectTool(tools[toolIndex]);
        showNotification(`${toolNames[tools[toolIndex]]} tool selected`, 'hand-pointer');
      }
    }
  });
}); 