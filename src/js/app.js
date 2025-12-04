// ============================================
// ROWCHAT - MAIN APP
// ============================================

// Global Variables
let currentUser = null;
let currentRoom = null;
let currentDM = null;
let usersCache = {};
let roomsCache = {};
let messagesCache = {};
let onlineUsers = {};

// Initialize App
window.addEventListener('DOMContentLoaded', async () => {
  console.log('RowChat initializing...');
  
  // Show loading screen
  showLoading(true);
  
  // Check for saved user
  const savedUser = localStorage.getItem('rowchat-user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      await initializeApp();
    } catch (error) {
      console.error('Error loading saved user:', error);
      localStorage.removeItem('rowchat-user');
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }
  
  showLoading(false);
});

// Show/Hide Loading Screen
function showLoading(show) {
  const loadingScreen = document.getElementById('loadingScreen');
  if (show) {
    loadingScreen.style.display = 'flex';
  } else {
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }
}

// Show Auth Screen
function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appContainer').style.display = 'none';
}

// Initialize Main App
async function initializeApp() {
  console.log('Initializing app for user:', currentUser.username);
  
  // Hide auth, show app
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appContainer').style.display = 'flex';
  
  // Update UI
  updateUserUI();
  
  // Load data
  await Promise.all([
    loadUsers(),
    loadRooms(),
    loadFriends()
  ]);
  
  // Subscribe to real-time updates
  subscribeToRealtimeUpdates();
  
  // Update presence
  updatePresence(true);
  setInterval(() => updatePresence(true), 30000);
  
  // Apply user theme
  if (currentUser.theme) {
    applyTheme(currentUser.theme);
  }
  
  // Apply user font
  if (currentUser.font_family) {
    document.documentElement.style.setProperty('--font-family', currentUser.font_family);
  }
}

