// REPUTATION SYSTEM & PROFILE VIEWER

// Reputation thresholds for badges
const REPUTATION_TIERS = {
  newbie: { min: 0, max: 99, name: 'Newbie' },
  member: { min: 100, max: 499, name: 'Member' },
  regular: { min: 500, max: 1499, name: 'Regular' },
  veteran: { min: 1500, max: 4999, name: 'Veteran' },
  legend: { min: 5000, max: 9999, name: 'Legend' },
  mythic: { min: 10000, max: 999999, name: 'Mythic' }
};

// Special badges
const SPECIAL_BADGES = {
  founder: 'Founder',
  contributor: 'Contributor',
  supporter: 'Supporter'
};

// ==================== REPUTATION FUNCTIONS ====================

function getReputationTier(reputation) {
  for (const [tier, data] of Object.entries(REPUTATION_TIERS)) {
    if (reputation >= data.min && reputation <= data.max) {
      return { tier, ...data };
    }
  }
  return { tier: 'newbie', ...REPUTATION_TIERS.newbie };
}

function getReputationBadge(reputation) {
  const tier = getReputationTier(reputation);
  return `<span class="user-badge badge-${tier.tier}">${tier.name}</span>`;
}

function getUserBadges(user) {
  const badges = [];
  
  // Add reputation tier badge
  if (user.reputation !== undefined) {
    const tier = getReputationTier(user.reputation);
    badges.push({ type: tier.tier, name: tier.name });
  }
  
  // Add special badges
  if (user.badges && Array.isArray(user.badges)) {
    user.badges.forEach(badge => {
      if (SPECIAL_BADGES[badge]) {
        badges.push({ type: badge, name: SPECIAL_BADGES[badge] });
      }
    });
  }
  
  return badges;
}

function renderBadges(badges) {
  return badges.map(badge => 
    `<span class="user-badge badge-${badge.type}">${badge.name}</span>`
  ).join('');
}

async function addReputation(userId, eventType, amount, reason = null) {
  try {
    const supabase = getSupabase();
    
    // Add reputation event
    await supabase
      .from('reputation_events')
      .insert([{
        user_id: userId,
        event_type: eventType,
        reputation_change: amount,
        reason: reason
      }]);
    
    // Update user reputation
    const { data: user } = await supabase
      .from('users')
      .select('reputation')
      .eq('id', userId)
      .single();
    
    const newReputation = (user.reputation || 0) + amount;
    
    await supabase
      .from('users')
      .update({ reputation: newReputation })
      .eq('id', userId);
    
    // Update cache
    if (usersCache[userId]) {
      usersCache[userId].reputation = newReputation;
    }
    
    console.log(`Added ${amount} reputation to user ${userId}. New total: ${newReputation}`);
    
  } catch (error) {
    console.error('Error adding reputation:', error);
  }
}

// Auto-award reputation for actions
async function trackMessageSent(userId) {
  await addReputation(userId, 'message_sent', 1, 'Sent a message');
  
  // Update message count
  try {
    const supabase = getSupabase();
    await supabase
      .from('users')
      .update({ message_count: (usersCache[userId]?.message_count || 0) + 1 })
      .eq('id', userId);
  } catch (error) {
    console.error('Error updating message count:', error);
  }
}

async function trackRoomCreated(userId) {
  await addReputation(userId, 'room_created', 10, 'Created a room');
}

async function trackFriendAdded(userId) {
  await addReputation(userId, 'friend_added', 3, 'Added a friend');
}

// ==================== PROFILE SIDEBAR ====================

