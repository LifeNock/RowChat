// ============================================
// ROWCHAT - COLLABORATIVE WHITEBOARD (SAFE VERSION)
// ============================================

let whiteboardCanvas = null;
let whiteboardCtx = null;
let isDrawing = false;
let currentWhiteboardSession = null;
let currentColor = '#ffffff';
let currentLineWidth = 3;
let isEraser = false;
let whiteboardChannel = null;

const COLORS = [
  '#ffffff', // White
  '#ff0000', // Red
  '#ff7f00', // Orange
  '#ffff00', // Yellow
  '#00ff00', // Green
  '#0000ff', // Blue
  '#4b0082', // Indigo
  '#9400d3', // Violet
  '#ff1493', // Pink
  '#00ffff', // Cyan
  '#000000'  // Black
];

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Open Whiteboard Modal
function openWhiteboardModal() {
  console.log('Opening whiteboard modal...');
  
  if (!currentRoom) {
    showToast('Please select a room first', 'warning');
    return;
  }
  
  const modal = document.getElementById('whiteboardModal');
  if (!modal) {
    console.error('Whiteboard modal not found!');
    showToast('Whiteboard modal not found in HTML', 'error');
    return;
  }
  
  modal.classList.add('active');
  
  // Wait for modal to be visible
  setTimeout(() => {
    initializeCanvas();
    loadWhiteboardSession();
  }, 100);
}

// Initialize Canvas
function initializeCanvas() {
  console.log('Initializing canvas...');
  
  whiteboardCanvas = document.getElementById('whiteboardCanvas');
  if (!whiteboardCanvas) {
    console.error('Canvas element not found!');
    showToast('Canvas element missing from HTML', 'error');
    return;
  }
  
  whiteboardCtx = whiteboardCanvas.getContext('2d');
  
  // Set canvas size
  whiteboardCanvas.width = 800;
  whiteboardCanvas.height = 600;
  
  // Set up canvas style
  whiteboardCtx.fillStyle = '#1e1e1e';
  whiteboardCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
  whiteboardCtx.strokeStyle = currentColor;
  whiteboardCtx.lineWidth = currentLineWidth;
  whiteboardCtx.lineCap = 'round';
  whiteboardCtx.lineJoin = 'round';
  
  // Add drawing listeners
  whiteboardCanvas.addEventListener('mousedown', startDrawing);
  whiteboardCanvas.addEventListener('mousemove', draw);
  whiteboardCanvas.addEventListener('mouseup', stopDrawing);
  whiteboardCanvas.addEventListener('mouseleave', stopDrawing);
  
  // Touch support
  whiteboardCanvas.addEventListener('touchstart', handleTouchStart);
  whiteboardCanvas.addEventListener('touchmove', handleTouchMove);
  whiteboardCanvas.addEventListener('touchend', stopDrawing);
  
  // Render color picker
  renderColorPicker();
  
  console.log('Canvas initialized successfully');
}

// Render Color Picker
function renderColorPicker() {
  const colorPickerDiv = document.getElementById('whiteboardColorPicker');
  if (!colorPickerDiv) {
    console.error('Color picker div not found!');
    return;
  }
  
  colorPickerDiv.innerHTML = `
    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-right: 4px;">Tools:</div>
      ${COLORS.map(color => `
        <div 
          class="color-option ${color === currentColor && !isEraser ? 'active' : ''}" 
          style="
            width: 32px; 
            height: 32px; 
            background: ${color}; 
            border: 2px solid ${color === currentColor && !isEraser ? 'var(--accent)' : 'var(--bg-tertiary)'}; 
            border-radius: 6px; 
            cursor: pointer;
            transition: all 0.2s;
            ${color === '#ffffff' || color === '#ffff00' || color === '#00ffff' ? 'box-shadow: inset 0 0 0 1px rgba(0,0,0,0.2);' : ''}
          "
          onclick="selectWhiteboardColor('${color}')"
          title="${getColorName(color)}"
        ></div>
      `).join('')}
      <div 
        class="eraser-btn ${isEraser ? 'active' : ''}" 
        style="
          width: 32px; 
          height: 32px; 
          background: var(--bg-tertiary); 
          border: 2px solid ${isEraser ? 'var(--accent)' : 'var(--bg-tertiary)'}; 
          border-radius: 6px; 
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s;
        "
        onclick="toggleEraser()"
        title="Eraser"
      >🧹</div>
      <div style="margin-left: 8px; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 13px; color: var(--text-secondary);">Size:</span>
        <input 
          type="range" 
          min="1" 
          max="20" 
          value="${currentLineWidth}" 
          onchange="changeLineWidth(this.value)"
          style="width: 100px;"
        >
      </div>
    </div>
  `;
  
  console.log('Color picker rendered');
}

