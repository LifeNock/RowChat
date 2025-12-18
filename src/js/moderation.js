// MODERATION SYSTEM - Auto-filters, Detection, and Manual Actions

// ==================== BAD WORD LISTS ====================

const SLURS = [
  // Racial slurs (exact words only)
  'nigger', 'nigga', 'nig', 'chink', 'spic', 'kike', 'wetback', 'gook', 'coon', 'redskin',
  'paki', 'beaner', 'cracker', 'zipperhead', 'towelhead', 'sandnigger', 'n1gger', 'n1gga',
  // Homophobic slurs
  'faggot', 'fag', 'dyke', 'tranny', 'f4ggot', 'f4g',
  // Misogynistic slurs
  'cunt', 'whore', 'slut', 'bitch', 'c0nt',
  // Religious slurs
  'raghead',
  // Disability slurs
  'retard', 'retarded', 'cripple', 'r3tard', 'r3tarded'
];

const BAD_WORDS = [
  // Profanity (exact words only)
  'fuck', 'shit', 'piss', 'damn', 'ass', 'bastard', 'cock', 'dick', 'pussy',
  'fuk', 'fck', 'f0ck', 'sh1t', 'sh!t', 'a55', 'b1tch', 'd1ck', 'p0rn',
  'asshole', 'arsehole', 'bullshit', 'motherfucker', 'mf', 'mofo'
];

const SELF_HARM_PHRASES = [
  'kill yourself', 'kys', 'neck yourself', 'end yourself', 'commit suicide',
  'hang yourself', 'k y s', 'k.y.s', 'k-y-s', 'unalive yourself', 'rope yourself',
  'kill your self', 'end your life', 'kms', 'kill my self'
];

const SCAM_PATTERNS = [
  /free\s+nitro/i,
  /click\s+here\s+to\s+claim/i,
  /congratulations.*won/i,
  /verify\s+your\s+account/i,
  /steam.*community.*gift/i,
  /discord.*gift/i
];

const INVITE_LINK_PATTERNS = [
  /discord\.gg\/[\w-]+/i,
  /discord\.com\/invite\/[\w-]+/i,
  /dsc\.gg\/[\w-]+/i
];

const SENSITIVE_DATA_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g
};

