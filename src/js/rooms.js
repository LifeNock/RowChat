// ROWCHAT - ROOMS (REVAMPED)

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function loadRooms() {
  try {
    const supabase = getSupabase();
    
    // Get all rooms
    const { data: allRooms, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Filter out DMs
    const rooms = allRooms.filter(room => room.is_dm !== true);
    
    // Load members and filter based on privacy
    const visibleRooms = [];
    
    for (const room of rooms) {
      // Load members for this room
      const { data: members } = await supabase
        .from('room_members')
        .select('user_id, role')
        .eq('room_id', room.id);
      
      room.members = members ? members.map(m => m.user_id) : [];
      room.memberData = members || [];
      
      // Check if user can see this room based on privacy
      const canSee = await canUserSeeRoom(room);
      
      if (canSee) {
        visibleRooms.push(room);
        roomsCache[room.id] = room;
      }
    }
    
    // Sort: Announcements first, then by creation date
    visibleRooms.sort((a, b) => {
      if (a.is_announcement && !b.is_announcement) return -1;
      if (!a.is_announcement && b.is_announcement) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    renderRoomList(visibleRooms);
    
    // Update online counts every second
    if (!window.roomOnlineUpdateInterval) {
      window.roomOnlineUpdateInterval = setInterval(updateAllRoomOnlineCounts, 1000);
    }
  } catch (error) {
    console.error('Error loading rooms:', error);
  }
}

function updateAllRoomOnlineCounts() {
  const roomItems = document.querySelectorAll('.room-item');
  
  roomItems.forEach(roomDiv => {
    const roomId = roomDiv.dataset.roomId;
    const room = roomsCache[roomId];
    
    if (!room) return;
    
    const onlineCount = countOnlineMembers(room);
    const metaDiv = roomDiv.querySelector('.room-item-meta');
    
    if (metaDiv) {
      if (onlineCount > 0) {
        metaDiv.innerHTML = `<span class="room-online-count">${onlineCount} online</span>`;
      } else {
        metaDiv.innerHTML = '<span class="room-offline-text">No one online</span>';
      }
    }
  });
}

async function canUserSeeRoom(room) {
  // Public rooms - everyone can see
  if (room.privacy === 'public' || !room.privacy) {
    return true;
  }
  
  // User is member - can see
  if (room.members.includes(currentUser.id)) {
    return true;
  }
  
  // Admins can see everything
  if (currentUser.role === 'admin') {
    return true;
  }
  
  // Friends only - check if user is friends with room creator
  if (room.privacy === 'friends_only') {
    try {
      const supabase = getSupabase();
      
      const { data: friendship } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${room.created_by}),and(user_id.eq.${room.created_by},friend_id.eq.${currentUser.id})`)
        .eq('status', 'accepted')
        .single();
      
      return !!friendship;
    } catch {
      return false;
    }
  }
  
  // Invite only / Private - must be member
  return false;
}

function renderRoomList(rooms) {
  const container = document.getElementById('roomsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (rooms.length === 0) {
    container.innerHTML = `
      <div class="empty-rooms-state">
        <div class="empty-rooms-icon">#</div>
        <div class="empty-rooms-text">No rooms yet</div>
        <div class="empty-rooms-subtext">Create one to get started!</div>
      </div>
    `;
    return;
  }
  
  rooms.forEach((room, index) => {
    const roomDiv = document.createElement('div');
    roomDiv.className = 'room-item';
    roomDiv.dataset.roomId = room.id;
    roomDiv.style.animationDelay = `${index * 0.05}s`;
    
    // Get room icon
    const icon = getRoomIcon(room);
    
    // Count online members
    const onlineCount = countOnlineMembers(room);
    
    // Check if user is member
    const isMember = room.members.includes(currentUser.id);
    
    // Get privacy indicator
    const privacyIcon = getPrivacyIcon(room);
    
    roomDiv.innerHTML = `
      <div class="room-item-icon">${icon}</div>
      <div class="room-item-content">
        <div class="room-item-header">
          <span class="room-item-name">${escapeHtml(cleanRoomName(room.name))}</span>
          ${privacyIcon}
        </div>
        <div class="room-item-meta">
          ${onlineCount > 0 ? `<span class="room-online-count">${onlineCount} online</span>` : '<span class="room-offline-text">No one online</span>'}
        </div>
      </div>
    `;
    
    // Special styling for announcement rooms
    if (room.is_announcement) {
      roomDiv.classList.add('room-announcement');
    }
    
    // Disabled styling if not member of private room
    if (!isMember && room.privacy !== 'public') {
      roomDiv.classList.add('room-locked');
    }
    
    roomDiv.onclick = () => selectRoom(room);
    container.appendChild(roomDiv);
  });
}

function getRoomIcon(room) {
  // Check for emojis in name first
  if (room.name.includes('📢')) return '📢';
  if (room.name.includes('📰')) return '📰';
  if (room.name.includes('📣')) return '📣';
  
  // Then check properties
  if (room.is_announcement) return '📣';
  if (room.privacy === 'private') return '🔒';
  if (room.privacy === 'invite_only') return '🔐';
  if (room.privacy === 'friends_only') return '👥';
  return '#';
}

function cleanRoomName(name) {
  // Remove emojis from room name for display
  return name.replace(/📢|📰|📣|🔒|🔐|👥|#/g, '').trim();
}

function getPrivacyIcon(room) {
  if (room.is_announcement) {
    return '<span class="room-privacy-badge announcement">ANNOUNCEMENT</span>';
  }
  
  if (room.privacy === 'private') {
    return '<span class="room-privacy-badge private">PRIVATE</span>';
  }
  
  if (room.privacy === 'invite_only') {
    return '<span class="room-privacy-badge invite">INVITE ONLY</span>';
  }
  
  if (room.privacy === 'friends_only') {
    return '<span class="room-privacy-badge friends">FRIENDS</span>';
  }
  
  return '';
}

function countOnlineMembers(room) {
  if (!room.members || !Array.isArray(room.members)) return 0;
  if (typeof onlineUsers === 'undefined') return 0;
  
  let count = 0;
  room.members.forEach(memberId => {
    if (onlineUsers[memberId]) {
      count++;
    }
  });
  
  return count;
}

function selectRoom(room) {
  // Check if user can access this room
  const isMember = room.members.includes(currentUser.id);
  const isAdmin = currentUser.role === 'admin';
  
  if (!isMember && !isAdmin && room.privacy !== 'public') {
    showToast('You do not have access to this room', 'error');
    return;
  }
  
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
  const icon = getRoomIcon(room);
  const chatTitle = document.getElementById('chatTitle');
  if (chatTitle) chatTitle.textContent = `${icon} ${cleanRoomName(room.name)}`;
  
  const chatDescription = document.getElementById('chatDescription');
  if (chatDescription) chatDescription.textContent = room.description || '';
  
  // Update online count for this room
  if (typeof updateCurrentRoomOnlineCount === 'function') {
    updateCurrentRoomOnlineCount();
  }
  
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
        privacy: 'public',
        created_by: currentUser.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Add creator as owner
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

console.log('Rooms.js loaded (REVAMPED)');