// Update User UI
function updateUserUI() {
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const sidebarUsername = document.getElementById('sidebarUsername');
  
  if (currentUser.avatar_url) {
    sidebarAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="${currentUser.username}">`;
  } else {
    sidebarAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
  }
  
  sidebarUsername.textContent = currentUser.display_name || currentUser.username;
}

// Switch Tab (Rooms/DMs/Friends)
function switchTab(tab) {
  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  
  // Update content sections
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.getElementById(`${tab}Section`).classList.add('active');
}

// Load Users
async function loadUsers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) throw error;
    
    data.forEach(user => {
      usersCache[user.id] = user;
    });
    
    console.log('Loaded users:', Object.keys(usersCache).length);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Get User
function getUser(userId) {
  return usersCache[userId] || { 
    username: 'Unknown User', 
    avatar_url: null 
  };
}

// Update Presence
async function updatePresence(isOnline) {
  if (!currentUser) return;
  
  try {
    await supabase
      .from('presence')
      .upsert({
        user_id: currentUser.id,
        username: currentUser.username,
        is_online: isOnline,
        last_seen: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error updating presence:', error);
  }
}

// Subscribe to Real-time Updates
function subscribeToRealtimeUpdates() {
  // Subscribe to messages
  supabase
    .channel('messages-channel')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages'
    }, handleMessageChange)
    .subscribe();
  
  // Subscribe to presence
  supabase
    .channel('presence-channel')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'presence'
    }, handlePresenceChange)
    .subscribe();
  
  // Subscribe to rooms
  supabase
    .channel('rooms-channel')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'rooms'
    }, handleRoomChange)
    .subscribe();
  
  // Subscribe to friendships
  supabase
    .channel('friendships-channel')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'friendships'
    }, handleFriendshipChange)
    .subscribe();
}

// Handle Message Change
function handleMessageChange(payload) {
  console.log('Message change:', payload);
  
  if (payload.eventType === 'INSERT') {
    const message = payload.new;
    
    // Add to cache
    if (!messagesCache[message.room_id]) {
      messagesCache[message.room_id] = [];
    }
    messagesCache[message.room_id].push(message);
    
    // If viewing this room, add message to UI
    if (currentRoom && currentRoom.id === message.room_id) {
      addMessageToUI(message);
    }
  }
}

// Handle Presence Change
function handlePresenceChange(payload) {
  console.log('Presence change:', payload);
  
  if (payload.new) {
    onlineUsers[payload.new.user_id] = payload.new;
  } else if (payload.old) {
    delete onlineUsers[payload.old.user_id];
  }
  
  updateOnlineCount();
}

// Handle Room Change
function handleRoomChange(payload) {
  console.log('Room change:', payload);
  
  if (payload.eventType === 'INSERT') {
    roomsCache[payload.new.id] = payload.new;
    loadRooms();
  } else if (payload.eventType === 'UPDATE') {
    roomsCache[payload.new.id] = payload.new;
    loadRooms();
  } else if (payload.eventType === 'DELETE') {
    delete roomsCache[payload.old.id];
    loadRooms();
  }
}

// Handle Friendship Change
function handleFriendshipChange(payload) {
  console.log('Friendship change:', payload);
  loadFriends();
}

// Update Online Count
function updateOnlineCount() {
  const count = Object.keys(onlineUsers).length;
  document.getElementById('onlineCount').textContent = `${count} online`;
}

// Toggle User Menu
function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  const isVisible = menu.style.display === 'block';
  menu.style.display = isVisible ? 'none' : 'block';
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const userMenu = document.getElementById('userMenu');
  const userProfile = document.querySelector('.user-profile');
  
  if (!userProfile.contains(e.target) && !userMenu.contains(e.target)) {
    userMenu.style.display = 'none';
  }
});

// Logout
async function logout() {
  await updatePresence(false);
  localStorage.removeItem('rowchat-user');
  currentUser = null;
  currentRoom = null;
  currentDM = null;
  window.location.reload();
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format Time
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} min${mins > 1 ? 's' : ''} ago`;
  }
  
  // Today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  
  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  
  // This year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  
  // Other years
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

// Show Toast Notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 16px 24px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: 8px;
    box-shadow: 0 4px 12px var(--shadow);
    z-index: 10000;
    animation: fadeInUp 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Toggle Room Info Panel
function toggleRoomInfo() {
  const panel = document.getElementById('roomInfoPanel');
  panel.classList.toggle('active');
  
  if (panel.classList.contains('active') && currentRoom) {
    loadRoomInfo();
  }
}

// Load Room Info
async function loadRoomInfo() {
  const content = document.getElementById('roomInfoContent');
  
  if (!currentRoom) {
    content.innerHTML = '<p>No room selected</p>';
    return;
  }
  
  try {
    // Get room members
    const { data: members, error } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', currentRoom.id);
    
    if (error) throw error;
    
    let html = `
      <div class="room-info-item">
        <h4>Room Name</h4>
        <p>${escapeHtml(currentRoom.name)}</p>
      </div>
    `;
    
    if (currentRoom.description) {
      html += `
        <div class="room-info-item">
          <h4>Description</h4>
          <p>${escapeHtml(currentRoom.description)}</p>
        </div>
      `;
    }
    
    html += `
      <div class="room-info-item">
        <h4>Members (${members.length})</h4>
        <div class="room-members-list">
    `;
    
    members.forEach(member => {
      const user = getUser(member.user_id);
      html += `
        <div class="member-item">
          <div class="member-avatar">
            ${user.avatar_url ? `<img src="${user.avatar_url}">` : user.username.charAt(0).toUpperCase()}
          </div>
          <span class="member-name">${escapeHtml(user.username)}</span>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    content.innerHTML = html;
  } catch (error) {
    console.error('Error loading room info:', error);
    content.innerHTML = '<p>Error loading room info</p>';
  }
}

// Handle beforeunload
window.addEventListener('beforeunload', () => {
  if (currentUser) {
    updatePresence(false);
  }
});

console.log('App.js loaded');
