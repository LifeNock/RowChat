// ============================================
// ROWCHAT - ROOMS (COMPLETE WORKING VERSION)
// ============================================

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Load Rooms
async function loadRooms() {
  try {
    const supabase = getSupabase();
    
    // Get ALL rooms from database
    const { data: allRooms, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log('All rooms from database:', allRooms);
    
    // FILTER OUT DMs - they have patterns like "DM-X-Y" or no description with dashes
    const rooms = allRooms.filter(room => {
      // Check if marked as DM in database
      if (room.is_dm === true) return false;
      
      // Check if name matches DM patterns
      const isDMName = room.name.match(/^DM-\d+-\d+$/) || 
                       room.name.match(/^\d+-\d+-\d+$/) ||
                       room.name.match(/^\d+-\d+$/);
      
      if (isDMName) return false;
      
      // Check if looks like DM (no description + has dash)
      const looksLikeDM = (!room.description || room.description === 'No description') && 
                          room.name.includes('-') && 
                          room.name.split('-').length === 2;
      
      if (looksLikeDM) return false;
      
      return true; // It's a real room!
    });
    
    console.log(`Filtered: ${rooms.length} real rooms (excluded ${allRooms.length - rooms.length} DMs)`);
    
    // Load members for each room
    for (const room of rooms) {
      const { data: members } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', room.id);
      
      room.members = members ? members.map(m => m.user_id) : [];
      roomsCache[room.id] = room;
    }
    
    renderRoomList(rooms);
    console.log('Loaded rooms:', rooms.length);
  } catch (error) {
    console.error('Error loading rooms:', error);
  }
}

// Render Room List
function renderRoomList(rooms) {
  const container = document.getElementById('roomsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (rooms.length === 0) {
    container.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-tertiary);">No rooms yet. Create one!</p>';
    return;
  }
  
  rooms.forEach(room => {
    const roomDiv = document.createElement('div');
    roomDiv.className = 'room-item';
    roomDiv.dataset.roomId = room.id;
    
    // Count online members
    let onlineCount = 0;
    if (room.members && Array.isArray(room.members) && typeof onlineUsers !== 'undefined' && onlineUsers) {
      room.members.forEach(memberId => {
        if (onlineUsers[memberId] && onlineUsers[memberId].is_online) {
          onlineCount++;
        }
      });
    }
    
    console.log(`Room "${room.name}": ${room.members ? room.members.length : 0} total, ${onlineCount} online`);
    
    // Unread count
    const unread = (typeof unreadRooms !== 'undefined') ? (unreadRooms[room.id] || 0) : 0;
    
    // Build HTML
    let html = `
      <div class="room-icon">${room.icon || '📁'}</div>
      <div style="flex: 1;">
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-description">${escapeHtml(room.description || 'No description')}</div>
    `;
    
    if (onlineCount > 0) {
      html += `<div style="display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 11px; color: #43b581;">
        <div style="width: 6px; height: 6px; background: #43b581; border-radius: 50%;"></div>
        ${onlineCount} online
      </div>`;
    }
    
    html += '</div>';
    
    if (unread > 0) {
      html += `<div style="background: #f23f43; color: white; border-radius: 10px; padding: 2px 6px; font-size: 11px; font-weight: 700;">${unread > 99 ? '99+' : unread}</div>`;
    }
    
    roomDiv.innerHTML = html;
    
    // Click handler
    roomDiv.addEventListener('click', function() {
      selectRoom(room);
    });
    
    container.appendChild(roomDiv);
  });
}

// Select Room
function selectRoom(room) {
  console.log('Selecting room:', room.name);
  
  currentRoom = room;
  currentDM = null;
  
  // Clear unread
  if (typeof unreadRooms !== 'undefined') {
    delete unreadRooms[room.id];
    if (typeof updateRoomBadges === 'function') {
      updateRoomBadges();
    }
  }
  
  // Update active state
  document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));
  const selected = document.querySelector(`.room-item[data-room-id="${room.id}"]`);
  if (selected) selected.classList.add('active');
  
  // Show messages section (it's always visible in your HTML)
  const messagesContainer = document.getElementById('messagesContainer');
  if (messagesContainer) {
    messagesContainer.style.display = 'flex';
  }
  
  // Update chat header - THESE ELEMENTS EXIST IN YOUR HTML
  const chatTitle = document.getElementById('chatTitle');
  if (chatTitle) {
    chatTitle.textContent = `${room.icon || '📁'} ${room.name}`;
  }
  
  const chatDescription = document.getElementById('chatDescription');
  if (chatDescription) {
    chatDescription.textContent = room.description || '';
  }
  
  // Update online count in header
  updateRoomOnlineCount(room);
  
  // Load messages
  if (typeof loadMessages === 'function') {
    loadMessages(room.id);
  }
}

