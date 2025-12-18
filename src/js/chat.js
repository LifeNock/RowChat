// ROWCHAT - CHAT WITH REPLY, MENTIONS, EDIT

let currentReplyTo = null;
let currentEditMessage = null;

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function uploadFile(file) {
  try {
    const supabase = getSupabase();
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('attachments')
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: urlData } = supabase.storage
      .from('attachments')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    showToast('Failed to upload file', 'error');
    return null;
  }
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

function processMentions(text) {
  return text.replace(/@(\w+)/g, (match, username) => {
    const isCurrentUser = currentUser && username.toLowerCase() === currentUser.username.toLowerCase();
    const color = isCurrentUser ? 'rgba(250, 166, 26, 0.3)' : 'rgba(88, 101, 242, 0.2)';
    return `<span style="background: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: 600;">@${username}</span>`;
  });
}

function formatText(text) {
  if (!text) return '';
  
  // Escape HTML first
  text = escapeHtml(text);
  
  // Convert line breaks
  text = text.replace(/\n/g, '<br>');
  
  // Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Italic: *text*
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Underline: __text__
  text = text.replace(/__(.+?)__/g, '<u>$1</u>');
  
  // Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
  
  // Inline code: `code`
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  
  // Process mentions after formatting
  text = processMentions(text);
  
  return text;
}

