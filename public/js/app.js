/**
 * Drawvibe ana uygulama, socket.io bağlantıları ve kullanıcı arayüzü işlemleri
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM elementleri - Hoş geldin ekranı
  const welcomeScreen = document.getElementById('welcome-screen');
  const drawingApp = document.getElementById('drawing-app');
  const welcomeUsername = document.getElementById('welcome-username');
  const roomIdInput = document.getElementById('room-id');
  const joinButton = document.getElementById('join-button');
  
  // DOM elementleri - Çizim uygulaması
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
  
  // İşlem geçmişi elementi
  let activityLogContainer = document.createElement('div');
  activityLogContainer.className = 'activity-log-container';
  activityLogContainer.innerHTML = '<h3><i class="fas fa-history"></i> İşlem Geçmişi</h3><ul id="activity-log"></ul>';
  document.querySelector('.canvas-container').appendChild(activityLogContainer);
  const activityLog = document.getElementById('activity-log');
  
  // Çizim araç butonları
  const toolButtons = document.querySelectorAll('.tool-select');
  
  // Uygulama durumu
  let currentUser = null;
  let currentRoom = null;
  let currentTool = 'brush';
  
  // Rastgele kullanıcı adı oluştur
  welcomeUsername.value = 'Misafir' + Math.floor(Math.random() * 1000);
  
  // Socket.io bağlantısı
  const socket = io();
  
  // Canvas sınıfını başlat
  const drawingCanvas = new DrawingCanvas();
  
  // Araç isimlerini Türkçe karşılıkları
  const toolNames = {
    'brush': 'Kalem',
    'eraser': 'Silgi',
    'line': 'Çizgi',
    'rect': 'Dikdörtgen',
    'circle': 'Daire'
  };
  
  // İşlem günlüğüne mesaj ekle
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
    
    // Sınırlı sayıda öğe tut
    if (activityLog.children.length > 30) {
      activityLog.removeChild(activityLog.children[0]);
    }
    
    // Otomatik kaydır
    activityLogContainer.scrollTop = activityLogContainer.scrollHeight;
  }
  
  // Araç seçme işlevi
  function selectTool(toolName) {
    // Önceki aktif aracı kaldır
    toolButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-tool') === toolName) {
        btn.classList.add('active');
      }
    });
    
    // Canvas aracını ayarla
    drawingCanvas.setTool(toolName);
    currentTool = toolName;
    
    // Araç adını göster
    currentToolNameElement.textContent = toolNames[toolName] || toolName;
    
    // İşlem günlüğüne ekle
    if (currentUser) {
      // Araç değiştirme olayını bildir
      socket.emit('userActivity', {
        type: 'toolChange',
        tool: toolName
      });
      
      addActivityLog(`${toolNames[toolName]} aracını seçti`, currentUser.username, currentUser.color);
    }
  }
  
  // Araç seçim butonlarına tıklama
  toolButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tool = button.getAttribute('data-tool');
      selectTool(tool);
    });
  });
  
  // Varsayılan aracı seç
  selectTool('brush');
  
  // Geçmiş kontrolleri event listener
  drawingCanvas.onHistoryChange = ({ canUndo, canRedo }) => {
    undoButton.disabled = !canUndo;
    redoButton.disabled = !canRedo;
  };
  
  // Canvas güncellendiğinde 
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
  
  // Tahtayı temizleme olayı
  drawingCanvas.onClearCanvas = () => {
    // Sadece kendi tahtamızın temizlendiğini bildir
    socket.emit('userActivity', {
      type: 'clearCanvas'
    });
  };
  
  // Geri alma/yeniden yapma düğmelerini etkinleştir
  undoButton.addEventListener('click', () => {
    if (drawingCanvas.undo()) {
      showNotification('Son adım geri alındı', 'undo');
      
      // İşlem günlüğüne ekle
      if (currentUser) {
        socket.emit('userActivity', {
          type: 'undo'
        });
      }
    }
  });
  
  redoButton.addEventListener('click', () => {
    if (drawingCanvas.redo()) {
      showNotification('Adım yeniden yapıldı', 'redo');
      
      // İşlem günlüğüne ekle
      if (currentUser) {
        socket.emit('userActivity', {
          type: 'redo'
        });
      }
    }
  });
  
  // URL'den oda kodu al (paylaşım linklerini desteklemek için)
  function getRoomIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
  }
  
  // Sayfa yüklendiğinde URL'den oda kodu varsa ekle
  const urlRoomId = getRoomIdFromUrl();
  if (urlRoomId) {
    roomIdInput.value = urlRoomId;
  }
  
  // Bildirim göster
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
  
  // Paylaşım modalı oluştur
  function createShareModal() {
    // Modal zaten varsa sil
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
          <div class="modal-title"><i class="fas fa-share-alt"></i> Çizim Odasını Paylaş</div>
          <button class="modal-close">&times;</button>
        </div>
        <p>Bu bağlantıyı paylaşarak arkadaşlarını çizim odana davet et:</p>
        <div class="share-link">
          <input type="text" class="share-input" value="${shareUrl}" readonly>
          <button class="copy-link-btn"><i class="fas fa-copy"></i></button>
        </div>
        <div class="social-share">
          <a href="https://wa.me/?text=${encodeURIComponent(`Drawvibe çizim odama katıl: ${shareUrl}`)}" 
             target="_blank" class="social-btn whatsapp" title="WhatsApp ile paylaş">
            <i class="fab fa-whatsapp"></i>
          </a>
          <a href="https://telegram.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Drawvibe çizim odama katıl')}" 
             target="_blank" class="social-btn telegram" title="Telegram ile paylaş">
            <i class="fab fa-telegram-plane"></i>
          </a>
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`Drawvibe çizim odama katıl: ${shareUrl}`)}" 
             target="_blank" class="social-btn twitter" title="Twitter ile paylaş">
            <i class="fab fa-twitter"></i>
          </a>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Modalı göster
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
    
    // Kapatma butonu
    const closeButton = modal.querySelector('.modal-close');
    closeButton.addEventListener('click', () => {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.remove();
      }, 300);
    });
    
    // Kopyalama butonu
    const copyButton = modal.querySelector('.copy-link-btn');
    const shareInput = modal.querySelector('.share-input');
    
    copyButton.addEventListener('click', () => {
      shareInput.select();
      document.execCommand('copy');
      showNotification('Bağlantı kopyalandı!', 'check');
    });
    
    // Modalın dışına tıklayarak kapat
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
        setTimeout(() => {
          modal.remove();
        }, 300);
      }
    });
  }
  
  // Oda kodunu kopyala
  copyRoomButton.addEventListener('click', () => {
    const tempInput = document.createElement('input');
    tempInput.value = currentRoom;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    
    showNotification('Oda kodu kopyalandı!', 'check');
  });
  
  // Paylaş butonuna tıklandığında
  shareButton.addEventListener('click', () => {
    createShareModal();
  });
  
  // Hoş geldin ekranında katıl butonuna tıklanma
  joinButton.addEventListener('click', () => {
    const username = welcomeUsername.value.trim() || welcomeUsername.placeholder;
    const roomId = roomIdInput.value.trim(); // Boşsa rastgele oda oluşturulacak
    
    // Odaya katıl
    socket.emit('joinRoom', { username, roomId });
  });
  
  // Kullanıcı odaya katıldığında
  socket.on('roomJoined', ({ roomId, user }) => {
    // Durum bilgilerini güncelle
    currentUser = user;
    currentRoom = roomId;
    
    // Oda kodunu göster
    currentRoomIdElement.textContent = roomId;
    
    // Kullanıcı adını göster
    currentUsernameElement.textContent = user.username;
    
    // Tarayıcı geçmişini güncelle (oda kodu ile)
    const url = new URL(window.location);
    url.searchParams.set('room', roomId);
    window.history.pushState({}, '', url);
    
    // Ekranları değiştir
    welcomeScreen.classList.add('hidden');
    drawingApp.classList.remove('hidden');
    
    // Pencere boyutuna göre canvas'ı ayarla
    drawingCanvas.resizeCanvas();
    
    showNotification('Çizim odasına bağlandın!', 'paint-brush');
    
    // İşlem günlüğüne ekle
    addActivityLog('odaya katıldı', user.username, user.color);
  });
  
  // Kullanıcı aktivite olayları
  socket.on('userActivity', (data) => {
    if (!data.user) return;
    
    switch (data.type) {
      case 'join':
        addActivityLog('odaya katıldı', data.user.username, data.user.color);
        break;
        
      case 'leave':
        addActivityLog('odadan ayrıldı', data.user.username, data.user.color);
        break;
        
      case 'toolChange':
        addActivityLog(`${toolNames[data.tool]} aracını seçti`, data.user.username, data.user.color);
        break;
        
      case 'undo':
        addActivityLog('son adımını geri aldı', data.user.username, data.user.color);
        break;
        
      case 'redo':
        addActivityLog('geri aldığı adımı yeniden yaptı', data.user.username, data.user.color);
        break;
        
      case 'clearCanvas':
        addActivityLog('kendi tahtasını temizledi', data.user.username, data.user.color);
        break;
        
      case 'drawStart':
        // Uzaktaki kullanıcı çizim yapmaya başladığında
        if (!document.querySelector(`#activity-log li[data-action="drawing-remote-${data.user.id}"]`)) {
          addActivityLog(`${toolNames[data.tool]} ile çiziyor`, data.user.username, data.user.color, `drawing-remote-${data.user.id}`);
        }
        break;
        
      case 'drawEnd':
        // Uzaktaki kullanıcı çizimi bitirdiğinde
        const drawingItem = document.querySelector(`#activity-log li[data-action="drawing-remote-${data.user.id}"]`);
        if (drawingItem) {
          drawingItem.remove();
        }
        addActivityLog(`${toolNames[data.tool]} ile çizimi tamamladı`, data.user.username, data.user.color);
        break;
    }
  });
  
  // Mouse takip etme
  drawingApp.addEventListener('mousemove', (e) => {
    if (!currentRoom) return;
    
    const rect = drawingCanvas.canvas.getBoundingClientRect();
    socket.emit('mouseMove', {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      tool: currentTool
    });
  });
  
  // Kullanıcı arayüzü olayları
  colorPicker.addEventListener('input', () => {
    drawingCanvas.setBrushColor(colorPicker.value);
  });
  
  brushSizeInput.addEventListener('input', () => {
    const size = brushSizeInput.value;
    drawingCanvas.setBrushSize(size);
    brushSizeDisplay.textContent = `${size}px`;
  });
  
  clearButton.addEventListener('click', () => {
    // Sadece kendi canvas'ını temizle, diğerlerine temizleme emri gönderme
    drawingCanvas.clearCanvas(true);
    showNotification('Kendi tahtanız temizlendi!', 'eraser');
  });
  
  saveButton.addEventListener('click', () => {
    drawingCanvas.saveAsImage();
    showNotification('Çizim kaydedildi!', 'download');
  });
  
  // Renk presetleri
  colorPresets.forEach(preset => {
    preset.addEventListener('click', () => {
      const color = preset.getAttribute('data-color');
      colorPicker.value = color;
      drawingCanvas.setBrushColor(color);
    });
  });
  
  // Aktif kullanıcı sayısı
  socket.on('userCount', (count) => {
    userCountElement.textContent = count;
  });
  
  // Aktif kullanıcılar listesi
  socket.on('activeUsers', (users) => {
    activeUsersList.innerHTML = '';
    
    users.forEach(user => {
      const li = document.createElement('li');
      const colorDot = document.createElement('span');
      colorDot.className = 'user-color-dot';
      colorDot.style.backgroundColor = user.color;
      
      li.appendChild(colorDot);
      li.appendChild(document.createTextNode(user.username));
      
      // Mevcut kullanıcı ise işaretle
      if (currentUser && user.id === currentUser.id) {
        li.style.fontWeight = 'bold';
      }
      
      activeUsersList.appendChild(li);
    });
  });
  
  // Diğer kullanıcıların mouse imleci
  socket.on('mouseMove', (data) => {
    if (!data.user) return;
    if (currentUser && data.user.id === currentUser.id) return; // Kendi imlecimizi gösterme
    
    let cursor = document.getElementById(`cursor-${data.user.id}`);
    
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = `cursor-${data.user.id}`;
      cursor.className = 'cursor';
      
      const label = document.createElement('div');
      label.className = 'cursor-label';
      label.textContent = `${data.user.username} (${toolNames[data.tool] || data.tool || 'Kalem'})`;
      
      cursor.appendChild(label);
      cursorsLayer.appendChild(cursor);
    } else {
      // Araç bilgisini güncelle
      const label = cursor.querySelector('.cursor-label');
      if (label) {
        label.textContent = `${data.user.username} (${toolNames[data.tool] || data.tool || 'Kalem'})`;
      }
    }
    
    cursor.style.left = `${data.x}px`;
    cursor.style.top = `${data.y}px`;
    cursor.style.backgroundColor = data.user.color;
  });
  
  // Çizim olaylarını socket.io üzerinden ilet
  drawingCanvas.onDrawStart = (data) => {
    if (!currentRoom) return;
    
    // Çizim başladığında araç tipini günlüğe ekle
    if (!document.querySelector(`#activity-log li[data-action="drawing-${currentTool}"]`)) {
      addActivityLog(`${toolNames[currentTool]} ile çiziyor`, currentUser.username, currentUser.color, `drawing-${currentTool}`);
    }
    
    socket.emit('drawStart', data);
  };
  
  drawingCanvas.onDrawMove = (data) => {
    if (!currentRoom) return;
    
    // Uzak kullanıcılara çizimi ilet
    socket.emit('drawMove', data);
  };
  
  drawingCanvas.onDrawEnd = () => {
    if (!currentRoom) return;
    
    // Çizim bittiğinde mesajı kaldır
    const drawingItem = document.querySelector(`#activity-log li[data-action="drawing-${currentTool}"]`);
    if (drawingItem) {
      drawingItem.remove();
    }
    
    // Çizimi bitirdiğini bildir
    addActivityLog(`${toolNames[currentTool]} ile çizimi tamamladı`, currentUser.username, currentUser.color);
    
    socket.emit('drawEnd', { tool: currentTool });
    socket.emit('userActivity', {
      type: 'drawEnd',
      tool: currentTool
    });
  };
  
  // Uzaktan gelen çizim olayları
  socket.on('drawStart', (data) => {
    drawingCanvas.remoteDrawStart(data);
  });
  
  socket.on('drawMove', (data) => {
    drawingCanvas.remoteDrawMove(data);
  });
  
  socket.on('drawEnd', (data) => {
    drawingCanvas.remoteDrawEnd(data);
  });
  
  // Canvas güncelleme olayını dinle
  socket.on('canvasUpdate', (data) => {
    if (data.type === 'historyChange') {
      if (data.user && currentUser && data.user.id !== currentUser.id) {
        // Başka birinin geri alma/ileri alma işlemini günlüğe ekle
        const action = data.action === 'undo' ? 'son adımını geri aldı' : 'geri aldığı adımı yeniden yaptı';
        addActivityLog(action, data.user.username, data.user.color);
      }
      
      drawingCanvas.setImageData(data.imageData);
    } else if (data.type === 'stateChange') {
      // Normal canvas değişiklikleri
      drawingCanvas.setImageData(data.imageData);
    }
  });
  
  socket.on('clearBoard', () => {
    drawingCanvas.clearCanvas(false); // Sadece kendi panelimizi temizliyoruz
    showNotification('Tahtanız temizlendi', 'eraser');
  });
  
  // Pencere boyutu değiştiğinde
  window.addEventListener('resize', () => {
    drawingCanvas.resizeCanvas();
  });
  
  // Klavye kısayolları
  document.addEventListener('keydown', (e) => {
    // 1-5 tuşları: araç değiştirme
    if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const toolIndex = parseInt(e.key) - 1;
      const tools = ['brush', 'eraser', 'line', 'rect', 'circle'];
      if (toolIndex >= 0 && toolIndex < tools.length) {
        selectTool(tools[toolIndex]);
        showNotification(`${toolNames[tools[toolIndex]]} aracı seçildi`, 'hand-pointer');
      }
    }
  });
}); 