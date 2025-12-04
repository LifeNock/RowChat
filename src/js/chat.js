// ============================================
// ROWCHAT - CHAT MESSAGING (FIXED)
// ============================================

let replyingTo = null;
let editingMessage = null;

// Get Supabase client
function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Add Message to UI
function addMessageToUI(message) {
  const container = document.getElementById('messagesContainer');
  
  // Remove welcome message if present
  const welcome = container.querySelector('.welcome-message');
  if (welcome) welcome.remove();
  
  // Check if message already exists
  if (document.getElementById(`msg-${message.id}`)) {
    return;
  }
  
  const user = getUser(message.user_id);
  const isOwn = message.user_id === currentUser.id;
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message';
  msgDiv.id = `msg-${message.id}`;
  
  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  if (user.avatar_url) {
    avatar.innerHTML = `<img src="${user.avatar_url}" alt="${user.username}">`;
  } else {
    avatar.textContent = (message.username || user.username).charAt(0).toUpperCase();
  }
  
  // Content wrapper
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'message-content-wrapper';
  
  // Header
  const header = document.createElement('div');
  header.className = 'message-header';
  
  const username = document.createElement('span');
  username.className = 'message-username';
  username.textContent = message.username || user.username;
  
  const timestamp = document.createElement('span');
  timestamp.className = 'message-timestamp';
  timestamp.textContent = formatTime(message.created_at);
  
  header.appendChild(username);
  header.appendChild(timestamp);
  
  if (message.edited_at) {
    const edited = document.createElement('span');
    edited.className = 'message-timestamp';
    edited.textContent = '(edited)';
    edited.style.marginLeft = '4px';
    header.appendChild(edited);
  }
  
  // Content
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = processMessageContent(message.content, message.message_type, message.file_url);
  
  // Actions (only for own messages)
  if (isOwn) {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.style.cssText = 'display: none; position: absolute; top: -10px; right: 10px; background: var(--bg-tertiary); border-radius: 6px; padding: 4px; gap: 4px;';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.textContent = '✏️';
    editBtn.title = 'Edit';
    editBtn.onclick = () => startEdit(message);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = () => deleteMessage(message.id);
    
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    
    msgDiv.style.position = 'relative';
    msgDiv.appendChild(actions);
    
    msgDiv.addEventListener('mouseenter', () => {
      actions.style.display = 'flex';
    });
    msgDiv.addEventListener('mouseleave', () => {
      actions.style.display = 'none';
    });
  }
  
  contentWrapper.appendChild(header);
  contentWrapper.appendChild(content);
  
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(contentWrapper);
  
  container.appendChild(msgDiv);
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Process Message Content
function processMessageContent(content, type, fileUrl) {
  if (type === 'image' && fileUrl) {
    return `${escapeHtml(content)}<br><img src="${fileUrl}" onclick="openImageModal('${fileUrl}')" style="max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px; cursor: pointer;">`;
  }
  
  if (type === 'video' && fileUrl) {
    return `${escapeHtml(content)}<br><video controls style="max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px;"><source src="${fileUrl}"></video>`;
  }
  
  if (type === 'file' && fileUrl) {
    return `${escapeHtml(content)}<br><a href="${fileUrl}" target="_blank" style="color: var(--accent);">📎 Download File</a>`;
  }
  
  // Process mentions and links
  let processed = escapeHtml(content);
  
  // Convert URLs to links
  processed = processed.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--accent);">$1</a>');
  
  // Convert @mentions
  processed = processed.replace(/@(\w+)/g, '<span style="background: var(--accent-light); color: var(--accent); padding: 2px 4px; border-radius: 4px;">@$1</span>');
  
  return processed;
}

