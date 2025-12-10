// ============================================
// ROWCHAT - CHAT MESSAGING (WITH REPLY & MENTIONS)
// ============================================

let replyingTo = null;
let editingMessage = null;
let unreadCount = 0;
let isAtBottom = true;
let mentionSuggestions = [];
let mentionStartPos = -1;

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
  
  // Check if this message mentions current user
  const mentionsMe = message.content && message.content.includes(`@${currentUser.username}`);
  if (mentionsMe) {
    msgDiv.style.background = 'rgba(250, 166, 26, 0.1)';
    msgDiv.style.borderLeft = '3px solid #faa61a';
    msgDiv.style.paddingLeft = '9px';
  }
  
  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  if (user && user.avatar_url) {
    avatar.innerHTML = `<img src="${user.avatar_url}" alt="${user.username}">`;
  } else {
    avatar.textContent = (message.username || (user ? user.username : 'U')).charAt(0).toUpperCase();
  }
  
  // Content wrapper
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'message-content-wrapper';
  contentWrapper.style.flex = '1';
  
  // Reply preview (if replying to another message)
  if (message.reply_to) {
    const replyPreview = createReplyPreview(message.reply_to);
    if (replyPreview) {
      contentWrapper.appendChild(replyPreview);
    }
  }
  
  // Header
  const header = document.createElement('div');
  header.className = 'message-header';
  
  const username = document.createElement('span');
  username.className = 'message-username';
  username.textContent = message.username || (user ? user.username : 'Unknown');
  
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
  
  contentWrapper.appendChild(header);
  contentWrapper.appendChild(content);
  
  // Actions
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  actions.style.cssText = 'display: none; position: absolute; top: -10px; right: 10px; background: var(--bg-tertiary); border-radius: 6px; padding: 4px; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
  
  // Reply button (for all messages)
  const replyBtn = document.createElement('button');
  replyBtn.className = 'icon-btn';
  replyBtn.textContent = '↩️';
  replyBtn.title = 'Reply';
  replyBtn.onclick = () => setReply(message);
  actions.appendChild(replyBtn);
  
  // Edit/Delete (only for own messages)
  if (isOwn) {
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
  }
  
  msgDiv.style.position = 'relative';
  msgDiv.appendChild(actions);
  
  msgDiv.addEventListener('mouseenter', () => {
    actions.style.display = 'flex';
  });
  msgDiv.addEventListener('mouseleave', () => {
    actions.style.display = 'none';
  });
  
  msgDiv.appendChild(avatar);
  msgDiv.appendChild(contentWrapper);
  
  container.appendChild(msgDiv);
  
  // Check if user is at bottom before adding message
  checkScrollPosition();
  
  // If at bottom or own message, scroll down
  if (isAtBottom || isOwn) {
    scrollToBottom();
  } else {
    // User is scrolled up, increment unread
    if (!isOwn) {
      unreadCount++;
      showNewMessageBanner();
    }
  }
}

// Create Reply Preview
function createReplyPreview(replyToId) {
  // Find the replied message in the DOM
  const repliedMsg = messagesCache[currentRoom?.id]?.find(m => m.id === replyToId);
  
  if (!repliedMsg) return null;
  
  const replyUser = getUser(repliedMsg.user_id);
  
  const previewDiv = document.createElement('div');
  previewDiv.className = 'reply-preview';
  previewDiv.style.cssText = `
    background: var(--bg-tertiary);
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    padding: 6px 10px;
    margin-bottom: 6px;
    font-size: 12px;
    cursor: pointer;
  `;
  
  previewDiv.innerHTML = `
    <div style="color: var(--accent); font-weight: 600; margin-bottom: 2px;">
      ↩️ Replying to ${escapeHtml(replyUser.username)}
    </div>
    <div style="color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
      ${escapeHtml(repliedMsg.content.substring(0, 100))}${repliedMsg.content.length > 100 ? '...' : ''}
    </div>
  `;
  
  // Click to scroll to original message
  previewDiv.onclick = () => {
    const originalMsg = document.getElementById(`msg-${replyToId}`);
    if (originalMsg) {
      originalMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      originalMsg.style.background = 'rgba(88, 101, 242, 0.2)';
      setTimeout(() => {
        originalMsg.style.background = '';
      }, 2000);
    }
  };
  
  return previewDiv;
}

// Process Message Content (with mentions)
function processMessageContent(content, type, fileUrl) {
  if (type === 'image' && fileUrl) {
    return `${processMentions(escapeHtml(content))}<br><img src="${fileUrl}" onclick="openImageModal('${fileUrl}')" style="max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px; cursor: pointer;">`;
  }
  
  if (type === 'video' && fileUrl) {
    return `${processMentions(escapeHtml(content))}<br><video controls style="max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px;"><source src="${fileUrl}"></video>`;
  }
  
  if (type === 'file' && fileUrl) {
    return `${processMentions(escapeHtml(content))}<br><a href="${fileUrl}" target="_blank" style="color: var(--accent);">📎 Download File</a>`;
  }
  
  // Process mentions and links
  let processed = escapeHtml(content);
  
  // Convert mentions FIRST (before URLs)
  processed = processMentions(processed);
  
  // Convert URLs to links
  processed = processed.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: var(--accent);">$1</a>');
  
  return processed;
}