// Get Color Name
function getColorName(color) {
  const names = {
    '#ffffff': 'White',
    '#ff0000': 'Red',
    '#ff7f00': 'Orange',
    '#ffff00': 'Yellow',
    '#00ff00': 'Green',
    '#0000ff': 'Blue',
    '#4b0082': 'Indigo',
    '#9400d3': 'Violet',
    '#ff1493': 'Pink',
    '#00ffff': 'Cyan',
    '#000000': 'Black'
  };
  return names[color] || 'Color';
}

// Select Color
function selectWhiteboardColor(color) {
  currentColor = color;
  isEraser = false;
  whiteboardCtx.strokeStyle = color;
  whiteboardCtx.globalCompositeOperation = 'source-over';
  renderColorPicker();
}

// Toggle Eraser
function toggleEraser() {
  isEraser = !isEraser;
  
  if (isEraser) {
    whiteboardCtx.globalCompositeOperation = 'destination-out';
    whiteboardCtx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    whiteboardCtx.globalCompositeOperation = 'source-over';
    whiteboardCtx.strokeStyle = currentColor;
  }
  
  renderColorPicker();
}

// Close Whiteboard Modal
function closeWhiteboardModal() {
  const modal = document.getElementById('whiteboardModal');
  if (modal) {
    modal.classList.remove('active');
  }
  
  if (whiteboardChannel) {
    whiteboardChannel.unsubscribe();
    whiteboardChannel = null;
  }
  
  if (whiteboardCanvas) {
    whiteboardCanvas.removeEventListener('mousedown', startDrawing);
    whiteboardCanvas.removeEventListener('mousemove', draw);
    whiteboardCanvas.removeEventListener('mouseup', stopDrawing);
    whiteboardCanvas.removeEventListener('mouseleave', stopDrawing);
    whiteboardCanvas.removeEventListener('touchstart', handleTouchStart);
    whiteboardCanvas.removeEventListener('touchmove', handleTouchMove);
    whiteboardCanvas.removeEventListener('touchend', stopDrawing);
  }
}

// Load Whiteboard Session
async function loadWhiteboardSession() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('whiteboard_sessions')
      .select('*')
      .eq('room_id', currentRoom.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.log('No active whiteboard session');
      return;
    }
    
    currentWhiteboardSession = data;
    
    // Load canvas data if exists
    if (data.canvas_data && data.canvas_data.image) {
      const img = new Image();
      img.onload = () => {
        whiteboardCtx.drawImage(img, 0, 0);
      };
      img.src = data.canvas_data.image;
    }
    
    // Subscribe to real-time drawing
    subscribeToWhiteboardUpdates();
  } catch (error) {
    console.error('Error loading whiteboard session:', error);
  }
}

// Subscribe to Whiteboard Updates
function subscribeToWhiteboardUpdates() {
  if (!currentWhiteboardSession) return;
  
  const supabase = getSupabase();
  
  whiteboardChannel = supabase
    .channel(`whiteboard-${currentWhiteboardSession.id}`)
    .on('broadcast', { event: 'draw' }, (payload) => {
      // Draw from other users
      drawRemoteLine(payload.payload);
    })
    .on('broadcast', { event: 'clear' }, () => {
      // Clear from other users
      if (whiteboardCtx) {
        whiteboardCtx.fillStyle = '#1e1e1e';
        whiteboardCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
        whiteboardCtx.globalCompositeOperation = 'source-over';
        whiteboardCtx.strokeStyle = currentColor;
      }
    })
    .subscribe((status) => {
      console.log('Whiteboard realtime status:', status);
    });
  
  console.log('Subscribed to whiteboard updates');
}

// Draw Remote Line
function drawRemoteLine(data) {
  const { x1, y1, x2, y2, color, lineWidth, isEraser } = data;
  
  whiteboardCtx.save();
  
  if (isEraser) {
    whiteboardCtx.globalCompositeOperation = 'destination-out';
    whiteboardCtx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    whiteboardCtx.globalCompositeOperation = 'source-over';
    whiteboardCtx.strokeStyle = color;
  }
  
  whiteboardCtx.lineWidth = lineWidth;
  whiteboardCtx.lineCap = 'round';
  whiteboardCtx.lineJoin = 'round';
  
  whiteboardCtx.beginPath();
  whiteboardCtx.moveTo(x1, y1);
  whiteboardCtx.lineTo(x2, y2);
  whiteboardCtx.stroke();
  
  whiteboardCtx.restore();
}

