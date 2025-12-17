// LEADERBOARD SYSTEM

let currentLeaderboardCategory = 'reputation';

async function switchLeaderboardCategory(category) {
  currentLeaderboardCategory = category;
  
  // Update active filter
  document.querySelectorAll('.leaderboard-filter').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-category="${category}"]`)?.classList.add('active');
  
  // Load leaderboard
  await loadLeaderboard(category);
}

async function loadLeaderboard(category = 'reputation') {
  const container = document.getElementById('leaderboardList');
  if (!container) return;
  
  container.innerHTML = '<div class="leaderboard-loading">Loading leaderboard...</div>';
  
  try {
    const supabase = getSupabase();
    
    // Determine sort column
    let sortColumn = 'reputation';
    let displayField = 'reputation';
    
    if (category === 'level') {
      sortColumn = 'xp';
      displayField = 'level';
    } else if (category === 'messages') {
      sortColumn = 'message_count';
      displayField = 'message_count';
    } else if (category === 'streak') {
      sortColumn = 'daily_streak';
      displayField = 'daily_streak';
    }
    
    // Fetch top 100 users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, badges, equipped_badges, reputation, level, xp, message_count, daily_streak')
      .order(sortColumn, { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    if (!users || users.length === 0) {
      container.innerHTML = '<div class="leaderboard-empty">No users found</div>';
      return;
    }
    
    // Render leaderboard
    container.innerHTML = '';
    
    users.forEach((user, index) => {
      const rank = index + 1;
      const isCurrentUser = user.id === currentUser.id;
      
      // Get score based on category
      let score = user[displayField] || 0;
      let scoreLabel = '';
      
      if (category === 'reputation') {
        scoreLabel = `${score.toLocaleString()} REP`;
      } else if (category === 'level') {
        scoreLabel = `Level ${user.level || 1}`;
        score = user.level || 1;
      } else if (category === 'messages') {
        scoreLabel = `${score.toLocaleString()} msgs`;
      } else if (category === 'streak') {
        scoreLabel = `${score} days`;
      }
      
      // Get equipped badges
      const equippedBadges = user.equipped_badges || [];
      let badgesHTML = '';
      
      equippedBadges.forEach(badgeType => {
        if (ALL_BADGES[badgeType]) {
          const badge = ALL_BADGES[badgeType];
          badgesHTML += `<span class="user-badge ${badge.color}">${badge.name}</span>`;
        }
      });
      
      // Rank styling
      let rankClass = '';
      let rankDisplay = `#${rank}`;
      if (rank === 1) {
        rankClass = 'top-1';
        rankDisplay = '🥇';
      } else if (rank === 2) {
        rankClass = 'top-2';
        rankDisplay = '🥈';
      } else if (rank === 3) {
        rankClass = 'top-3';
        rankDisplay = '🥉';
      }
      
      const entry = document.createElement('div');
      entry.className = `leaderboard-entry ${isCurrentUser ? 'current-user' : ''}`;
      entry.onclick = () => {
        if (typeof openProfileView === 'function') {
          openProfileView(user.id);
        }
      };
      
      entry.innerHTML = `
        <div class="leaderboard-rank ${rankClass}">${rankDisplay}</div>
        <div class="leaderboard-avatar">
          ${user.avatar_url ? `<img src="${user.avatar_url}" alt="${user.username}">` : user.username.charAt(0).toUpperCase()}
        </div>
        <div class="leaderboard-info">
          <div class="leaderboard-username">
            ${user.username}
            ${isCurrentUser ? '<span style="color: var(--accent); font-size: 12px;">(You)</span>' : ''}
          </div>
          <div class="leaderboard-badges">
            ${badgesHTML}
          </div>
        </div>
        <div class="leaderboard-score">${scoreLabel}</div>
      `;
      
      container.appendChild(entry);
    });
    
    // Scroll to current user if not in top 10
    const currentUserEntry = container.querySelector('.current-user');
    if (currentUserEntry && rank > 10) {
      setTimeout(() => {
        currentUserEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
    
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    container.innerHTML = '<div class="leaderboard-empty">Failed to load leaderboard</div>';
  }
}

console.log('Leaderboard loaded');
