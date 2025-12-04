// ============================================
// ROWCHAT - ROOMS
// ============================================

// Load Rooms
async function loadRooms() {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_dm', false)
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    // Cache rooms
    data.forEach(room => {
      roomsCache[room.id] = room;
    });
    
    // Get user's room memberships
    const { data: memberships } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', currentUser.id);
    
    const memberRoomIds = new Set(memberships?.map(m => m.room_id) || []);
    
    // Render rooms list
    const roomsList = document.getElementById('roomsList');
    roomsList.innerHTML = '';
    
    if (data.length === 0) {
      roomsList.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-tertiary); font-size: 13px;">No rooms yet</p>';
      return;
    }
    
    data.forEach(room => {
      const isMember = memberRoomIds.has(room.id);
      
      const roomItem = document.createElement('div');
      roomItem.className = 'room-item';
      if (currentRoom && currentRoom.id === room.id) {
        roomItem.classList.add('active');
      }
      
      roomItem.innerHTML = `
        <div class="room-icon">#</div>
        <span class="room-name">${escapeHtml(room.name)}</span>
      `;
      
      roomItem.onclick = () => {
        if (isMember) {
          openRoom(room);
        } else {
          joinRoom(room.id);
        }
      };
      
      roomsList.appendChild(roomItem);
    });
    
    console.log('Loaded rooms:', data.length);
  } catch (error) {
    console.error('Error loading rooms:', error);
  }
}

// Open Room
async function openRoom(room) {
  currentRoom = room;
  currentDM = null;
  
  // Update UI
  document.querySelectorAll('.room-item').forEach(item => item.classList.remove('active'));
  event.target.closest('.room-item')?.classList.add('active');
  
  document.getElementById('chatTitle').textContent = '# ' + room.name;
  document.getElementById('chatDescription').textContent = room.description || '';
  
  // Load messages
  await loadMessages(room.id);
  
  // Load online users count
  updateOnlineUsersInRoom(room.id);
}

// Update Online Users in Room
async function updateOnlineUsersInRoom(roomId) {
  try {
    const { data } = await supabase
      .from('presence')
      .select('user_id')
      .eq('is_online', true);
    
    const count = data?.length || 0;
    document.getElementById('onlineCount').textContent = `${count} online`;
  } catch (error) {
    console.error('Error getting online count:', error);
  }
}

// Join Room
async function joinRoom(roomId) {
  try {
    const { error } = await supabase
      .from('room_members')
      .insert([{
        room_id: roomId,
        user_id: currentUser.id,
        role: 'member'
      }]);
    
    if (error) throw error;
    
    showToast('Joined room!', 'success');
    
    // Open the room
    const room = roomsCache[roomId];
    if (room) openRoom(room);
    
    // Reload rooms to update UI
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
    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', currentUser.id);
    
    if (error) throw error;
    
    showToast('Left room', 'success');
    
    if (currentRoom && currentRoom.id === roomId) {
      currentRoom = null;
      document.getElementById('messagesContainer').innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">⛵</div>
          <h3>Select a room</h3>
          <p>Choose a room from the sidebar to start chatting.</p>
        </div>
      `;
    }
    
    loadRooms();
  } catch (error) {
    console.error('Error leaving room:', error);
    showToast('Failed to leave room', 'error');
  }
}

// Open Create Room Modal
function openCreateRoomModal() {
  document.getElementById('roomName').value = '';
  document.getElementById('roomDescription').value = '';
  document.getElementById('createRoomModal').classList.add('active');
}

// Close Create Room Modal
function closeCreateRoomModal() {
  document.getElementById('createRoomModal').classList.remove('active');
}

// Create Room
async function createRoom() {
  const name = document.getElementById('roomName').value.trim();
  const description = document.getElementById('roomDescription').value.trim();
  
  if (!name) {
    showToast('Please enter a room name', 'warning');
    return;
  }
  
  if (name.length < 3) {
    showToast('Room name must be at least 3 characters', 'warning');
    return;
  }
  
  try {
    // Create room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert([{
        name: name,
        description: description,
        is_dm: false,
        created_by: currentUser.id
      }])
      .select()
      .single();
    
    if (roomError) throw roomError;
    
    // Auto-join creator
    const { error: memberError } = await supabase
      .from('room_members')
      .insert([{
        room_id: room.id,
        user_id: currentUser.id,
        role: 'owner'
      }]);
    
    if (memberError) throw memberError;
    
    showToast('Room created!', 'success');
    closeCreateRoomModal();
    
    // Reload rooms and open the new room
    await loadRooms();
    openRoom(room);
  } catch (error) {
    console.error('Error creating room:', error);
    showToast('Failed to create room', 'error');
  }
}

// Delete Room (owner only)
async function deleteRoom(roomId) {
  if (!confirm('Delete this room? This cannot be undone!')) return;
  
  try {
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
    
    showToast('Room deleted', 'success');
    
    if (currentRoom && currentRoom.id === roomId) {
      currentRoom = null;
      document.getElementById('messagesContainer').innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">⛵</div>
          <h3>Select a room</h3>
          <p>Choose a room from the sidebar to start chatting.</p>
        </div>
      `;
    }
    
    loadRooms();
  } catch (error) {
    console.error('Error deleting room:', error);
    showToast('Failed to delete room', 'error');
  }
}

// Get Room Members
async function getRoomMembers(roomId) {
  try {
    const { data, error } = await supabase
      .from('room_members')
      .select(`
        *,
        users (*)
      `)
      .eq('room_id', roomId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting room members:', error);
    return [];
  }
}

console.log('Rooms.js loaded');
