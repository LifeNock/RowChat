// ============================================
// ROWCHAT - FRIENDS SYSTEM
// ============================================

let currentFriendTab = 'online';

// Load Friends
async function loadFriends() {
  try {
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);
    
    if (error) throw error;
    
    const friendsList = document.getElementById('friendsList');
    friendsList.innerHTML = '';
    
    // Filter based on current tab
    let filtered = [];
    
    if (currentFriendTab === 'pending') {
      filtered = friendships.filter(f => 
        f.status === 'pending' && f.friend_id === currentUser.id
      );
    } else if (currentFriendTab === 'online') {
      filtered = friendships.filter(f => f.status === 'accepted');
      // TODO: Filter by online status
    } else {
      filtered = friendships.filter(f => f.status === 'accepted');
    }
    
    if (filtered.length === 0) {
      friendsList.innerHTML = '<p style="padding: 12px; text-align: center; color: var(--text-tertiary); font-size: 13px;">No friends here</p>';
      return;
    }
    
    filtered.forEach(friendship => {
      const friendId = friendship.user_id === currentUser.id ? friendship.friend_id : friendship.user_id;
      const friend = getUser(friendId);
      const isOnline = onlineUsers[friendId] && onlineUsers[friendId].is_online;
      
      const friendItem = document.createElement('div');
      friendItem.className = 'friend-item';
      
      if (friendship.status === 'pending' && friendship.friend_id === currentUser.id) {
        // Pending request
        friendItem.innerHTML = `
          <div class="dm-avatar">
            ${friend.avatar_url ? `<img src="${friend.avatar_url}">` : friend.username.charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1;">
            <span class="friend-name">${escapeHtml(friend.username)}</span>
            <div style="margin-top: 4px; display: flex; gap: 8px;">
              <button class="btn-primary" style="padding: 4px 12px; font-size: 12px;" onclick="acceptFriendRequest(${friendship.id})">Accept</button>
              <button class="btn-secondary" style="padding: 4px 12px; font-size: 12px;" onclick="declineFriendRequest(${friendship.id})">Decline</button>
            </div>
          </div>
        `;
      } else {
        // Accepted friend
        friendItem.innerHTML = `
          <div class="dm-avatar">
            ${friend.avatar_url ? `<img src="${friend.avatar_url}">` : friend.username.charAt(0).toUpperCase()}
          </div>
          <span class="friend-name">${escapeHtml(friend.username)}</span>
          <div class="friend-status ${isOnline ? 'online' : ''}"></div>
        `;
        
        friendItem.onclick = () => {
          // Open context menu or DM
          createDM(friendId);
        };
      }
      
      friendsList.appendChild(friendItem);
    });
    
    // Update pending badge
    const pendingCount = friendships.filter(f => 
      f.status === 'pending' && f.friend_id === currentUser.id
    ).length;
    
    const badge = document.getElementById('friendRequestBadge');
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
    
    console.log('Loaded friends:', friendships.length);
  } catch (error) {
    console.error('Error loading friends:', error);
  }
}

// Show Friend Tab
function showFriendTab(tab) {
  currentFriendTab = tab;
  
  document.querySelectorAll('.friend-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  
  loadFriends();
}

// Open Add Friend Modal
function openAddFriendModal() {
  document.getElementById('friendUsername').value = '';
  document.getElementById('addFriendModal').classList.add('active');
}

// Close Add Friend Modal
function closeAddFriendModal() {
  document.getElementById('addFriendModal').classList.remove('active');
}

// Send Friend Request
async function sendFriendRequest() {
  const username = document.getElementById('friendUsername').value.trim();
  
  if (!username) {
    showToast('Please enter a username', 'warning');
    return;
  }
  
  if (username.toLowerCase() === currentUser.username.toLowerCase()) {
    showToast('You cannot add yourself as a friend', 'warning');
    return;
  }
  
  try {
    // Find user by username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();
    
    if (userError || !user) {
      showToast('User not found', 'error');
      return;
    }
    
    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${user.id}),and(user_id.eq.${user.id},friend_id.eq.${currentUser.id})`)
      .single();
    
    if (existing) {
      if (existing.status === 'pending') {
        showToast('Friend request already sent', 'warning');
      } else if (existing.status === 'accepted') {
        showToast('Already friends!', 'info');
      } else {
        showToast('Cannot send friend request', 'error');
      }
      return;
    }
    
    // Send friend request
    const { error } = await supabase
      .from('friendships')
      .insert([{
        user_id: currentUser.id,
        friend_id: user.id,
        status: 'pending'
      }]);
    
    if (error) throw error;
    
    showToast('Friend request sent!', 'success');
    closeAddFriendModal();
  } catch (error) {
    console.error('Error sending friend request:', error);
    showToast('Failed to send friend request', 'error');
  }
}

// Accept Friend Request
async function acceptFriendRequest(friendshipId) {
  try {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend request accepted!', 'success');
    loadFriends();
  } catch (error) {
    console.error('Error accepting friend request:', error);
    showToast('Failed to accept friend request', 'error');
  }
}

// Decline Friend Request
async function declineFriendRequest(friendshipId) {
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend request declined', 'info');
    loadFriends();
  } catch (error) {
    console.error('Error declining friend request:', error);
    showToast('Failed to decline friend request', 'error');
  }
}

// Remove Friend
async function removeFriend(friendshipId) {
  if (!confirm('Remove this friend?')) return;
  
  try {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend removed', 'info');
    loadFriends();
  } catch (error) {
    console.error('Error removing friend:', error);
    showToast('Failed to remove friend', 'error');
  }
}

// Block User
async function blockUser(userId) {
  if (!confirm('Block this user?')) return;
  
  try {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'blocked' })
      .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUser.id})`);
    
    if (error) throw error;
    
    showToast('User blocked', 'info');
    loadFriends();
  } catch (error) {
    console.error('Error blocking user:', error);
    showToast('Failed to block user', 'error');
  }
}

console.log('Friends.js loaded');