// Helper function to check if word contains bad word with exact boundaries
function containsBadWord(text, badWord) {
  const textLower = text.toLowerCase();
  const badWordLower = badWord.toLowerCase();
  
  // Direct exact match
  if (textLower === badWordLower) return true;
  
  // Check for exact word match with word boundaries
  const exactRegex = new RegExp(`\\b${badWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (exactRegex.test(text)) return true;
  
  // Check for spaced out version (F U C K, f-u-c-k, etc)
  const spacedPattern = badWord.split('').join('[\\s\\-_.]?');
  const spacedRegex = new RegExp(spacedPattern, 'i');
  if (spacedRegex.test(text)) return true;
  
  // Remove all spaces/punctuation and check
  const normalizedText = textLower.replace(/[\s\-_.]/g, '');
  const normalizedBad = badWordLower.replace(/[\s\-_.]/g, '');
  if (normalizedText.includes(normalizedBad)) return true;
  
  // Check for l33t speak
  const leetText = textLower
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i');
  
  if (leetText.includes(badWordLower)) return true;
  
  return false;
}

// ==================== USER RATE LIMITING ====================

const userMessageHistory = new Map(); // userId -> [timestamps]

function checkRateLimit(userId) {
  const now = Date.now();
  const history = userMessageHistory.get(userId) || [];
  
  // Remove timestamps older than 10 seconds
  const recent = history.filter(t => now - t < 10000);
  
  if (recent.length >= 5) {
    return { limited: true, count: recent.length };
  }
  
  recent.push(now);
  userMessageHistory.set(userId, recent);
  
  return { limited: false };
}

// ==================== MESSAGE FILTERING ====================

function detectSensitiveData(text) {
  const detected = [];
  
  for (const [type, pattern] of Object.entries(SENSITIVE_DATA_PATTERNS)) {
    if (pattern.test(text)) {
      detected.push(type);
    }
  }
  
  return detected;
}

async function filterMessage(content, userId) {
  const result = {
    allowed: true,
    action: null,
    reason: null,
    censored: content,
    needsConfirm: false,
    confirmMessage: null
  };
  
  // Check sensitive data (emails, phones, IPs) - CONFIRM instead of block (applies to everyone)
  const sensitiveData = detectSensitiveData(content);
  if (sensitiveData.length > 0) {
    result.needsConfirm = true;
    result.confirmMessage = `Your message contains ${sensitiveData.join(', ')}. Are you sure this is safe to send?`;
    return result;
  }
  
  // Check self-harm phrases
  const lowerContent = content.toLowerCase();
  for (const phrase of SELF_HARM_PHRASES) {
    if (lowerContent.includes(phrase)) {
      result.allowed = false;
      result.action = 'delete';
      result.reason = 'self_harm';
      await showSelfHarmResources();
      await flagMessage(userId, content, 'self_harm');
      return result;
    }
  }
  
  // Check slurs - instant delete + warn (check entire message)
  const contentLower = content.toLowerCase();
  for (const slur of SLURS) {
    if (containsBadWord(contentLower, slur)) {
      result.allowed = false;
      result.action = 'delete';
      result.reason = 'slur';
      await autoWarn(userId, 'Use of hate speech/slurs', 3);
      await flagMessage(userId, content, 'slur');
      return result;
    }
  }
  
  // Check bad words - censor with ### (only whole words)
  let censored = content;
  const words = content.split(/\b/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (const badWord of BAD_WORDS) {
      if (containsBadWord(word, badWord)) {
        words[i] = '#'.repeat(word.length);
        break;
      }
    }
  }
  
  censored = words.join('');
  
  // Load custom bad words from database
  try {
    const supabase = getSupabase();
    const { data: customWords } = await supabase
      .from('bad_words')
      .select('word, action, severity');
    
    if (customWords) {
      for (const entry of customWords) {
        if (containsBadWord(content, entry.word)) {
          if (entry.action === 'delete') {
            result.allowed = false;
            result.action = 'delete';
            result.reason = 'custom_bad_word';
            await flagMessage(userId, content, 'bad_word');
            return result;
          } else if (entry.action === 'censor') {
            // Re-process with custom word
            const customWords = censored.split(/\b/);
            for (let i = 0; i < customWords.length; i++) {
              if (containsBadWord(customWords[i], entry.word)) {
                customWords[i] = '#'.repeat(customWords[i].length);
              }
            }
            censored = customWords.join('');
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading custom bad words:', error);
  }
  
  result.censored = censored;
  
  // Check scam links
  for (const pattern of SCAM_PATTERNS) {
    if (pattern.test(content)) {
      result.allowed = false;
      result.action = 'delete';
      result.reason = 'scam_link';
      await flagMessage(userId, content, 'scam_link');
      return result;
    }
  }
  
  // Check invite links
  for (const pattern of INVITE_LINK_PATTERNS) {
    if (pattern.test(content)) {
      result.allowed = false;
      result.action = 'delete';
      result.reason = 'invite_link';
      await flagMessage(userId, content, 'invite_link');
      return result;
    }
  }
  
  // Check spam (repeated characters, caps)
  if (detectSpam(content)) {
    result.action = 'flag';
    result.reason = 'spam';
    await flagMessage(userId, content, 'spam');
  }
  
  // Check rate limiting
  const rateLimit = checkRateLimit(userId);
  if (rateLimit.limited) {
    result.allowed = false;
    result.action = 'rate_limit';
    result.reason = 'rate_limit';
    showToast('Slow down! You are sending messages too quickly.', 'warning');
    return result;
  }
  
  return result;
}

function detectSpam(content) {
  // Check caps spam (70% or more caps)
  const capsCount = (content.match(/[A-Z]/g) || []).length;
  const letterCount = (content.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 10 && (capsCount / letterCount) > 0.7) {
    return true;
  }
  
  // Check repeated characters (same char 5+ times)
  if (/(.)\1{4,}/.test(content)) {
    return true;
  }
  
  // Check emoji spam (10+ emojis)
  const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 10) {
    return true;
  }
  
  return false;
}

async function flagMessage(userId, content, reason) {
  try {
    const supabase = getSupabase();
    await supabase.from('flagged_messages').insert([{
      message_id: 0, // Will be set after message is created
      user_id: userId,
      room_id: currentRoom ? currentRoom.id : (currentDM ? currentDM.id : null),
      flag_reason: reason,
      content: content.substring(0, 500),
      auto_action: 'flagged_only'
    }]);
  } catch (error) {
    console.error('Error flagging message:', error);
  }
}

async function autoWarn(userId, reason, severity) {
  try {
    const supabase = getSupabase();
    
    // Add warning
    await supabase.from('warnings').insert([{
      user_id: userId,
      warned_by: null, // Auto-warning
      reason: reason,
      severity: severity,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    }]);
    
    // Update user behavior
    await supabase.rpc('increment', {
      table_name: 'user_behavior',
      column_name: 'warning_count',
      row_id: userId,
      increment_by: 1
    });
    
    // Log audit
    await logAudit('auto_warn', null, userId, null, reason, { severity });
    
  } catch (error) {
    console.error('Error auto-warning user:', error);
  }
}

function showSelfHarmResources() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>We're Here to Help</h2>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 16px;">If you're struggling with thoughts of self-harm, please know that you're not alone and help is available.</p>
        <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <h3 style="margin-bottom: 12px;">Crisis Resources:</h3>
          <p><strong>National Suicide Prevention Lifeline:</strong><br>1-800-273-8255 (24/7)</p>
          <p><strong>Crisis Text Line:</strong><br>Text HOME to 741741</p>
          <p><strong>International:</strong><br><a href="https://findahelpline.com" target="_blank" style="color: var(--accent);">findahelpline.com</a></p>
        </div>
        <p style="font-size: 14px; color: var(--text-secondary);">Your message was not sent. Please reach out to someone you trust or contact a crisis resource.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">I Understand</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ==================== MANUAL MODERATION ACTIONS ====================

async function banUser(userId, reason, duration = null) {
  try {
    const supabase = getSupabase();
    
    const banData = {
      user_id: userId,
      banned_by: currentUser.id,
      reason: reason,
      ban_type: duration ? 'temporary' : 'permanent'
    };
    
    if (duration) {
      banData.expires_at = new Date(Date.now() + duration).toISOString();
    }
    
    const { error } = await supabase.from('bans').insert([banData]);
    if (error) throw error;
    
    await logAudit('ban', currentUser.id, userId, null, reason, { duration });
    
    showToast(`User banned: ${reason}`, 'success');
    
  } catch (error) {
    console.error('Error banning user:', error);
    showToast('Failed to ban user', 'error');
  }
}

async function unbanUser(userId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('bans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (error) throw error;
    
    await logAudit('unban', currentUser.id, userId, null, 'Unbanned by moderator');
    
    showToast('User unbanned', 'success');
    
  } catch (error) {
    console.error('Error unbanning user:', error);
    showToast('Failed to unban user', 'error');
  }
}

async function timeoutUser(userId, roomId, reason, duration) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase.from('timeouts').insert([{
      user_id: userId,
      room_id: roomId,
      timed_out_by: currentUser.id,
      reason: reason,
      expires_at: new Date(Date.now() + duration).toISOString()
    }]);
    
    if (error) throw error;
    
    await logAudit('timeout', currentUser.id, userId, null, reason, { duration, room_id: roomId });
    
    showToast(`User timed out for ${formatDuration(duration)}`, 'success');
    
  } catch (error) {
    console.error('Error timing out user:', error);
    showToast('Failed to timeout user', 'error');
  }
}

async function removeTimeout(userId, roomId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('timeouts')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .eq('is_active', true);
    
    if (error) throw error;
    
    await logAudit('remove_timeout', currentUser.id, userId, null, 'Timeout removed by moderator', { room_id: roomId });
    
    showToast('Timeout removed', 'success');
    
  } catch (error) {
    console.error('Error removing timeout:', error);
    showToast('Failed to remove timeout', 'error');
  }
}

async function warnUser(userId, reason, severity = 1) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase.from('warnings').insert([{
      user_id: userId,
      warned_by: currentUser.id,
      reason: reason,
      severity: severity,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    }]);
    
    if (error) throw error;
    
    await logAudit('warn', currentUser.id, userId, null, reason, { severity });
    
    showToast('Warning issued', 'success');
    
  } catch (error) {
    console.error('Error warning user:', error);
    showToast('Failed to warn user', 'error');
  }
}

async function logAudit(actionType, moderatorId, targetUserId, targetMessageId, reason, metadata = {}) {
  try {
    const supabase = getSupabase();
    
    await supabase.from('audit_logs').insert([{
      action_type: actionType,
      moderator_id: moderatorId,
      target_user_id: targetUserId,
      target_message_id: targetMessageId,
      room_id: currentRoom ? currentRoom.id : (currentDM ? currentDM.id : null),
      reason: reason,
      metadata: metadata
    }]);
    
  } catch (error) {
    console.error('Error logging audit:', error);
  }
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

async function checkUserBanned(userId) {
  try {
    const supabase = getSupabase();
    
    const { data: bans } = await supabase
      .from('bans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!bans || bans.length === 0) return null;
    
    const ban = bans[0];
    
    // Check if temp ban expired
    if (ban.ban_type === 'temporary' && new Date(ban.expires_at) < new Date()) {
      await supabase
        .from('bans')
        .update({ is_active: false })
        .eq('id', ban.id);
      return null;
    }
    
    return ban;
    
  } catch (error) {
    console.error('Error checking ban:', error);
    return null;
  }
}

async function checkUserTimedOut(userId, roomId) {
  try {
    const supabase = getSupabase();
    
    const { data: timeouts } = await supabase
      .from('timeouts')
      .select('*')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!timeouts || timeouts.length === 0) return null;
    
    const timeout = timeouts[0];
    
    // Check if expired
    if (new Date(timeout.expires_at) < new Date()) {
      await supabase
        .from('timeouts')
        .update({ is_active: false })
        .eq('id', timeout.id);
      return null;
    }
    
    return timeout;
    
  } catch (error) {
    console.error('Error checking timeout:', error);
    return null;
  }
}

console.log('Moderation system loaded');

// ==================== ADMIN PANEL FUNCTIONS ====================

function openAdminPanel() {
  if (currentUser.role !== 'admin') {
    showToast('Access denied', 'error');
    return;
  }
  
  document.getElementById('adminPanelModal')?.classList.add('active');
  loadAdminDashboard();
}

function closeAdminPanel() {
  document.getElementById('adminPanelModal')?.classList.remove('active');
}

function switchAdminTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-admin-tab="${tabName}"]`)?.classList.add('active');
  
  // Update content
  document.querySelectorAll('.admin-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`admin${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`)?.classList.add('active');
  
  // Load data for specific tabs
  if (tabName === 'dashboard') {
    loadAdminDashboard();
  } else if (tabName === 'bans') {
    loadBanManagement();
  } else if (tabName === 'timeouts') {
    loadTimeoutManagement();
  } else if (tabName === 'flagged') {
    loadFlaggedMessages();
  } else if (tabName === 'reports') {
    loadReports();
  } else if (tabName === 'audit') {
    loadAuditLogs();
  } else if (tabName === 'filters') {
    loadFilterSettings();
  } else if (tabName === 'words') {
    loadBadWords();
  }
}

async function loadAdminDashboard() {
  try {
    const supabase = getSupabase();
    
    // Get stats
    const [bans, timeouts, warnings, flagged, reports] = await Promise.all([
      supabase.from('bans').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('timeouts').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('warnings').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('flagged_messages').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    ]);
    
    document.getElementById('statsActiveBans').textContent = bans.count || 0;
    document.getElementById('statsActiveTimeouts').textContent = timeouts.count || 0;
    document.getElementById('statsActiveWarnings').textContent = warnings.count || 0;
    document.getElementById('statsFlaggedMessages').textContent = flagged.count || 0;
    document.getElementById('statsPendingReports').textContent = reports.count || 0;
    
    // Load recent actions
    const { data: recentActions } = await supabase
      .from('audit_logs')
      .select('*, moderator:moderator_id(username), target:target_user_id(username)')
      .order('created_at', { ascending: false })
      .limit(10);
    
    const container = document.getElementById('recentActionsList');
    if (container && recentActions) {
      container.innerHTML = '';
      
      recentActions.forEach(action => {
        const div = document.createElement('div');
        div.className = 'audit-log-entry';
        div.innerHTML = `
          <div class="audit-log-info">
            <strong>${formatActionType(action.action_type)}</strong>
            <span>${action.moderator?.username || 'System'} → ${action.target?.username || 'Unknown'}</span>
          </div>
          <div class="audit-log-time">${formatTime(action.created_at)}</div>
        `;
        container.appendChild(div);
      });
    }
    
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
  }
}

async function loadBanManagement() {
  try {
    const supabase = getSupabase();
    
    const { data: bans } = await supabase
      .from('bans')
      .select('*, user:user_id(username, avatar_url), banned_by_user:banned_by(username)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    const container = document.getElementById('bansList');
    if (!container) return;
    
    if (!bans || bans.length === 0) {
      container.innerHTML = '<div class="empty-state">No active bans</div>';
      return;
    }
    
    container.innerHTML = '';
    
    bans.forEach(ban => {
      const div = document.createElement('div');
      div.className = 'moderation-entry';
      
      const timeLeft = ban.ban_type === 'permanent' ? 'Permanent' : `Expires: ${formatTime(ban.expires_at)}`;
      
      div.innerHTML = `
        <div class="moderation-entry-user">
          <div class="moderation-entry-avatar">
            ${ban.user.avatar_url ? `<img src="${ban.user.avatar_url}">` : ban.user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="moderation-entry-username">${ban.user.username}</div>
            <div class="moderation-entry-meta">${ban.ban_type} - ${timeLeft}</div>
          </div>
        </div>
        <div class="moderation-entry-reason">${ban.reason}</div>
        <div class="moderation-entry-actions">
          <button class="btn-danger-sm" onclick="confirmUnban(${ban.user_id})">Unban</button>
        </div>
      `;
      
      container.appendChild(div);
    });
    
  } catch (error) {
    console.error('Error loading bans:', error);
  }
}

async function loadTimeoutManagement() {
  try {
    const supabase = getSupabase();
    
    const { data: timeouts } = await supabase
      .from('timeouts')
      .select('*, user:user_id(username, avatar_url), room:room_id(name), timed_out_by_user:timed_out_by(username)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    const container = document.getElementById('timeoutsList');
    if (!container) return;
    
    if (!timeouts || timeouts.length === 0) {
      container.innerHTML = '<div class="empty-state">No active timeouts</div>';
      return;
    }
    
    container.innerHTML = '';
    
    timeouts.forEach(timeout => {
      const div = document.createElement('div');
      div.className = 'moderation-entry';
      
      const timeLeft = Math.max(0, new Date(timeout.expires_at) - new Date());
      const timeLeftStr = formatDuration(timeLeft);
      
      div.innerHTML = `
        <div class="moderation-entry-user">
          <div class="moderation-entry-avatar">
            ${timeout.user.avatar_url ? `<img src="${timeout.user.avatar_url}">` : timeout.user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="moderation-entry-username">${timeout.user.username}</div>
            <div class="moderation-entry-meta">Room: ${timeout.room?.name || 'Unknown'} - ${timeLeftStr} left</div>
          </div>
        </div>
        <div class="moderation-entry-reason">${timeout.reason}</div>
        <div class="moderation-entry-actions">
          <button class="btn-secondary-sm" onclick="removeTimeout(${timeout.user_id}, ${timeout.room_id})">Remove</button>
        </div>
      `;
      
      container.appendChild(div);
    });
    
  } catch (error) {
    console.error('Error loading timeouts:', error);
  }
}

async function loadFlaggedMessages() {
  try {
    const supabase = getSupabase();
    
    const { data: flagged } = await supabase
      .from('flagged_messages')
      .select('*, user:user_id(username, avatar_url), room:room_id(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    
    const container = document.getElementById('flaggedMessagesList');
    if (!container) return;
    
    if (!flagged || flagged.length === 0) {
      container.innerHTML = '<div class="empty-state">No flagged messages</div>';
      return;
    }
    
    container.innerHTML = '';
    
    flagged.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'flagged-message-entry';
      
      div.innerHTML = `
        <div class="flagged-message-header">
          <span class="flagged-message-user">${msg.user?.username || 'Unknown'}</span>
          <span class="flagged-message-reason badge-${msg.flag_reason}">${formatFlagReason(msg.flag_reason)}</span>
          <span class="flagged-message-time">${formatTime(msg.created_at)}</span>
        </div>
        <div class="flagged-message-content">${escapeHtml(msg.content)}</div>
        <div class="flagged-message-actions">
          <button class="btn-secondary-sm" onclick="approveFlaggedMessage(${msg.id})">Approve</button>
          <button class="btn-danger-sm" onclick="deleteFlaggedMessage(${msg.id}, ${msg.message_id})">Delete</button>
          <button class="btn-warning-sm" onclick="warnUserFromFlag(${msg.user_id}, '${escapeHtml(msg.flag_reason)}')">Warn User</button>
        </div>
      `;
      
      container.appendChild(div);
    });
    
  } catch (error) {
    console.error('Error loading flagged messages:', error);
  }
}

async function loadReports() {
  try {
    const supabase = getSupabase();
    
    const { data: reports } = await supabase
      .from('reports')
      .select('*, reporter:reporter_id(username), reported:reported_user_id(username, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    const container = document.getElementById('reportsList');
    if (!container) return;
    
    if (!reports || reports.length === 0) {
      container.innerHTML = '<div class="empty-state">No pending reports</div>';
      return;
    }
    
    container.innerHTML = '';
    
    reports.forEach(report => {
      const div = document.createElement('div');
      div.className = 'report-entry';
      
      div.innerHTML = `
        <div class="report-header">
          <span class="report-type badge-${report.report_type}">${formatReportType(report.report_type)}</span>
          <span class="report-time">${formatTime(report.created_at)}</span>
        </div>
        <div class="report-body">
          <div class="report-users">
            <strong>Reporter:</strong> ${report.reporter?.username || 'Anonymous'}
            <strong>Reported:</strong> ${report.reported?.username || 'Unknown'}
          </div>
          <div class="report-reason">${escapeHtml(report.reason)}</div>
        </div>
        <div class="report-actions">
          <button class="btn-primary-sm" onclick="viewReportDetails(${report.id})">View Details</button>
          <button class="btn-danger-sm" onclick="resolveReport(${report.id}, 'action_taken')">Take Action</button>
          <button class="btn-secondary-sm" onclick="resolveReport(${report.id}, 'dismissed')">Dismiss</button>
        </div>
      `;
      
      container.appendChild(div);
    });
    
  } catch (error) {
    console.error('Error loading reports:', error);
  }
}

async function loadAuditLogs(filters = {}) {
  try {
    const supabase = getSupabase();
    
    let query = supabase
      .from('audit_logs')
      .select('*, moderator:moderator_id(username), target:target_user_id(username)')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (filters.action_type) {
      query = query.eq('action_type', filters.action_type);
    }
    
    const { data: logs } = await query;
    
    const container = document.getElementById('auditLogsList');
    if (!container) return;
    
    if (!logs || logs.length === 0) {
      container.innerHTML = '<div class="empty-state">No audit logs</div>';
      return;
    }
    
    container.innerHTML = '';
    
    logs.forEach(log => {
      const div = document.createElement('div');
      div.className = 'audit-log-entry';
      
      div.innerHTML = `
        <div class="audit-log-type">${formatActionType(log.action_type)}</div>
        <div class="audit-log-details">
          <strong>Moderator:</strong> ${log.moderator?.username || 'System'}<br>
          <strong>Target:</strong> ${log.target?.username || 'N/A'}<br>
          ${log.reason ? `<strong>Reason:</strong> ${escapeHtml(log.reason)}<br>` : ''}
        </div>
        <div class="audit-log-time">${formatTime(log.created_at)}</div>
      `;
      
      container.appendChild(div);
    });
    
  } catch (error) {
    console.error('Error loading audit logs:', error);
  }
}

async function loadFilterSettings() {
  try {
    const supabase = getSupabase();
    
    const { data: filters } = await supabase
      .from('filter_settings')
      .select('*')
      .order('filter_name');
    
    const container = document.getElementById('filterSettingsList');
    if (!container) return;
    
    if (!filters) return;
    
    container.innerHTML = '';
    
    filters.forEach(filter => {
      const div = document.createElement('div');
      div.className = 'filter-setting-entry';
      
      div.innerHTML = `
        <div class="filter-setting-info">
          <div class="filter-setting-name">${formatFilterName(filter.filter_name)}</div>
          <div class="filter-setting-action">Action: ${filter.action}</div>
        </div>
        <div class="filter-setting-toggle">
          <label class="toggle-switch">
            <input type="checkbox" ${filter.enabled ? 'checked' : ''} onchange="toggleFilter('${filter.filter_name}', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;
      
      container.appendChild(div);
    });
    
  } catch (error) {
    console.error('Error loading filter settings:', error);
  }
}

async function loadBadWords() {
  try {
    const supabase = getSupabase();
    
    const { data: words } = await supabase
      .from('bad_words')
      .select('*')
      .order('created_at', { ascending: false });
    
    const container = document.getElementById('badWordsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!words || words.length === 0) {
      container.innerHTML = '<div class="empty-state">No custom bad words</div>';
      return;
    }
    
    words.forEach(word => {
      const div = document.createElement('div');
      div.className = 'bad-word-entry';
      
      div.innerHTML = `
        <div class="bad-word-text">${escapeHtml(word.word)}</div>
        <div class="bad-word-severity">Severity: ${word.severity}</div>
        <div class="bad-word-action">Action: ${word.action}</div>
        <button class="btn-danger-sm" onclick="removeBadWord(${word.id})">Remove</button>
      `;
      
      container.appendChild(div);
    });
    
  } catch (error) {
    console.error('Error loading bad words:', error);
  }
}

// ==================== QUICK ACTION FUNCTIONS ====================

function confirmUnban(userId) {
  if (confirm('Are you sure you want to unban this user?')) {
    unbanUser(userId);
    setTimeout(() => loadBanManagement(), 500);
  }
}

async function approveFlaggedMessage(flagId) {
  try {
    const supabase = getSupabase();
    
    await supabase
      .from('flagged_messages')
      .update({ status: 'approved', reviewed_by: currentUser.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId);
    
    showToast('Message approved', 'success');
    loadFlaggedMessages();
    
  } catch (error) {
    console.error('Error approving message:', error);
    showToast('Failed to approve message', 'error');
  }
}

async function deleteFlaggedMessage(flagId, messageId) {
  try {
    const supabase = getSupabase();
    
    // Delete the actual message
    await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    
    // Update flag status
    await supabase
      .from('flagged_messages')
      .update({ status: 'removed', reviewed_by: currentUser.id, reviewed_at: new Date().toISOString() })
      .eq('id', flagId);
    
    showToast('Message deleted', 'success');
    loadFlaggedMessages();
    
  } catch (error) {
    console.error('Error deleting message:', error);
    showToast('Failed to delete message', 'error');
  }
}

function warnUserFromFlag(userId, reason) {
  openWarnModal(userId, reason);
}

async function resolveReport(reportId, resolution) {
  try {
    const supabase = getSupabase();
    
    await supabase
      .from('reports')
      .update({ 
        status: resolution, 
        resolved_by: currentUser.id, 
        resolved_at: new Date().toISOString() 
      })
      .eq('id', reportId);
    
    showToast('Report resolved', 'success');
    loadReports();
    
  } catch (error) {
    console.error('Error resolving report:', error);
    showToast('Failed to resolve report', 'error');
  }
}

async function toggleFilter(filterName, enabled) {
  try {
    const supabase = getSupabase();
    
    await supabase
      .from('filter_settings')
      .update({ enabled: enabled })
      .eq('filter_name', filterName);
    
    showToast(`Filter ${enabled ? 'enabled' : 'disabled'}`, 'success');
    
  } catch (error) {
    console.error('Error toggling filter:', error);
    showToast('Failed to update filter', 'error');
  }
}

async function addBadWord() {
  const word = prompt('Enter word to add to bad words list:');
  if (!word) return;
  
  const severity = prompt('Enter severity (1=mild, 2=moderate, 3=severe):', '2');
  const action = prompt('Enter action (censor, delete, warn, timeout):', 'censor');
  
  try {
    const supabase = getSupabase();
    
    await supabase.from('bad_words').insert([{
      word: word.toLowerCase(),
      severity: parseInt(severity) || 2,
      action: action,
      added_by: currentUser.id
    }]);
    
    showToast('Bad word added', 'success');
    loadBadWords();
    
  } catch (error) {
    console.error('Error adding bad word:', error);
    showToast('Failed to add bad word', 'error');
  }
}

async function removeBadWord(wordId) {
  if (!confirm('Remove this word from the list?')) return;
  
  try {
    const supabase = getSupabase();
    
    await supabase
      .from('bad_words')
      .delete()
      .eq('id', wordId);
    
    showToast('Bad word removed', 'success');
    loadBadWords();
    
  } catch (error) {
    console.error('Error removing bad word:', error);
    showToast('Failed to remove bad word', 'error');
  }
}

// ==================== USER CONTEXT MENU ACTIONS ====================

let pendingBanUserId = null;
let pendingBanUsername = null;
let pendingTimeoutUserId = null;
let pendingTimeoutUsername = null;
let pendingWarnUserId = null;
let pendingWarnUsername = null;

function showModerateUserMenu(userId, username, event) {
  if (currentUser.role !== 'admin') return;
  
  event.preventDefault();
  
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = event.pageX + 'px';
  menu.style.top = event.pageY + 'px';
  
  menu.innerHTML = `
    <div class="context-menu-item" onclick="openBanModal(${userId}, '${username}')">Ban User</div>
    <div class="context-menu-item" onclick="openTimeoutModal(${userId}, '${username}')">Timeout User</div>
    <div class="context-menu-item" onclick="openWarnModal(${userId}, '${username}')">Warn User</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick="openProfileView(${userId})">View Profile</div>
  `;
  
  document.body.appendChild(menu);
  
  setTimeout(() => {
    document.addEventListener('click', function closeMenu() {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    });
  }, 10);
}

// ==================== BAN MODAL ====================

function openBanModal(userId, username) {
  pendingBanUserId = userId;
  pendingBanUsername = username;
  
  const modal = document.getElementById('banModal');
  const usernameField = document.getElementById('banUsername');
  const reasonField = document.getElementById('banReason');
  const typeSelect = document.getElementById('banType');
  const durationGroup = document.getElementById('banDurationGroup');
  
  if (usernameField) usernameField.value = username;
  if (reasonField) reasonField.value = '';
  if (typeSelect) typeSelect.value = 'permanent';
  if (durationGroup) durationGroup.style.display = 'none';
  
  if (modal) modal.classList.add('active');
}

function closeBanModal() {
  const modal = document.getElementById('banModal');
  if (modal) modal.classList.remove('active');
  
  pendingBanUserId = null;
  pendingBanUsername = null;
}

function toggleBanDuration() {
  const type = document.getElementById('banType').value;
  const durationGroup = document.getElementById('banDurationGroup');
  
  if (durationGroup) {
    durationGroup.style.display = type === 'temporary' ? 'block' : 'none';
  }
}

async function executeBan() {
  if (!pendingBanUserId) return;
  
  const reason = document.getElementById('banReason').value.trim();
  const type = document.getElementById('banType').value;
  
  if (!reason) {
    showToast('Please provide a reason', 'warning');
    return;
  }
  
  let duration = null;
  if (type === 'temporary') {
    const durationSelect = document.getElementById('banDuration');
    duration = durationSelect ? durationSelect.value : null;
    
    if (!duration) {
      showToast('Please select a duration', 'warning');
      return;
    }
  }
  
  try {
    await banUser(pendingBanUserId, reason, duration);
    showToast(`User ${pendingBanUsername} has been banned`, 'success');
    closeBanModal();
  } catch (error) {
    console.error('Error executing ban:', error);
    showToast('Failed to ban user', 'error');
  }
}

// ==================== TIMEOUT MODAL ====================

function openTimeoutModal(userId, username) {
  pendingTimeoutUserId = userId;
  pendingTimeoutUsername = username;
  
  const modal = document.getElementById('timeoutModal');
  const usernameField = document.getElementById('timeoutUsername');
  const reasonField = document.getElementById('timeoutReason');
  const durationField = document.getElementById('timeoutDurationCustom');
  
  if (usernameField) usernameField.value = username;
  if (reasonField) reasonField.value = '';
  if (durationField) durationField.value = '';
  
  if (modal) modal.classList.add('active');
}

function closeTimeoutModal() {
  const modal = document.getElementById('timeoutModal');
  if (modal) modal.classList.remove('active');
  
  pendingTimeoutUserId = null;
  pendingTimeoutUsername = null;
}

function setTimeoutDuration(minutes) {
  const durationField = document.getElementById('timeoutDurationCustom');
  if (durationField) durationField.value = minutes;
}

async function executeTimeout() {
  if (!pendingTimeoutUserId) return;
  
  const reason = document.getElementById('timeoutReason').value.trim();
  const durationField = document.getElementById('timeoutDurationCustom');
  const duration = durationField ? parseInt(durationField.value) : null;
  
  if (!reason) {
    showToast('Please provide a reason', 'warning');
    return;
  }
  
  if (!duration || duration <= 0) {
    showToast('Please set a duration', 'warning');
    return;
  }
  
  const roomId = currentRoom ? currentRoom.id : null;
  if (!roomId) {
    showToast('No room selected', 'error');
    return;
  }
  
  try {
    await timeoutUser(pendingTimeoutUserId, roomId, reason, duration * 60 * 1000); // Convert to ms
    showToast(`User ${pendingTimeoutUsername} has been timed out for ${duration} minutes`, 'success');
    closeTimeoutModal();
  } catch (error) {
    console.error('Error executing timeout:', error);
    showToast('Failed to timeout user', 'error');
  }
}

// ==================== WARN MODAL ====================

function openWarnModal(userId, username) {
  pendingWarnUserId = userId;
  pendingWarnUsername = username;
  
  const modal = document.getElementById('warnModal');
  const usernameField = document.getElementById('warnUsername');
  const reasonField = document.getElementById('warnReason');
  const severitySelect = document.getElementById('warnSeverity');
  
  if (usernameField) usernameField.value = username;
  if (reasonField) reasonField.value = '';
  if (severitySelect) severitySelect.value = '2';
  
  if (modal) modal.classList.add('active');
}

function closeWarnModal() {
  const modal = document.getElementById('warnModal');
  if (modal) modal.classList.remove('active');
  
  pendingWarnUserId = null;
  pendingWarnUsername = null;
}

async function executeWarn() {
  if (!pendingWarnUserId) return;
  
  const reason = document.getElementById('warnReason').value.trim();
  const severitySelect = document.getElementById('warnSeverity');
  const severity = severitySelect ? parseInt(severitySelect.value) : 2;
  
  if (!reason) {
    showToast('Please provide a reason', 'warning');
    return;
  }
  
  try {
    await warnUser(pendingWarnUserId, reason, severity);
    showToast(`User ${pendingWarnUsername} has been warned`, 'success');
    closeWarnModal();
  } catch (error) {
    console.error('Error executing warn:', error);
    showToast('Failed to warn user', 'error');
  }
}

// ==================== FORMAT HELPER FUNCTIONS ====================

function formatActionType(type) {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatFlagReason(reason) {
  return reason.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatReportType(type) {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatFilterName(name) {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

console.log('Moderation admin functions loaded');
