// ROWCHAT - ROLES, STATUS, TYPING INDICATORS

let typingTimeout = null;
let typingChannel = null;

function initRolesAndStatus() {
  // Subscribe to typing indicators
  subscribeToTyping();
  
  // Add status modal to page
  createStatusModal();
  
  // Update typing when user types
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    messageInput.addEventListener('input', handleTyping);
  }
}

// Role Badges
function getRoleBadge(username, role) {
  if (username.toLowerCase() === 'lifenock' || role === 'admin') {
    return '<span class="role-badge admin-badge">ADMIN</span>';
  }
  if (role === 'moderator' || role === 'mod') {
    return '<span class="role-badge mod-badge">MOD</span>';
  }
  if (role === 'vip') {
    return '<span class="role-badge vip-badge">VIP</span>';
  }
  return '';
}

// Typing Indicators
async function handleTyping() {
  if (!currentRoom && !currentDM) return;
  
  const roomId = currentRoom ? currentRoom.id : currentDM.id;
  
  try {
    const supabase = getSupabase();
    
    // Upsert typing status
    await supabase
      .from('typing_status')
      .upsert({
        user_id: currentUser.id,
        room_id: roomId,
        is_typing: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,room_id'
      });
    
    // Clear after 3 seconds
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(async () => {
      await supabase
        .from('typing_status')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('room_id', roomId);
    }, 3000);
    
  } catch (error) {
    console.error('Error updating typing status:', error);
  }
}

function subscribeToTyping() {
  const supabase = getSupabase();
  
  typingChannel = supabase
    .channel('typing_status')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'typing_status'
    }, (payload) => {
      updateTypingIndicator();
    })
    .subscribe();
}

async function updateTypingIndicator() {
  if (!currentRoom && !currentDM) return;
  
  const roomId = currentRoom ? currentRoom.id : currentDM.id;
  
  try {
    const supabase = getSupabase();
    
    const { data: typing } = await supabase
      .from('typing_status')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('is_typing', true)
      .neq('user_id', currentUser.id);
    
    const indicator = document.getElementById('typingIndicator');
    if (!indicator) return;
    
    if (typing && typing.length > 0) {
      const usernames = await Promise.all(
        typing.map(async (t) => {
          const user = getUser(t.user_id);
          return user ? user.username : 'Someone';
        })
      );
      
      if (usernames.length === 1) {
        indicator.textContent = `${usernames[0]} is typing...`;
      } else if (usernames.length === 2) {
        indicator.textContent = `${usernames[0]} and ${usernames[1]} are typing...`;
      } else {
        indicator.textContent = `${usernames.length} people are typing...`;
      }
      
      indicator.style.display = 'block';
    } else {
      indicator.style.display = 'none';
    }
    
  } catch (error) {
    console.error('Error updating typing indicator:', error);
  }
}

// Status Messages
function createStatusModal() {
  const modal = document.createElement('div');
  modal.id = 'statusModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Set Status</h2>
        <button class="icon-btn" onclick="closeStatusModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="status-presets">
          <button class="status-preset" onclick="setStatus('🎮 Playing Roblox')">🎮 Playing Roblox</button>
          <button class="status-preset" onclick="setStatus('💻 Coding')">💻 Coding</button>
          <button class="status-preset" onclick="setStatus('📚 Studying')">📚 Studying</button>
          <button class="status-preset" onclick="setStatus('🎵 Listening to music')">🎵 Listening to music</button>
          <button class="status-preset" onclick="setStatus('😴 AFK')">😴 AFK</button>
          <button class="status-preset" onclick="setStatus('🎬 Watching videos')">🎬 Watching videos</button>
        </div>
        <div class="form-group">
          <label>Custom Status</label>
          <input type="text" id="customStatus" placeholder="What are you up to?" maxlength="100">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="clearStatus()">Clear Status</button>
        <button class="btn-primary" onclick="saveCustomStatus()">Save</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add CSS
  const style = document.createElement('style');
  style.textContent = `
    .role-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
      vertical-align: middle;
    }
    
    .admin-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .mod-badge {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    
    .vip-badge {
      background: linear-gradient(135deg, #ffd89b 0%, #19547b 100%);
      color: white;
    }
    
    .status-presets {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    }
    
    .status-preset {
      padding: 12px;
      background: var(--bg-tertiary);
      border: 2px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }
    
    .status-preset:hover {
      border-color: var(--accent);
      background: var(--bg-hover);
      transform: translateY(-2px);
    }
    
    .user-status-display {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    
    .last-seen-text {
      font-size: 12px;
      color: var(--text-tertiary);
      font-style: italic;
    }
  `;
  
  document.head.appendChild(style);
}

function openStatusModal() {
  document.getElementById('statusModal').classList.add('active');
  
  // Load current status
  if (currentUser.status_message) {
    document.getElementById('customStatus').value = currentUser.status_message;
  }
}

function closeStatusModal() {
  document.getElementById('statusModal').classList.remove('active');
}

async function setStatus(statusMessage) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('users')
      .update({ status_message: statusMessage })
      .eq('id', currentUser.id);
    
    if (error) throw error;
    
    currentUser.status_message = statusMessage;
    updateUserDisplay();
    
    showToast('Status updated!', 'success');
    closeStatusModal();
    
  } catch (error) {
    console.error('Error setting status:', error);
    showToast('Failed to update status', 'error');
  }
}

async function saveCustomStatus() {
  const status = document.getElementById('customStatus').value.trim();
  
  if (!status) {
    showToast('Please enter a status', 'warning');
    return;
  }
  
  await setStatus(status);
}

async function clearStatus() {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('users')
      .update({ status_message: null })
      .eq('id', currentUser.id);
    
    if (error) throw error;
    
    currentUser.status_message = null;
    updateUserDisplay();
    
    showToast('Status cleared', 'info');
    closeStatusModal();
    
  } catch (error) {
    console.error('Error clearing status:', error);
    showToast('Failed to clear status', 'error');
  }
}

function updateUserDisplay() {
  const userStatus = document.querySelector('.user-status');
  if (userStatus) {
    if (currentUser.status_message) {
      userStatus.textContent = currentUser.status_message;
    } else {
      userStatus.textContent = '🟢 Online';
    }
  }
}

// Format last seen
function formatLastSeen(lastSeenDate) {
  if (!lastSeenDate) return 'Never';
  
  const now = new Date();
  const lastSeen = new Date(lastSeenDate);
  const diff = now - lastSeen;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return lastSeen.toLocaleDateString();
}

// Add status button to user menu
function addStatusButton() {
  const userMenu = document.getElementById('userMenu');
  if (userMenu) {
    const statusItem = document.createElement('div');
    statusItem.className = 'dropdown-item';
    statusItem.innerHTML = '<span>💬</span> Set Status';
    statusItem.onclick = openStatusModal;
    
    // Insert after profile item
    const firstItem = userMenu.querySelector('.dropdown-item');
    if (firstItem) {
      firstItem.after(statusItem);
    }
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initRolesAndStatus();
    setTimeout(addStatusButton, 1000); // Wait for DOM
  });
} else {
  initRolesAndStatus();
  setTimeout(addStatusButton, 1000);
}

console.log('Roles, Status, and Typing loaded');
