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

// Helper function to normalize text for comparison (handles leetspeak and common substitutions)
function normalizeText(text) {
  return text.toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i');
}

// Improved function to check if text contains bad word with proper word boundaries
function containsBadWord(text, badWord) {
  const textLower = text.toLowerCase();
  const badWordLower = badWord.toLowerCase();
  
  // 1. Direct exact match (entire text is the bad word)
  if (textLower === badWordLower) return true;
  
  // 2. Check for exact word match with proper word boundaries
  // This prevents "class" from matching "ass" because word boundaries require non-letter characters
  const exactRegex = new RegExp(`\\b${badWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (exactRegex.test(text)) return true;
  
  // 3. Check for spaced/separated versions (F U C K, f-u-c-k, f.u.c.k)
  // Only matches if ALL letters are separated by the same delimiter
  const spacedPattern = badWord.split('').join('[\\s\\-_.]');
  const spacedRegex = new RegExp(`\\b${spacedPattern}\\b`, 'i');
  if (spacedRegex.test(text)) return true;
  
  // 4. Check normalized text with word boundaries (handles leetspeak)
  // Normalize both the text and the bad word, then check with word boundaries
  const normalizedText = normalizeText(text);
  const normalizedBad = normalizeText(badWord);
  const normalizedRegex = new RegExp(`\\b${normalizedBad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  if (normalizedRegex.test(normalizedText)) return true;
  
  // 5. Check for the bad word with spaces/punctuation removed BUT only as a complete word
  // This catches "a s s" or "a.s.s" but NOT "class" because we check word boundaries first
  const strippedText = textLower.replace(/[\s\-_.]/g, '');
  const strippedBad = badWordLower.replace(/[\s\-_.]/g, '');
  
  // Only check if the stripped bad word appears as a standalone sequence
  // We use a more restrictive pattern that requires the match to be isolated
  if (strippedBad.length >= 3) { // Only do this check for words 3+ chars
    // Create a pattern that ensures we're not matching in the middle of a larger word
    // by checking that it's either at start/end or surrounded by non-letters
    const words = text.split(/\s+/);
    for (const word of words) {
      const strippedWord = word.toLowerCase().replace(/[\s\-_.]/g, '');
      if (strippedWord === strippedBad) {
        return true;
      }
    }
  }
  
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
  const words = content.split(/(\s+)/); // Split but keep whitespace
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Skip whitespace tokens
    if (word.trim().length === 0) continue;
    
    for (const badWord of BAD_WORDS) {
      if (containsBadWord(word, badWord)) {
        // Replace with ### but preserve length
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
            const customWords = censored.split(/(\s+)/);
            for (let i = 0; i < customWords.length; i++) {
              if (customWords[i].trim().length === 0) continue;
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
  if (letterCount > 10 && capsCount / letterCount > 0.7) {
    return true;
  }
  
  // Check repeated characters (same char 5+ times in a row)
  if (/(.)\1{4,}/.test(content)) {
    return true;
  }
  
  return false;
}

// ==================== AUTO WARN SYSTEM ====================

async function autoWarn(userId, reason, severity) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('warnings')
      .insert([{
        user_id: userId,
        warned_by: 'system',
        reason: reason,
        severity: severity,
        auto_generated: true
      }]);
    
    if (error) throw error;
    
    // Broadcast warning to user if they're online
    await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        type: 'warning',
        content: `You have been automatically warned: ${reason}`,
        severity: severity
      }]);
    
  } catch (error) {
    console.error('Error auto-warning user:', error);
  }
}

// ==================== FLAG MESSAGE SYSTEM ====================

async function flagMessage(userId, content, reason) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('message_flags')
      .insert([{
        user_id: userId,
        content: content,
        reason: reason,
        flagged_at: new Date().toISOString(),
        auto_flagged: true
      }]);
    
    if (error) throw error;
    
  } catch (error) {
    console.error('Error flagging message:', error);
  }
}

// ==================== SELF-HARM RESOURCES ====================

