// PERSONAL WORD FILTERS

let userPersonalFilters = [];

// Load user's personal filters
async function loadPersonalFilters() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('user_word_filters')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    userPersonalFilters = data || [];
    renderPersonalFilters();
    
  } catch (error) {
    console.error('Error loading personal filters:', error);
  }
}

// Render personal filters list in settings
function renderPersonalFilters() {
  const container = document.getElementById('personalFiltersList');
  if (!container) return;
  
  if (userPersonalFilters.length === 0) {
    container.innerHTML = '<div class="empty-filters">No filters added yet. Add words you want to blur.</div>';
    return;
  }
  
  container.innerHTML = '';
  
  userPersonalFilters.forEach(filter => {
    const div = document.createElement('div');
    div.className = 'personal-filter-item';
    div.innerHTML = `
      <span class="personal-filter-word">${escapeHtml(filter.word)}</span>
      <button class="personal-filter-remove" onclick="removePersonalFilter(${filter.id})" title="Remove filter">×</button>
    `;
    container.appendChild(div);
  });
}

// Add new personal filter
async function addPersonalFilter() {
  const input = document.getElementById('newFilterWord');
  if (!input) return;
  
  const word = input.value.trim().toLowerCase();
  
  if (!word) {
    showToast('Please enter a word', 'warning');
    return;
  }
  
  if (word.length < 2) {
    showToast('Word must be at least 2 characters', 'warning');
    return;
  }
  
  // Check if already exists
  if (userPersonalFilters.some(f => f.word.toLowerCase() === word)) {
    showToast('This word is already filtered', 'warning');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('user_word_filters')
      .insert([{
        user_id: currentUser.id,
        word: word
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    userPersonalFilters.unshift(data);
    renderPersonalFilters();
    
    input.value = '';
    showToast('Filter added', 'success');
    
    // Reload messages to apply filter
    if (currentRoom && typeof loadMessages === 'function') {
      await loadMessages(currentRoom.id);
    } else if (currentDM && typeof loadMessages === 'function') {
      await loadMessages(currentDM.id);
    }
    
  } catch (error) {
    console.error('Error adding filter:', error);
    showToast('Failed to add filter', 'error');
  }
}

// Remove personal filter
async function removePersonalFilter(filterId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('user_word_filters')
      .delete()
      .eq('id', filterId);
    
    if (error) throw error;
    
    userPersonalFilters = userPersonalFilters.filter(f => f.id !== filterId);
    renderPersonalFilters();
    
    showToast('Filter removed', 'success');
    
    // Reload messages to remove filter
    if (currentRoom && typeof loadMessages === 'function') {
      await loadMessages(currentRoom.id);
    } else if (currentDM && typeof loadMessages === 'function') {
      await loadMessages(currentDM.id);
    }
    
  } catch (error) {
    console.error('Error removing filter:', error);
    showToast('Failed to remove filter', 'error');
  }
}

// Apply personal filters to text content
function applyPersonalFilters(text) {
  if (!text || userPersonalFilters.length === 0) return text;
  
  let filtered = text;
  
  for (const filter of userPersonalFilters) {
    const word = filter.word;
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    
    filtered = filtered.replace(regex, (match) => {
      return `<span class="blurred-word" onclick="revealWord(this)">${match}</span>`;
    });
  }
  
  return filtered;
}

// Reveal blurred word on click
function revealWord(element) {
  element.classList.toggle('revealed');
}

console.log('Personal filters loaded');