function addMessageToUI(message) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;
  
  if (document.getElementById(`msg-${message.id}`)) {
    return;
  }
  
  const user = typeof getUser === 'function' ? getUser(message.user_id) : { username: message.username || 'Unknown' };
  
  const isMentioned = message.content && currentUser && message.content.toLowerCase().includes('@' + currentUser.username.toLowerCase());
  
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message';
  msgDiv.id = `msg-${message.id}`;
  
  if (isMentioned) {
    msgDiv.style.background = 'rgba(250, 166, 26, 0.1)';
    msgDiv.style.borderLeft = '3px solid rgba(250, 166, 26, 0.8)';
    msgDiv.style.paddingLeft = '12px';
  }
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.style.cursor = 'pointer';
  avatar.onclick = () => {
    if (message.user_id !== currentUser.id) {
      openProfileView(message.user_id);
    }
  };
  if (user.avatar_url) {
    avatar.innerHTML = `<img src="${user.avatar_url}">`;
  } else {
    avatar.textContent = (message.username || user.username || 'U').charAt(0).toUpperCase();
  }
  
  const contentWrapper = document.createElement('div');
  contentWrapper.style.flex = '1';
  contentWrapper.style.position = 'relative';
  
  const header = document.createElement('div');
  header.className = 'message-header';
  
  const username = document.createElement('span');
  username.className = 'message-username';
  const displayName = message.username || user.username || 'Unknown';
  
  let badgesHTML = '';
  
  // Check if user wants to hide priority badges
  const hidePriorityBadges = user.hide_priority_badges || false;
  
  if (!hidePriorityBadges) {
    // Show role badge (ADMIN, ROOM MASTER) + reputation tier badge
    if (typeof getRoleBadge === 'function') {
      badgesHTML = getRoleBadge(displayName, user.role);
    }
  }
  
  // Always show equipped badges
  if (user.equipped_badges && Array.isArray(user.equipped_badges)) {
    user.equipped_badges.forEach(badgeType => {
      if (typeof ALL_BADGES !== 'undefined' && ALL_BADGES[badgeType]) {
        const badge = ALL_BADGES[badgeType];
        badgesHTML += `<span class="user-badge ${badge.color}">${badge.name}</span>`;
      }
    });
  }
  
  username.innerHTML = displayName + badgesHTML;
  username.style.cursor = 'pointer';
  username.onclick = () => {
    if (message.user_id !== currentUser.id) {
      openProfileView(message.user_id);
    }
  };
  
  const timestamp = document.createElement('span');
  timestamp.className = 'message-timestamp';
  timestamp.textContent = typeof formatTime === 'function' ? formatTime(message.created_at) : new Date(message.created_at).toLocaleTimeString();
  
  header.appendChild(username);
  header.appendChild(timestamp);
  
  if (message.reply_to) {
    const replyPreview = document.createElement('div');
    replyPreview.style.cssText = 'background: rgba(0,0,0,0.2); border-left: 3px solid var(--accent); padding: 6px 10px; margin: 6px 0; border-radius: 4px; font-size: 12px; cursor: pointer;';
    replyPreview.innerHTML = `<strong>Replying to:</strong> ${escapeHtml((message.reply_text || '').substring(0, 50))}...`;
    replyPreview.onclick = () => scrollToMessage(message.reply_to);
    contentWrapper.appendChild(replyPreview);
  }
  
  const content = document.createElement('div');
  content.className = 'message-content';
  
  if (message.message_type === 'image' && message.file_url) {
    content.innerHTML = `
      ${formatText(message.content)}<br>
      <img src="${message.file_url}" style="max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px; cursor: pointer;" onclick="openImageModal('${message.file_url}')">
    `;
  } else if (message.message_type === 'gif' && message.file_url) {
    content.innerHTML = `
      ${formatText(message.content)}<br>
      <img src="${message.file_url}" data-gif="true" style="max-width: 300px; max-height: 300px; border-radius: 8px; margin-top: 8px; cursor: pointer;" onclick="openImageModal('${message.file_url}')">
    `;
  } else if (message.message_type === 'video' && message.file_url) {
    content.innerHTML = `
      ${formatText(message.content)}<br>
      <video controls style="max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px;">
        <source src="${message.file_url}">
      </video>
    `;
  } else if (message.message_type === 'file' && message.file_url) {
    content.innerHTML = `
      ${formatText(message.content)}<br>
      <a href="${message.file_url}" target="_blank" style="color: var(--accent);">📎 ${escapeHtml(message.file_name || 'Download File')}</a>
    `;
  } else {
    content.innerHTML = formatText(message.content);
  }
  
  const actions = document.createElement('div');
  actions.style.cssText = 'position: absolute; top: 0; right: 0; display: none; gap: 4px; background: var(--bg-secondary); padding: 4px; border-radius: 4px;';
  actions.innerHTML = `
    <button onclick="setReply(${message.id}, '${escapeHtml(message.username)}', '${escapeHtml(message.content.substring(0, 50))}')" style="background: none; border: none; cursor: pointer; font-size: 16px;">↩️</button>
    ${message.user_id === (currentUser ? currentUser.id : 0) ? `<button onclick="editMessage(${message.id}, '${escapeHtml(message.content)}')" style="background: none; border: none; cursor: pointer; font-size: 16px;">✏️</button>` : ''}
  `;
  
  msgDiv.addEventListener('mouseenter', () => actions.style.display = 'flex');
  msgDiv.addEventListener('mouseleave', () => actions.style.display = 'none');
  
  contentWrapper.appendChild(header);
  contentWrapper.appendChild(content);
  contentWrapper.appendChild(actions);
  
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(contentWrapper);
  
  container.appendChild(msgDiv);
  
  // Add right-click context menu for admins
  if (currentUser.role === 'admin' && message.user_id !== currentUser.id) {
    msgDiv.addEventListener('contextmenu', (e) => {
      if (typeof showModerateUserMenu === 'function') {
        showModerateUserMenu(message.user_id, message.username, e);
      }
    });
    msgDiv.style.cursor = 'context-menu';
  }
  
  // Add admin delete button if user is admin
  if (currentUser.role === 'admin' && typeof addAdminDeleteButton === 'function') {
    addAdminDeleteButton(msgDiv, message.id, message.user_id);
  }
}

function setReply(messageId, username, text) {
  currentReplyTo = { id: messageId, username, text };
  
  const replyBar = document.getElementById('replyBar');
  const replyToUser = document.getElementById('replyToUser');
  const replyToText = document.getElementById('replyToText');
  
  if (replyBar && replyToUser && replyToText) {
    replyToUser.textContent = username;
    replyToText.textContent = text;
    replyBar.style.display = 'flex';
  }
  
  document.getElementById('messageInput')?.focus();
}

function cancelReply() {
  currentReplyTo = null;
  const replyBar = document.getElementById('replyBar');
  if (replyBar) replyBar.style.display = 'none';
}