async function openProfileView(userId) {
  try {
    const supabase = getSupabase();
    
    // Load user data with stats
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    // Load user stats (may not exist)
    let stats = null;
    try {
      const { data: statsData } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      stats = statsData;
    } catch (statsError) {
      console.log('No stats found for user:', statsError);
    }
    
    // Only load friendship if viewing another user
    let friendship = null;
    if (userId !== currentUser.id) {
      try {
        const { data: friendshipData } = await supabase
          .from('friendships')
          .select('*')
          .or(`user1_id.eq.${currentUser.id},user2_id.eq.${userId}`)
          .or(`user1_id.eq.${userId},user2_id.eq.${currentUser.id}`)
          .maybeSingle();
        
        // Filter to ensure it's the right friendship
        if (friendshipData) {
          if ((friendshipData.user1_id === currentUser.id && friendshipData.user2_id === userId) ||
              (friendshipData.user1_id === userId && friendshipData.user2_id === currentUser.id)) {
            friendship = friendshipData;
          }
        }
      } catch (friendError) {
        console.log('No friendship found:', friendError);
      }
    }
    
    renderProfileSidebar(user, stats, friendship);
    
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast('Failed to load profile', 'error');
  }
}

function renderProfileSidebar(user, stats, friendship) {
  // Remove existing sidebar
  const existing = document.getElementById('profileSidebar');
  if (existing) existing.remove();
  
  const existingBackdrop = document.getElementById('profileBackdrop');
  if (existingBackdrop) existingBackdrop.remove();
  
  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'profileBackdrop';
  backdrop.className = 'profile-backdrop';
  backdrop.onclick = closeProfileView;
  document.body.appendChild(backdrop);
  
  // Create sidebar
  const sidebar = document.createElement('div');
  sidebar.id = 'profileSidebar';
  sidebar.className = 'profile-sidebar';
  
  // Get user badges
  const badges = getUserBadges(user);
  const badgesHTML = renderBadges(badges);
  
  // Calculate next tier
  const currentTier = getReputationTier(user.reputation || 0);
  const nextTierKey = Object.keys(REPUTATION_TIERS)[Object.keys(REPUTATION_TIERS).indexOf(currentTier.tier) + 1];
  const nextTier = nextTierKey ? REPUTATION_TIERS[nextTierKey] : null;
  
  let progressPercent = 0;
  let progressText = '';
  if (nextTier) {
    const progress = (user.reputation || 0) - currentTier.min;
    const total = nextTier.min - currentTier.min;
    progressPercent = (progress / total) * 100;
    progressText = `${user.reputation || 0} / ${nextTier.min} to ${nextTier.name}`;
  } else {
    progressPercent = 100;
    progressText = 'Max tier reached!';
  }
  
  // Friendship status
  const isFriend = friendship && friendship.status === 'accepted';
  const isPending = friendship && friendship.status === 'pending';
  
  // Member since
  const joinedDate = user.joined_at ? new Date(user.joined_at).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }) : 'Unknown';
  
  sidebar.innerHTML = `
    <div class="profile-sidebar-header">
      <div style="flex: 1;"></div>
      <button class="profile-close-btn" onclick="closeProfileView()">×</button>
    </div>
    
    <div class="profile-sidebar-content">
      <!-- Avatar -->
      <div class="profile-avatar-large">
        ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}">` : user.username.charAt(0).toUpperCase()}
      </div>
      
      <!-- Username -->
      <div class="profile-username">${escapeHtml(user.username)}</div>
      
      <!-- Badges -->
      <div class="profile-badges-container">
        ${badgesHTML}
      </div>
      
      <!-- Reputation -->
      <div class="profile-reputation">
        <span class="profile-reputation-score">${user.reputation || 0}</span>
        <span class="profile-reputation-label">Reputation Points</span>
        <div class="reputation-progress">
          <div class="reputation-progress-bar">
            <div class="reputation-progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="reputation-progress-text">${progressText}</div>
        </div>
      </div>
      
      <!-- Level & Streak Info -->
      <div class="profile-stats-row">
        <div class="profile-stat-card">
          <div class="profile-stat-icon">⭐</div>
          <div class="profile-stat-info">
            <div class="profile-stat-label">Level</div>
            <div class="profile-stat-value">${user.level || 1}</div>
          </div>
        </div>
        <div class="profile-stat-card">
          <div class="profile-stat-icon">🔥</div>
          <div class="profile-stat-info">
            <div class="profile-stat-label">Streak</div>
            <div class="profile-stat-value">${user.daily_streak || 0} days</div>
          </div>
        </div>
      </div>
      
      <!-- Bio -->
      ${user.bio ? `
        <div class="profile-section">
          <div class="profile-section-title">About</div>
          <div class="profile-bio">${escapeHtml(user.bio)}</div>
        </div>
      ` : ''}
      
      <!-- Stats -->
      <div class="profile-section">
        <div class="profile-section-title">Statistics</div>
        <div class="profile-stat-item">
          <span class="profile-stat-label">Messages Sent</span>
          <span class="profile-stat-value">${user.message_count || 0}</span>
        </div>
        <div class="profile-stat-item">
          <span class="profile-stat-label">Member Since</span>
          <span class="profile-stat-value">${joinedDate}</span>
        </div>
        ${stats ? `
          <div class="profile-stat-item">
            <span class="profile-stat-label">Rooms Joined</span>
            <span class="profile-stat-value">${stats.rooms_joined || 0}</span>
          </div>
          <div class="profile-stat-item">
            <span class="profile-stat-label">Friends</span>
            <span class="profile-stat-value">${stats.friends_count || 0}</span>
          </div>
        ` : ''}
      </div>
      
      <!-- Actions -->
      ${user.id === currentUser.id ? `
        <div class="profile-actions">
          <button class="profile-action-btn profile-action-primary" onclick="closeProfileView(); openProfileModal();">
            Edit Profile
          </button>
        </div>
      ` : `
        <div class="profile-actions">
          ${!isFriend && !isPending ? `
            <button class="profile-action-btn profile-action-primary" onclick="sendFriendRequestFromProfile(${user.id})">
              Add Friend
            </button>
          ` : isPending ? `
            <button class="profile-action-btn profile-action-secondary" disabled>
              Friend Request Pending
            </button>
          ` : `
            <button class="profile-action-btn profile-action-secondary" onclick="startDMFromProfile(${user.id})">
              Send Message
            </button>
          `}
        </div>
      `}
    </div>
  `;
  
  document.body.appendChild(sidebar);
  
  // Animate in
  setTimeout(() => {
    backdrop.classList.add('active');
    sidebar.classList.add('active');
  }, 10);
}

function closeProfileView() {
  const sidebar = document.getElementById('profileSidebar');
  const backdrop = document.getElementById('profileBackdrop');
  
  if (sidebar) sidebar.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
  
  setTimeout(() => {
    if (sidebar) sidebar.remove();
    if (backdrop) backdrop.remove();
  }, 300);
}

async function sendFriendRequestFromProfile(userId) {
  if (typeof sendFriendRequest === 'function') {
    await sendFriendRequest(userId);
    closeProfileView();
    showToast('Friend request sent!', 'success');
  }
}

async function startDMFromProfile(userId) {
  closeProfileView();
  
  // Find or create DM
  if (typeof startDM === 'function') {
    await startDM(userId);
  }
}

// ==================== INTEGRATION WITH EXISTING CODE ====================

// Override existing getRoleBadge to include reputation badge
const originalGetRoleBadge = window.getRoleBadge;
window.getRoleBadge = function(username, role) {
  let badges = '';
  
  // Add role badge (admin, mod, etc)
  if (originalGetRoleBadge && typeof originalGetRoleBadge === 'function') {
    badges += originalGetRoleBadge(username, role);
  }
  
  // Add reputation badge
  const user = Object.values(usersCache).find(u => u.username === username);
  if (user && user.reputation !== undefined) {
    badges += getReputationBadge(user.reputation);
  }
  
  return badges;
};

console.log('Reputation system & profile viewer loaded');
