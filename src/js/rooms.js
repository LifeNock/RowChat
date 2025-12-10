// ============================================
// ROWCHAT - ROOMS (SIMPLE WORKING VERSION)
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

// Render Room List - SIMPLE VERSION THAT WORKS
function renderRoomList(rooms) {
  const container = document.getElementById('roomsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (rooms.length === 0) {
    container.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-tertiary);">No rooms yet</p>';
    return;
  }
  
  rooms.forEach(room => {
    const roomDiv = document.createElement('div');
    roomDiv.className = 'room-item';
    roomDiv.dataset.roomId = room.id;
    
    // Count online
    let onlineCount = 0;
    if (room.members && typeof onlineUsers !== 'undefined') {
      room.members.forEach(mid => {
        if (onlineUsers[mid]) onlineCount++;
      });
    }
    
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
    
    // Click handler - use function scope
    roomDiv.addEventListener('click', function() {
      selectRoom(room);
    });
    
    container.appendChild(roomDiv);
  });
}

// Select Room - SIMPLIFIED
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
  
  // Update active class
  document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));
  const selected = document.querySelector(`.room-item[data-room-id="${room.id}"]`);
  if (selected) selected.classList.add('active');
  
  // Show chat
  const chat = document.getElementById('chatSection');
  if (chat) chat.style.display = 'flex';
  
  // Update header
  const header = document.getElementById('roomHeader');
  if (header) header.textContent = `${room.icon || '📁'} ${room.name}`;
  
  // Load messages
  if (typeof loadMessages === 'function') {
    loadMessages(room.id);
  }
  
  // Load members
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
    
    const container = document.getElementById('roomMembers');
    if (!container) return;
    
    container.innerHTML = '';
    
    data.forEach(member => {
      const user = getUser(member.user_id);
      const online = typeof onlineUsers !== 'undefined' && onlineUsers[member.user_id];
      
      const div = document.createElement('div');
      div.className = 'member-item';
      
      div.innerHTML = `
        <div style="position: relative;">
          <div class="dm-avatar" style="width: 32px; height: 32px;">
            ${user.avatar_url ? `<img src="${user.avatar_url}">` : user.username.charAt(0).toUpperCase()}
          </div>
          ${online ? `<div style="position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; background: #43b581; border: 2px solid var(--bg-secondary); border-radius: 50%;"></div>` : ''}
        </div>
        <span>${escapeHtml(user.username)}</span>
      `;
      
      div.onclick = () => {
        if (typeof createDM === 'function') createDM(member.user_id);
      };
      
      container.appendChild(div);
    });
  } catch (error) {
    console.error('Error loading members:', error);
  }
}

// Open Create Room Modal
function openCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (!modal) return;
  
  modal.classList.add('active');
  
  const name = document.getElementById('roomNameInput');
  const desc = document.getElementById('roomDescInput');
  const icon = document.getElementById('roomIconInput');
  
  if (name) name.value = '';
  if (desc) desc.value = '';
  if (icon) icon.value = '📁';
}

// Close Create Room Modal
function closeCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (modal) modal.classList.remove('active');
}

// Create Room
async function createRoom() {
  const nameInput = document.getElementById('roomNameInput');
  const descInput = document.getElementById('roomDescInput');
  const iconInput = document.getElementById('roomIconInput');
  
  if (!nameInput) return;
  
  const name = nameInput.value.trim();
  const description = descInput ? descInput.value.trim() : '';
  const icon = iconInput ? iconInput.value.trim() : '📁';
  
  if (!name) {
    showToast('Enter a room name', 'warning');
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
      const chat = document.getElementById('chatSection');
      if (chat) chat.style.display = 'none';
    }
    
    loadRooms();
  } catch (error) {
    console.error('Error leaving room:', error);
    showToast('Failed to leave room', 'error');
  }
}

// Delete Room
async function deleteRoom(roomId) {
  if (!confirm('Delete this room? Cannot be undone!')) return;
  
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
      const chat = document.getElementById('chatSection');
      if (chat) chat.style.display = 'none';
    }
    
    loadRooms();
  } catch (error) {
    console.error('Error deleting room:', error);
    showToast('Failed to delete room', 'error');
  }
}

console.log('Rooms.js loaded (SIMPLE WORKING VERSION)');