async function showSelfHarmResources() {
  const resources = `
    <div class="self-harm-resources">
      <h3>We're here to help</h3>
      <p>If you're struggling with thoughts of self-harm, please reach out:</p>
      <ul>
        <li><strong>National Suicide Prevention Lifeline:</strong> 988</li>
        <li><strong>Crisis Text Line:</strong> Text HOME to 741741</li>
        <li><strong>International Association for Suicide Prevention:</strong> <a href="https://www.iasp.info/resources/Crisis_Centres/" target="_blank">Find help in your country</a></li>
      </ul>
      <p>You matter, and there are people who care about you.</p>
    </div>
  `;
  
  // Show modal or toast with resources
  if (typeof showModal === 'function') {
    showModal('Support Resources', resources);
  } else {
    showToast('If you need help, please call 988 or text HOME to 741741', 'warning', 10000);
  }
}

// ==================== ADMIN MODERATION FUNCTIONS ====================

let pendingBanUserId = null;
let pendingBanUsername = null;
let pendingTimeoutUserId = null;
let pendingTimeoutUsername = null;
let pendingWarnUserId = null;
let pendingWarnUsername = null;

// Manual ban user
async function banUser(userId, reason, duration = null) {
  try {
    const supabase = getSupabase();
    
    const banData = {
      user_id: userId,
      banned_by: currentUser.id,
      reason: reason,
      banned_at: new Date().toISOString()
    };
    
    if (duration) {
      const durationMs = parseDuration(duration);
      const expiresAt = new Date(Date.now() + durationMs);
      banData.expires_at = expiresAt.toISOString();
      banData.is_permanent = false;
    } else {
      banData.is_permanent = true;
    }
    
    const { error: banError } = await supabase
      .from('bans')
      .insert([banData]);
    
    if (banError) throw banError;
    
    // Update user banned status
    const { error: userError } = await supabase
      .from('users')
      .update({ is_banned: true })
      .eq('id', userId);
    
    if (userError) throw userError;
    
    // Force disconnect the user
    await forceDisconnectUser(userId);
    
    console.log('User banned successfully:', userId);
    
  } catch (error) {
    console.error('Error banning user:', error);
    throw error;
  }
}

// Timeout user (temporary mute in a room)
async function timeoutUser(userId, roomId, reason, duration) {
  try {
    const supabase = getSupabase();
    
    const expiresAt = new Date(Date.now() + duration);
    
    const { error } = await supabase
      .from('timeouts')
      .insert([{
        user_id: userId,
        room_id: roomId,
        reason: reason,
        issued_by: currentUser.id,
        expires_at: expiresAt.toISOString()
      }]);
    
    if (error) throw error;
    
    console.log('User timed out successfully:', userId);
    
  } catch (error) {
    console.error('Error timing out user:', error);
    throw error;
  }
}

// Warn user
async function warnUser(userId, reason, severity) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('warnings')
      .insert([{
        user_id: userId,
        warned_by: currentUser.id,
        reason: reason,
        severity: severity,
        auto_generated: false
      }]);
    
    if (error) throw error;
    
    // Send notification to user
    await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        type: 'warning',
        content: `You have been warned by a moderator: ${reason}`,
        severity: severity
      }]);
    
    console.log('User warned successfully:', userId);
    
  } catch (error) {
    console.error('Error warning user:', error);
    throw error;
  }
}

