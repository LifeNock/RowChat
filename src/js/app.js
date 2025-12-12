// ROWCHAT - MAIN APPLICATION (FIXED)

let currentUser = null;
let currentRoom = null;
let currentDM = null;
let usersCache = {};
let roomsCache = {};
let onlineUsers = {};
let unreadRooms = {};

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, checking for existing session...');
  
  const storedUser = localStorage.getItem('rowchat-user');
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      console.log('Found stored user:', currentUser.username);
      initializeApp();
    } catch (error) {
      console.error('Error parsing stored user:', error);
      localStorage.removeItem('rowchat-user');
    }
  } else {
    console.log('No stored user found, showing auth screen');
    showLoading(false);
  }
});

function showLoading(show) {
  const loadingScreen = document.getElementById('loadingScreen');
  const authScreen = document.getElementById('authScreen');
  const appContainer = document.getElementById('appContainer');
  
  if (show) {
    loadingScreen.style.display = 'flex';
    authScreen.style.display = 'none';
    appContainer.style.display = 'none';
  } else {
    loadingScreen.style.display = 'none';
    if (currentUser) {
      authScreen.style.display = 'none';
      appContainer.style.display = 'flex';
    } else {
      authScreen.style.display = 'flex';
      appContainer.style.display = 'none';
    }
  }
}

async function initializeApp() {
  console.log('Initializing app for user:', currentUser.username);
  showLoading(true);
  
  try {
    await loadUsers();
    await loadRooms();
    await loadFriends();
    await updatePresence();
    await loadOnlineUsers();
    
    // Load theme and font preferences
    await loadUserPreferences();
    
    updateUserUI();
    subscribeToRealtimeUpdates();
    
    // Update presence every 30 seconds
    setInterval(updatePresence, 30000);
    
    // Refresh online users every 10 seconds
    setInterval(loadOnlineUsers, 10000);
    
    console.log('App initialized successfully!');
    showLoading(false);
  } catch (error) {
    console.error('Error initializing app:', error);
    showLoading(false);
    showToast('Failed to initialize app', 'error');
  }
}

// Load user preferences (theme and font)
async function loadUserPreferences() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('users')
      .select('theme, font_family')
      .eq('id', currentUser.id)
      .single();
    
    if (error) throw error;
    
    // Apply theme
    if (data.theme && data.theme.preset) {
      document.body.setAttribute('data-theme', data.theme.preset);
      currentUser.theme = data.theme;
    }
    
    // Apply font
    if (data.font_family) {
      const font = FONTS.find(f => f.name === data.font_family);
      if (font) {
        document.documentElement.style.setProperty('--font-family', font.value);
        currentUser.font_family = data.font_family;
      }
    }
    
    // Update localStorage
    localStorage.setItem('rowchat-user', JSON.stringify(currentUser));
    
  } catch (error) {
    console.error('Error loading user preferences:', error);
  }
}

async function loadOnlineUsers() {
  try {
    const supabase = getSupabase();
    
    // Get users online in last 60 seconds
    const cutoff = new Date(Date.now() - 60000).toISOString();
    
    const { data, error } = await supabase
      .from('presence')
      .select('*')
      .eq('is_online', true)
      .gte('last_seen', cutoff);
    
    if (error) throw error;
    
    onlineUsers = {};
    data.forEach(presence => {
      onlineUsers[presence.user_id] = presence;
    });
    
    console.log('Online users:', Object.keys(onlineUsers).length);
    
    // Update online count display
    updateOnlineCountDisplay();
    
    // Update room online counts
    if (currentRoom) {
      updateCurrentRoomOnlineCount();
    }
    
  } catch (error) {
    console.error('Error loading online users:', error);
  }
}

function updateOnlineCountDisplay() {
  const onlineCountEl = document.getElementById('onlineCount');
  if (onlineCountEl) {
    const count = Object.keys(onlineUsers).length;
    onlineCountEl.textContent = `${count} online`;
  }
  
  // Update dropdown list if it's open
  const dropdown = document.getElementById('onlineUsersDropdown');
  if (dropdown && dropdown.classList.contains('active')) {
    renderOnlineUsersList();
  }
}

