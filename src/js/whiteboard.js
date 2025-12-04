// ============================================
// ROWCHAT - COLLABORATIVE WHITEBOARD (FIXED)
// ============================================

let whiteboardCanvas = null;
let whiteboardCtx = null;
let isDrawing = false;
let currentWhiteboardSession = null;

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
  
  // Initialize canvas
  whiteboardCanvas = document.getElementById('whiteboardCanvas');
  whiteboardCtx = whiteboardCanvas.getContext('2d');
  
  // Set up canvas
  whiteboardCtx.strokeStyle = '#ffffff';
  whiteboardCtx.lineWidth = 2;
  whiteboardCtx.lineCap = 'round';
  
  // Add drawing listeners
  whiteboardCanvas.addEventListener('mousedown', startDrawing);
  whiteboardCanvas.addEventListener('mousemove', draw);
  whiteboardCanvas.addEventListener('mouseup', stopDrawing);
  whiteboardCanvas.addEventListener('mouseout', stopDrawing);
  
  // Check if there's an active session
  loadWhiteboardSession();
}

// Close Whiteboard Modal
function closeWhiteboardModal() {
  document.getElementById('whiteboardModal').classList.remove('active');
  
  if (whiteboardCanvas) {
    whiteboardCanvas.removeEventListener('mousedown', startDrawing);
    whiteboardCanvas.removeEventListener('mousemove', draw);
    whiteboardCanvas.removeEventListener('mouseup', stopDrawing);
    whiteboardCanvas.removeEventListener('mouseout', stopDrawing);
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

// Clear Whiteboard
function clearWhiteboard() {
  if (!confirm('Clear the whiteboard?')) return;
  
  whiteboardCtx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
  saveWhiteboardState();
}

console.log('Whiteboard.js loaded (FIXED)');
