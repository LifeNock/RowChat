// ADMIN FEATURES - Room Management, DMs Viewing, Message Deletion

let selectedInvitedUsers = [];

// ==================== ADMIN: VIEW ALL DMS ====================

async function loadAdminDMs() {
  if (currentUser.role !== 'admin') return;
  
  try {
    const supabase = getSupabase();
    
    // Get all DM rooms
    const { data: dms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_dm', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return dms || [];
  } catch (error) {
    console.error('Error loading admin DMs:', error);
    return [];
  }
}

function toggleAdminDMs() {
  const list = document.getElementById('adminDmsList');
  if (!list) return;
  
  if (list.classList.contains('expanded')) {
    list.classList.remove('expanded');
    list.innerHTML = '';
  } else {
    list.classList.add('expanded');
    renderAdminDMs();
  }
}

async function renderAdminDMs() {
  const list = document.getElementById('adminDmsList');
  if (!list) return;
  
  list.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-secondary);">Loading...</div>';
  
  const dms = await loadAdminDMs();
  
  list.innerHTML = '';
  
  if (dms.length === 0) {
    list.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-secondary);">No DMs found</div>';
    return;
  }
  
  dms.forEach(dm => {
    const dmDiv = document.createElement('div');
    dmDiv.className = 'admin-dm-item';
    
    // Get participant names
    const participants = dm.name || 'Unknown DM';
    dmDiv.textContent = `💬 ${participants}`;
    
    dmDiv.onclick = () => {
      currentDM = dm;
      currentRoom = null;
      selectRoom(dm);
      toggleAdminDMs(); // Close dropdown
    };
    
    list.appendChild(dmDiv);
  });
}

// ==================== ADMIN: DELETE ANY MESSAGE ====================

function addAdminDeleteButton(messageElement, messageId, messageUserId) {
  // Only add if user is admin and message isn't theirs
  if (currentUser.role !== 'admin') return;
  if (messageUserId === currentUser.id) return; // Already has edit/delete
  
  const actions = messageElement.querySelector('[style*="position: absolute"]');
  if (!actions) return;
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'admin-delete-msg';
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Admin: Delete Message';
  deleteBtn.onclick = () => adminDeleteMessage(messageId);
  
  actions.appendChild(deleteBtn);
}

async function adminDeleteMessage(messageId) {
  if (!confirm('Are you sure you want to delete this message?')) return;
  
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    
    if (error) throw error;
    
    // Remove from UI
    const msgEl = document.getElementById(`msg-${messageId}`);
    if (msgEl) msgEl.remove();
    
    showToast('Message deleted', 'success');
  } catch (error) {
    console.error('Error deleting message:', error);
    showToast('Failed to delete message', 'error');
  }
}

// ==================== ROOM MASTER BADGE ====================

function getRoomMasterBadge(userId, room) {
  if (!room) return '';
  if (room.room_master_id === userId || room.created_by === userId) {
    return '<span class="room-master-badge">ROOM MASTER</span>';
  }
  return '';
}

// ==================== ENHANCED CREATE ROOM ====================

function openCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (!modal) return;
  
  modal.classList.add('active');
  
  // Reset form
  document.getElementById('roomName').value = '';
  document.getElementById('roomDescription').value = '';
  document.getElementById('roomType').value = 'general';
  document.getElementById('roomPrivacy').value = 'public';
  
  selectedInvitedUsers = [];
  updatePrivacyInfo();
}

function closeCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (modal) modal.classList.remove('active');
  
  selectedInvitedUsers = [];
}

function updatePrivacyInfo() {
  const privacy = document.getElementById('roomPrivacy').value;
  const info = document.getElementById('privacyInfo');
  const inviteSection = document.getElementById('inviteUsersSection');
  
  const messages = {
    'public': '<strong>Public rooms</strong> are visible to everyone and anyone can join.',
    'friends_only': '<strong>Friends Only</strong> rooms are only visible to your friends.',
    'invite_only': '<strong>Invite Only</strong> rooms require an invitation to join.',
    'private': '<strong>Private rooms</strong> are completely hidden from non-members.'
  };
  
  if (info) info.innerHTML = messages[privacy];
  
  // Show invite section for invite_only
  if (inviteSection) {
    inviteSection.style.display = privacy === 'invite_only' ? 'block' : 'none';
  }
}

async function searchUsersToInvite() {
  const search = document.getElementById('inviteSearch').value.toLowerCase();
  const list = document.getElementById('inviteUsersList');
  
  if (!search || search.length < 2) {
    list.innerHTML = '';
    return;
  }
  
  // Get all users matching search
  const matchingUsers = Object.values(usersCache).filter(user => 
    user.username.toLowerCase().includes(search) && 
    user.id !== currentUser.id &&
    !selectedInvitedUsers.includes(user.id)
  );
  
  list.innerHTML = '';
  
  matchingUsers.slice(0, 10).forEach(user => {
    const userDiv = document.createElement('div');
    userDiv.className = 'invite-user-item';
    
    const avatar = document.createElement('div');
    avatar.className = 'invite-user-avatar';
    if (user.avatar_url) {
      avatar.innerHTML = `<img src="${user.avatar_url}">`;
    } else {
      avatar.textContent = user.username.charAt(0).toUpperCase();
    }
    
    const name = document.createElement('div');
    name.textContent = user.username;
    
    userDiv.appendChild(avatar);
    userDiv.appendChild(name);
    
    userDiv.onclick = () => addInvitedUser(user);
    
    list.appendChild(userDiv);
  });
}

