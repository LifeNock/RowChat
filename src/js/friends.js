// FRIENDS SYSTEM - COMPLETE REWORK

let currentFriendTab = 'all';
let allFriendships = [];

// ==================== LOAD FRIENDS ====================

async function loadFriends() {
  try {
    const supabase = getSupabase();
    
    // Get all friendships involving current user
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id,
        friend_id,
        status,
        created_at,
        accepted_at
      `)
      .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    allFriendships = data || [];
    
    // Get user details for all friends
    const friendIds = new Set();
    allFriendships.forEach(f => {
      if (f.user_id !== currentUser.id) friendIds.add(f.user_id);
      if (f.friend_id !== currentUser.id) friendIds.add(f.friend_id);
    });
    
    const friendIdsArray = Array.from(friendIds);
    let friendUsers = [];
    
    if (friendIdsArray.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', friendIdsArray);
      
      if (!usersError) {
        friendUsers = users || [];
      }
    }
    
    // Attach user data to friendships
    allFriendships = allFriendships.map(f => {
      const friendId = f.user_id === currentUser.id ? f.friend_id : f.user_id;
      const friendData = friendUsers.find(u => u.id === friendId);
      
      return {
        ...f,
        friendId: friendId,
        friendData: friendData || { username: 'Unknown User', avatar_url: null },
        isOutgoing: f.user_id === currentUser.id,
        isIncoming: f.friend_id === currentUser.id
      };
    });
    
    renderFriendsList();
    updatePendingBadge();
    
  } catch (error) {
    console.error('Error loading friends:', error);
    showToast('Failed to load friends', 'error');
  }
}

// ==================== RENDER FRIENDS LIST ====================

function renderFriendsList() {
  const container = document.getElementById('friendsList');
  if (!container) return;
  
  let friendsToShow = [];
  
  if (currentFriendTab === 'all') {
    // Show accepted friends only
    friendsToShow = allFriendships.filter(f => f.status === 'accepted');
  } else if (currentFriendTab === 'pending') {
    // Show incoming requests (where current user is friend_id)
    friendsToShow = allFriendships.filter(f => 
      f.status === 'pending' && f.friend_id === currentUser.id
    );
  }
  
  container.innerHTML = '';
  
  if (friendsToShow.length === 0) {
    const emptyMsg = currentFriendTab === 'pending' 
      ? 'No pending requests' 
      : 'No friends yet';
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-tertiary);">
        ${emptyMsg}
      </div>
    `;
    return;
  }
  
  friendsToShow.forEach(friendship => {
    const friendDiv = document.createElement('div');
    friendDiv.className = 'friend-item';
    
    const avatarUrl = friendship.friendData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(friendship.friendData.username)}&background=random`;
    
    if (currentFriendTab === 'pending') {
      // Pending request - show accept/decline
      friendDiv.innerHTML = `
        <img src="${avatarUrl}" class="friend-avatar" alt="${escapeHtml(friendship.friendData.username)}">
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(friendship.friendData.username)}</div>
          <div class="friend-status">Incoming request</div>
        </div>
        <div class="friend-actions">
          <button class="btn-primary btn-sm" onclick="acceptFriendRequest(${friendship.id})">Accept</button>
          <button class="btn-danger btn-sm" onclick="declineFriendRequest(${friendship.id})">Decline</button>
        </div>
      `;
    } else {
      // Accepted friend - show message/remove
      friendDiv.innerHTML = `
        <img src="${avatarUrl}" class="friend-avatar" alt="${escapeHtml(friendship.friendData.username)}" onclick="openProfileView(${friendship.friendId})">
        <div class="friend-info" onclick="openProfileView(${friendship.friendId})">
          <div class="friend-name">${escapeHtml(friendship.friendData.username)}</div>
          <div class="friend-status">Friends since ${formatDate(friendship.accepted_at || friendship.created_at)}</div>
        </div>
        <div class="friend-actions">
          <button class="btn-primary btn-sm" onclick="openDM(${friendship.friendId}, '${escapeHtml(friendship.friendData.username)}')">Message</button>
          <button class="btn-danger btn-sm" onclick="removeFriend(${friendship.id}, '${escapeHtml(friendship.friendData.username)}')">Remove</button>
        </div>
      `;
    }
    
    container.appendChild(friendDiv);
  });
}

// ==================== TAB SWITCHING ====================

function showFriendTab(tab) {
  currentFriendTab = tab;
  
  document.querySelectorAll('.friend-tab').forEach(t => {
    t.classList.remove('active');
  });
  
  const activeTab = Array.from(document.querySelectorAll('.friend-tab'))
    .find(t => t.textContent.toLowerCase().includes(tab));
  
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  renderFriendsList();
}

// ==================== UPDATE PENDING BADGE ====================

function updatePendingBadge() {
  const badge = document.getElementById('pendingFriendsBadge');
  if (!badge) return;
  
  const pendingCount = allFriendships.filter(f => 
    f.status === 'pending' && f.friend_id === currentUser.id
  ).length;
  
  if (pendingCount > 0) {
    badge.textContent = pendingCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ==================== MODAL FUNCTIONS ====================

function openAddFriendModal() {
  const modal = document.getElementById('addFriendModal');
  const input = document.getElementById('friendUsername');
  
  if (input) input.value = '';
  if (modal) modal.classList.add('active');
}

function closeAddFriendModal() {
  const modal = document.getElementById('addFriendModal');
  if (modal) modal.classList.remove('active');
}

// ==================== SEND FRIEND REQUEST ====================

async function sendFriendRequest() {
  const input = document.getElementById('friendUsername');
  const username = input ? input.value.trim() : '';
  
  if (!username) {
    showToast('Please enter a username', 'warning');
    return;
  }
  
  if (username.toLowerCase() === currentUser.username.toLowerCase()) {
    showToast('You cannot add yourself as a friend', 'warning');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    // Find user by username
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .ilike('username', username)
      .single();
    
    if (userError || !targetUser) {
      showToast('User not found', 'error');
      return;
    }
    
    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},friend_id.eq.${currentUser.id})`)
      .single();
    
    if (existing) {
      if (existing.status === 'accepted') {
        showToast('You are already friends', 'warning');
      } else if (existing.status === 'pending') {
        showToast('Friend request already sent', 'warning');
      } else {
        showToast('Cannot send friend request', 'error');
      }
      return;
    }
    
    // Create friend request
    const { error: insertError } = await supabase
      .from('friendships')
      .insert([{
        user_id: currentUser.id,
        friend_id: targetUser.id,
        status: 'pending'
      }]);
    
    if (insertError) throw insertError;
    
    showToast(`Friend request sent to ${targetUser.username}`, 'success');
    closeAddFriendModal();
    await loadFriends();
    
  } catch (error) {
    console.error('Error sending friend request:', error);
    showToast('Failed to send friend request', 'error');
  }
}