function editMessage(messageId, content) {
  currentEditMessage = { id: messageId, content };
  
  const input = document.getElementById('messageInput');
  const editBar = document.getElementById('editBar');
  
  if (input && editBar) {
    input.value = content;
    editBar.style.display = 'flex';
    input.focus();
  }
}

function cancelEdit() {
  currentEditMessage = null;
  const input = document.getElementById('messageInput');
  const editBar = document.getElementById('editBar');
  
  if (input) input.value = '';
  if (editBar) editBar.style.display = 'none';
}

function scrollToMessage(messageId) {
  const msgEl = document.getElementById(`msg-${messageId}`);
  if (msgEl) {
    msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    msgEl.style.background = 'rgba(88, 101, 242, 0.3)';
    setTimeout(() => msgEl.style.background = '', 2000);
  }
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  if (!input) return;
  
  const content = input.value.trim();
  const pendingFile = window.pendingFile;
  
  if (!content && !pendingFile) return;
  
  if (!currentRoom && !currentDM) {
    if (typeof showToast === 'function') {
      showToast('Please select a room or DM first', 'warning');
    }
    return;
  }
  
  // Check if announcement room and user is not admin
  if (currentRoom && currentRoom.is_announcement && currentUser.role !== 'admin') {
    if (typeof showToast === 'function') {
      showToast('Only admins can post in announcements', 'error');
    }
    return;
  }
  
  const roomId = currentRoom ? currentRoom.id : currentDM.id;
  
  try {
    const supabase = getSupabase();
    
    let fileUrl = null;
    let fileName = null;
    let messageType = 'text';
    
    // Handle file upload
    if (pendingFile) {
      fileUrl = await uploadFile(pendingFile);
      if (!fileUrl) return;
      
      fileName = pendingFile.name;
      
      if (pendingFile.type.startsWith('image/')) {
        messageType = 'image';
      } else if (pendingFile.type.startsWith('video/')) {
        messageType = 'video';
      } else {
        messageType = 'file';
      }
      
      window.pendingFile = null;
      cancelFile();
    }
    
    // Handle editing
    if (currentEditMessage) {
      const { error } = await supabase
        .from('messages')
        .update({
          content: content,
          edited_at: new Date().toISOString()
        })
        .eq('id', currentEditMessage.id);
      
      if (error) throw error;
      
      const msgEl = document.getElementById(`msg-${currentEditMessage.id}`);
      if (msgEl) {
        const contentEl = msgEl.querySelector('.message-content');
        if (contentEl) {
          contentEl.innerHTML = formatText(content);
        }
      }
      
      input.value = '';
      cancelEdit();
      updateCharCounter('');
      return;
    }
    
    // Build message data
    const messageData = {
      room_id: roomId,
      user_id: currentUser.id,
      username: currentUser.username,
      content: content || fileName || 'File',
      message_type: messageType,
      file_url: fileUrl,
      file_name: fileName
    };
    
    // Add reply data if replying
    if (currentReplyTo) {
      messageData.reply_to = currentReplyTo.id;
      messageData.reply_text = currentReplyTo.text;
    }
    
    // Send message
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
    
    // Clear input and reset state
    input.value = '';
    input.style.height = 'auto'; // Reset textarea height
    updateCharCounter('');
    cancelReply();
    
    // Add to UI
    addMessageToUI(data);
    
    // Track reputation for message
    if (typeof trackMessageSent === 'function') {
      trackMessageSent(currentUser.id);
    }
    
    // Scroll to bottom
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

// Update character counter
function updateCharCounter(text) {
  const counter = document.getElementById('charCount');
  if (!counter) return;
  
  const length = text.length;
  
  if (length > 1800) {
    counter.textContent = `${length}/2000`;
    counter.style.color = '#f04747';
  } else if (length > 0) {
    counter.textContent = `${length}/2000`;
    counter.style.color = 'var(--text-tertiary)';
  } else {
    counter.textContent = '';
  }
}

const messageInput = document.getElementById('messageInput');
if (messageInput) {
  messageInput.addEventListener('keydown', (e) => {
    // Enter without Shift = Send message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Shift+Enter = New line (default textarea behavior)
  });
  
  messageInput.addEventListener('input', (e) => {
    updateCharCounter(e.target.value);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
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

console.log('Chat.js loaded (with reply, mentions, edit)');
