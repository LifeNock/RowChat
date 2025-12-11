// ROWCHAT - GIF PICKER (Tenor v2 API - Fixed)

const TENOR_API_KEY = 'AIzaSyAyLXS1ge1Wn8zJz_z-wRTF8q_gHVJxXmI';
const CLIENT_KEY = 'rowchat';

let gifPickerModal = null;
let currentGifSearch = '';

function initGifPicker() {
  gifPickerModal = document.createElement('div');
  gifPickerModal.id = 'gifPickerModal';
  gifPickerModal.className = 'gif-picker-modal';
  gifPickerModal.innerHTML = `
    <div class="gif-picker-container">
      <div class="gif-picker-header">
        <input type="text" id="gifSearchInput" placeholder="Search GIFs..." autocomplete="off">
        <button onclick="closeGifPicker()" class="icon-btn"><i data-lucide="x"></i></button>
      </div>
      <div class="gif-picker-grid" id="gifPickerGrid">
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          Search for GIFs above
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(gifPickerModal);
  
  // Initialize icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  const messageWrapper = document.querySelector('.message-input-wrapper');
  if (messageWrapper) {
    const gifBtn = document.createElement('button');
    gifBtn.className = 'icon-btn';
    gifBtn.innerHTML = '<i data-lucide="image"></i>';
    gifBtn.title = 'Send GIF';
    gifBtn.onclick = openGifPicker;
    
    const fileBtn = messageWrapper.querySelector('button');
    messageWrapper.insertBefore(gifBtn, fileBtn.nextSibling);
    
    // Initialize icon
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
  
  const searchInput = document.getElementById('gifSearchInput');
  searchInput.addEventListener('input', debounce((e) => {
    searchGifs(e.target.value);
  }, 500));
}

function openGifPicker() {
  gifPickerModal.classList.add('active');
  document.getElementById('gifSearchInput').focus();
  
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
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&client_key=${CLIENT_KEY}&limit=20&media_filter=gif`;
    
    console.log('Fetching:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Tenor response:', data);
    
    if (data.results && data.results.length > 0) {
      displayGifs(data.results);
    } else {
      grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No GIFs found. Try a different search.</div>';
    }
  } catch (error) {
    console.error('Error searching GIFs:', error);
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Error: ' + error.message + '</div>';
  }
}

async function loadTrendingGifs() {
  const grid = document.getElementById('gifPickerGrid');
  grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Loading trending...</div>';
  
  try {
    const url = `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&client_key=${CLIENT_KEY}&limit=20&media_filter=gif`;
    
    console.log('Fetching trending:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Tenor trending response:', data);
    
    if (data.results && data.results.length > 0) {
      displayGifs(data.results);
    } else {
      grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No trending GIFs available.</div>';
    }
  } catch (error) {
    console.error('Error loading trending GIFs:', error);
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Error: ' + error.message + '</div>';
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
    
    // Use tinygif for preview, gif for sending
    if (gif.media_formats && gif.media_formats.tinygif) {
      img.src = gif.media_formats.tinygif.url;
    } else if (gif.media_formats && gif.media_formats.gif) {
      img.src = gif.media_formats.gif.url;
    } else {
      console.error('No media format found for gif:', gif);
      return;
    }
    
    img.alt = gif.content_description || 'GIF';
    img.loading = 'lazy';
    
    gifItem.appendChild(img);
    
    gifItem.onclick = () => {
      const fullUrl = gif.media_formats.gif ? gif.media_formats.gif.url : img.src;
      sendGif(fullUrl, gif.content_description || 'GIF');
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGifPicker);
} else {
  initGifPicker();
}

console.log('GIF Picker loaded (Tenor v2)');
