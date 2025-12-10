// ============================================
// ROWCHAT - CHAT DIAGNOSTIC VERSION
// ============================================

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Load Messages - WITH EXTENSIVE DEBUGGING
async function loadMessages(roomId) {
  console.log('═══════════════════════════════════════');
  console.log('📥 LOADING MESSAGES FOR ROOM:', roomId);
  console.log('═══════════════════════════════════════');
  
  const container = document.getElementById('messagesContainer');
  if (!container) {
    console.error('❌ messagesContainer not found!');
    return;
  }
  
  container.innerHTML = '<div style="padding: 20px; text-align: center;">Loading messages...</div>';
  
  try {
    const supabase = getSupabase();
    
    console.log('🔍 Fetching messages from database...');
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);
    
    console.log('📊 Query result:', {
      messageCount: messages ? messages.length : 0,
      error: error,
      messages: messages
    });
    
    if (error) {
      console.error('❌ Database error:', error);
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">Error: ${error.message}</div>`;
      throw error;
    }
    
    if (!messages || messages.length === 0) {
      console.log('📭 No messages found for this room');
      container.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">💬</div>
          <h3>No messages yet</h3>
          <p>Be the first to send a message!</p>
        </div>
      `;
      return;
    }
    
    console.log('✅ Found', messages.length, 'messages. Rendering...');
    
    container.innerHTML = '';
    
    messages.forEach((message, index) => {
      console.log(`Rendering message ${index + 1}:`, {
        id: message.id,
        user: message.username,
        content: message.content.substring(0, 50)
      });
      
      addMessageToUI(message);
    });
    
    console.log('✅ All messages rendered successfully!');
    
    // Scroll to bottom
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
    
  } catch (error) {
    console.error('❌ Error loading messages:', error);
    container.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">Failed to load messages</div>`;
  }
}

// Add Message to UI
function addMessageToUI(message) {
  const container = document.getElementById('messagesContainer');
  if (!container) {
    console.error('❌ Cannot add message - container not found');
    return;
  }
  
  // Check if message already exists
  if (document.getElementById(`msg-${message.id}`)) {
    console.log('⚠️ Message already exists, skipping:', message.id);
    return;
  }
  
  console.log('➕ Adding message to UI:', message.id);
  
  const user = getUser ? getUser(message.user_id) : { username: message.username || 'Unknown' };
  const isOwn = currentUser && message.user_id === currentUser.id;
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message';
  msgDiv.id = `msg-${message.id}`;
  
  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  if (user.avatar_url) {
    avatar.innerHTML = `<img src="${user.avatar_url}">`;
  } else {
    avatar.textContent = message.username ? message.username.charAt(0).toUpperCase() : 'U';
  }
  
  // Content
  const contentWrapper = document.createElement('div');
  contentWrapper.style.flex = '1';
  
  const header = document.createElement('div');
  header.className = 'message-header';
  
  const username = document.createElement('span');
  username.className = 'message-username';
  username.textContent = message.username || user.username || 'Unknown';
  
  const timestamp = document.createElement('span');
  timestamp.className = 'message-timestamp';
  timestamp.textContent = formatTime ? formatTime(message.created_at) : new Date(message.created_at).toLocaleTimeString();
  
  header.appendChild(username);
  header.appendChild(timestamp);
  
  const content = document.createElement('div');
  content.className = 'message-content';
  content.textContent = message.content;
  
  contentWrapper.appendChild(header);
  contentWrapper.appendChild(content);
  
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(contentWrapper);
  
  container.appendChild(msgDiv);
  
  console.log('✅ Message added:', message.id);
}

// Send Message - WITH DEBUGGING
async function sendMessage() {
  console.log('═══════════════════════════════════════');
  console.log('📤 SENDING MESSAGE');
  console.log('═══════════════════════════════════════');
  
  const input = document.getElementById('messageInput');
  if (!input) {
    console.error('❌ messageInput not found!');
    return;
  }
  
  const content = input.value.trim();
  
  if (!content) {
    console.log('⚠️ Empty message, not sending');
    return;
  }
  
  if (!currentRoom && !currentDM) {
    console.error('❌ No room or DM selected!');
    showToast('Please select a room or DM first', 'warning');
    return;
  }
  
  console.log('📝 Message content:', content);
  console.log('📍 Current room:', currentRoom);
  console.log('👤 Current user:', currentUser);
  
  const roomId = currentRoom ? currentRoom.id : currentDM.id;
  
  try {
    const supabase = getSupabase();
    
    const messageData = {
      room_id: roomId,
      user_id: currentUser.id,
      username: currentUser.username,
      content: content,
      message_type: 'text',
      created_at: new Date().toISOString()
    };
    
    console.log('💾 Inserting message to database:', messageData);
    
    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Database insert error:', error);
      showToast('Failed to send message: ' + error.message, 'error');
      throw error;
    }
    
    console.log('✅ Message saved to database:', data);
    
    // Clear input
    input.value = '';
    
    // IMPORTANT: Manually add the message to UI since realtime might be broken
    console.log('➕ Manually adding message to UI...');
    addMessageToUI(data);
    
    console.log('✅ Message sent successfully!');
    
  } catch (error) {
    console.error('❌ Error sending message:', error);
    showToast('Failed to send message', 'error');
  }
}

// Check Realtime Status
function checkRealtimeStatus() {
  console.log('═══════════════════════════════════════');
  console.log('🔌 CHECKING REALTIME STATUS');
  console.log('═══════════════════════════════════════');
  
  const supabase = getSupabase();
  
  // Check if subscriptions exist
  if (supabase.getChannels) {
    const channels = supabase.getChannels();
    console.log('📡 Active channels:', channels.length);
    channels.forEach((channel, index) => {
      console.log(`Channel ${index + 1}:`, {
        topic: channel.topic,
        state: channel.state
      });
    });
  } else {
    console.log('⚠️ Cannot check channels');
  }
  
  console.log('═══════════════════════════════════════');
}

// Initialize Chat (call this when page loads)
function initChat() {
  console.log('🚀 Initializing chat diagnostic mode');
  
  // Check realtime status every 5 seconds
  setInterval(checkRealtimeStatus, 5000);
  
  // Listen for Enter key
  const input = document.getElementById('messageInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
}

// Call init when DOM loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}

console.log('💬 Chat.js loaded (DIAGNOSTIC VERSION)');
