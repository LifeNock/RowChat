// ROWCHAT - GIF PICKER (Tenor API)

const TENOR_API_KEY = 'AIzaSyAKq02bLq-16gYVGPTONEQF4f-PdGXH1z0'; // Public Tenor API key

let gifPickerModal = null;
let currentGifSearch = '';

function initGifPicker() {
  // Create GIF picker modal
  gifPickerModal = document.createElement('div');
  gifPickerModal.id = 'gifPickerModal';
  gifPickerModal.className = 'gif-picker-modal';
  gifPickerModal.innerHTML = `
    <div class="gif-picker-container">
      <div class="gif-picker-header">
        <input type="text" id="gifSearchInput" placeholder="Search GIFs..." autocomplete="off">
        <button onclick="closeGifPicker()" class="icon-btn">×</button>
      </div>
      <div class="gif-picker-grid" id="gifPickerGrid">
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          Search for GIFs above
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(gifPickerModal);
  
  // Add GIF button to message input
  const messageWrapper = document.querySelector('.message-input-wrapper');
  if (messageWrapper) {
    const gifBtn = document.createElement('button');
    gifBtn.className = 'icon-btn';
    gifBtn.innerHTML = 'GIF';
    gifBtn.title = 'Send GIF';
    gifBtn.onclick = openGifPicker;
    
    const fileBtn = messageWrapper.querySelector('button');
    messageWrapper.insertBefore(gifBtn, fileBtn.nextSibling);
  }
  
  // Search handler
  const searchInput = document.getElementById('gifSearchInput');
  searchInput.addEventListener('input', debounce((e) => {
    searchGifs(e.target.value);
  }, 500));
}

function openGifPicker() {
  gifPickerModal.classList.add('active');
  document.getElementById('gifSearchInput').focus();
  
  // Load trending GIFs
  if (!currentGifSearch) {
    loadTrendingGifs();
  }
}

function closeGifPicker() {
  gifPickerModal.classList.remove('active');
  document.getElementById('gifSearchInput').value = '';
  currentGifSearch = '';
}

async function searchGifs(query) {
  if (!query.trim()) {
    loadTrendingGifs();
    return;
  }
  
  currentGifSearch = query;
  const grid = document.getElementById('gifPickerGrid');
  grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Searching...</div>';
  
  try {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20`;
    const response = await fetch(url);
    const data = await response.json();
    
    displayGifs(data.results);
  } catch (error) {
    console.error('Error searching GIFs:', error);
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Failed to load GIFs</div>';
  }
}

async function loadTrendingGifs() {
  const grid = document.getElementById('gifPickerGrid');
  grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Loading trending...</div>';
  
  try {
    const url = `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20`;
    const response = await fetch(url);
    const data = await response.json();
    
    displayGifs(data.results);
  } catch (error) {
    console.error('Error loading trending GIFs:', error);
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Failed to load GIFs</div>';
  }
}

function displayGifs(gifs) {
  const grid = document.getElementById('gifPickerGrid');
  
  if (!gifs || gifs.length === 0) {
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No GIFs found</div>';
    return;
  }
  
  grid.innerHTML = '';
  
  gifs.forEach(gif => {
    const gifItem = document.createElement('div');
    gifItem.className = 'gif-item';
    
    const img = document.createElement('img');
    img.src = gif.media_formats.tinygif.url;
    img.alt = gif.content_description;
    img.loading = 'lazy';
    
    gifItem.appendChild(img);
    
    gifItem.onclick = () => {
      sendGif(gif.media_formats.gif.url, gif.content_description);
    };
    
    grid.appendChild(gifItem);
  });
}

async function sendGif(gifUrl, description) {
  closeGifPicker();
  
  if (!currentRoom && !currentDM) {
    if (typeof showToast === 'function') {
      showToast('Please select a room or DM first', 'warning');
    }
    return;
  }
  
  try {
    const supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    const messageData = {
      room_id: currentRoom ? currentRoom.id : currentDM.id,
      user_id: currentUser.id,
      username: currentUser.username,
      content: description || 'GIF',
      message_type: 'gif',
      file_url: gifUrl
    };
    
    const { error } = await supabase
      .from('messages')
      .insert([messageData]);
    
    if (error) throw error;
    
    console.log('GIF sent successfully');
  } catch (error) {
    console.error('Error sending GIF:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to send GIF', 'error');
    }
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGifPicker);
} else {
  initGifPicker();
}

console.log('GIF Picker loaded');
