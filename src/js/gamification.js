// GAMIFICATION SYSTEM - Streaks, XP, Levels, Activity Feed, Leaderboards

// ==================== BADGE DEFINITIONS ====================

const ALL_BADGES = {
  // Reputation Tier Badges (auto-earned)
  newbie: { name: 'Newbie', description: 'Just getting started', color: 'badge-newbie', requirement: 'Reach 0 reputation', autoEarned: true },
  member: { name: 'Member', description: 'Active community member', color: 'badge-member', requirement: 'Reach 100 reputation', autoEarned: true },
  regular: { name: 'Regular', description: 'Regular contributor', color: 'badge-regular', requirement: 'Reach 500 reputation', autoEarned: true },
  veteran: { name: 'Veteran', description: 'Seasoned veteran', color: 'badge-veteran', requirement: 'Reach 1500 reputation', autoEarned: true },
  legend: { name: 'Legend', description: 'Legendary status', color: 'badge-legend', requirement: 'Reach 5000 reputation', autoEarned: true },
  mythic: { name: 'Mythic', description: 'Mythic presence', color: 'badge-mythic', requirement: 'Reach 10000 reputation', autoEarned: true },
  
  // Special Role Badges
  founder: { name: 'Founder', description: 'Original founder', color: 'badge-founder', requirement: 'Granted by admin' },
  contributor: { name: 'Contributor', description: 'Valuable contributor', color: 'badge-contributor', requirement: 'Granted by admin' },
  supporter: { name: 'Supporter', description: 'Community supporter', color: 'badge-supporter', requirement: 'Granted by admin' },
  
  // Streak Badges
  'streak-7': { name: 'Week Warrior', description: '7 day login streak', color: 'badge-streak', requirement: '7 day streak' },
  'streak-30': { name: 'Monthly Master', description: '30 day login streak', color: 'badge-streak', requirement: '30 day streak' },
  'streak-100': { name: 'Century Club', description: '100 day login streak', color: 'badge-streak-gold', requirement: '100 day streak' },
  'streak-365': { name: 'Year Legend', description: '365 day login streak', color: 'badge-streak-diamond', requirement: '365 day streak' },
  
  // Level Badges
  'level-5': { name: 'Rising Star', description: 'Reached level 5', color: 'badge-level', requirement: 'Reach level 5' },
  'level-10': { name: 'Expert', description: 'Reached level 10', color: 'badge-level', requirement: 'Reach level 10' },
  'level-25': { name: 'Master', description: 'Reached level 25', color: 'badge-level-gold', requirement: 'Reach level 25' },
  'level-50': { name: 'Grandmaster', description: 'Reached level 50', color: 'badge-level-diamond', requirement: 'Reach level 50' },
  
  // Activity Badges
  'messages-100': { name: 'Chatterbox', description: 'Sent 100 messages', color: 'badge-activity', requirement: '100 messages' },
  'messages-1000': { name: 'Conversationalist', description: 'Sent 1000 messages', color: 'badge-activity', requirement: '1000 messages' },
  'messages-10000': { name: 'Talk Master', description: 'Sent 10000 messages', color: 'badge-activity-gold', requirement: '10000 messages' },
  
  // Social Badges
  'friends-10': { name: 'Friendly', description: '10 friends', color: 'badge-social', requirement: '10 friends' },
  'friends-50': { name: 'Popular', description: '50 friends', color: 'badge-social', requirement: '50 friends' },
  'friends-100': { name: 'Socialite', description: '100 friends', color: 'badge-social-gold', requirement: '100 friends' },
  
  // Room Badges
  'rooms-5': { name: 'Room Explorer', description: 'Joined 5 rooms', color: 'badge-rooms', requirement: 'Join 5 rooms' },
  'room-creator': { name: 'Room Architect', description: 'Created 10 rooms', color: 'badge-rooms', requirement: 'Create 10 rooms' },
  
  // Achievement Badges
  'first-message': { name: 'First Steps', description: 'Sent first message', color: 'badge-achievement', requirement: 'Send first message' },
  'early-bird': { name: 'Early Bird', description: 'Logged in before 6am', color: 'badge-achievement', requirement: 'Login before 6am' },
  'night-owl': { name: 'Night Owl', description: 'Logged in after midnight', color: 'badge-achievement', requirement: 'Login after midnight' },
  'weekend-warrior': { name: 'Weekend Warrior', description: 'Active on weekends', color: 'badge-achievement', requirement: 'Login 10 weekends' },
  'helper': { name: 'Helper', description: 'Received 100 helpful reactions', color: 'badge-achievement', requirement: '100 helpful reactions' },
  
  // Challenge Badges
  'challenge-master': { name: 'Challenge Master', description: 'Completed 30 daily challenges', color: 'badge-challenge', requirement: '30 challenges' },
  'streak-keeper': { name: 'Streak Keeper', description: 'Never broke a 30+ day streak', color: 'badge-challenge', requirement: 'Maintain 30+ day streak' },
  
  // Leaderboard Badges
  'top-10': { name: 'Top 10', description: 'Ranked in top 10', color: 'badge-leaderboard', requirement: 'Reach top 10' },
  'number-1': { name: 'Champion', description: 'Ranked #1', color: 'badge-leaderboard-gold', requirement: 'Reach #1' },
};