// Delete message
async function deleteMessage(messageId, reason) {
  try {
    const supabase = getSupabase();
    
    // Mark as deleted instead of actually removing
    const { error } = await supabase
      .from('messages')
      .update({ 
        is_deleted: true,
        deleted_by: currentUser.id,
        deleted_reason: reason,
        deleted_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (error) throw error;
    
    console.log('Message deleted:', messageId);
    
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
}

// Parse duration string to milliseconds
function parseDuration(duration) {
  const units = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  
  return units[duration] || 0;
}

// ==================== ADMIN UI - REPORTS PANEL ====================

async function loadReports() {
  try {
    const supabase = getSupabase();
    
    const { data: reports, error } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:users!reports_reporter_id_fkey(id, username),
        reported_user:users!reports_reported_user_id_fkey(id, username),
        message:messages(id, content)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    renderReports(reports || []);
    
  } catch (error) {
    console.error('Error loading reports:', error);
  }
}

function renderReports(reports) {
  const container = document.getElementById('reportsList');
  if (!container) return;
  
  if (reports.length === 0) {
    container.innerHTML = '<div class="empty-reports">No reports to review</div>';
    return;
  }
  
  container.innerHTML = '';
  
  reports.forEach(report => {
    const div = document.createElement('div');
    div.className = `report-item ${report.status}`;
    div.innerHTML = `
      <div class="report-header">
        <span class="report-type">${formatReportType(report.type)}</span>
        <span class="report-status">${report.status}</span>
        <span class="report-time">${formatRelativeTime(report.created_at)}</span>
      </div>
      <div class="report-details">
        <p><strong>Reporter:</strong> ${report.reporter?.username || 'Unknown'}</p>
        <p><strong>Reported User:</strong> ${report.reported_user?.username || 'Unknown'}</p>
        <p><strong>Reason:</strong> ${escapeHtml(report.reason)}</p>
        ${report.message ? `<p><strong>Message:</strong> "${escapeHtml(report.message.content)}"</p>` : ''}
      </div>
      <div class="report-actions">
        <button onclick="resolveReport(${report.id}, 'action_taken')">Take Action</button>
        <button onclick="resolveReport(${report.id}, 'dismissed')">Dismiss</button>
        <button onclick="viewReportDetails(${report.id})">View Details</button>
      </div>
    `;
    container.appendChild(div);
  });
}

async function resolveReport(reportId, status) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('reports')
      .update({ 
        status: status,
        resolved_by: currentUser.id,
        resolved_at: new Date().toISOString()
      })
      .eq('id', reportId);
    
    if (error) throw error;
    
    showToast('Report updated', 'success');
    await loadReports();
    
  } catch (error) {
    console.error('Error resolving report:', error);
    showToast('Failed to update report', 'error');
  }
}

function viewReportDetails(reportId) {
  // Open detailed view modal
  console.log('Viewing report details:', reportId);
}

// ==================== ADMIN UI - FLAGS PANEL ====================

async function loadFlags() {
  try {
    const supabase = getSupabase();
    
    const { data: flags, error } = await supabase
      .from('message_flags')
      .select(`
        *,
        user:users(id, username)
      `)
      .order('flagged_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    renderFlags(flags || []);
    
  } catch (error) {
    console.error('Error loading flags:', error);
  }
}

function renderFlags(flags) {
  const container = document.getElementById('flagsList');
  if (!container) return;
  
  if (flags.length === 0) {
    container.innerHTML = '<div class="empty-flags">No flagged messages</div>';
    return;
  }
  
  container.innerHTML = '';
  
  flags.forEach(flag => {
    const div = document.createElement('div');
    div.className = 'flag-item';
    div.innerHTML = `
      <div class="flag-header">
        <span class="flag-reason">${formatFlagReason(flag.reason)}</span>
        <span class="flag-time">${formatRelativeTime(flag.flagged_at)}</span>
        ${flag.auto_flagged ? '<span class="flag-auto">Auto</span>' : ''}
      </div>
      <div class="flag-details">
        <p><strong>User:</strong> ${flag.user?.username || 'Unknown'}</p>
        <p><strong>Content:</strong> "${escapeHtml(flag.content)}"</p>
      </div>
      <div class="flag-actions">
        <button onclick="openWarnModal(${flag.user_id}, '${flag.user?.username}')">Warn User</button>
        <button onclick="dismissFlag(${flag.id})">Dismiss</button>
      </div>
    `;
    container.appendChild(div);
  });
}

async function dismissFlag(flagId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('message_flags')
      .delete()
      .eq('id', flagId);
    
    if (error) throw error;
    
    showToast('Flag dismissed', 'success');
    await loadFlags();
    
  } catch (error) {
    console.error('Error dismissing flag:', error);
    showToast('Failed to dismiss flag', 'error');
  }
}

// ==================== ADMIN UI - ACTIONS LOG ====================

async function loadModerationActions() {
  try {
    const supabase = getSupabase();
    
    const { data: actions, error } = await supabase
      .from('moderation_actions')
      .select(`
        *,
        moderator:users!moderation_actions_moderator_id_fkey(id, username),
        target_user:users!moderation_actions_target_user_id_fkey(id, username)
      `)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    renderModerationActions(actions || []);
    
  } catch (error) {
    console.error('Error loading moderation actions:', error);
  }
}

function renderModerationActions(actions) {
  const container = document.getElementById('actionsList');
  if (!container) return;
  
  if (actions.length === 0) {
    container.innerHTML = '<div class="empty-actions">No moderation actions</div>';
    return;
  }
  
  container.innerHTML = '';
  
  actions.forEach(action => {
    const div = document.createElement('div');
    div.className = 'action-item';
    div.innerHTML = `
      <div class="action-header">
        <span class="action-type">${formatActionType(action.action_type)}</span>
        <span class="action-time">${formatRelativeTime(action.created_at)}</span>
      </div>
      <div class="action-details">
        <p><strong>Moderator:</strong> ${action.moderator?.username || 'System'}</p>
        <p><strong>Target:</strong> ${action.target_user?.username || 'Unknown'}</p>
        <p><strong>Reason:</strong> ${escapeHtml(action.reason)}</p>
        ${action.duration ? `<p><strong>Duration:</strong> ${action.duration}</p>` : ''}
      </div>
    `;
    container.appendChild(div);
  });
}

// ==================== ADMIN UI - FILTERS PANEL ====================

async function loadCustomFilters() {
  try {
    const supabase = getSupabase();
    
    const { data: filters, error } = await supabase
      .from('bad_words')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    renderCustomFilters(filters || []);
    
  } catch (error) {
    console.error('Error loading custom filters:', error);
  }
}

function renderCustomFilters(filters) {
  const container = document.getElementById('customFiltersList');
  if (!container) return;
  
  if (filters.length === 0) {
    container.innerHTML = '<div class="empty-filters">No custom filters added</div>';
    return;
  }
  
  container.innerHTML = '';
  
  filters.forEach(filter => {
    const div = document.createElement('div');
    div.className = 'filter-item';
    div.innerHTML = `
      <span class="filter-word">${escapeHtml(filter.word)}</span>
      <span class="filter-action">${formatFilterName(filter.action)}</span>
      <span class="filter-severity">Severity: ${filter.severity}</span>
      <button class="filter-remove" onclick="removeCustomFilter(${filter.id})">Remove</button>
    `;
    container.appendChild(div);
  });
}

async function addCustomFilter() {
  const word = document.getElementById('newFilterWord').value.trim();
  const action = document.getElementById('newFilterAction').value;
  const severity = parseInt(document.getElementById('newFilterSeverity').value);
  
  if (!word) {
    showToast('Please enter a word', 'warning');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('bad_words')
      .insert([{
        word: word.toLowerCase(),
        action: action,
        severity: severity,
        added_by: currentUser.id
      }]);
    
    if (error) throw error;
    
    showToast('Filter added', 'success');
    document.getElementById('newFilterWord').value = '';
    await loadCustomFilters();
    
  } catch (error) {
    console.error('Error adding filter:', error);
    showToast('Failed to add filter', 'error');
  }
}

async function removeCustomFilter(filterId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('bad_words')
      .delete()
      .eq('id', filterId);
    
    if (error) throw error;
    
    showToast('Filter removed', 'success');
    await loadCustomFilters();
    
  } catch (error) {
    console.error('Error removing filter:', error);
    showToast('Failed to remove filter', 'error');
  }
}

