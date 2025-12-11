// ROWCHAT - WEBRTC CALLS (REBUILT)

let localStream = null;
let remoteStream = null;
let peerConnection = null;
let callType = null; // 'voice', 'video', 'screen'
let isInitiator = false;
let currentCallRoomId = null;
let signalChannel = null;

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Initialize call system
function initWebRTC() {
  console.log('WebRTC initialized');
}

// Start a call
async function startCall(type) {
  if (!currentRoom) {
    showToast('Please select a room first', 'warning');
    return;
  }
  
  callType = type;
  isInitiator = true;
  currentCallRoomId = currentRoom.id;
  
  try {
    // Get media based on type
    if (type === 'voice') {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } else if (type === 'video') {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } else if (type === 'screen') {
      localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      
      // Listen for screen share stop
      localStream.getVideoTracks()[0].onended = () => {
        endCall();
      };
    }
    
    showCallUI();
    setupLocalStream();
    await createPeerConnection();
    await subscribeToSignals();
    
    showToast(`${type} call started`, 'success');
  } catch (error) {
    console.error('Error starting call:', error);
    showToast('Could not access media devices', 'error');
    endCall();
  }
}

// Join existing call
async function joinCall(type, roomId) {
  callType = type;
  isInitiator = false;
  currentCallRoomId = roomId;
  
  try {
    // Get media
    if (type === 'voice') {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } else if (type === 'video') {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } else if (type === 'screen') {
      // Joining screen share - only receive
      localStream = null;
    }
    
    showCallUI();
    if (localStream) {
      setupLocalStream();
    }
    await createPeerConnection();
    await subscribeToSignals();
    
  } catch (error) {
    console.error('Error joining call:', error);
    showToast('Could not join call', 'error');
    endCall();
  }
}

// Setup local stream
function setupLocalStream() {
  const localVideo = document.getElementById('localVideo');
  if (localVideo && localStream) {
    localVideo.srcObject = localStream;
    localVideo.muted = true;
  }
}

// Create peer connection
async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);
  
  // Add local stream tracks
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
  
  // Handle incoming tracks
  peerConnection.ontrack = (event) => {
    console.log('Received remote track');
    if (!remoteStream) {
      remoteStream = new MediaStream();
    }
    remoteStream.addTrack(event.track);
    
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;
    }
  };
  
  // Handle ICE candidates
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendSignal({
        type: 'ice-candidate',
        candidate: event.candidate
      });
    }
  };
  
  // Connection state changes
  peerConnection.onconnectionstatechange = () => {
    console.log('Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'disconnected' || 
        peerConnection.connectionState === 'failed') {
      endCall();
    }
  };
  
  // If initiator, create offer
  if (isInitiator) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await sendSignal({
      type: 'offer',
      offer: offer
    });
  }
}

// Send signal via Supabase
async function sendSignal(signal) {
  try {
    const supabase = getSupabase();
    await supabase.from('call_signals').insert([{
      room_id: currentCallRoomId,
      user_id: currentUser.id,
      signal: signal
    }]);
  } catch (error) {
    console.error('Error sending signal:', error);
  }
}

// Subscribe to signals
async function subscribeToSignals() {
  const supabase = getSupabase();
  
  signalChannel = supabase
    .channel(`call_signals:${currentCallRoomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'call_signals',
      filter: `room_id=eq.${currentCallRoomId}`
    }, async (payload) => {
      const signal = payload.new.signal;
      const senderId = payload.new.user_id;
      
      // Ignore own signals
      if (senderId === currentUser.id) return;
      
      await handleSignal(signal);
    })
    .subscribe();
}

// Handle incoming signal
async function handleSignal(signal) {
  if (!peerConnection) return;
  
  try {
    if (signal.type === 'offer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await sendSignal({
        type: 'answer',
        answer: answer
      });
    } else if (signal.type === 'answer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
    } else if (signal.type === 'ice-candidate') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  } catch (error) {
    console.error('Error handling signal:', error);
  }
}

// Show call UI
function showCallUI() {
  let modal = document.getElementById('callModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'callModal';
    modal.className = 'call-modal';
    document.body.appendChild(modal);
  }
  
  const isVideoCall = callType === 'video' || callType === 'screen';
  
  modal.innerHTML = `
    <div class="call-container">
      <div class="call-header">
        <h3>${callType === 'screen' ? 'Screen Share' : callType === 'video' ? 'Video Call' : 'Voice Call'}</h3>
        <button class="icon-btn" onclick="endCall()">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="call-videos">
        ${isVideoCall ? `
          <video id="remoteVideo" autoplay playsinline></video>
          <video id="localVideo" autoplay playsinline muted></video>
        ` : `
          <div class="voice-call-indicator">
            <i data-lucide="${callType === 'voice' ? 'mic' : 'monitor'}"></i>
            <p>Call in progress...</p>
          </div>
        `}
      </div>
      <div class="call-controls">
        ${callType !== 'screen' ? `
          <button class="call-btn" onclick="toggleMute()" id="muteBtn">
            <i data-lucide="mic"></i>
          </button>
        ` : ''}
        ${callType === 'video' ? `
          <button class="call-btn" onclick="toggleVideo()" id="videoBtn">
            <i data-lucide="video"></i>
          </button>
        ` : ''}
        <button class="call-btn end-btn" onclick="endCall()">
          <i data-lucide="phone-off"></i>
        </button>
      </div>
    </div>
  `;
  
  modal.style.display = 'flex';
  
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Toggle mute
function toggleMute() {
  if (!localStream) return;
  
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    const btn = document.getElementById('muteBtn');
    if (btn) {
      btn.classList.toggle('muted', !audioTrack.enabled);
      btn.innerHTML = audioTrack.enabled ? '<i data-lucide="mic"></i>' : '<i data-lucide="mic-off"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

// Toggle video
function toggleVideo() {
  if (!localStream) return;
  
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    const btn = document.getElementById('videoBtn');
    if (btn) {
      btn.classList.toggle('muted', !videoTrack.enabled);
      btn.innerHTML = videoTrack.enabled ? '<i data-lucide="video"></i>' : '<i data-lucide="video-off"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  }
}

// End call
function endCall() {
  console.log('Ending call...');
  
  // Stop all tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
    remoteStream = null;
  }
  
  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Unsubscribe from signals
  if (signalChannel) {
    signalChannel.unsubscribe();
    signalChannel = null;
  }
  
  // Hide UI
  const modal = document.getElementById('callModal');
  if (modal) {
    modal.style.display = 'none';
    modal.remove();
  }
  
  // Reset state
  callType = null;
  isInitiator = false;
  currentCallRoomId = null;
  
  console.log('Call ended');
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (peerConnection) {
    endCall();
  }
});

console.log('WebRTC (REBUILT) loaded');