// Process Mentions
function processMentions(text) {
  // Find all @username mentions
  return text.replace(/@(\w+)/g, (match, username) => {
    // Check if this user exists
    const user = Object.values(usersCache).find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (user) {
      const isCurrentUser = user.id === currentUser.id;
      return `<span class="mention ${isCurrentUser ? 'mention-me' : ''}" style="
        background: ${isCurrentUser ? 'rgba(250, 166, 26, 0.2)' : 'rgba(88, 101, 242, 0.2)'};
        color: ${isCurrentUser ? '#faa61a' : 'var(--accent)'};
        padding: 2px 4px;
        border-radius: 4px;
        font-weight: 600;
        cursor: pointer;
      " onclick="openUserProfile(${user.id})">@${escapeHtml(username)}</span>`;
    }
    
    return match;
  });
}

// Check Scroll Position
function checkScrollPosition() {
  const container = document.getElementById('messagesContainer');
  const threshold = 100; // pixels from bottom
  isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

// Scroll to Bottom
function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
  unreadCount = 0;
  hideNewMessageBanner();
}

// Show New Message Banner
function showNewMessageBanner() {
  let banner = document.getElementById('newMessageBanner');
  
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'newMessageBanner';
    banner.style.cssText = `
      position: absolute;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--accent);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      z-index: 1000;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideInUp 0.3s ease;
    `;
    banner.onclick = scrollToBottom;
    document.querySelector('.main-content').appendChild(banner);
  }
  
  banner.textContent = `${unreadCount} new message${unreadCount > 1 ? 's' : ''}`;
  banner.style.display = 'block';
}

// Hide New Message Banner
function hideNewMessageBanner() {
  const banner = document.getElementById('newMessageBanner');
  if (banner) {
    banner.style.display = 'none';
  }
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
    
    // Hide mention suggestions
    hideMentionSuggestions();
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
  
  // Reset unread
  unreadCount = 0;
  hideNewMessageBanner();
  
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
    if (!messagesCache[roomId]) messagesCache[roomId] = [];
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
  
  // Check for mentions
  handleMentionInput(e);
  
  // Update typing status
  updateTypingStatus(true);
});

// Handle Mention Input
function handleMentionInput(e) {
  const input = e.target;
  const cursorPos = input.selectionStart;
  const text = input.value;
  
  // Find if we're typing after an @
  const beforeCursor = text.substring(0, cursorPos);
  const lastAtIndex = beforeCursor.lastIndexOf('@');
  
  if (lastAtIndex !== -1) {
    const afterAt = beforeCursor.substring(lastAtIndex + 1);
    
    // Check if there's a space after @
    if (!afterAt.includes(' ')) {
      // Show mention suggestions
      mentionStartPos = lastAtIndex;
      showMentionSuggestions(afterAt);
      return;
    }
  }
  
  // Hide suggestions
  hideMentionSuggestions();
}

// Show Mention Suggestions
function showMentionSuggestions(query) {
  // Get room members
  let members = [];
  if (currentRoom && currentRoom.members) {
    members = currentRoom.members.map(id => usersCache[id]).filter(u => u);
  }
  
  // Filter by query
  const filtered = members.filter(u => 
    u.username.toLowerCase().startsWith(query.toLowerCase())
  ).slice(0, 5);
  
  if (filtered.length === 0) {
    hideMentionSuggestions();
    return;
  }
  
  let suggestionsDiv = document.getElementById('mentionSuggestions');
  
  if (!suggestionsDiv) {
    suggestionsDiv = document.createElement('div');
    suggestionsDiv.id = 'mentionSuggestions';
    suggestionsDiv.style.cssText = `
      position: absolute;
      bottom: 70px;
      left: 20px;
      background: var(--bg-secondary);
      border: 1px solid var(--bg-tertiary);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
      z-index: 1000;
    `;
    document.querySelector('.chat-input-container').appendChild(suggestionsDiv);
  }
  
  suggestionsDiv.innerHTML = filtered.map((user, index) => `
    <div class="mention-suggestion" data-index="${index}" style="
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      transition: background 0.2s;
    " onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background=''" onclick="insertMention('${user.username}')">
      <div class="dm-avatar" style="width: 24px; height: 24px; font-size: 12px;">
        ${user.avatar_url ? `<img src="${user.avatar_url}">` : user.username.charAt(0).toUpperCase()}
      </div>
      <span style="color: var(--text-primary); font-size: 14px;">${escapeHtml(user.username)}</span>
    </div>
  `).join('');
  
  mentionSuggestions = filtered;
}

// Hide Mention Suggestions
function hideMentionSuggestions() {
  const suggestionsDiv = document.getElementById('mentionSuggestions');
  if (suggestionsDiv) {
    suggestionsDiv.remove();
  }
  mentionSuggestions = [];
  mentionStartPos = -1;
}

// Insert Mention
function insertMention(username) {
  const input = document.getElementById('messageInput');
  const text = input.value;
  
  // Replace from @ to cursor position with mention
  const before = text.substring(0, mentionStartPos);
  const after = text.substring(input.selectionStart);
  
  input.value = before + '@' + username + ' ' + after;
  
  // Set cursor after mention
  const newPos = before.length + username.length + 2;
  input.setSelectionRange(newPos, newPos);
  input.focus();
  
  hideMentionSuggestions();
}

messageInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Scroll listener
const messagesContainer = document.getElementById('messagesContainer');
messagesContainer?.addEventListener('scroll', checkScrollPosition);

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

// Open User Profile (placeholder)
function openUserProfile(userId) {
  const user = getUser(userId);
  showToast(`Profile: ${user.username}`, 'info');
  // TODO: Implement user profile modal
}

console.log('Chat.js loaded (WITH REPLY & MENTIONS)');
