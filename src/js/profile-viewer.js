// ROWCHAT - PROFILE VIEWER

let currentViewingProfile = null;

function initProfileViewer() {
  // Create profile modal
  const profileModal = document.createElement('div');
  profileModal.id = 'profileViewModal';
  profileModal.className = 'modal-overlay';
  profileModal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>User Profile</h2>
        <button class="icon-btn" onclick="closeProfileView()">×</button>
      </div>
      <div class="modal-body">
        <div class="profile-view-container">
          <div class="profile-view-avatar" id="profileViewAvatar"></div>
          <h3 id="profileViewUsername" class="profile-view-username"></h3>
          <div id="profileViewBio" class="profile-view-bio"></div>
          <div id="profileViewStatus" class="profile-view-status"></div>
          <div class="profile-view-actions" id="profileViewActions"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(profileModal);
  
  // Add CSS
  const style = document.createElement('style');
  style.textContent = `
    .profile-view-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      text-align: center;
    }
    
    .profile-view-avatar {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: 700;
      color: white;
      margin-bottom: 20px;
      overflow: hidden;
    }
    
    .profile-view-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .profile-view-username {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 12px;
    }
    
    .profile-view-bio {
      color: var(--text-secondary);
      font-size: 15px;
      margin-bottom: 16px;
      max-width: 400px;
      line-height: 1.5;
    }
    
    .profile-view-status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
      font-size: 14px;
      color: var(--text-tertiary);
    }
    
    .profile-view-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }
    
    .message-username {
      cursor: pointer;
      transition: color 0.2s;
    }
    
    .message-username:hover {
      color: var(--accent);
    }
    
    .message-avatar {
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .message-avatar:hover {
      transform: scale(1.05);
    }
  `;
  
  document.head.appendChild(style);
}

async function openProfileView(userId) {
  if (!userId || userId === currentUser.id) {
    // Don't show profile for yourself
    return;
  }
  
  currentViewingProfile = userId;
  
  try {
    const supabase = getSupabase();
    
    // Fetch user data
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    if (!user) {
      showToast('User not found', 'error');
      return;
    }
    
    // Update modal content
    const avatar = document.getElementById('profileViewAvatar');
    if (user.avatar_url) {
      avatar.innerHTML = `<img src="${user.avatar_url}" alt="${user.username}">`;
    } else {
      avatar.textContent = user.username.charAt(0).toUpperCase();
    }
    
    document.getElementById('profileViewUsername').textContent = user.username;
    
    const bio = document.getElementById('profileViewBio');
    if (user.bio) {
      bio.textContent = user.bio;
      bio.style.display = 'block';
    } else {
      bio.textContent = 'No bio set';
      bio.style.color = 'var(--text-tertiary)';
      bio.style.display = 'block';
    }
    
    // Show status message if exists
    if (user.status_message) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'user-status-display';
      statusDiv.textContent = user.status_message;
      bio.after(statusDiv);
    }
    
    // Check online status
    const isOnline = onlineUsers[userId] && onlineUsers[userId].is_online;
    const status = document.getElementById('profileViewStatus');
    
    if (isOnline) {
      status.innerHTML = `
        <div class="friend-status online"></div>
        <span>Online</span>
      `;
    } else {
      const lastSeenText = typeof formatLastSeen === 'function' ? formatLastSeen(user.last_seen) : 'Offline';
      status.innerHTML = `
        <div class="friend-status"></div>
        <span class="last-seen-text">Last seen ${lastSeenText}</span>
      `;
    }
    
    // Get friend count
    const { count: friendCount } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    
    // Update friend count display if element exists
    const friendCountEl = document.getElementById('profileFriendCount');
    if (friendCountEl) {
      friendCountEl.textContent = friendCount || 0;
    }
    
    // Check friendship status
    const { data: friendship } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${currentUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${currentUser.id})`)
      .single();
    
    // Build action buttons
    const actions = document.getElementById('profileViewActions');
    actions.innerHTML = '';
    
    // Send Message button
    const messageBtn = document.createElement('button');
    messageBtn.className = 'btn-primary';
    messageBtn.textContent = '📨 Send Message';
    messageBtn.onclick = () => {
      closeProfileView();
      createDM(userId);
    };
    actions.appendChild(messageBtn);
    
    // Friend button
    if (!friendship) {
      const friendBtn = document.createElement('button');
      friendBtn.className = 'btn-secondary';
      friendBtn.textContent = '➕ Add Friend';
      friendBtn.onclick = () => sendFriendRequestToUser(userId);
      actions.appendChild(friendBtn);
    } else if (friendship.status === 'pending') {
      if (friendship.friend_id === currentUser.id) {
        // They sent us a request
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn-primary';
        acceptBtn.textContent = '✓ Accept Friend Request';
        acceptBtn.onclick = () => {
          acceptFriendRequest(friendship.id);
          closeProfileView();
        };
        actions.appendChild(acceptBtn);
      } else {
        // We sent them a request
        const pendingBtn = document.createElement('button');
        pendingBtn.className = 'btn-secondary';
        pendingBtn.textContent = '⏳ Friend Request Pending';
        pendingBtn.disabled = true;
        actions.appendChild(pendingBtn);
      }
    } else if (friendship.status === 'accepted') {
      const friendsBtn = document.createElement('button');
      friendsBtn.className = 'btn-secondary';
      friendsBtn.textContent = '✓ Friends';
      friendsBtn.disabled = true;
      actions.appendChild(friendsBtn);
      
      const unfriendBtn = document.createElement('button');
      unfriendBtn.className = 'btn-secondary';
      unfriendBtn.textContent = '❌ Remove Friend';
      unfriendBtn.onclick = () => {
        removeFriend(friendship.id);
        closeProfileView();
      };
      actions.appendChild(unfriendBtn);
    }
    
    // Show modal
    document.getElementById('profileViewModal').classList.add('active');
    
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast('Failed to load profile', 'error');
  }
}

function closeProfileView() {
  document.getElementById('profileViewModal').classList.remove('active');
  currentViewingProfile = null;
}

async function sendFriendRequestToUser(userId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('friendships')
      .insert([{
        user_id: currentUser.id,
        friend_id: userId,
        status: 'pending'
      }]);
    
    if (error) throw error;
    
    showToast('Friend request sent!', 'success');
    
    // Refresh the profile view
    openProfileView(userId);
    
  } catch (error) {
    console.error('Error sending friend request:', error);
    showToast('Failed to send friend request', 'error');
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfileViewer);
} else {
  initProfileViewer();
}

console.log('Profile Viewer loaded');
