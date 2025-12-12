// ROWCHAT - FRIENDS SYSTEM (WITH REPUTATION TRACKING)

let currentFriendTab = null;

async function loadFriends() {
  const allTab = document.getElementById('friendsAll');
  const pendingTab = document.getElementById('friendsPending');
  
  if (!allTab || !pendingTab) return;
  
  try {
    const supabase = getSupabase();
    
    // Load all friendships
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Separate accepted and pending
    const accepted = friendships.filter(f => f.status === 'accepted');
    const pending = friendships.filter(f => f.status === 'pending');
    
    // Render accepted friends
    allTab.innerHTML = '';
    if (accepted.length === 0) {
      allTab.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No friends yet</p>';
    } else {
      accepted.forEach(friendship => {
        const friendId = friendship.user1_id === currentUser.id ? friendship.user2_id : friendship.user1_id;
        const friend = getUser(friendId);
        
        const friendDiv = document.createElement('div');
        friendDiv.className = 'friend-item';
        
        const isOnline = typeof onlineUsers !== 'undefined' && onlineUsers[friendId];
        
        friendDiv.innerHTML = `
          <div class="friend-avatar" onclick="openProfileView(${friendId})">
            ${friend.avatar_url ? `<img src="${friend.avatar_url}">` : friend.username.charAt(0).toUpperCase()}
            ${isOnline ? '<span class="online-dot"></span>' : ''}
          </div>
          <div class="friend-info" onclick="openProfileView(${friendId})">
            <div class="friend-name">${escapeHtml(friend.username)}</div>
            <div class="friend-status">${isOnline ? 'Online' : 'Offline'}</div>
          </div>
          <button class="btn-secondary btn-small" onclick="startDM(${friendId})">Message</button>
        `;
        
        allTab.appendChild(friendDiv);
      });
    }
    
    // Render pending requests
    pendingTab.innerHTML = '';
    const pendingReceived = pending.filter(f => f.user2_id === currentUser.id);
    
    if (pendingReceived.length === 0) {
      pendingTab.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No pending requests</p>';
    } else {
      pendingReceived.forEach(friendship => {
        const senderId = friendship.user1_id;
        const sender = getUser(senderId);
        
        const requestDiv = document.createElement('div');
        requestDiv.className = 'friend-request-item';
        
        requestDiv.innerHTML = `
          <div class="friend-avatar" onclick="openProfileView(${senderId})">
            ${sender.avatar_url ? `<img src="${sender.avatar_url}">` : sender.username.charAt(0).toUpperCase()}
          </div>
          <div class="friend-info" onclick="openProfileView(${senderId})">
            <div class="friend-name">${escapeHtml(sender.username)}</div>
            <div class="friend-status">Wants to be friends</div>
          </div>
          <div class="friend-actions">
            <button class="btn-primary btn-small" onclick="acceptFriend(${friendship.id}, ${senderId})">Accept</button>
            <button class="btn-secondary btn-small" onclick="rejectFriend(${friendship.id})">Reject</button>
          </div>
        `;
        
        pendingTab.appendChild(requestDiv);
      });
      
      // Update badge
      const badge = document.getElementById('friendRequestBadge');
      if (badge) {
        badge.textContent = pendingReceived.length;
        badge.style.display = pendingReceived.length > 0 ? 'inline-block' : 'none';
      }
    }
    
  } catch (error) {
    console.error('Error loading friends:', error);
  }
}

function openAddFriendModal() {
  document.getElementById('addFriendModal')?.classList.add('active');
  document.getElementById('friendUsername')?.focus();
}

function closeAddFriendModal() {
  document.getElementById('addFriendModal')?.classList.remove('active');
  const input = document.getElementById('friendUsername');
  if (input) input.value = '';
}

async function sendFriendRequest(userIdOrUsername) {
  try {
    const supabase = getSupabase();
    
    let targetUserId;
    
    // If number passed, it's a userId
    if (typeof userIdOrUsername === 'number') {
      targetUserId = userIdOrUsername;
    } else {
      // Otherwise it's a username from the input
      const username = userIdOrUsername || document.getElementById('friendUsername')?.value.trim();
      
      if (!username) {
        showToast('Please enter a username', 'warning');
        return;
      }
      
      // Find user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();
      
      if (userError || !user) {
        showToast('User not found', 'error');
        return;
      }
      
      targetUserId = user.id;
    }
    
    if (targetUserId === currentUser.id) {
      showToast("You can't add yourself as a friend", 'warning');
      return;
    }
    
    // Check if already friends or pending
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${currentUser.id})`)
      .single();
    
    if (existing) {
      showToast('Friend request already exists', 'warning');
      return;
    }
    
    // Send friend request
    const { error } = await supabase
      .from('friendships')
      .insert([{
        user1_id: currentUser.id,
        user2_id: targetUserId,
        status: 'pending'
      }]);
    
    if (error) throw error;
    
    // Track reputation for adding friend
    if (typeof trackFriendAdded === 'function') {
      trackFriendAdded(currentUser.id);
    }
    
    showToast('Friend request sent!', 'success');
    closeAddFriendModal();
    
  } catch (error) {
    console.error('Error sending friend request:', error);
    showToast('Failed to send friend request', 'error');
  }
}

async function acceptFriend(friendshipId, friendId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    // Track reputation for both users
    if (typeof trackFriendAdded === 'function') {
      trackFriendAdded(currentUser.id);
      trackFriendAdded(friendId);
    }
    
    showToast('Friend request accepted!', 'success');
    loadFriends();
    
  } catch (error) {
    console.error('Error accepting friend:', error);
    showToast('Failed to accept friend request', 'error');
  }
}

async function rejectFriend(friendshipId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend request rejected', 'info');
    loadFriends();
    
  } catch (error) {
    console.error('Error rejecting friend:', error);
    showToast('Failed to reject friend request', 'error');
  }
}

async function startDM(friendId) {
  try {
    const supabase = getSupabase();
    
    // Check if DM already exists
    const { data: existingDM } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_dm', true)
      .or(`and(created_by.eq.${currentUser.id},name.ilike.%${getUser(friendId).username}%),and(created_by.eq.${friendId},name.ilike.%${currentUser.username}%)`)
      .single();
    
    if (existingDM) {
      currentDM = existingDM;
      currentRoom = null;
      switchTab('dms');
      if (typeof selectRoom === 'function') {
        selectRoom(existingDM);
      }
      return;
    }
    
    // Create new DM
    const friend = getUser(friendId);
    const dmName = `${currentUser.username}, ${friend.username}`;
    
    const { data: dm, error } = await supabase
      .from('rooms')
      .insert([{
        name: dmName,
        is_dm: true,
        created_by: currentUser.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    // Add both users as members
    await supabase.from('room_members').insert([
      { room_id: dm.id, user_id: currentUser.id },
      { room_id: dm.id, user_id: friendId }
    ]);
    
    currentDM = dm;
    currentRoom = null;
    switchTab('dms');
    
    if (typeof loadDMs === 'function') {
      await loadDMs();
    }
    
    if (typeof selectRoom === 'function') {
      selectRoom(dm);
    }
    
  } catch (error) {
    console.error('Error starting DM:', error);
    showToast('Failed to start DM', 'error');
  }
}

console.log('Friends.js loaded (with reputation tracking)');
