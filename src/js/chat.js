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
    
    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(fileName);
    
    return publicUrl;
    
  } catch (error) {
    console.error('Error uploading file:', error);
    showToast('Failed to upload file', 'error');
    return null;
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMessageContent(content) {
  if (!content) return '';
  
  let formatted = escapeHtml(content);
  
  // Format @mentions
  formatted = formatted.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  
  // Format **bold**
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Format *italic*
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Format `code`
  formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');
  
  // Format URLs
  formatted = formatted.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  
  return formatted;
}

function getMentionedUsername(content) {
  if (!content) return null;
  
  const match = content.match(/@(\w+)/);
  return match ? match[1] : null;
}

function isUserMentioned(content, username) {
  if (!content || !username) return false;
  
  const mentionedUsername = getMentionedUsername(content);
  if (!mentionedUsername) return false;
  
  const isCurrentUser = currentUser && username.toLowerCase() === currentUser.username.toLowerCase();
  return isCurrentUser;
}

async function loadMessages() {
  try {
    const supabase = getSupabase();
    const container = document.getElementById('messagesContainer');
    
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">Loading messages...</div>';
    
    const roomId = currentRoom ? currentRoom.id : (currentDM ? currentDM.id : null);
    if (!roomId) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">Select a room or DM to start chatting</div>';
      return;
    }
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (error) throw error;
    
    container.innerHTML = '';
    
    if (!messages || messages.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary);">No messages yet. Start the conversation!</div>';
      return;
    }
    
    messages.forEach(message => addMessageToUI(message));
    
    container.scrollTop = container.scrollHeight;
    
  } catch (error) {
    console.error('Error loading messages:', error);
    showToast('Failed to load messages', 'error');
  }
}

