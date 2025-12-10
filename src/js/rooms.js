// ROWCHAT - ROOMS

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function loadRooms() {
  try {
    const supabase = getSupabase();
    
    const { data: allRooms, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    console.log('All rooms from database:', allRooms);
    
    const rooms = allRooms.filter(room => {
      if (room.is_dm === true) return false;
      
      const isDMName = room.name.match(/^DM-\d+-\d+$/) || 
                       room.name.match(/^\d+-\d+-\d+$/) ||
                       room.name.match(/^\d+-\d+$/);
      
      if (isDMName) return false;
      
      const looksLikeDM = (!room.description || room.description === 'No description') && 
                          room.name.includes('-') && 
                          room.name.split('-').length === 2;
      
      if (looksLikeDM) return false;
      
      return true;
    });
    
    console.log(`Filtered: ${rooms.length} real rooms`);
    
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
    
    let onlineCount = 0;
    if (room.members && Array.isArray(room.members) && typeof onlineUsers !== 'undefined' && onlineUsers) {
      room.members.forEach(memberId => {
        if (onlineUsers[memberId] && onlineUsers[memberId].is_online) {
          onlineCount++;
        }
      });
    }
    
    const unread = (typeof unreadRooms !== 'undefined') ? (unreadRooms[room.id] || 0) : 0;
    
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
    
    roomDiv.addEventListener('click', function() {
      selectRoom(room);
    });
    
    container.appendChild(roomDiv);
  });
}

function selectRoom(room) {
  console.log('Selecting room:', room.name);
  
  currentRoom = room;
  currentDM = null;
  
  if (typeof unreadRooms !== 'undefined') {
    delete unreadRooms[room.id];
    if (typeof updateRoomBadges === 'function') {
      updateRoomBadges();
    }
  }
  
  document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));
  const selected = document.querySelector(`.room-item[data-room-id="${room.id}"]`);
  if (selected) selected.classList.add('active');
  
  const messagesContainer = document.getElementById('messagesContainer');
  if (messagesContainer) {
    messagesContainer.style.display = 'flex';
  }
  
  const chatTitle = document.getElementById('chatTitle');
  if (chatTitle) {
    chatTitle.textContent = `${room.icon || '📁'} ${room.name}`;
  }
  
  const chatDescription = document.getElementById('chatDescription');
  if (chatDescription) {
    chatDescription.textContent = room.description || '';
  }
  
  updateRoomOnlineCount(room);
  
  if (typeof loadMessages === 'function') {
    loadMessages(room.id);
  } else {
    console.error('loadMessages function not found');
  }
}

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
}

function openCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (!modal) return;
  
  modal.classList.add('active');
  
  const name = document.getElementById('roomName');
  const desc = document.getElementById('roomDescription');
  
  if (name) name.value = '';
  if (desc) desc.value = '';
}

function closeCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (modal) modal.classList.remove('active');
}

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
    
    await loadRooms();
    
    selectRoom(room);
  } catch (error) {
    console.error('Error creating room:', error);
    showToast('Failed to create room', 'error');
  }
}

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

async function deleteRoom(roomId) {
  if (!confirm('Delete this room? This cannot be undone!')) return;
  
  try {
    const supabase = getSupabase();
    
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

console.log('Rooms.js loaded');
