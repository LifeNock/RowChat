// ============================================
// ROWCHAT - DIRECT MESSAGES
// ============================================

// Load DMs
async function loadDMs() {
  try {
    // Get DM rooms where user is a member
    const { data: memberships, error: memberError } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', currentUser.id);
    
    if (memberError) throw memberError;
    
    const roomIds = memberships.map(m => m.room_id);
    
    if (roomIds.length === 0) {
      document.getElementById('dmsList').innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-tertiary); font-size: 13px;">No DMs yet</p>';
      return;
    }
    
    // Get DM rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .in('id', roomIds)
      .eq('is_dm', true);
    
    if (roomsError) throw roomsError;
    
    const dmsList = document.getElementById('dmsList');
    dmsList.innerHTML = '';
    
    if (rooms.length === 0) {
      dmsList.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-tertiary); font-size: 13px;">No DMs yet</p>';
      return;
    }
    
    // For each DM room, get the other user
    for (const room of rooms) {
      const { data: members } = await supabase
        .from('room_members')
        .select('user_id')
        .eq('room_id', room.id);
      
      const otherUserId = members.find(m => m.user_id !== currentUser.id)?.user_id;
      const otherUser = getUser(otherUserId);
      
      const dmItem = document.createElement('div');
      dmItem.className = 'dm-item';
      if (currentDM && currentDM.id === room.id) {
        dmItem.classList.add('active');
      }
      
      dmItem.innerHTML = `
        <div class="dm-avatar">
          ${otherUser.avatar_url ? `<img src="${otherUser.avatar_url}">` : otherUser.username.charAt(0).toUpperCase()}
        </div>
        <span class="dm-name">${escapeHtml(otherUser.username)}</span>
      `;
      
      dmItem.onclick = () => openDM(room, otherUser);
      
      dmsList.appendChild(dmItem);
    }
    
    console.log('Loaded DMs:', rooms.length);
  } catch (error) {
    console.error('Error loading DMs:', error);
  }
}

// Open DM
async function openDM(room, otherUser) {
  currentDM = room;
  currentRoom = null;
  
  // Update UI
  document.querySelectorAll('.dm-item').forEach(item => item.classList.remove('active'));
  event.target.closest('.dm-item')?.classList.add('active');
  
  document.getElementById('chatTitle').textContent = otherUser.username;
  document.getElementById('chatDescription').textContent = 'Direct Message';
  
  // Load messages
  await loadMessages(room.id);
}

// Create DM
async function createDM(friendId) {
  try {
    // Check if DM already exists
    const { data: existingMemberships } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', currentUser.id);
    
    for (const membership of existingMemberships || []) {
      const { data: roomMembers } = await supabase
        .from('room_members')
        .select('user_id, rooms!inner(is_dm)')
        .eq('room_id', membership.room_id);
      
      if (roomMembers && roomMembers.length === 2) {
        const memberIds = roomMembers.map(m => m.user_id);
        if (memberIds.includes(currentUser.id) && memberIds.includes(friendId)) {
          const { data: room } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', membership.room_id)
            .single();
          
          if (room && room.is_dm) {
            const otherUser = getUser(friendId);
            openDM(room, otherUser);
            closeNewDMModal();
            switchTab('dms');
            return;
          }
        }
      }
    }
    
    // Create new DM room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert([{
        name: `DM-${currentUser.id}-${friendId}`,
        is_dm: true,
        created_by: currentUser.id
      }])
      .select()
      .single();
    
    if (roomError) throw roomError;
    
    // Add both users as members
    const { error: memberError } = await supabase
      .from('room_members')
      .insert([
        { room_id: room.id, user_id: currentUser.id, role: 'member' },
        { room_id: room.id, user_id: friendId, role: 'member' }
      ]);
    
    if (memberError) throw memberError;
    
    showToast('DM created!', 'success');
    closeNewDMModal();
    
    // Load DMs and open the new one
    await loadDMs();
    const otherUser = getUser(friendId);
    openDM(room, otherUser);
    switchTab('dms');
  } catch (error) {
    console.error('Error creating DM:', error);
    showToast('Failed to create DM', 'error');
  }
}

// Open New DM Modal
async function openNewDMModal() {
  document.getElementById('newDMModal').classList.add('active');
  
  // Load friends list
  try {
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
      .eq('status', 'accepted');
    
    if (error) throw error;
    
    const friendsList = document.getElementById('dmFriendsList');
    friendsList.innerHTML = '';
    
    if (friendships.length === 0) {
      friendsList.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-tertiary);">No friends yet. Add friends first!</p>';
      return;
    }
    
    friendships.forEach(friendship => {
      const friendId = friendship.user_id === currentUser.id ? friendship.friend_id : friendship.user_id;
      const friend = getUser(friendId);
      
      const friendItem = document.createElement('div');
      friendItem.className = 'friend-item';
      friendItem.style.cursor = 'pointer';
      
      friendItem.innerHTML = `
        <div class="dm-avatar">
          ${friend.avatar_url ? `<img src="${friend.avatar_url}">` : friend.username.charAt(0).toUpperCase()}
        </div>
        <span class="friend-name">${escapeHtml(friend.username)}</span>
      `;
      
      friendItem.onclick = () => createDM(friendId);
      
      friendsList.appendChild(friendItem);
    });
  } catch (error) {
    console.error('Error loading friends for DM:', error);
  }
}

// Close New DM Modal
function closeNewDMModal() {
  document.getElementById('newDMModal').classList.remove('active');
}

console.log('DMs.js loaded');