function addInvitedUser(user) {
  if (selectedInvitedUsers.includes(user.id)) return;
  
  selectedInvitedUsers.push(user.id);
  
  // Clear search
  document.getElementById('inviteSearch').value = '';
  document.getElementById('inviteUsersList').innerHTML = '';
  
  // Render selected invites
  renderSelectedInvites();
}

function renderSelectedInvites() {
  const container = document.getElementById('selectedInvites');
  container.innerHTML = '';
  
  selectedInvitedUsers.forEach(userId => {
    const user = usersCache[userId];
    if (!user) return;
    
    const tag = document.createElement('div');
    tag.className = 'selected-invite-tag';
    tag.innerHTML = `
      <span>${user.username}</span>
      <span class="remove-invite" onclick="removeInvitedUser(${userId})">×</span>
    `;
    
    container.appendChild(tag);
  });
}

function removeInvitedUser(userId) {
  selectedInvitedUsers = selectedInvitedUsers.filter(id => id !== userId);
  renderSelectedInvites();
}

async function createRoomEnhanced() {
  const name = document.getElementById('roomName').value.trim();
  const description = document.getElementById('roomDescription').value.trim();
  const roomType = document.getElementById('roomType').value;
  const privacy = document.getElementById('roomPrivacy').value;
  
  if (!name || name.length < 3) {
    showToast('Room name must be at least 3 characters', 'warning');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    // Create room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert([{
        name,
        description,
        is_dm: false,
        is_announcement: false,
        created_by: currentUser.id,
        room_master_id: currentUser.id,
        privacy,
        room_type: roomType
      }])
      .select()
      .single();
    
    if (roomError) throw roomError;
    
    // Add creator as member
    await supabase.from('room_members').insert([{
      room_id: room.id,
      user_id: currentUser.id,
      role: 'owner'
    }]);
    
    // Send invites if invite_only
    if (privacy === 'invite_only' && selectedInvitedUsers.length > 0) {
      const invites = selectedInvitedUsers.map(userId => ({
        room_id: room.id,
        invited_by: currentUser.id,
        invited_user: userId,
        status: 'pending'
      }));
      
      await supabase.from('room_invites').insert(invites);
    }
    
    showToast('Room created!', 'success');
    closeCreateRoomModal();
    
    await loadRooms();
    selectRoom(room);
    
  } catch (error) {
    console.error('Error creating room:', error);
    showToast('Failed to create room', 'error');
  }
}

// ==================== DELETE ROOM ====================

function showDeleteRoomOption() {
  if (!currentRoom) return;
  
  // Don't show for announcement rooms
  if (currentRoom.is_announcement) return;
  
  const isAdmin = currentUser.role === 'admin';
  const isRoomMaster = currentRoom.room_master_id === currentUser.id || currentRoom.created_by === currentUser.id;
  
  if (!isAdmin && !isRoomMaster) return;
  
  // Add delete button to chat actions
  const chatActions = document.getElementById('chatActions');
  if (!chatActions) return;
  
  // Clear previous buttons
  chatActions.innerHTML = '';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.id = 'deleteRoomBtn';
  deleteBtn.className = 'delete-room-btn';
  deleteBtn.innerHTML = '🗑️ Delete Room';
  deleteBtn.onclick = confirmDeleteRoom;
  
  chatActions.appendChild(deleteBtn);
}

function confirmDeleteRoom() {
  if (!currentRoom) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Delete Room</h2>
        <button class="icon-btn" onclick="this.closest('.modal-overlay').remove()">
          <span class="icon icon-x"></span>
        </button>
      </div>
      <div class="modal-body delete-room-confirmation">
        <div class="warning-icon">⚠️</div>
        <h3>This action cannot be undone!</h3>
        <p>Type the room name to confirm deletion:</p>
        <p class="danger-text">${escapeHtml(currentRoom.name)}</p>
        <input type="text" id="deleteRoomConfirm" placeholder="Type room name here">
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-danger" onclick="executeDeleteRoom()">Delete Room</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

async function executeDeleteRoom() {
  const confirmInput = document.getElementById('deleteRoomConfirm');
  if (!confirmInput) return;
  
  if (confirmInput.value.trim() !== currentRoom.name) {
    showToast('Room name does not match', 'error');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    const roomId = currentRoom.id;
    
    // Delete room (CASCADE will delete members, messages, invites)
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId);
    
    if (error) throw error;
    
    showToast('Room deleted', 'success');
    
    // Close modal
    document.querySelector('.modal-overlay').remove();
    
    // Clear current room
    currentRoom = null;
    
    // Reload rooms
    await loadRooms();
    
    // Clear chat
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.innerHTML = '<div class="welcome-message"><h3>Select a room to start chatting</h3></div>';
    }
    
  } catch (error) {
    console.error('Error deleting room:', error);
    showToast('Failed to delete room', 'error');
  }
}

console.log('Admin features loaded');