function toggleOnlineUsersDropdown() {
  const dropdown = document.getElementById('onlineUsersDropdown');
  if (!dropdown) return;
  
  dropdown.classList.toggle('active');
  
  if (dropdown.classList.contains('active')) {
    renderOnlineUsersList();
  }
}

function renderOnlineUsersList() {
  const listEl = document.getElementById('onlineUsersList');
  if (!listEl) return;
  
  listEl.innerHTML = '';
  
  const onlineUserIds = Object.keys(onlineUsers);
  
  if (onlineUserIds.length === 0) {
    listEl.innerHTML = '<div class="online-users-empty">No users online</div>';
    return;
  }
  
  // Sort by username
  const sortedUsers = onlineUserIds
    .map(id => getUser(parseInt(id)))
    .filter(user => user && user.username !== 'Unknown')
    .sort((a, b) => a.username.localeCompare(b.username));
  
  sortedUsers.forEach(user => {
    const userDiv = document.createElement('div');
    userDiv.className = 'online-user-item';
    
    const avatar = document.createElement('div');
    avatar.className = 'online-user-avatar';
    if (user.avatar_url) {
      avatar.innerHTML = `<img src="${user.avatar_url}" alt="${user.username}">`;
    } else {
      avatar.textContent = user.username.charAt(0).toUpperCase();
    }
    
    const info = document.createElement('div');
    info.className = 'online-user-info';
    
    const name = document.createElement('div');
    name.className = 'online-user-name';
    name.textContent = user.username;
    
    const status = document.createElement('div');
    status.className = 'online-user-status';
    status.textContent = user.status_message || 'Online';
    
    info.appendChild(name);
    info.appendChild(status);
    
    userDiv.appendChild(avatar);
    userDiv.appendChild(info);
    
    // Click to view profile
    userDiv.onclick = (e) => {
      e.stopPropagation();
      if (user.id !== currentUser.id && typeof openProfileView === 'function') {
        openProfileView(user.id);
        document.getElementById('onlineUsersDropdown').classList.remove('active');
      }
    };
    
    listEl.appendChild(userDiv);
  });
}

function updateCurrentRoomOnlineCount() {
  if (!currentRoom) return;
  
  let onlineCount = 0;
  
  if (currentRoom.members && Array.isArray(currentRoom.members)) {
    currentRoom.members.forEach(memberId => {
      if (onlineUsers[memberId]) {
        onlineCount++;
      }
    });
  }
  
  const onlineCountEl = document.getElementById('onlineCount');
  if (onlineCountEl) {
    onlineCountEl.textContent = `${onlineCount} online`;
  }
}

function updateUserUI() {
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const sidebarUsername = document.getElementById('sidebarUsername');
  
  if (sidebarUsername) {
    sidebarUsername.textContent = currentUser.username;
  }
  
  if (sidebarAvatar) {
    if (currentUser.avatar_url) {
      sidebarAvatar.innerHTML = `<img src="${currentUser.avatar_url}">`;
    } else {
      sidebarAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
    }
  }
}

function switchTab(tab) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.remove('active');
    if (t.getAttribute('data-tab') === tab) {
      t.classList.add('active');
    }
  });
  
  document.querySelectorAll('.content-section').forEach(s => {
    s.classList.remove('active');
  });
  
  if (tab === 'rooms') {
    document.getElementById('roomsSection').classList.add('active');
  } else if (tab === 'dms') {
    document.getElementById('dmsSection').classList.add('active');
    loadDMs();
  } else if (tab === 'friends') {
    document.getElementById('friendsSection').classList.add('active');
    loadFriends();
  }
}

async function loadUsers() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) throw error;
    
    usersCache = {};
    data.forEach(user => {
      usersCache[user.id] = user;
    });
    
    console.log('Loaded users:', data.length);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

function getUser(userId) {
  return usersCache[userId] || { id: userId, username: 'Unknown', display_name: 'Unknown' };
}

