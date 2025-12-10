// ============================================
// ROWCHAT - ROOMS (WITH ONLINE INDICATORS - FIXED)
// ============================================

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Load Rooms
async function loadRooms() {
  try {
    const supabase = getSupabase();
    
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
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
  if (!container) {
    console.error('roomsList element not found');
    return;
  }
  
  container.innerHTML = '';
  
  if (rooms.length === 0) {
    container.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-tertiary); font-size: 13px;">No rooms yet. Create one!</p>';
    return;
  }
  
  rooms.forEach(room => {
    const roomItem = document.createElement('div');
    roomItem.className = 'room-item';
    roomItem.dataset.roomId = room.id;
    
    // Count online members
    let onlineCount = 0;
    if (room.members) {
      room.members.forEach(memberId => {
        if (onlineUsers[memberId]) {
          onlineCount++;
        }
      });
    }
    
    // Check for unread messages
    const unreadCount = unreadRooms[room.id] || 0;
    
    roomItem.innerHTML = `
      <div class="room-icon">${room.icon || '📁'}</div>
      <div style="flex: 1;">
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-description">${escapeHtml(room.description || 'No description')}</div>
        ${onlineCount > 0 ? `
          <div class="room-online-indicator" style="
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
            font-size: 11px;
            color: var(--success, #43b581);
          ">
            <div style="
              width: 6px;
              height: 6px;
              background: var(--success, #43b581);
              border-radius: 50%;
            "></div>
            ${onlineCount} online
          </div>
        ` : ''}
      </div>
      ${unreadCount > 0 ? `
        <div class="unread-badge" style="
          background: #f23f43;
          color: white;
          border-radius: 10px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 700;
          min-width: 18px;
          text-align: center;
        ">${unreadCount > 99 ? '99+' : unreadCount}</div>
      ` : ''}
    `;
    
    roomItem.onclick = () => selectRoom(room);
    container.appendChild(roomItem);
  });
}

// Select Room
function selectRoom(room) {
  currentRoom = room;
  currentDM = null;
  
  console.log('Selecting room:', room.name);
  
  // Clear unread for this room
  if (typeof unreadRooms !== 'undefined') {
    delete unreadRooms[room.id];
    if (typeof updateRoomBadges === 'function') {
      updateRoomBadges();
    }
  }
  
  // Update UI
  document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));
  const selectedRoom = document.querySelector(`.room-item[data-room-id="${room.id}"]`);
  if (selectedRoom) {
    selectedRoom.classList.add('active');
  }
  
  // Show chat section
  const chatSection = document.getElementById('chatSection');
  if (chatSection) {
    chatSection.style.display = 'flex';
  } else {
    console.error('chatSection element not found');
  }
  
  // Update room header
  const roomHeader = document.getElementById('roomHeader');
  if (roomHeader) {
    roomHeader.textContent = `${room.icon || '📁'} ${room.name}`;
  } else {
    console.error('roomHeader element not found');
  }
  
  // Load messages
  if (typeof loadMessages === 'function') {
    loadMessages(room.id);
  }
  
  // Load room members
  loadRoomMembers(room.id);
}

// Load Room Members
async function loadRoomMembers(roomId) {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId);
    
    if (error) throw error;
    
    const membersContainer = document.getElementById('roomMembers');
    if (!membersContainer) {
      console.log('roomMembers container not found, skipping member list');
      return;
    }
    
    membersContainer.innerHTML = '';
    
    data.forEach(member => {
      const user = getUser(member.user_id);
      const isOnline = onlineUsers[member.user_id] && onlineUsers[member.user_id].is_online;
      
      const memberDiv = document.createElement('div');
      memberDiv.className = 'member-item';
      memberDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 6px; cursor: pointer;';
      
      memberDiv.innerHTML = `
        <div style="position: relative;">
          <div class="dm-avatar" style="width: 32px; height: 32px; font-size: 14px;">
            ${user.avatar_url ? `<img src="${user.avatar_url}">` : user.username.charAt(0).toUpperCase()}
          </div>
          ${isOnline ? `
            <div style="
              position: absolute;
              bottom: -2px;
              right: -2px;
              width: 12px;
              height: 12px;
              background: var(--success, #43b581);
              border: 2px solid var(--bg-secondary, #2b2b2b);
              border-radius: 50%;
            "></div>
          ` : ''}
        </div>
        <span style="color: var(--text-primary); font-size: 14px;">${escapeHtml(user.username)}</span>
      `;
      
      memberDiv.onclick = () => {
        if (typeof createDM === 'function') {
          createDM(member.user_id);
        }
      };
      
      membersContainer.appendChild(memberDiv);
    });
  } catch (error) {
    console.error('Error loading room members:', error);
  }
}

// Open Create Room Modal
function openCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (!modal) {
    console.error('createRoomModal not found');
    return;
  }
  
  modal.classList.add('active');
  
  const nameInput = document.getElementById('roomNameInput');
  const descInput = document.getElementById('roomDescInput');
  const iconInput = document.getElementById('roomIconInput');
  
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  if (iconInput) iconInput.value = '📁';
}

// Close Create Room Modal
function closeCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Create Room
async function createRoom() {
  const nameInput = document.getElementById('roomNameInput');
  const descInput = document.getElementById('roomDescInput');
  const iconInput = document.getElementById('roomIconInput');
  
  if (!nameInput || !descInput || !iconInput) {
    console.error('Room input elements not found');
    return;
  }
  
  const name = nameInput.value.trim();
  const description = descInput.value.trim();
  const icon = iconInput.value.trim() || '📁';
  
  if (!name) {
    showToast('Please enter a room name', 'warning');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert([{
        name: name,
        description: description,
        icon: icon,
        created_by: currentUser.id
      }])
      .select()
      .single();
    
    if (roomError) throw roomError;
    
    // Add creator as member
    const { error: memberError } = await supabase
      .from('room_members')
      .insert([{
        room_id: room.id,
        user_id: currentUser.id
      }]);
    
    if (memberError) throw memberError;
    
    showToast('Room created!', 'success');
    closeCreateRoomModal();
    loadRooms();
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
        user_id: currentUser.id
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
      const chatSection = document.getElementById('chatSection');
      if (chatSection) {
        chatSection.style.display = 'none';
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
    
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId)
      .eq('created_by', currentUser.id);
    
    if (error) throw error;
    
    showToast('Room deleted', 'info');
    
    if (currentRoom && currentRoom.id === roomId) {
      currentRoom = null;
      const chatSection = document.getElementById('chatSection');
      if (chatSection) {
        chatSection.style.display = 'none';
      }
    }
    
    loadRooms();
  } catch (error) {
    console.error('Error deleting room:', error);
    showToast('Failed to delete room', 'error');
  }
}

console.log('Rooms.js loaded (WITH ONLINE INDICATORS - FIXED NULL CHECKS)');
