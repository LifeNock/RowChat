// ============================================
// ROWCHAT - MAIN APPLICATION (FIXED)
// ============================================

let currentUser = null;
let currentRoom = null;
let currentDM = null;
let usersCache = {};
let roomsCache = {};
let messagesCache = {};
let onlineUsers = {};

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, checking for existing session...');
  
  // Check for existing user
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

// Show/Hide Loading Screen
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

// Initialize Application
async function initializeApp() {
  console.log('Initializing app for user:', currentUser.username);
  showLoading(true);
  
  try {
    // Load all data
    await loadUsers();
    await loadRooms();
    await loadFriends();
    
    // Update UI
    updateUserUI();
    
    // Subscribe to real-time updates
    subscribeToRealtimeUpdates();
    
    // Update presence
    await updatePresence();
    setInterval(updatePresence, 30000); // Every 30 seconds
    
    // Apply user theme and font
    if (currentUser.theme) {
      applyTheme(currentUser.theme);
    }
    
    if (currentUser.font_family) {
      const font = FONTS.find(f => f.name === currentUser.font_family);
      if (font) {
        document.documentElement.style.setProperty('--font-family', font.value);
      }
    }
    
    console.log('App initialized successfully!');
    showLoading(false);
  } catch (error) {
    console.error('Error initializing app:', error);
    showLoading(false);
    showToast('Failed to initialize app', 'error');
  }
}

// Update User UI
function updateUserUI() {
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const sidebarUsername = document.getElementById('sidebarUsername');
  
  sidebarUsername.textContent = currentUser.username;
  
  if (currentUser.avatar_url) {
    sidebarAvatar.innerHTML = `<img src="${currentUser.avatar_url}">`;
  } else {
    sidebarAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
  }
}

// Switch Tab
function switchTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.remove('active');
    if (t.getAttribute('data-tab') === tab) {
      t.classList.add('active');
    }
  });
  
  // Update content sections
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

// Load Users
async function loadUsers() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) throw error;
    
    // Cache users
    data.forEach(user => {
      usersCache[user.id] = user;
    });
    
    console.log('Loaded users:', data.length);
  } catch (error) {
    console.error('Error loading users:', error);
  }
}

// Get User
function getUser(userId) {
  return usersCache[userId] || { id: userId, username: 'Unknown', display_name: 'Unknown' };
}

// Update Presence
async function updatePresence() {
  if (!currentUser) return;
  
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('presence')
      .upsert({
        user_id: currentUser.id,
        username: currentUser.username,
        is_online: true,
        last_seen: new Date().toISOString()
      });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating presence:', error);
  }
}

// Subscribe to Real-time Updates
function subscribeToRealtimeUpdates() {
  const supabase = getSupabase();
  
  // Messages
  supabase
    .channel('messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
      handleMessageUpdate(payload);
    })
    .subscribe();
  
  // Presence
  supabase
    .channel('presence')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'presence' }, (payload) => {
      handlePresenceUpdate(payload);
    })
    .subscribe();
  
  // Rooms
  supabase
    .channel('rooms')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
      loadRooms();
    })
    .subscribe();
  
  // Friendships
  supabase
    .channel('friendships')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, (payload) => {
      loadFriends();
    })
    .subscribe();
  
  console.log('Subscribed to real-time updates');
}

// Handle Message Update
function handleMessageUpdate(payload) {
  if (payload.eventType === 'INSERT') {
    const message = payload.new;
    if (currentRoom && message.room_id === currentRoom.id) {
      addMessageToUI(message);
    } else if (currentDM && message.room_id === currentDM.id) {
      addMessageToUI(message);
    }
  }
}

// Handle Presence Update
function handlePresenceUpdate(payload) {
  if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
    const presence = payload.new;
    onlineUsers[presence.user_id] = presence;
  }
}

// Toggle User Menu
function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-section')) {
    document.getElementById('userMenu').style.display = 'none';
  }
});

// Logout
function logout() {
  if (!confirm('Are you sure you want to log out?')) return;
  
  // Set offline before logout
  const supabase = getSupabase();
  supabase.from('presence')
    .update({ is_online: false })
    .eq('user_id', currentUser.id)
    .then(() => {
      localStorage.removeItem('rowchat-user');
      location.reload();
    });
}

// Utility Functions
function escapeHtml(text) {
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
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  
  // Format as date
  return date.toLocaleDateString();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; animation: slideInRight 0.3s ease;';
  
  if (type === 'success') toast.style.background = 'var(--success)';
  if (type === 'error') toast.style.background = 'var(--danger)';
  if (type === 'warning') toast.style.background = 'var(--warning)';
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function toggleRoomInfo() {
  const panel = document.getElementById('roomInfoPanel');
  panel.classList.toggle('active');
}

function loadRoomInfo() {
  if (!currentRoom) return;
  
  const content = document.getElementById('roomInfoContent');
  content.innerHTML = `
    <h4>${escapeHtml(currentRoom.name)}</h4>
    <p>${escapeHtml(currentRoom.description || 'No description')}</p>
  `;
}

// Set user offline when leaving
window.addEventListener('beforeunload', () => {
  if (currentUser) {
    const supabase = getSupabase();
    supabase.from('presence')
      .update({ is_online: false })
      .eq('user_id', currentUser.id);
  }
});

console.log('App.js loaded (FIXED)');
