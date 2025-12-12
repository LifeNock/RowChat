// ROWCHAT - ROOMS (POLISHED)

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function loadRooms() {
  try {
    const supabase = getSupabase();
    
    const { data: allRooms, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false});
    
    if (error) throw error;
    
    const rooms = allRooms.filter(room => room.is_dm !== true);
    
    // Sort: Announcements first (📢), then Updates (📰), then others
    rooms.sort((a, b) => {
      // Both announcement rooms
      if (a.is_announcement && b.is_announcement) {
        // Announcements before Updates
        if (a.name.includes('📢') && b.name.includes('📰')) return -1;
        if (a.name.includes('📰') && b.name.includes('📢')) return 1;
        return new Date(a.created_at) - new Date(b.created_at);
      }
      // Only a is announcement
      if (a.is_announcement) return -1;
      // Only b is announcement
      if (b.is_announcement) return 1;
      // Both regular rooms
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
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
    
    // Special styling for announcements
    if (room.is_announcement) {
      roomDiv.style.background = 'linear-gradient(135deg, rgba(88, 101, 242, 0.15) 0%, rgba(88, 101, 242, 0.05) 100%)';
      roomDiv.style.borderLeft = '3px solid var(--accent)';
      roomDiv.style.fontWeight = '600';
    }
    
    // Count online users
    let onlineCount = 0;
    if (room.members && Array.isArray(room.members) && typeof onlineUsers !== 'undefined') {
      room.members.forEach(memberId => {
        if (onlineUsers[memberId]) {
          onlineCount++;
        }
      });
    }
    
    const icon = room.name.includes('📢') ? '📢' : room.name.includes('📰') ? '📰' : room.is_announcement ? '🔒' : '#';
    const lockIcon = room.is_announcement ? '<span class="icon icon-lock" style="font-size: 12px; margin-left: 6px; opacity: 0.6;"></span>' : '';
    
    roomDiv.innerHTML = `
      <div class="room-icon">${icon}</div>
      <div style="flex: 1;">
        <div class="room-name">${escapeHtml(room.name)}${lockIcon}</div>
        ${onlineCount > 0 ? `<div style="font-size: 11px; color: #43b581; margin-top: 2px;">${onlineCount} online</div>` : ''}
      </div>
    `;
    
    roomDiv.onclick = () => selectRoom(room);
    container.appendChild(roomDiv);
  });
}

function selectRoom(room) {
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
  
  // Update header
  const icon = room.name.includes('📢') ? '📢' : room.name.includes('📰') ? '📰' : room.is_announcement ? '🔒' : '#';
  const chatTitle = document.getElementById('chatTitle');
  if (chatTitle) chatTitle.textContent = `${icon} ${room.name}`;
  
  const chatDescription = document.getElementById('chatDescription');
  if (chatDescription) chatDescription.textContent = room.description || '';
  
  // Update online count for this room
  updateCurrentRoomOnlineCount();
  
  // Disable input if announcement room and not admin
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  
  if (room.is_announcement && currentUser.role !== 'admin') {
    if (messageInput) {
      messageInput.disabled = true;
      messageInput.placeholder = '🔒 Only admins can post announcements';
    }
    if (sendBtn) sendBtn.disabled = true;
  } else {
    if (messageInput) {
      messageInput.disabled = false;
      messageInput.placeholder = 'Type a message...';
    }
    if (sendBtn) sendBtn.disabled = false;
  }
  
  // Load messages
  if (typeof loadMessages === 'function') {
    loadMessages(room.id);
  }
  
  // Show delete room button if admin or room master
  if (typeof showDeleteRoomOption === 'function') {
    setTimeout(showDeleteRoomOption, 100);
  }
}

function openCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (modal) modal.classList.add('active');
  
  const nameInput = document.getElementById('roomName');
  const descInput = document.getElementById('roomDescription');
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
}

function closeCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (modal) modal.classList.remove('active');
}

async function createRoom() {
  const name = document.getElementById('roomName').value.trim();
  const description = document.getElementById('roomDescription').value.trim();
  
  if (!name || name.length < 3) {
    showToast('Room name must be at least 3 characters', 'warning');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    const { data: room, error } = await supabase
      .from('rooms')
      .insert([{
        name,
        description,
        is_dm: false,
        created_by: currentUser.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    await supabase.from('room_members').insert([{
      room_id: room.id,
      user_id: currentUser.id,
      role: 'owner'
    }]);
    
    showToast('Room created!', 'success');
    closeCreateRoomModal();
    await loadRooms();
    selectRoom(room);
  } catch (error) {
    console.error('Error creating room:', error);
    showToast('Failed to create room', 'error');
  }
}

console.log('Rooms.js loaded (POLISHED)');
