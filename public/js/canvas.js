/**
 * Module containing canvas operations and drawing functions
 */
class DrawingCanvas {
  constructor() {
    this.canvas = document.getElementById('drawing-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Second canvas for temporary drawing
    this.tempCanvas = document.getElementById('temp-canvas');
    this.tempCtx = this.tempCanvas.getContext('2d');
    
    this.isDrawing = false;
    this.brushSize = 5;
    this.brushColor = '#000000';
    this.lastX = 0;
    this.lastY = 0;
    this.startX = 0;
    this.startY = 0;
    
    // Drawing tool
    this.currentTool = 'brush';
    
    // For history management
    this.history = [];
    this.currentStep = -1;
    this.maxHistorySteps = 20; // Maximum record steps
    this.shouldRecordHistory = true; // Record control flag when undoing
    
    // Set canvas size
    this.resizeCanvas();
    
    // Save current state
    this.saveCurrentState();
    
    // Event listeners
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Drawing events
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseout', () => this.stopDrawing());
    
    // Touch device support
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });
    
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      this.canvas.dispatchEvent(mouseEvent);
    });
    
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const mouseEvent = new MouseEvent('mouseup');
      this.canvas.dispatchEvent(mouseEvent);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.undo();
      }
      
      // Ctrl/Cmd + Y: Redo or Ctrl/Cmd + Shift + Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        this.redo();
      }
    });
  }
  
  // Adjust canvas size according to window
  resizeCanvas() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    this.tempCanvas.width = container.clientWidth;
    this.tempCanvas.height = container.clientHeight;
    
    // Draw current state after resizing
    if (this.currentStep >= 0 && this.history[this.currentStep]) {
      const tempImage = new Image();
      tempImage.src = this.history[this.currentStep];
      tempImage.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(tempImage, 0, 0);
      };
    }
  }
  
  // Change tool
  setTool(tool) {
    this.currentTool = tool;
    
    // Set cursor style
    switch (tool) {
      case 'brush':
        this.canvas.style.cursor = 'crosshair';
        break;
      case 'eraser':
        this.canvas.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23333\' d=\'M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17.1c-.78-.78-.78-2.05 0-2.83l6.25-6.25 7.18-4.46zm.71 1.42L10.44 9.44l5.66 5.66 5.31-5.31c.39-.39.39-1.02 0-1.41l-4.95-4.95a.996.996 0 0 0-1.41 0z\'/%3E%3C/svg%3E") 5 5, auto';
        break;
      case 'line':
      case 'rect':
      case 'circle':
        this.canvas.style.cursor = 'crosshair';
        break;
      default:
        this.canvas.style.cursor = 'crosshair';
    }
  }
  
  // Save current canvas state
  saveCurrentState() {
    if (!this.shouldRecordHistory) return;
    
    // If we're in the middle of history steps, delete forward steps
    if (this.currentStep < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentStep + 1);
    }
    
    // Add to history
    this.currentStep++;
    this.history.push(this.canvas.toDataURL());
    
    // Delete oldest step if history limit is exceeded
    if (this.history.length > this.maxHistorySteps) {
      this.history.shift();
      this.currentStep--;
    }
    
    // Notify if history has changed
    if (typeof this.onHistoryChange === 'function') {
      this.onHistoryChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });
    }
    
    // When canvas is updated
    if (typeof this.onCanvasUpdated === 'function') {
      this.onCanvasUpdated({
        type: 'stateChange',
        imageData: this.history[this.currentStep]
      });
    }
  }
  
  // Can undo operation be performed?
  canUndo() {
    return this.currentStep > 0;
  }
  
  // Can redo operation be performed?
  canRedo() {
    return this.currentStep < this.history.length - 1;
  }
  
  // Undo
  undo() {
    if (!this.canUndo()) return false;
    
    this.shouldRecordHistory = false;
    this.currentStep--;
    this.loadImageFromHistory();
    this.shouldRecordHistory = true;
    
    // Notify
    if (typeof this.onHistoryChange === 'function') {
      this.onHistoryChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });
    }
    
    return true;
  }
  
  // Redo
  redo() {
    if (!this.canRedo()) return false;
    
    this.shouldRecordHistory = false;
    this.currentStep++;
    this.loadImageFromHistory();
    this.shouldRecordHistory = true;
    
    // Notify
    if (typeof this.onHistoryChange === 'function') {
      this.onHistoryChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });
    }
    
    return true;
  }
  
  // Load image from history
  loadImageFromHistory() {
    if (this.currentStep >= 0 && this.history[this.currentStep]) {
      const tempImage = new Image();
      tempImage.src = this.history[this.currentStep];
      tempImage.onload = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(tempImage, 0, 0);
        
        // Notify remote users
        if (typeof this.onCanvasUpdated === 'function') {
          this.onCanvasUpdated({
            type: 'historyChange',
            action: this.currentStep < this.history.length - 1 ? 'undo' : 'redo',
            imageData: this.history[this.currentStep]
          });
        }
      };
    }
  }
  
  // Start drawing
  startDrawing(e) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    this.lastX = e.clientX - rect.left;
    this.lastY = e.clientY - rect.top;
    this.startX = this.lastX;
    this.startY = this.lastY;
    
    switch (this.currentTool) {
      case 'brush':
        // Draw point when drawing starts
        this.ctx.beginPath();
        this.ctx.fillStyle = this.brushColor;
        this.ctx.arc(this.lastX, this.lastY, this.brushSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        break;
        
      case 'eraser':
        // Eraser mode - use 'destination-out' composition mode
        this.ctx.beginPath();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.arc(this.lastX, this.lastY, this.brushSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalCompositeOperation = 'source-over';
        break;
        
      case 'line':
      case 'rect':
      case 'circle':
        // Clear temporary drawing
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        break;
    }
    
    // Drawing start event
    if (typeof this.onDrawStart === 'function') {
      this.onDrawStart({
        x: this.lastX,
        y: this.lastY,
        color: this.brushColor,
        size: this.brushSize,
        tool: this.currentTool
      });
    }
  }
  
  // Draw
  draw(e) {
    if (!this.isDrawing) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    switch (this.currentTool) {
      case 'brush':
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.strokeStyle = this.brushColor;
        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
        break;
        
      case 'eraser':
        this.ctx.beginPath();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(x, y);
        this.ctx.lineWidth = this.brushSize;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
        this.ctx.globalCompositeOperation = 'source-over';
        break;
        
      case 'line':
        // Clear temporary drawing
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        
        // Draw new line
        this.tempCtx.beginPath();
        this.tempCtx.moveTo(this.startX, this.startY);
        this.tempCtx.lineTo(x, y);
        this.tempCtx.strokeStyle = this.brushColor;
        this.tempCtx.lineWidth = this.brushSize;
        this.tempCtx.lineCap = 'round';
        this.tempCtx.lineJoin = 'round';
        this.tempCtx.stroke();
        break;
        
      case 'rect':
        // Clear temporary drawing
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        
        // Draw new rectangle
        const width = x - this.startX;
        const height = y - this.startY;
        
        this.tempCtx.beginPath();
        this.tempCtx.rect(this.startX, this.startY, width, height);
        this.tempCtx.strokeStyle = this.brushColor;
        this.tempCtx.lineWidth = this.brushSize;
        this.tempCtx.stroke();
        break;
        
      case 'circle':
        // Clear temporary drawing
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        
        // Draw new circle
        const radiusX = Math.abs(x - this.startX);
        const radiusY = Math.abs(y - this.startY);
        const radius = Math.max(radiusX, radiusY);
        
        this.tempCtx.beginPath();
        this.tempCtx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
        this.tempCtx.strokeStyle = this.brushColor;
        this.tempCtx.lineWidth = this.brushSize;
        this.tempCtx.stroke();
        break;
    }
    
    // Save live drawing state immediately
    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      // Save state every 10 drawing steps (to avoid saving too frequently)
      if (Math.random() < 0.1) {
        this.saveCurrentState();
      }
    }
    
    // Mouse move event
    if (typeof this.onDrawMove === 'function') {
      this.onDrawMove({
        x0: this.lastX,
        y0: this.lastY,
        x1: x,
        y1: y,
        color: this.brushColor,
        size: this.brushSize,
        tool: this.currentTool,
        startX: this.startX,
        startY: this.startY
      });
    }
    
    this.lastX = x;
    this.lastY = y;
  }
  
  // Stop drawing
  stopDrawing() {
    if (this.isDrawing) {
      switch (this.currentTool) {
        case 'line':
        case 'rect':
        case 'circle':
          // Transfer temporary drawing to main canvas
          this.ctx.drawImage(this.tempCanvas, 0, 0);
          this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
          break;
      }
      
      // Save current state after drawing ends
      this.saveCurrentState();
      
      if (typeof this.onDrawEnd === 'function') {
        this.onDrawEnd();
      }
    }
    this.isDrawing = false;
  }
  
  // Start drawing from remote user
  remoteDrawStart(data) {
    switch (data.tool || 'brush') {
      case 'brush':
        this.ctx.beginPath();
        this.ctx.fillStyle = data.color;
        this.ctx.arc(data.x, data.y, data.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        break;
        
      case 'eraser':
        this.ctx.beginPath();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.arc(data.x, data.y, data.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalCompositeOperation = 'source-over';
        break;
    }
  }
  
  // Continue drawing from remote user
  remoteDrawMove(data) {
    switch (data.tool || 'brush') {
      case 'brush':
        this.ctx.beginPath();
        this.ctx.moveTo(data.x0, data.y0);
        this.ctx.lineTo(data.x1, data.y1);
        this.ctx.strokeStyle = data.color;
        this.ctx.lineWidth = data.size;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
        break;
        
      case 'eraser':
        this.ctx.beginPath();
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.moveTo(data.x0, data.y0);
        this.ctx.lineTo(data.x1, data.y1);
        this.ctx.lineWidth = data.size;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
        this.ctx.globalCompositeOperation = 'source-over';
        break;
        
      case 'line':
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        this.tempCtx.beginPath();
        this.tempCtx.moveTo(data.startX, data.startY);
        this.tempCtx.lineTo(data.x1, data.y1);
        this.tempCtx.strokeStyle = data.color;
        this.tempCtx.lineWidth = data.size;
        this.tempCtx.lineCap = 'round';
        this.tempCtx.lineJoin = 'round';
        this.tempCtx.stroke();
        break;
        
      case 'rect':
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        const width = data.x1 - data.startX;
        const height = data.y1 - data.startY;
        this.tempCtx.beginPath();
        this.tempCtx.rect(data.startX, data.startY, width, height);
        this.tempCtx.strokeStyle = data.color;
        this.tempCtx.lineWidth = data.size;
        this.tempCtx.stroke();
        break;
        
      case 'circle':
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        const radiusX = Math.abs(data.x1 - data.startX);
        const radiusY = Math.abs(data.y1 - data.startY);
        const radius = Math.max(radiusX, radiusY);
        this.tempCtx.beginPath();
        this.tempCtx.arc(data.startX, data.startY, radius, 0, Math.PI * 2);
        this.tempCtx.strokeStyle = data.color;
        this.tempCtx.lineWidth = data.size;
        this.tempCtx.stroke();
        break;
    }
  }
  
  // Drawing ended from remote user
  remoteDrawEnd(data) {
    if (data && (data.tool === 'line' || data.tool === 'rect' || data.tool === 'circle')) {
      // Transfer temporary drawing to main canvas
      this.ctx.drawImage(this.tempCanvas, 0, 0);
      this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    }
    
    // Save current state after remote drawing ends
    this.saveCurrentState();
  }
  
  // Clear canvas
  clearCanvas(notifyOthers = true) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    this.saveCurrentState();
    
    // Notify clear operation but only if requested
    if (notifyOthers && typeof this.onClearCanvas === 'function') {
      this.onClearCanvas();
    }
  }
  
  // Save image
  saveAsImage() {
    const link = document.createElement('a');
    link.download = 'drawvibe-' + new Date().toISOString().slice(0, 10) + '.png';
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }
  
  // Set brush size
  setBrushSize(size) {
    this.brushSize = size;
  }
  
  // Set brush color
  setBrushColor(color) {
    this.brushColor = color;
  }
  
  // Set image data directly
  setImageData(imageData) {
    if (!imageData) return;
    
    this.shouldRecordHistory = false;
    const tempImage = new Image();
    tempImage.src = imageData;
    tempImage.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(tempImage, 0, 0);
      
      // Save current state
      this.currentStep++;
      if (this.currentStep >= this.history.length) {
        this.history.push(imageData);
      } else {
        this.history[this.currentStep] = imageData;
      }
      
      if (this.history.length > this.maxHistorySteps) {
        this.history.shift();
        this.currentStep--;
      }
      
      // Update history buttons
      if (typeof this.onHistoryChange === 'function') {
        this.onHistoryChange({
          canUndo: this.canUndo(),
          canRedo: this.canRedo()
        });
      }
      
      this.shouldRecordHistory = true;
    };
  }
}

// Export
window.DrawingCanvas = DrawingCanvas; 