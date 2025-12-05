// ============================================
// ROWCHAT - YOUTUBE SYNC PLAYER (ADVANCED)
// ============================================

let youtubePlayer = null;
let currentYoutubeSession = null;
let isHost = false;
let syncInterval = null;

function getSupabase() {
  return window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

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
  
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  
  if (youtubePlayer) {
    youtubePlayer = null;
  }
}

// Load YouTube Session
async function loadYoutubeSession() {
  try {
    const supabase = getSupabase();
    
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
    isHost = data.created_by === currentUser.id;
    
    loadYoutubePlayer(data.video_id);
    
    // Start sync if not host
    if (!isHost) {
      startSyncListener();
    }
  } catch (error) {
    console.error('Error loading YouTube session:', error);
  }
}

// Load YouTube Player
function loadYoutubePlayer(videoId) {
  const playerDiv = document.getElementById('youtubePlayer');
  
  // Create custom video player
  playerDiv.innerHTML = `
    <div class="custom-youtube-player">
      <iframe 
        id="ytFrame"
        width="100%" 
        height="450" 
        src="https://www.youtube.com/embed/${videoId}?enablejsapi=1&controls=${isHost ? 1 : 0}&modestbranding=1" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen
        style="border-radius: 8px;">
      </iframe>
      <div class="player-info" style="margin-top: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">📺</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text-primary);">
              ${isHost ? '🎬 You are the host' : '👥 Watching with group'}
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
              ${isHost ? 'You control playback for everyone' : 'Only the host can control playback'}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Initialize YouTube API
  if (isHost) {
    initializeHostControls();
  }
}

// Initialize Host Controls
function initializeHostControls() {
  if (!window.YT) {
    // Load YouTube API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
    window.onYouTubeIframeAPIReady = () => {
      createYouTubePlayer();
    };
  } else {
    createYouTubePlayer();
  }
}

// Create YouTube Player
function createYouTubePlayer() {
  youtubePlayer = new YT.Player('ytFrame', {
    events: {
      'onStateChange': onPlayerStateChange
    }
  });
}

// On Player State Change
async function onPlayerStateChange(event) {
  if (!isHost) return;
  
  const supabase = getSupabase();
  
  // Update session based on state
  const state = event.data;
  const currentTime = youtubePlayer.getCurrentTime();
  
  let isPlaying = false;
  if (state === YT.PlayerState.PLAYING) {
    isPlaying = true;
  }
  
  try {
    await supabase
      .from('youtube_sessions')
      .update({
        is_playing: isPlaying,
        canvas_data: { currentTime: currentTime }
      })
      .eq('id', currentYoutubeSession.id);
  } catch (error) {
    console.error('Error updating YouTube state:', error);
  }
}

// Start Sync Listener (for non-hosts)
function startSyncListener() {
  const supabase = getSupabase();
  
  // Subscribe to session updates
  supabase
    .channel(`youtube-session-${currentYoutubeSession.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'youtube_sessions',
        filter: `id=eq.${currentYoutubeSession.id}`
      },
      (payload) => {
        syncPlayer(payload.new);
      }
    )
    .subscribe();
  
  console.log('Started YouTube sync listener');
}

// Sync Player (for non-hosts)
function syncPlayer(sessionData) {
  const iframe = document.getElementById('ytFrame');
  if (!iframe) return;
  
  // Send postMessage to iframe to control playback
  const command = sessionData.is_playing ? 'playVideo' : 'pauseVideo';
  iframe.contentWindow.postMessage(JSON.stringify({
    event: 'command',
    func: command
  }), '*');
  
  // Seek to correct time
  if (sessionData.canvas_data && sessionData.canvas_data.currentTime) {
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: 'seekTo',
      args: [sessionData.canvas_data.currentTime, true]
    }), '*');
  }
}

// Start YouTube Session
async function startYoutubeSession() {
  const input = document.getElementById('youtubeUrl').value.trim();
  
  if (!input) {
    showToast('Please enter a YouTube URL or video ID', 'warning');
    return;
  }
  
  // Extract video ID
  let videoId = extractYoutubeId(input);
  
  if (!videoId || videoId.length !== 11) {
    showToast('Invalid YouTube URL or video ID', 'error');
    return;
  }
  
  try {
    const supabase = getSupabase();
    
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
    isHost = true;
    
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
  
  if (!isHost) {
    showToast('Only the host can end the session', 'error');
    return;
  }
  
  if (!confirm('End this YouTube session?')) return;
  
  try {
    const supabase = getSupabase();
    
    await supabase
      .from('youtube_sessions')
      .update({ is_active: false })
      .eq('id', currentYoutubeSession.id);
    
    currentYoutubeSession = null;
    isHost = false;
    
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
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

console.log('YouTube.js loaded (SYNC VERSION)');