// Update Room Online Count (NEW - this was missing!)
function updateRoomOnlineCount(room) {
  const onlineCountEl = document.getElementById('onlineCount');
  if (!onlineCountEl) return;
  
  let onlineCount = 0;
  
  if (room.members && Array.isArray(room.members) && typeof onlineUsers !== 'undefined' && onlineUsers) {
    room.members.forEach(memberId => {
      if (onlineUsers[memberId] && onlineUsers[memberId].is_online) {
        onlineCount++;
      }
    });
  }
  
  onlineCountEl.textContent = `${onlineCount} online`;
  console.log(`Updated online count for ${room.name}: ${onlineCount}`);
}

// Open Create Room Modal
function openCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (!modal) return;
  
  modal.classList.add('active');
  
  const name = document.getElementById('roomName');
  const desc = document.getElementById('roomDescription');
  
  if (name) name.value = '';
  if (desc) desc.value = '';
}

// Close Create Room Modal
function closeCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (modal) modal.classList.remove('active');
}

// Create Room
async function createRoom() {
  const nameInput = document.getElementById('roomName');
  const descInput = document.getElementById('roomDescription');
  
  if (!nameInput) {
    console.error('roomName input not found');
    return;
  }
  
  const name = nameInput.value.trim();
  const description = descInput ? descInput.value.trim() : '';
  
  if (!name) {
    showToast('Please enter a room name', 'warning');
    return;
  }
  
  if (name.length < 3) {
    showToast('Room name must be at least 3 characters', 'warning');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    console.log('Creating room:', { name, description });
    
    // Create room with is_dm = false
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert([{
        name: name,
        description: description,
        icon: '📁',
        is_dm: false,
        created_by: currentUser.id
      }])
      .select()
      .single();
    
    if (roomError) {
      console.error('Room creation error:', roomError);
      showToast('Failed to create room: ' + roomError.message, 'error');
      return;
    }
    
    console.log('Room created:', room);
    
    // Add creator as member
    const { error: memberError } = await supabase
      .from('room_members')
      .insert([{
        room_id: room.id,
        user_id: currentUser.id,
        role: 'owner'
      }]);
    
    if (memberError) {
      console.error('Member add error:', memberError);
      showToast('Room created but failed to join', 'warning');
    } else {
      showToast('Room created!', 'success');
    }
    
    closeCreateRoomModal();
    
    // Reload rooms
    await loadRooms();
    
    // Select the new room
    selectRoom(room);
  } catch (error) {
    console.error('Error creating room:', error);
    showToast('Failed to create room', 'error');
  }
}

// Join Room
async function joinRoom(roomId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('room_members')
      .insert([{
        room_id: roomId,
        user_id: currentUser.id,
        role: 'member'
      }]);
    
    if (error) throw error;
    
    showToast('Joined room!', 'success');
    loadRooms();
  } catch (error) {
    console.error('Error joining room:', error);
    showToast('Failed to join room', 'error');
  }
}

// Leave Room
async function leaveRoom(roomId) {
  if (!confirm('Leave this room?')) return;
  
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', currentUser.id);
    
    if (error) throw error;
    
    showToast('Left room', 'info');
    
    if (currentRoom && currentRoom.id === roomId) {
      currentRoom = null;
      
      const chatTitle = document.getElementById('chatTitle');
      if (chatTitle) chatTitle.textContent = 'Select a room or DM';
      
      const chatDescription = document.getElementById('chatDescription');
      if (chatDescription) chatDescription.textContent = '';
      
      const messagesContainer = document.getElementById('messagesContainer');
      if (messagesContainer) {
        messagesContainer.innerHTML = `
          <div class="welcome-message">
            <div class="welcome-icon">⛵</div>
            <h3>Welcome to RowChat!</h3>
            <p>Select a room or start a conversation to begin chatting.</p>
          </div>
        `;
      }
    }
    
    loadRooms();
  } catch (error) {
    console.error('Error leaving room:', error);
    showToast('Failed to leave room', 'error');
  }
}

// Delete Room
async function deleteRoom(roomId) {
  if (!confirm('Delete this room? This cannot be undone!')) return;
  
  try {
    const supabase = getSupabase();
    
    // Check if user is owner
    const { data: membership } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', currentUser.id)
      .single();
    
    if (membership?.role !== 'owner') {
      showToast('Only room owner can delete rooms', 'error');
      return;
    }
    
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);
    
    if (error) throw error;
    
    showToast('Room deleted', 'info');
    
    if (currentRoom && currentRoom.id === roomId) {
      currentRoom = null;
      
      const chatTitle = document.getElementById('chatTitle');
      if (chatTitle) chatTitle.textContent = 'Select a room or DM';
      
      const messagesContainer = document.getElementById('messagesContainer');
      if (messagesContainer) {
        messagesContainer.innerHTML = `
          <div class="welcome-message">
            <div class="welcome-icon">⛵</div>
            <h3>Welcome to RowChat!</h3>
            <p>Select a room or start a conversation to begin chatting.</p>
          </div>
        `;
      }
    }
    
    loadRooms();
  } catch (error) {
    console.error('Error deleting room:', error);
    showToast('Failed to delete room', 'error');
  }
}

console.log('Rooms.js loaded (COMPLETE WORKING VERSION - MATCHES HTML)');