async function updatePresence() {
  if (!currentUser) return;
  
  try {
    const supabase = getSupabase();
    
    await supabase
      .from('presence')
      .upsert({
        user_id: currentUser.id,
        username: currentUser.username,
        is_online: true,
        last_seen: new Date().toISOString()
      });
    
  } catch (error) {
    console.error('Error updating presence:', error);
  }
}

function subscribeToRealtimeUpdates() {
  const supabase = getSupabase();
  
  console.log('Setting up realtime subscriptions...');
  
  // Messages
  supabase
    .channel('public:messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      handleMessageInsert(payload.new);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      handleMessageUpdate(payload.new);
    })
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      handleMessageDelete(payload.old);
    })
    .subscribe();
  
  // Presence
  supabase
    .channel('public:presence')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'presence'
    }, () => {
      loadOnlineUsers();
    })
    .subscribe();
  
  // Rooms
  supabase
    .channel('public:rooms')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'rooms'
    }, () => {
      loadRooms();
    })
    .subscribe();
  
  // Friendships
  supabase
    .channel('public:friendships')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'friendships'
    }, () => {
      loadFriends();
    })
    .subscribe();
}

function handleMessageInsert(message) {
  if (currentRoom && message.room_id === currentRoom.id) {
    addMessageToUI(message);
  } else if (currentDM && message.room_id === currentDM.id) {
    addMessageToUI(message);
  } else {
    if (!unreadRooms[message.room_id]) {
      unreadRooms[message.room_id] = 0;
    }
    unreadRooms[message.room_id]++;
    updateRoomBadges();
  }
}

function updateRoomBadges() {
  document.querySelectorAll('.room-item').forEach(roomEl => {
    const roomId = parseInt(roomEl.dataset.roomId);
    const unreadCount = unreadRooms[roomId] || 0;
    
    let badge = roomEl.querySelector('.unread-badge');
    
    if (unreadCount > 0) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'unread-badge';
        badge.style.cssText = 'position: absolute; top: 8px; right: 8px; background: #f23f43; color: white; border-radius: 10px; padding: 2px 6px; font-size: 11px; font-weight: 700;';
        roomEl.style.position = 'relative';
        roomEl.appendChild(badge);
      }
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    } else if (badge) {
      badge.remove();
    }
  });
}

function handleMessageUpdate(message) {
  const msgEl = document.getElementById(`msg-${message.id}`);
  if (msgEl) {
    msgEl.remove();
    addMessageToUI(message);
  }
}

function handleMessageDelete(message) {
  const msgEl = document.getElementById(`msg-${message.id}`);
  if (msgEl) {
    msgEl.remove();
  }
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
  // Close user menu
  if (!e.target.closest('.user-section')) {
    document.getElementById('userMenu').style.display = 'none';
  }
  
  // Close online users dropdown
  if (!e.target.closest('.online-users')) {
    const dropdown = document.getElementById('onlineUsersDropdown');
    if (dropdown) {
      dropdown.classList.remove('active');
    }
  }
});

function logout() {
  if (!confirm('Are you sure you want to log out?')) return;
  
  const supabase = getSupabase();
  supabase.from('presence')
    .update({ is_online: false })
    .eq('user_id', currentUser.id)
    .then(() => {
      localStorage.removeItem('rowchat-user');
      location.reload();
    });
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return date.toLocaleDateString();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000;';
  
  if (type === 'success') toast.style.background = '#43b581';
  if (type === 'error') toast.style.background = '#f04747';
  if (type === 'warning') toast.style.background = '#faa61a';
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}

function toggleRoomInfo() {
  const panel = document.getElementById('roomInfoPanel');
  if (panel) panel.classList.toggle('active');
}

window.addEventListener('beforeunload', () => {
  if (currentUser) {
    const supabase = getSupabase();
    supabase.from('presence')
      .update({ is_online: false })
      .eq('user_id', currentUser.id);
  }
});

console.log('App.js loaded (FIXED)');
