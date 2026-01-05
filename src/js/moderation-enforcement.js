// MODERATION ENFORCEMENT - BAN & TIMEOUT CHECKING

let currentBanStatus = null;
let currentTimeoutStatus = null;
let timeoutCheckInterval = null;

// Check if user is banned on app load
async function checkUserBan() {
  if (!currentUser || !hardwareId) return;
  
  try {
    const supabase = getSupabase();
    
    // Check both user ID and hardware ID
    const { data: bans, error } = await supabase
      .from('bans')
      .select('*')
      .eq('is_active', true)
      .or(`user_id.eq.${currentUser.id},hardware_id.eq.${hardwareId}`)
      .or('expires_at.is.null,expires_at.gt.now()');
    
    if (error) throw error;
    
    if (bans && bans.length > 0) {
      const ban = bans[0];
      currentBanStatus = ban;
      showBanScreen(ban);
      return true;
    }
    
    currentBanStatus = null;
    return false;
    
  } catch (error) {
    console.error('Error checking ban status:', error);
    return false;
  }
}

// Show ban screen
function showBanScreen(ban) {
  const isPermanent = !ban.expires_at;
  const expiresText = isPermanent 
    ? 'Permanent' 
    : 'Until ' + new Date(ban.expires_at).toLocaleString();
  
  // Create ban overlay
  const overlay = document.createElement('div');
  overlay.id = 'banOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
  `;
  
  overlay.innerHTML = `
    <div style="
      background: var(--bg-secondary);
      padding: 40px;
      border-radius: 12px;
      max-width: 500px;
      text-align: center;
      border: 3px solid #f04747;
    ">
      <div style="font-size: 64px; margin-bottom: 20px;">🚫</div>
      <h2 style="color: #f04747; margin-bottom: 20px; font-size: 28px;">Account Banned</h2>
      <div style="background: var(--bg-tertiary); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: var(--text-secondary); margin-bottom: 10px;"><strong>Reason:</strong></p>
        <p style="color: var(--text-primary); font-size: 16px;">${ban.reason}</p>
      </div>
      <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: var(--text-secondary); margin-bottom: 5px;"><strong>Duration:</strong></p>
        <p style="color: #f04747; font-size: 18px; font-weight: 600;">${expiresText}</p>
      </div>
      <p style="color: var(--text-tertiary); font-size: 14px; margin-bottom: 20px;">
        Banned by: <strong>${ban.banned_by || 'System'}</strong><br>
        Ban Type: <strong>${ban.ban_type === 'hardware' ? 'Hardware Ban' : 'Account Ban'}</strong>
      </p>
      <p style="color: var(--text-tertiary); font-size: 13px;">
        To appeal this ban, contact: <a href="mailto:witchnock@gmail.com" style="color: var(--accent);">witchnock@gmail.com</a>
      </p>
      <button onclick="logout()" style="
        margin-top: 20px;
        padding: 12px 24px;
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
      ">Log Out</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Disable all inputs
  disableAllInputs();
}

// Check if user is timed out in current room
async function checkRoomTimeout() {
  if (!currentUser || !currentRoom) return false;
  
  try {
    const supabase = getSupabase();
    
    const { data: timeout, error } = await supabase
      .from('timeouts')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('room_id', currentRoom.id)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (timeout) {
      currentTimeoutStatus = timeout;
      showTimeoutMessage(timeout);
      return true;
    }
    
    currentTimeoutStatus = null;
    hideTimeoutMessage();
    return false;
    
  } catch (error) {
    console.error('Error checking timeout:', error);
    return false;
  }
}

// Show timeout message in chat input
function showTimeoutMessage(timeout) {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  
  if (messageInput) {
    messageInput.disabled = true;
    messageInput.placeholder = 'You are timed out in this room';
  }
  
  if (sendBtn) {
    sendBtn.disabled = true;
  }
  
  // Show countdown
  updateTimeoutCountdown(timeout);
}

// Hide timeout message
function hideTimeoutMessage() {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  
  if (messageInput && !currentTimeoutStatus) {
    messageInput.disabled = false;
    messageInput.placeholder = 'Type a message...';
  }
  
  if (sendBtn && !currentTimeoutStatus) {
    sendBtn.disabled = false;
  }
  
  // Clear countdown
  const countdown = document.getElementById('timeoutCountdown');
  if (countdown) countdown.remove();
}

// Update timeout countdown
function updateTimeoutCountdown(timeout) {
  let countdown = document.getElementById('timeoutCountdown');
  
  if (!countdown) {
    countdown = document.createElement('div');
    countdown.id = 'timeoutCountdown';
    countdown.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(240, 71, 71, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(countdown);
  }
  
  const updateCountdown = () => {
    const now = new Date();
    const expiresAt = new Date(timeout.expires_at);
    const remaining = expiresAt - now;
    
    if (remaining <= 0) {
      hideTimeoutMessage();
      currentTimeoutStatus = null;
      checkRoomTimeout(); // Recheck
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    countdown.innerHTML = `
      ⏱️ Timed out: ${minutes}m ${seconds}s remaining<br>
      <small style="opacity: 0.8;">${timeout.reason}</small>
    `;
  };
  
  updateCountdown();
  const interval = setInterval(() => {
    if (!currentTimeoutStatus) {
      clearInterval(interval);
      return;
    }
    updateCountdown();
  }, 1000);
}

// Disable all inputs when banned
function disableAllInputs() {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  
  if (messageInput) messageInput.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  
  // Disable all buttons
  document.querySelectorAll('button').forEach(btn => {
    if (btn.onclick !== logout) {
      btn.disabled = true;
    }
  });
}

// Start timeout checking interval
function startTimeoutChecking() {
  if (timeoutCheckInterval) clearInterval(timeoutCheckInterval);
  
  timeoutCheckInterval = setInterval(() => {
    if (currentRoom) {
      checkRoomTimeout();
    }
  }, 5000); // Check every 5 seconds
}

// Stop timeout checking
function stopTimeoutChecking() {
  if (timeoutCheckInterval) {
    clearInterval(timeoutCheckInterval);
    timeoutCheckInterval = null;
  }
}

console.log('Moderation enforcement loaded');