// Send Message
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  
  if (!content && !window.pendingFile) {
    return;
  }
  
  if (!currentRoom && !currentDM) {
    showToast('Please select a room or DM first', 'warning');
    return;
  }
  
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;
  
  try {
    const supabase = getSupabase();
    
    let messageData = {
      room_id: currentRoom ? currentRoom.id : currentDM.id,
      user_id: currentUser.id,
      username: currentUser.username,
      content: content || 'Sent a file',
      reply_to: replyingTo ? replyingTo.id : null
    };
    
    // Handle file upload
    if (window.pendingFile) {
      const fileUrl = await uploadFile(window.pendingFile);
      if (fileUrl) {
        messageData.file_url = fileUrl;
        messageData.file_name = window.pendingFile.name;
        messageData.file_size = window.pendingFile.size;
        
        if (window.pendingFile.type.startsWith('image/')) {
          messageData.message_type = 'image';
        } else if (window.pendingFile.type.startsWith('video/')) {
          messageData.message_type = 'video';
        } else {
          messageData.message_type = 'file';
        }
      }
      window.pendingFile = null;
      document.getElementById('filePreviewBar').style.display = 'none';
    }
    
    // If editing
    if (editingMessage) {
      await supabase
        .from('messages')
        .update({
          content: content,
          edited_at: new Date().toISOString()
        })
        .eq('id', editingMessage.id);
      
      cancelEdit();
    } else {
      // Insert new message
      const { error } = await supabase
        .from('messages')
        .insert([messageData]);
      
      if (error) throw error;
    }
    
    input.value = '';
    document.getElementById('charCount').textContent = '';
    cancelReply();
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('Failed to send message', 'error');
  }
  
  sendBtn.disabled = false;
}

// Start Edit
function startEdit(message) {
  editingMessage = message;
  const input = document.getElementById('messageInput');
  input.value = message.content;
  input.focus();
  
  document.getElementById('editBar').style.display = 'flex';
  cancelReply();
}

// Cancel Edit
function cancelEdit() {
  editingMessage = null;
  document.getElementById('messageInput').value = '';
  document.getElementById('editBar').style.display = 'none';
}

// Delete Message
async function deleteMessage(messageId) {
  if (!confirm('Delete this message?')) return;
  
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    
    if (error) throw error;
    
    const msgEl = document.getElementById(`msg-${messageId}`);
    if (msgEl) msgEl.remove();
  } catch (error) {
    console.error('Error deleting message:', error);
    showToast('Failed to delete message', 'error');
  }
}

// Set Reply
function setReply(message) {
  replyingTo = message;
  const user = getUser(message.user_id);
  
  document.getElementById('replyToUser').textContent = message.username || user.username;
  document.getElementById('replyToText').textContent = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
  document.getElementById('replyBar').style.display = 'flex';
  
  document.getElementById('messageInput').focus();
}

// Cancel Reply
function cancelReply() {
  replyingTo = null;
  document.getElementById('replyBar').style.display = 'none';
}

// Load Messages for Room
async function loadMessages(roomId) {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '<div class="loading-shimmer" style="height: 100px; border-radius: 8px;"></div>';
  
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (error) throw error;
    
    container.innerHTML = '';
    
    if (data.length === 0) {
      container.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">💬</div>
          <h3>No messages yet</h3>
          <p>Be the first to send a message!</p>
        </div>
      `;
    } else {
      data.forEach(message => addMessageToUI(message));
    }
    
    // Cache messages
    messagesCache[roomId] = data;
  } catch (error) {
    console.error('Error loading messages:', error);
    container.innerHTML = `
      <div class="welcome-message">
        <p style="color: var(--danger);">Error loading messages</p>
      </div>
    `;
  }
}

// Message Input Handling
const messageInput = document.getElementById('messageInput');

messageInput?.addEventListener('input', (e) => {
  const length = e.target.value.length;
  const counter = document.getElementById('charCount');
  
  if (length > 1800) {
    counter.textContent = `${length}/2000`;
    counter.classList.add('warning');
  } else {
    counter.textContent = '';
    counter.classList.remove('warning');
  }
  
  // Update typing status
  updateTypingStatus(true);
});

messageInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Typing Status
let typingTimeout;
async function updateTypingStatus(isTyping) {
  if (!currentUser || (!currentRoom && !currentDM)) return;
  
  clearTimeout(typingTimeout);
  
  try {
    const supabase = getSupabase();
    
    await supabase
      .from('presence')
      .update({
        is_typing: isTyping,
        typing_in_room: currentRoom ? currentRoom.id : currentDM.id
      })
      .eq('user_id', currentUser.id);
    
    if (isTyping) {
      typingTimeout = setTimeout(() => updateTypingStatus(false), 3000);
    }
  } catch (error) {
    console.error('Error updating typing status:', error);
  }
}

// Open Image Modal
function openImageModal(url) {
  const modal = document.getElementById('imageModal');
  const img = document.getElementById('modalImage');
  img.src = url;
  modal.classList.add('active');
}

// Close Image Modal
function closeImageModal() {
  document.getElementById('imageModal').classList.remove('active');
}

console.log('Chat.js loaded (FIXED)');
