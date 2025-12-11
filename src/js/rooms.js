// ROWCHAT - ROOMS (FIXED - NO ICON FIELD)

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
    
    const rooms = allRooms.filter(room => room.is_dm !== true);
    
    // Sort: announcements first, then by created_at
    rooms.sort((a, b) => {
      if (a.is_announcement && !b.is_announcement) return -1;
      if (!a.is_announcement && b.is_announcement) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
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
    
    let onlineCount = 0;
    if (room.members && typeof onlineUsers !== 'undefined') {
      room.members.forEach(memberId => {
        if (onlineUsers[memberId]?.is_online) {
          onlineCount++;
        }
      });
    }
    
    const icon = room.is_announcement ? '📢' : '#';
    const lockIcon = room.is_announcement ? '<i data-lucide="lock" style="width: 14px; height: 14px; margin-left: 6px; opacity: 0.6;"></i>' : '';
    
    roomDiv.innerHTML = `
      <div class="room-icon">${icon}</div>
      <div style="flex: 1;">
        <div class="room-name">${escapeHtml(room.name)}${lockIcon}</div>
        ${onlineCount > 0 ? `<div style="font-size: 11px; color: var(--success); margin-top: 2px;">${onlineCount} online</div>` : ''}
      </div>
    `;
    
    roomDiv.onclick = () => selectRoom(room);
    container.appendChild(roomDiv);
  });
  
  // Re-initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function selectRoom(room) {
  currentRoom = room;
  currentDM = null;
  
  document.querySelectorAll('.room-item').forEach(r => r.classList.remove('active'));
  document.querySelector(`.room-item[data-room-id="${room.id}"]`)?.classList.add('active');
  
  const icon = room.is_announcement ? '📢' : '#';
  document.getElementById('chatTitle').textContent = `${icon} ${room.name}`;
  document.getElementById('chatDescription').textContent = room.description || '';
  
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
  
  if (typeof loadMessages === 'function') {
    loadMessages(room.id);
  }
}

function openCreateRoomModal() {
  document.getElementById('createRoomModal')?.classList.add('active');
  document.getElementById('roomName').value = '';
  document.getElementById('roomDescription').value = '';
}

function closeCreateRoomModal() {
  document.getElementById('createRoomModal')?.classList.remove('active');
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

console.log('Rooms.js loaded (FIXED)');