// ==================== MODERATION CONTEXT MENU ====================

function showModerationMenu(event, userId, username) {
  event.preventDefault();
  event.stopPropagation();
  
  // Remove any existing menu
  const existingMenu = document.querySelector('.moderation-context-menu');
  if (existingMenu) existingMenu.remove();
  
  const menu = document.createElement('div');
  menu.className = 'moderation-context-menu';
  menu.style.left = `${event.pageX}px`;
  menu.style.top = `${event.pageY}px`;
  
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

// Force disconnect user (kick them out)
async function forceDisconnectUser(userId) {
  try {
    const supabase = getSupabase();
    
    // Update user's online status to offline
    await supabase
      .from('users')
      .update({ 
        is_online: false,
        last_seen: new Date().toISOString()
      })
      .eq('id', userId);
    
    console.log('Forced disconnect for user:', userId);
    
  } catch (error) {
    console.error('Error forcing disconnect:', error);
  }
}

// Add contributor role badge display
function getUserRoleBadge(user) {
  if (!user) return '';
  
  const badges = [];
  
  // Admin badge
  if (user.role === 'admin') {
    badges.push('<span class="user-badge admin-badge" title="Administrator">👑 Admin</span>');
  }
  
  // Custom role badges
  if (user.custom_role) {
    const roleColors = {
      'Contributor': '#00d4aa',
      'Tester': '#faa61a',
      'Supporter': '#f04747',
      'VIP': '#ffcb6b'
    };
    
    const color = roleColors[user.custom_role] || '#5865f2';
    badges.push(`<span class="user-badge custom-role-badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color};" title="${user.custom_role}">✨ ${user.custom_role}</span>`);
  }
  
  return badges.join(' ');
}
