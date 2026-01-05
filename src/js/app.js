// Get references from config.js
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_KEY = window.SUPABASE_KEY;

let currentUser = null;
let currentRoom = null;
let currentDM = null;
let onlineUsers = {};
let usersCache = {};
let roomsCache = {};
let unreadRooms = {};
let unreadDMs = {};

function showLoading(show) {
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    loadingScreen.style.display = show ? 'flex' : 'none';
  }
}

// Check for existing session on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, checking for existing session...');
  
  const storedUser = localStorage.getItem('rowchat_user');
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      console.log('Found stored user:', currentUser.username);
      
      document.getElementById('authScreen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      
      await initializeApp();
    } catch (error) {
      console.error('Error restoring session:', error);
      localStorage.removeItem('rowchat_user');
      showLoading(false);
    }
  } else {
    console.log('No stored session found');
    document.getElementById('authScreen').style.display = 'flex';
    showLoading(false);
  }
});

function getSupabase() {
  if (window.supabaseClient) {
    return window.supabaseClient;
  }
  
  console.log('Initializing Supabase...');
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('Supabase initialized successfully');
  return window.supabaseClient;
}

async function initializeApp() {
  console.log('Initializing app for user:', currentUser.username);
  
  try {
    await loadUsers();
    await loadRooms();
    await loadFriends();
    await loadOnlineUsers();
    
    // Load reputation system
    if (typeof loadReputation === 'function') {
      await loadReputation(currentUser.id);
    }
    
    // Load gamification data
    if (typeof loadGamificationData === 'function') {
      await loadGamificationData();
    }
    
    // Load personal word filters
    if (typeof loadPersonalFilters === 'function') {
      await loadPersonalFilters();
    }
    
    updateUserUI();
    
    // Delay realtime subscriptions until chat.js is loaded
    setTimeout(() => {
      subscribeToRealtimeUpdates();
    }, 500);
    
    // Show admin DMs section if user is admin
    if (currentUser.role === 'admin') {
      const adminSection = document.getElementById('adminDmsSection');
      if (adminSection) adminSection.style.display = 'block';
      
      // Show admin panel link in user menu
      const adminPanelLink = document.getElementById('adminPanelLink');
      if (adminPanelLink) adminPanelLink.style.display = 'flex';
    }
    
    // Update presence every 30 seconds
    setInterval(updatePresence, 30000);
    
    // Refresh online users every 10 seconds
    setInterval(loadOnlineUsers, 10000);
    
    // Check if user needs to accept TOS/Privacy Policy
    if (typeof checkAgreements === 'function') {
      setTimeout(checkAgreements, 1000);
    }
    
    console.log('App initialized successfully!');
    showLoading(false);
  } catch (error) {
    console.error('Error initializing app:', error);
    showLoading(false);
    showToast('Failed to initialize app', 'error');
  }
}

function updateUserUI() {
  const userAvatar = document.getElementById('currentUserAvatar');
  const userName = document.getElementById('currentUserName');
  const userRole = document.getElementById('currentUserRole');
  
  if (userAvatar) {
    if (currentUser.avatar_url) {
      userAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="${currentUser.username}">`;
    } else {
      userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
    }
  }
  
  if (userName) {
    userName.textContent = currentUser.username;
  }
  
  if (userRole) {
    console.log('User role:', currentUser.role);
    userRole.textContent = currentUser.role === 'admin' ? '👑 Admin' : '';
  }
}

async function loadOnlineUsers() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, is_online, last_seen')
      .eq('is_online', true);
    
    if (error) throw error;
    
    onlineUsers = {};
    data.forEach(user => {
      onlineUsers[user.id] = user;
    });
    
    console.log('Online users:', data.length);
    
    updateOnlineUsersUI();
    
    // Update online counts in rooms
    if (typeof updateAllRoomOnlineCounts === 'function') {
      updateAllRoomOnlineCounts();
    }
    
  } catch (error) {
    console.error('Error loading online users:', error);
  }
}

function updateOnlineUsersUI() {
  const container = document.getElementById('onlineUsersList');
  if (!container) return;
  
  const onlineUsersArray = Object.values(onlineUsers);
  
  container.innerHTML = '';
  
  if (onlineUsersArray.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No one online</div>';
    return;
  }
  
  onlineUsersArray.forEach(user => {
    const userDiv = document.createElement('div');
    userDiv.className = 'online-user-item';
    
    const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`;
    
    userDiv.innerHTML = `
      <img src="${avatarUrl}" alt="${user.username}" class="online-user-avatar">
      <span class="online-user-name">${user.username}</span>
      <span class="online-indicator"></span>
    `;
    
    userDiv.onclick = () => {
      if (user.id !== currentUser.id && typeof openDM === 'function') {
        openDM(user.id, user.username);
      }
    };
    
    container.appendChild(userDiv);
  });
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
      .from('users')
      .update({
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', currentUser.id);
    
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
    }, payload => {
      handleMessageInsert(payload.new);
    })
    .subscribe();
  
  // Online status
  supabase
    .channel('public:users')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'users'
    }, payload => {
      const user = payload.new;
      if (user.is_online) {
        onlineUsers[user.id] = user;
      } else {
        delete onlineUsers[user.id];
      }
      updateOnlineUsersUI();
    })
    .subscribe();
  
  // DMs
  supabase
    .channel('public:direct_messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages'
    }, payload => {
      handleDMInsert(payload.new);
    })
    .subscribe();
}

function handleMessageInsert(message) {
  if (typeof addMessageToUI !== 'function') {
    console.error('addMessageToUI not loaded yet');
    return;
  }
  
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

function handleDMInsert(dm) {
  if (typeof addMessageToUI !== 'function') {
    return;
  }
  
  if (currentDM && dm.room_id === currentDM.id) {
    addMessageToUI(dm);
  } else {
    if (!unreadDMs[dm.room_id]) {
      unreadDMs[dm.room_id] = 0;
    }
    unreadDMs[dm.room_id]++;
    updateDMBadges();
  }
}

function updateRoomBadges() {
  Object.keys(unreadRooms).forEach(roomId => {
    const roomItem = document.querySelector(`.room-item[data-room-id="${roomId}"]`);
    if (roomItem && unreadRooms[roomId] > 0) {
      let badge = roomItem.querySelector('.unread-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'unread-badge';
        roomItem.appendChild(badge);
      }
      badge.textContent = unreadRooms[roomId];
    }
  });
}

function updateDMBadges() {
  Object.keys(unreadDMs).forEach(dmId => {
    const dmItem = document.querySelector(`.dm-item[data-dm-id="${dmId}"]`);
    if (dmItem && unreadDMs[dmId] > 0) {
      let badge = dmItem.querySelector('.unread-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'unread-badge';
        dmItem.appendChild(badge);
      }
      badge.textContent = unreadDMs[dmId];
    }
  });
}

function logout() {
  if (currentUser) {
    const supabase = getSupabase();
    supabase.from('users')
      .update({ is_online: false })
      .eq('id', currentUser.id);
  }
  
  localStorage.removeItem('rowchat_user');
  currentUser = null;
  window.location.reload();
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
    supabase.from('users')
      .update({ is_online: false })
      .eq('id', currentUser.id);
  }
});

console.log('App.js loaded (REVERTED - NO HARDWARE BANS)');