// Broadcast Drawing
function broadcastDrawing(x1, y1, x2, y2) {
  if (!whiteboardChannel) return;
  
  whiteboardChannel.send({
    type: 'broadcast',
    event: 'draw',
    payload: {
      x1,
      y1,
      x2,
      y2,
      color: currentColor,
      lineWidth: currentLineWidth,
      isEraser: isEraser,
      userId: currentUser.id
    }
  });
}

// Start Drawing
function startDrawing(e) {
  isDrawing = true;
  const rect = whiteboardCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  whiteboardCtx.beginPath();
  whiteboardCtx.moveTo(x, y);
  
  // Store last position
  whiteboardCanvas.lastX = x;
  whiteboardCanvas.lastY = y;
}

// Draw
function draw(e) {
  if (!isDrawing) return;
  
  const rect = whiteboardCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  whiteboardCtx.lineTo(x, y);
  whiteboardCtx.stroke();
  
  // Broadcast to other users
  if (whiteboardCanvas.lastX !== undefined) {
    broadcastDrawing(whiteboardCanvas.lastX, whiteboardCanvas.lastY, x, y);
  }
  
  whiteboardCanvas.lastX = x;
  whiteboardCanvas.lastY = y;
}

// Stop Drawing
function stopDrawing() {
  if (isDrawing) {
    isDrawing = false;
    whiteboardCanvas.lastX = undefined;
    whiteboardCanvas.lastY = undefined;
    saveWhiteboardState();
  }
}

// Touch Handlers
function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  whiteboardCanvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  });
  whiteboardCanvas.dispatchEvent(mouseEvent);
}

// Save Whiteboard State
async function saveWhiteboardState() {
  if (!currentWhiteboardSession) return;
  
  try {
    const supabase = getSupabase();
    const imageData = whiteboardCanvas.toDataURL();
    
    await supabase
      .from('whiteboard_sessions')
      .update({
        canvas_data: { image: imageData }
      })
      .eq('id', currentWhiteboardSession.id);
  } catch (error) {
    console.error('Error saving whiteboard state:', error);
  }
}

// Send Whiteboard Invite
async function sendWhiteboardInvite() {
  if (!currentRoom) {
    showToast('Please select a room first', 'warning');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    // Create or get session
    let session = currentWhiteboardSession;
    
    if (!session) {
      const { data, error } = await supabase
        .from('whiteboard_sessions')
        .insert([{
          room_id: currentRoom.id,
          created_by: currentUser.id,
          is_active: true
        }])
        .select()
        .single();
      
      if (error) throw error;
      session = data;
      currentWhiteboardSession = session;
      
      // Subscribe to updates
      subscribeToWhiteboardUpdates();
    }
    
    // Send system message
    await supabase
      .from('messages')
      .insert([{
        room_id: currentRoom.id,
        user_id: currentUser.id,
        username: 'System',
        content: `${currentUser.username} started a whiteboard session! 🎨 Click the whiteboard button to join.`,
        message_type: 'system'
      }]);
    
    showToast('Whiteboard invite sent!', 'success');
  } catch (error) {
    console.error('Error sending whiteboard invite:', error);
    showToast('Failed to send invite', 'error');
  }
}

// Change Line Width
function changeLineWidth(width) {
  currentLineWidth = parseInt(width);
  whiteboardCtx.lineWidth = currentLineWidth;
}

// Clear Whiteboard
async function clearWhiteboard() {
  if (!confirm('Clear the whiteboard for everyone?')) return;
  
  whiteboardCtx.fillStyle = '#1e1e1e';
  whiteboardCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
  
  // Reset composite operation
  whiteboardCtx.globalCompositeOperation = 'source-over';
  whiteboardCtx.strokeStyle = currentColor;
  
  await saveWhiteboardState();
  
  // Broadcast clear to everyone
  if (whiteboardChannel) {
    whiteboardChannel.send({
      type: 'broadcast',
      event: 'clear',
      payload: { userId: currentUser.id }
    });
  }
  
  showToast('Whiteboard cleared!', 'info');
}

console.log('Whiteboard.js loaded (SAFE VERSION WITH NULL CHECKS)');
