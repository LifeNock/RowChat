// ============================================
// ROWCHAT - THEMES & FONTS (FIXED)
// ============================================

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

const THEMES = [
  { name: 'Default', icon: '🌙', value: 'default' },
  { name: 'Christmas', icon: '🎄', value: 'christmas' },
  { name: 'Dark Blue', icon: '💙', value: 'dark-blue' },
  { name: 'Light', icon: '☀️', value: 'light' },
  { name: 'Sunset', icon: '🌅', value: 'sunset' },
  { name: 'Ocean', icon: '🌊', value: 'ocean' },
  { name: 'Forest', icon: '🌲', value: 'forest' },
  { name: 'Midnight', icon: '🌃', value: 'midnight' },
  { name: 'Cyberpunk', icon: '🤖', value: 'cyberpunk' },
  { name: 'Autumn', icon: '🍂', value: 'autumn' },
  { name: 'Pastel', icon: '🎨', value: 'pastel' }
];

const FONTS = [
  { name: 'Segoe UI', value: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { name: 'Courier New', value: '"Courier New", Courier, monospace' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { name: 'Comic Sans', value: '"Comic Sans MS", cursive' },
  { name: 'Impact', value: 'Impact, fantasy' },
  { name: 'Trebuchet', value: '"Trebuchet MS", sans-serif' },
  { name: 'Palatino', value: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { name: 'Lucida', value: '"Lucida Console", Monaco, monospace' },
  { name: 'Garamond', value: 'Garamond, serif' },
  { name: 'Bookman', value: '"Bookman Old Style", serif' },
  { name: 'Tahoma', value: 'Tahoma, sans-serif' },
  { name: 'Monaco', value: 'Monaco, "Courier New", monospace' },
  { name: 'Consolas', value: 'Consolas, monospace' },
  { name: 'Cambria', value: 'Cambria, Georgia, serif' },
  { name: 'Candara', value: 'Candara, sans-serif' },
  { name: 'Optima', value: 'Optima, sans-serif' },
  { name: 'Century Gothic', value: '"Century Gothic", sans-serif' }
];

// Open Theme Modal
function openThemeModal() {
  document.getElementById('userMenu').style.display = 'none';
  
  const modal = document.getElementById('themeModal');
  const presetsGrid = document.getElementById('themePresets');
  const fontGrid = document.getElementById('fontGrid');
  
  // Render theme presets
  presetsGrid.innerHTML = '';
  THEMES.forEach(theme => {
    const themeDiv = document.createElement('div');
    themeDiv.className = 'theme-preset';
    
    const currentTheme = document.body.getAttribute('data-theme') || 'default';
    if (theme.value === currentTheme) {
      themeDiv.classList.add('active');
    }
    
    themeDiv.innerHTML = `
      <div class="theme-preset-icon">${theme.icon}</div>
      <div class="theme-preset-name">${theme.name}</div>
    `;
    
    themeDiv.onclick = () => selectTheme(theme.value);
    
    presetsGrid.appendChild(themeDiv);
  });
  
  // Render fonts
  fontGrid.innerHTML = '';
  FONTS.forEach(font => {
    const fontDiv = document.createElement('div');
    fontDiv.className = 'font-option';
    
    const currentFont = currentUser.font_family || 'Segoe UI';
    if (font.name === currentFont) {
      fontDiv.classList.add('active');
    }
    
    fontDiv.innerHTML = `
      <div class="font-preview" style="font-family: ${font.value};">The quick brown fox</div>
      <div class="font-name">${font.name}</div>
    `;
    
    fontDiv.onclick = () => selectFont(font);
    
    fontGrid.appendChild(fontDiv);
  });
  
  modal.classList.add('active');
}

// Close Theme Modal
function closeThemeModal() {
  document.getElementById('themeModal').classList.remove('active');
}

// Select Theme
async function selectTheme(themeName) {
  try {
    const supabase = getSupabase();
    
    // Apply theme
    document.body.setAttribute('data-theme', themeName);
    
    // Update active state
    document.querySelectorAll('.theme-preset').forEach(preset => {
      preset.classList.remove('active');
    });
    if (event && event.target) {
      event.target.closest('.theme-preset').classList.add('active');
    }
    
    console.log('Saving theme:', themeName);
    
    // Save to database
    const { error } = await supabase
      .from('users')
      .update({
        theme: { preset: themeName }
      })
      .eq('id', currentUser.id);
    
    if (error) {
      console.error('Theme save error:', error);
      throw error;
    }
    
    currentUser.theme = { preset: themeName };
    localStorage.setItem('rowchat-user', JSON.stringify(currentUser));
    
    showToast('Theme applied!', 'success');
    console.log('Theme saved successfully');
  } catch (error) {
    console.error('Error saving theme:', error);
    showToast('Failed to save theme: ' + error.message, 'error');
  }
}

// Select Font
async function selectFont(font) {
  try {
    const supabase = getSupabase();
    
    // Apply font
    document.documentElement.style.setProperty('--font-family', font.value);
    
    // Update active state
    document.querySelectorAll('.font-option').forEach(option => {
      option.classList.remove('active');
    });
    if (event && event.target) {
      event.target.closest('.font-option').classList.add('active');
    }
    
    console.log('Saving font:', font.name);
    
    // Save to database
    const { error } = await supabase
      .from('users')
      .update({
        font_family: font.name
      })
      .eq('id', currentUser.id);
    
    if (error) {
      console.error('Font save error:', error);
      throw error;
    }
    
    currentUser.font_family = font.name;
    localStorage.setItem('rowchat-user', JSON.stringify(currentUser));
    
    showToast('Font applied!', 'success');
    console.log('Font saved successfully');
  } catch (error) {
    console.error('Error saving font:', error);
    showToast('Failed to save font: ' + error.message, 'error');
  }
}

// Apply Theme
function applyTheme(themeConfig) {
  if (themeConfig && themeConfig.preset) {
    document.body.setAttribute('data-theme', themeConfig.preset);
  }
}

// Open Settings Modal
function openSettingsModal() {
  document.getElementById('userMenu').style.display = 'none';
  showToast('Settings coming soon!', 'info');
}

console.log('Themes.js loaded (FIXED)');
