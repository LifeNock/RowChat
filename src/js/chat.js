// ROWCHAT - CHAT

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function loadMessages(roomId) {
  console.log('Loading messages for room:', roomId);
  
  const container = document.getElementById('messagesContainer');
  if (!container) {
    console.error('messagesContainer not found');
    return;
  }
  
  container.innerHTML = '<div style="padding: 20px; text-align: center;">Loading...</div>';
  
  try {
    const supabase = getSupabase();
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    
    console.log(`Found ${messages ? messages.length : 0} messages`);
    
    if (error) {
      console.error('Error loading messages:', error);
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Error loading messages</div>';
      return;
    }
    
    container.innerHTML = '';
    
    if (!messages || messages.length === 0) {
      container.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">💬</div>
          <h3>No messages yet</h3>
          <p>Be the first to send a message!</p>
        </div>
      `;
      return;
    }
    
    messages.forEach(message => {
      addMessageToUI(message);
    });
    
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
    
    console.log('Messages loaded successfully');
    
  } catch (error) {
    console.error('Error loading messages:', error);
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Failed to load messages</div>';
  }
}

function addMessageToUI(message) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;
  
  if (document.getElementById(`msg-${message.id}`)) {
    console.log('Message already exists:', message.id);
    return;
  }
  
  const user = typeof getUser === 'function' ? getUser(message.user_id) : { username: message.username || 'Unknown' };
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message';
  msgDiv.id = `msg-${message.id}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  if (user.avatar_url) {
    avatar.innerHTML = `<img src="${user.avatar_url}">`;
  } else {
    avatar.textContent = (message.username || user.username || 'U').charAt(0).toUpperCase();
  }
  
  const contentWrapper = document.createElement('div');
  contentWrapper.style.flex = '1';
  
  const header = document.createElement('div');
  header.className = 'message-header';
  
  const username = document.createElement('span');
  username.className = 'message-username';
  username.textContent = message.username || user.username || 'Unknown';
  
  const timestamp = document.createElement('span');
  timestamp.className = 'message-timestamp';
  timestamp.textContent = typeof formatTime === 'function' ? formatTime(message.created_at) : new Date(message.created_at).toLocaleTimeString();
  
  header.appendChild(username);
  header.appendChild(timestamp);
  
  const content = document.createElement('div');
  content.className = 'message-content';
  
  if (message.message_type === 'image' && message.file_url) {
    content.innerHTML = `
      ${escapeHtml(message.content)}<br>
      <img src="${message.file_url}" style="max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px; cursor: pointer;" onclick="openImageModal('${message.file_url}')">
    `;
  } else if (message.message_type === 'video' && message.file_url) {
    content.innerHTML = `
      ${escapeHtml(message.content)}<br>
      <video controls style="max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px;">
        <source src="${message.file_url}">
      </video>
    `;
  } else if (message.message_type === 'file' && message.file_url) {
    content.innerHTML = `
      ${escapeHtml(message.content)}<br>
      <a href="${message.file_url}" target="_blank" style="color: var(--accent);">📎 ${escapeHtml(message.file_name || 'Download File')}</a>
    `;
  } else {
    content.textContent = message.content;
  }
  
  contentWrapper.appendChild(header);
  contentWrapper.appendChild(content);
  
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(contentWrapper);
  
  container.appendChild(msgDiv);
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  if (!input) return;
  
  const content = input.value.trim();
  
  if (!content) return;
  
  if (!currentRoom && !currentDM) {
    if (typeof showToast === 'function') {
      showToast('Please select a room or DM first', 'warning');
    }
    return;
  }
  
  const roomId = currentRoom ? currentRoom.id : currentDM.id;
  
  try {
    const supabase = getSupabase();
    
    const messageData = {
      room_id: roomId,
      user_id: currentUser.id,
      username: currentUser.username,
      content: content,
      message_type: 'text'
    };
    
    console.log('Sending message:', messageData);
    
    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
      .single();
    
    if (error) {
      console.error('Error sending message:', error);
      if (typeof showToast === 'function') {
        showToast('Failed to send message', 'error');
      }
      return;
    }
    
    console.log('Message sent:', data);
    
    input.value = '';
    
    addMessageToUI(data);
    
    const container = document.getElementById('messagesContainer');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    
  } catch (error) {
    console.error('Error sending message:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to send message', 'error');
    }
  }
}

const messageInput = document.getElementById('messageInput');
if (messageInput) {
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  messageInput.addEventListener('input', (e) => {
    const length = e.target.value.length;
    const counter = document.getElementById('charCount');
    
    if (counter) {
      if (length > 1800) {
        counter.textContent = `${length}/2000`;
        counter.style.color = 'var(--danger)';
      } else if (length > 0) {
        counter.textContent = `${length}/2000`;
        counter.style.color = 'var(--text-tertiary)';
      } else {
        counter.textContent = '';
      }
    }
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

function openImageModal(url) {
  const modal = document.getElementById('imageModal');
  const img = document.getElementById('modalImage');
  if (modal && img) {
    img.src = url;
    modal.classList.add('active');
  }
}

function closeImageModal() {
  const modal = document.getElementById('imageModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

const fileInput = document.getElementById('fileInput');
if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('File selected:', file.name);
    
    const preview = document.getElementById('filePreview');
    const previewBar = document.getElementById('filePreviewBar');
    
    if (preview && previewBar) {
      preview.textContent = `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      previewBar.style.display = 'flex';
    }
    
    window.pendingFile = file;
  });
}

function cancelFile() {
  window.pendingFile = null;
  const previewBar = document.getElementById('filePreviewBar');
  if (previewBar) {
    previewBar.style.display = 'none';
  }
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.value = '';
  }
}

console.log('Chat.js loaded');
