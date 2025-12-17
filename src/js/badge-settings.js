// BADGE SETTINGS UI

let currentEquippedBadges = [];
let currentFilter = 'all';

function openBadgeSettingsModal() {
  document.getElementById('badgeSettingsModal')?.classList.add('active');
  loadBadgeSettings();
}

function closeBadgeSettingsModal() {
  document.getElementById('badgeSettingsModal')?.classList.remove('active');
}

async function loadBadgeSettings() {
  try {
    const supabase = getSupabase();
    
    // Load user data
    const { data: user } = await supabase
      .from('users')
      .select('equipped_badges, badges, reputation, level, xp, message_count')
      .eq('id', currentUser.id)
      .single();
    
    currentEquippedBadges = user.equipped_badges || [];
    
    // Update equipped slots
    renderEquippedSlots();
    
    // Get available badges
    const availableBadges = getUserAvailableBadges(user);
    
    // Render available badges
    renderAvailableBadges(availableBadges);
    
    // Render locked badges
    renderLockedBadges(availableBadges);
    
  } catch (error) {
    console.error('Error loading badge settings:', error);
  }
}

function renderEquippedSlots() {
  const container = document.getElementById('equippedBadgesContainer');
  if (!container) return;
  
  for (let i = 0; i < 3; i++) {
    const slot = container.querySelector(`[data-slot="${i}"]`);
    if (!slot) continue;
    
    const badgeType = currentEquippedBadges[i];
    
    if (badgeType && ALL_BADGES[badgeType]) {
      const badge = ALL_BADGES[badgeType];
      slot.classList.remove('empty');
      slot.classList.add('filled');
      slot.innerHTML = `
        <span class="slot-number">${i + 1}</span>
        <span class="user-badge ${badge.color}">${badge.name}</span>
        <button class="remove-badge" onclick="unequipBadge(${i})">×</button>
      `;
    } else {
      slot.classList.add('empty');
      slot.classList.remove('filled');
      slot.innerHTML = `
        <span class="slot-number">${i + 1}</span>
        <span class="slot-text">Empty Slot</span>
      `;
    }
  }
}

function equipBadge(badgeType) {
  // Check if already equipped
  if (currentEquippedBadges.includes(badgeType)) {
    showToast('Badge already equipped', 'warning');
    return;
  }
  
  // Find first empty slot
  for (let i = 0; i < 3; i++) {
    if (!currentEquippedBadges[i]) {
      currentEquippedBadges[i] = badgeType;
      renderEquippedSlots();
      renderAvailableBadges(getUserAvailableBadges(currentUser));
      return;
    }
  }
  
  showToast('All slots are full. Remove a badge first.', 'warning');
}

function unequipBadge(slotIndex) {
  currentEquippedBadges[slotIndex] = null;
  currentEquippedBadges = currentEquippedBadges.filter(b => b !== null);
  renderEquippedSlots();
  renderAvailableBadges(getUserAvailableBadges(currentUser));
}

function renderAvailableBadges(availableBadges) {
  const container = document.getElementById('availableBadgesGrid');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Filter badges based on current filter
  let badgesToShow = availableBadges;
  if (currentFilter === 'equipped') {
    badgesToShow = availableBadges.filter(b => currentEquippedBadges.includes(b));
  } else if (currentFilter === 'unequipped') {
    badgesToShow = availableBadges.filter(b => !currentEquippedBadges.includes(b));
  }
  
  badgesToShow.forEach(badgeType => {
    const badge = ALL_BADGES[badgeType];
    if (!badge) return;
    
    const isEquipped = currentEquippedBadges.includes(badgeType);
    
    const card = document.createElement('div');
    card.className = `badge-card ${isEquipped ? 'equipped' : ''}`;
    card.onclick = () => equipBadge(badgeType);
    
    card.innerHTML = `
      <div class="badge-card-header">
        <span class="user-badge ${badge.color}">${badge.name}</span>
        ${isEquipped ? '<span class="badge-equipped-indicator">Equipped</span>' : ''}
      </div>
      <div class="badge-card-desc">${badge.description}</div>
      <div class="badge-card-requirement">${badge.requirement}</div>
    `;
    
    container.appendChild(card);
  });
  
  if (badgesToShow.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">No badges to show</p>';
  }
}

function renderLockedBadges(availableBadges) {
  const container = document.getElementById('lockedBadgesGrid');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Get all badges that aren't available yet
  const lockedBadges = Object.keys(ALL_BADGES).filter(key => {
    const badge = ALL_BADGES[key];
    return !availableBadges.includes(key) && !badge.autoEarned;
  });
  
  lockedBadges.forEach(badgeType => {
    const badge = ALL_BADGES[badgeType];
    
    const card = document.createElement('div');
    card.className = 'locked-badge-card';
    
    card.innerHTML = `
      <div class="locked-badge-name">${badge.name}</div>
      <div class="locked-badge-desc">${badge.description}</div>
      <div class="locked-badge-requirement">${badge.requirement}</div>
    `;
    
    container.appendChild(card);
  });
  
  if (lockedBadges.length === 0) {
    container.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">All badges unlocked!</p>';
  }
}

function filterBadges(filter) {
  currentFilter = filter;
  
  // Update tab states
  document.querySelectorAll('.badge-filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');
  
  // Re-render
  renderAvailableBadges(getUserAvailableBadges(currentUser));
}

async function saveEquippedBadges() {
  try {
    const supabase = getSupabase();
    
    // Filter out nulls
    const cleanedBadges = currentEquippedBadges.filter(b => b !== null);
    
    // Save to database
    const { error } = await supabase
      .from('users')
      .update({ equipped_badges: cleanedBadges })
      .eq('id', currentUser.id);
    
    if (error) throw error;
    
    // Update cache
    currentUser.equipped_badges = cleanedBadges;
    if (usersCache[currentUser.id]) {
      usersCache[currentUser.id].equipped_badges = cleanedBadges;
    }
    
    showToast('Badges updated!', 'success');
    closeBadgeSettingsModal();
    
  } catch (error) {
    console.error('Error saving badges:', error);
    showToast('Failed to save badges', 'error');
  }
}

console.log('Badge settings loaded');