// ==================== LEVEL SYSTEM ====================

const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500, // Levels 1-10
  10000, 12500, 15000, 17500, 20000, 22500, 25000, 27500, 30000, 32500, // Levels 11-20
  35000, 37500, 40000, 42500, 45000, 47500, 50000, 52500, 55000, 57500, // Levels 21-30
  60000, 62500, 65000, 67500, 70000, 72500, 75000, 77500, 80000, 82500, // Levels 31-40
  85000, 87500, 90000, 92500, 95000, 97500, 100000, 102500, 105000, 107500 // Levels 41-50
];

function getLevelFromXP(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

function getXPForNextLevel(currentXP) {
  const level = getLevelFromXP(currentXP);
  if (level >= LEVEL_THRESHOLDS.length) {
    return { current: currentXP, needed: currentXP, percent: 100 };
  }
  
  const currentLevelXP = LEVEL_THRESHOLDS[level - 1];
  const nextLevelXP = LEVEL_THRESHOLDS[level];
  const progress = currentXP - currentLevelXP;
  const total = nextLevelXP - currentLevelXP;
  const percent = Math.floor((progress / total) * 100);
  
  return {
    current: progress,
    needed: total,
    percent: percent,
    nextLevel: level + 1
  };
}

// ==================== XP SYSTEM ====================

async function addXP(userId, eventType, amount, reason = null) {
  try {
    const supabase = getSupabase();
    
    // Record XP event
    await supabase.from('xp_events').insert([{
      user_id: userId,
      event_type: eventType,
      xp_gained: amount,
      reason: reason
    }]);
    
    // Get current user data
    const { data: user } = await supabase
      .from('users')
      .select('xp, level')
      .eq('id', userId)
      .single();
    
    const oldXP = user.xp || 0;
    const oldLevel = user.level || 1;
    const newXP = oldXP + amount;
    const newLevel = getLevelFromXP(newXP);
    
    // Update user XP and level
    await supabase
      .from('users')
      .update({ xp: newXP, level: newLevel })
      .eq('id', userId);
    
    // Update cache
    if (usersCache[userId]) {
      usersCache[userId].xp = newXP;
      usersCache[userId].level = newLevel;
    }
    
    // Check if leveled up
    if (newLevel > oldLevel) {
      showLevelUpNotification(newLevel);
      checkLevelBadges(userId, newLevel);
    }
    
    // Show XP notification
    if (userId === currentUser.id) {
      showXPNotification(amount, eventType);
    }
    
    console.log(`Added ${amount} XP to user ${userId}. Total: ${newXP} (Level ${newLevel})`);
    
  } catch (error) {
    console.error('Error adding XP:', error);
  }
}

function showXPNotification(amount, reason) {
  const notification = document.createElement('div');
  notification.className = 'xp-notification';
  notification.innerHTML = `+${amount} XP`;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

function showLevelUpNotification(level) {
  const notification = document.createElement('div');
  notification.className = 'level-up-notification';
  notification.innerHTML = `
    <div class="level-up-content">
      <div class="level-up-icon">⭐</div>
      <div class="level-up-text">
        <div class="level-up-title">Level Up!</div>
        <div class="level-up-level">Level ${level}</div>
      </div>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// ==================== DAILY STREAK SYSTEM ====================

async function checkDailyStreak() {
  try {
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];
    
    const { data: user } = await supabase
      .from('users')
      .select('daily_streak, last_login_date, total_logins')
      .eq('id', currentUser.id)
      .single();
    
    const lastLogin = user.last_login_date;
    const currentStreak = user.daily_streak || 0;
    
    if (lastLogin === today) {
      // Already logged in today
      return;
    }
    
    let newStreak = currentStreak;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (lastLogin === yesterdayStr) {
      // Continue streak
      newStreak = currentStreak + 1;
    } else if (lastLogin === null || lastLogin < yesterdayStr) {
      // Streak broken, start over
      newStreak = 1;
    }
    
    // Update user
    await supabase
      .from('users')
      .update({
        daily_streak: newStreak,
        last_login_date: today,
        total_logins: (user.total_logins || 0) + 1
      })
      .eq('id', currentUser.id);
    
    // Update cache
    currentUser.daily_streak = newStreak;
    currentUser.last_login_date = today;
    
    // Award XP
    const streakBonus = Math.min(newStreak * 5, 100); // Cap at 100 XP
    await addXP(currentUser.id, 'daily_login', 10 + streakBonus, `Daily login + ${newStreak} day streak bonus`);
    
    // Show streak notification
    showStreakNotification(newStreak);
    
    // Check streak badges
    checkStreakBadges(currentUser.id, newStreak);
    
    // Generate daily challenges
    await generateDailyChallenges();
    
  } catch (error) {
    console.error('Error checking daily streak:', error);
  }
}

function showStreakNotification(streak) {
  const notification = document.createElement('div');
  notification.className = 'streak-notification';
  notification.innerHTML = `
    <div class="streak-content">
      <div class="streak-icon">🔥</div>
      <div class="streak-text">
        <div class="streak-title">${streak} Day Streak!</div>
        <div class="streak-subtitle">Keep it going!</div>
      </div>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ==================== BADGE SYSTEM ====================

async function checkStreakBadges(userId, streak) {
  const badges = [];
  if (streak >= 7) badges.push('streak-7');
  if (streak >= 30) badges.push('streak-30');
  if (streak >= 100) badges.push('streak-100');
  if (streak >= 365) badges.push('streak-365');
  
  for (const badge of badges) {
    await unlockBadge(userId, badge);
  }
}

async function checkLevelBadges(userId, level) {
  const badges = [];
  if (level >= 5) badges.push('level-5');
  if (level >= 10) badges.push('level-10');
  if (level >= 25) badges.push('level-25');
  if (level >= 50) badges.push('level-50');
  
  for (const badge of badges) {
    await unlockBadge(userId, badge);
  }
}

async function unlockBadge(userId, badgeType) {
  try {
    const supabase = getSupabase();
    
    // Check if already has badge
    const { data: existing } = await supabase
      .from('users')
      .select('badges')
      .eq('id', userId)
      .single();
    
    if (existing.badges && existing.badges.includes(badgeType)) {
      return; // Already has badge
    }
    
    // Add badge
    const newBadges = [...(existing.badges || []), badgeType];
    await supabase
      .from('users')
      .update({ badges: newBadges })
      .eq('id', userId);
    
    // Update cache
    if (usersCache[userId]) {
      usersCache[userId].badges = newBadges;
    }
    
    // Show notification
    if (userId === currentUser.id) {
      showBadgeUnlockNotification(badgeType);
    }
    
    console.log(`Badge unlocked: ${badgeType}`);
    
  } catch (error) {
    console.error('Error unlocking badge:', error);
  }
}

function showBadgeUnlockNotification(badgeType) {
  const badge = ALL_BADGES[badgeType];
  if (!badge) return;
  
  const notification = document.createElement('div');
  notification.className = 'badge-unlock-notification';
  notification.innerHTML = `
    <div class="badge-unlock-content">
      <div class="badge-unlock-icon">🏆</div>
      <div class="badge-unlock-text">
        <div class="badge-unlock-title">Badge Unlocked!</div>
        <div class="badge-unlock-badge">
          <span class="user-badge ${badge.color}">${badge.name}</span>
        </div>
        <div class="badge-unlock-desc">${badge.description}</div>
      </div>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

function getUserAvailableBadges(user) {
  const available = [];
  
  // Add reputation tier badge
  const tier = getReputationTier(user.reputation || 0);
  available.push(tier.tier);
  
  // Add earned badges
  if (user.badges && Array.isArray(user.badges)) {
    available.push(...user.badges);
  }
  
  return available;
}

console.log('Gamification system loaded');
