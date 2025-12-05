// ============================================
// ROWCHAT - COLLABORATIVE WHITEBOARD (WORKING)
// ============================================

let whiteboardCanvas = null;
let whiteboardCtx = null;
let isDrawing = false;
let currentWhiteboardSession = null;
let currentColor = '#ffffff';
let currentLineWidth = 3;

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Open Whiteboard Modal
function openWhiteboardModal() {
  if (!currentRoom) {
    showToast('Please select a room first', 'warning');
    return;
  }
  
  const modal = document.getElementById('whiteboardModal');
  modal.classList.add('active');
  
  // Wait for modal to be visible
  setTimeout(() => {
    initializeCanvas();
    loadWhiteboardSession();
  }, 100);
}

// Initialize Canvas
function initializeCanvas() {
  whiteboardCanvas = document.getElementById('whiteboardCanvas');
  if (!whiteboardCanvas) {
    console.error('Canvas element not found');
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
  
  console.log('Canvas initialized successfully');
}

// Close Whiteboard Modal
function closeWhiteboardModal() {
  document.getElementById('whiteboardModal').classList.remove('active');
  
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
  } catch (error) {
    console.error('Error loading whiteboard session:', error);
  }
}

// Start Drawing
function startDrawing(e) {
  isDrawing = true;
  const rect = whiteboardCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  whiteboardCtx.beginPath();
  whiteboardCtx.moveTo(x, y);
}

// Draw
function draw(e) {
  if (!isDrawing) return;
  
  const rect = whiteboardCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  whiteboardCtx.lineTo(x, y);
  whiteboardCtx.stroke();
}

// Stop Drawing
function stopDrawing() {
  if (isDrawing) {
    isDrawing = false;
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

// Change Color
function changeWhiteboardColor(color) {
  currentColor = color;
  whiteboardCtx.strokeStyle = color;
}

// Change Line Width
function changeLineWidth(width) {
  currentLineWidth = width;
  whiteboardCtx.lineWidth = width;
}

// Clear Whiteboard
function clearWhiteboard() {
  if (!confirm('Clear the whiteboard?')) return;
  
  whiteboardCtx.fillStyle = '#1e1e1e';
  whiteboardCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
  whiteboardCtx.fillStyle = currentColor;
  saveWhiteboardState();
}

console.log('Whiteboard.js loaded (WORKING VERSION)');