// ==================== ACCEPT FRIEND REQUEST ====================

async function acceptFriendRequest(friendshipId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('friendships')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend request accepted', 'success');
    await loadFriends();
    
  } catch (error) {
    console.error('Error accepting friend request:', error);
    showToast('Failed to accept friend request', 'error');
  }
}

// ==================== DECLINE FRIEND REQUEST ====================

async function declineFriendRequest(friendshipId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend request declined', 'success');
    await loadFriends();
    
  } catch (error) {
    console.error('Error declining friend request:', error);
    showToast('Failed to decline friend request', 'error');
  }
}

// ==================== REMOVE FRIEND ====================

async function removeFriend(friendshipId, friendName) {
  if (!confirm(`Remove ${friendName} from your friends?`)) return;
  
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast(`Removed ${friendName} from friends`, 'success');
    await loadFriends();
    
  } catch (error) {
    console.error('Error removing friend:', error);
    showToast('Failed to remove friend', 'error');
  }
}

// ==================== GET FRIEND COUNT ====================

async function getFriendCount(userId) {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    
    if (error) throw error;
    
    return data || 0;
    
  } catch (error) {
    console.error('Error getting friend count:', error);
    return 0;
  }
}

// ==================== CHECK IF FRIENDS ====================

async function areFriends(userId1, userId2) {
  try {
    const supabase = getSupabase();
    
    const { data } = await supabase
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(`and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`)
      .single();
    
    return !!data;
    
  } catch (error) {
    return false;
  }
}

// ==================== CHECK FRIENDSHIP STATUS ====================

async function getFriendshipStatus(userId1, userId2) {
  try {
    const supabase = getSupabase();
    
    const { data } = await supabase
      .from('friendships')
      .select('status, user_id')
      .or(`and(user_id.eq.${userId1},friend_id.eq.${userId2}),and(user_id.eq.${userId2},friend_id.eq.${userId1})`)
      .single();
    
    if (!data) return 'none';
    
    if (data.status === 'accepted') return 'friends';
    if (data.status === 'pending' && data.user_id === userId1) return 'outgoing';
    if (data.status === 'pending' && data.user_id === userId2) return 'incoming';
    
    return 'none';
    
  } catch (error) {
    return 'none';
  }
}

// ==================== HELPER FUNCTIONS ====================

function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== INITIALIZE ====================

console.log('Friends system loaded (COMPLETE REWORK)');

// Auto-load friends when sidebar is opened
if (typeof loadFriends === 'function') {
  setTimeout(loadFriends, 1000);
}