function addMessageToUI(message) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;
  
  const isMentioned = message.content && currentUser && message.content.toLowerCase().includes('@' + currentUser.username.toLowerCase());
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message' + (isMentioned ? ' mentioned' : '');
  messageDiv.dataset.messageId = message.id;
  
  const user = getUser(message.user_id);
  const avatarUrl = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`;
  
  let replyHTML = '';
  if (message.reply_to) {
    const replyToMsg = Array.from(container.querySelectorAll('.message')).find(m => m.dataset.messageId == message.reply_to);
    if (replyToMsg) {
      const replyUser = replyToMsg.querySelector('.message-username').textContent;
      const replyContent = replyToMsg.querySelector('.message-content').textContent.substring(0, 50);
      replyHTML = `<div class="message-reply" onclick="scrollToMessage(${message.reply_to})">↩️ Replying to ${replyUser}: ${replyContent}...</div>`;
    }
  }
  
  messageDiv.innerHTML = `
    <div class="message-avatar" onclick="openProfileView(${message.user_id})">
      <img src="${avatarUrl}" alt="${escapeHtml(user.username)}">
    </div>
    <div class="message-main">
      ${replyHTML}
      <div class="message-header">
        <span class="message-username" onclick="openProfileView(${message.user_id})">${escapeHtml(user.username)}</span>
        ${getUserBadges(user)}
        <span class="message-timestamp">${formatTimestamp(message.created_at)}</span>
      </div>
      <div class="message-content">${formatMessageContent(message.content)}</div>
      ${message.attachment_url ? `<div class="message-attachment"><img src="${message.attachment_url}" alt="attachment"></div>` : ''}
      ${message.edited_at ? '<span class="message-edited">(edited)</span>' : ''}
      <div class="message-actions">
        <button class="icon-btn" onclick="replyToMessage(${message.id}, '${escapeHtml(user.username)}')">↩️</button>
        ${message.user_id === currentUser.id ? `<button class="icon-btn" onclick="editMessage(${message.id}, '${escapeHtml(message.content)}')">✏️</button>` : ''}
        ${message.user_id === currentUser.id || currentUser.role === 'admin' ? `<button class="icon-btn" onclick="deleteMessage(${message.id})">🗑️</button>` : ''}
      </div>
    </div>
  `;
  
  container.appendChild(messageDiv);
}

function getUserBadges(user) {
  if (!user) return '';
  
  let badges = '';
  
  if (user.role === 'admin') {
    badges += '<span class="user-badge admin-badge">👑 Admin</span>';
  }
  
  return badges;
}

function scrollToMessage(messageId) {
  const messageDiv = document.querySelector(`.message[data-message-id="${messageId}"]`);
  if (messageDiv) {
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageDiv.style.background = 'var(--accent-bg)';
    setTimeout(() => {
      messageDiv.style.background = '';
    }, 2000);
  }
}

function replyToMessage(messageId, username) {
  currentReplyTo = messageId;
  
  const input = document.getElementById('messageInput');
  if (input) {
    input.focus();
  }
  
  const replyBar = document.getElementById('replyBar');
  if (replyBar) {
    replyBar.style.display = 'flex';
    replyBar.innerHTML = `
      <span>Replying to ${username}</span>
      <button onclick="cancelReply()">✕</button>
    `;
  }
}

function cancelReply() {
  currentReplyTo = null;
  
  const replyBar = document.getElementById('replyBar');
  if (replyBar) {
    replyBar.style.display = 'none';
  }
}

function editMessage(messageId, content) {
  currentEditMessage = messageId;
  
  const input = document.getElementById('messageInput');
  if (input) {
    input.value = content;
    input.focus();
  }
  
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.textContent = '✓';
  }
}

function cancelEdit() {
  currentEditMessage = null;
  
  const input = document.getElementById('messageInput');
  if (input) {
    input.value = '';
  }
  
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.innerHTML = '➤';
  }
}

async function deleteMessage(messageId) {
  if (!confirm('Delete this message?')) return;
  
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    
    if (error) throw error;
    
    const messageDiv = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageDiv) {
      messageDiv.remove();
    }
    
    showToast('Message deleted', 'success');
    
  } catch (error) {
    console.error('Error deleting message:', error);
    showToast('Failed to delete message', 'error');
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
  
  // MODERATION FILTERS
  if (content && typeof filterMessage === 'function') {
    const filterResult = await filterMessage(content, currentUser.id);
    
    // Show confirmation for sensitive data
    if (filterResult.needsConfirm) {
      showConfirmSensitiveModal(filterResult.confirmMessage, () => {
        actualSendMessage(filterResult.censored);
      });
      return;
    }
    
    // Check if banned
    if (filterResult.banned) {
      showToast(filterResult.bannedReason || 'You are banned', 'error');
      return;
    }
    
    // Check if timed out
    if (filterResult.timedOut) {
      showToast('You are timed out in this room', 'error');
      return;
    }
    
    // Message was blocked
    if (filterResult.blocked) {
      // Already showed toast in filterMessage
      return;
    }
    
    // Use censored content
    actualSendMessage(filterResult.censored);
  } else {
    actualSendMessage(content);
  }
}

async function actualSendMessage(content) {
  const input = document.getElementById('messageInput');
  const pendingFile = window.pendingFile;
  
  try {
    const supabase = getSupabase();
    
    let attachmentUrl = null;
    if (pendingFile) {
      attachmentUrl = await uploadFile(pendingFile);
      if (!attachmentUrl) return;
    }
    
    const roomId = currentRoom ? currentRoom.id : (currentDM ? currentDM.id : null);
    
    if (currentEditMessage) {
      const { error } = await supabase
        .from('messages')
        .update({
          content: content,
          edited_at: new Date().toISOString()
        })
        .eq('id', currentEditMessage);
      
      if (error) throw error;
      
      const messageDiv = document.querySelector(`.message[data-message-id="${currentEditMessage}"]`);
      if (messageDiv) {
        const contentDiv = messageDiv.querySelector('.message-content');
        if (contentDiv) {
          contentDiv.innerHTML = formatMessageContent(content);
        }
        
        const editedSpan = messageDiv.querySelector('.message-edited');
        if (!editedSpan) {
          const mainDiv = messageDiv.querySelector('.message-main');
          if (mainDiv) {
            const span = document.createElement('span');
            span.className = 'message-edited';
            span.textContent = '(edited)';
            mainDiv.appendChild(span);
          }
        }
      }
      
      cancelEdit();
      
    } else {
      const messageData = {
        room_id: roomId,
        user_id: currentUser.id,
        content: content
      };
      
      if (attachmentUrl) {
        messageData.attachment_url = attachmentUrl;
      }
      
      if (currentReplyTo) {
        messageData.reply_to = currentReplyTo;
      }
      
      const { error } = await supabase
        .from('messages')
        .insert([messageData]);
      
      if (error) throw error;
      
      cancelReply();
      
      // Track XP if gamification is loaded
      if (typeof trackMessageSent === 'function') {
        await trackMessageSent();
      }
    }
    
    input.value = '';
    window.pendingFile = null;
    
    const preview = document.getElementById('filePreview');
    if (preview) {
      preview.innerHTML = '';
      preview.style.display = 'none';
    }
    
    const charCount = document.getElementById('charCount');
    if (charCount) {
      charCount.textContent = '0/2000';
    }
    
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('Failed to send message', 'error');
  }
}

function showConfirmSensitiveModal(message, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>⚠️ Sensitive Data Detected</h2>
      </div>
      <div class="modal-body">
        <p>${message}</p>
        <p><strong>Are you sure you want to send this?</strong></p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-danger" onclick="this.closest('.modal-overlay').remove(); (${onConfirm.toString()})()">Send Anyway</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

console.log('Chat.js loaded (REVERTED - NO HARDWARE BANS)');
