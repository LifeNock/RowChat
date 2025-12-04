// ============================================
// ROWCHAT - YOUTUBE WATCH TOGETHER
// ============================================

let youtubePlayer = null;
let currentYoutubeSession = null;

// Open YouTube Modal
function openYoutubeModal() {
  if (!currentRoom) {
    showToast('Please select a room first', 'warning');
    return;
  }
  
  const modal = document.getElementById('youtubeModal');
  modal.classList.add('active');
  
  // Check if there's an active session
  loadYoutubeSession();
}

// Close YouTube Modal
function closeYoutubeModal() {
  document.getElementById('youtubeModal').classList.remove('active');
  
  if (youtubePlayer) {
    youtubePlayer.destroy();
    youtubePlayer = null;
  }
}

// Load YouTube Session
async function loadYoutubeSession() {
  try {
    const { data, error } = await supabase
      .from('youtube_sessions')
      .select('*')
      .eq('room_id', currentRoom.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.log('No active YouTube session');
      return;
    }
    
    currentYoutubeSession = data;
    loadYoutubePlayer(data.video_id);
  } catch (error) {
    console.error('Error loading YouTube session:', error);
  }
}

// Load YouTube Player
function loadYoutubePlayer(videoId) {
  const playerDiv = document.getElementById('youtubePlayer');
  
  // Create iframe
  playerDiv.innerHTML = `
    <iframe 
      width="100%" 
      height="400" 
      src="https://www.youtube.com/embed/${videoId}?enablejsapi=1" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen
      style="border-radius: 8px; margin-top: 16px;">
    </iframe>
  `;
}

// Start YouTube Session
async function startYoutubeSession() {
  const input = document.getElementById('youtubeUrl').value.trim();
  
  if (!input) {
    showToast('Please enter a YouTube URL or video ID', 'warning');
    return;
  }
  
  // Extract video ID
  let videoId = input;
  
  // Try to extract from URL
  const urlPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of urlPatterns) {
    const match = input.match(pattern);
    if (match) {
      videoId = match[1];
      break;
    }
  }
  
  if (videoId.length !== 11) {
    showToast('Invalid YouTube URL or video ID', 'error');
    return;
  }
  
  try {
    // Create session
    const { data, error } = await supabase
      .from('youtube_sessions')
      .insert([{
        room_id: currentRoom.id,
        video_id: videoId,
        created_by: currentUser.id,
        is_active: true,
        is_playing: false
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    currentYoutubeSession = data;
    
    // Load player
    loadYoutubePlayer(videoId);
    
    // Send system message
    await supabase
      .from('messages')
      .insert([{
        room_id: currentRoom.id,
        user_id: currentUser.id,
        username: 'System',
        content: `${currentUser.username} started a YouTube watch party! 📺 Click the YouTube button to join.`,
        message_type: 'system'
      }]);
    
    showToast('YouTube session started!', 'success');
    document.getElementById('youtubeUrl').value = '';
  } catch (error) {
    console.error('Error starting YouTube session:', error);
    showToast('Failed to start YouTube session', 'error');
  }
}

// End YouTube Session
async function endYoutubeSession() {
  if (!currentYoutubeSession) return;
  
  if (!confirm('End this YouTube session?')) return;
  
  try {
    await supabase
      .from('youtube_sessions')
      .update({ is_active: false })
      .eq('id', currentYoutubeSession.id);
    
    currentYoutubeSession = null;
    
    if (youtubePlayer) {
      youtubePlayer.destroy();
      youtubePlayer = null;
    }
    
    document.getElementById('youtubePlayer').innerHTML = '';
    showToast('YouTube session ended', 'info');
  } catch (error) {
    console.error('Error ending YouTube session:', error);
    showToast('Failed to end session', 'error');
  }
}

// Extract Video ID from URL
function extractYoutubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  // If it's just the ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  return null;
}

console.log('YouTube.js loaded');
