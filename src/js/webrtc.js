// ROWCHAT - WEBRTC VOICE/VIDEO/SCREEN SHARE

let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentCall = null;
let callChannel = null;

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function initCalls() {
  // Add call buttons to chat header
  const headerRight = document.querySelector('.chat-header-right');
  if (headerRight) {
    const voiceBtn = document.createElement('button');
    voiceBtn.className = 'icon-btn';
    voiceBtn.innerHTML = '🎙️';
    voiceBtn.title = 'Voice Call';
    voiceBtn.onclick = () => startCall('voice');
    
    const videoBtn = document.createElement('button');
    videoBtn.className = 'icon-btn';
    videoBtn.innerHTML = '📹';
    videoBtn.title = 'Video Call';
    videoBtn.onclick = () => startCall('video');
    
    const screenBtn = document.createElement('button');
    screenBtn.className = 'icon-btn';
    screenBtn.innerHTML = '🖥️';
    screenBtn.title = 'Screen Share';
    screenBtn.onclick = () => startCall('screen');
    
    const firstChild = headerRight.children[1];
    headerRight.insertBefore(screenBtn, firstChild);
    headerRight.insertBefore(videoBtn, firstChild);
    headerRight.insertBefore(voiceBtn, firstChild);
  }
  
  // Create call modal
  const callModal = document.createElement('div');
  callModal.id = 'callModal';
  callModal.className = 'call-modal';
  callModal.innerHTML = `
    <div class="call-container">
      <div class="call-header">
        <div class="call-info">
          <div class="call-title" id="callTitle">Connecting...</div>
          <div class="call-status" id="callStatus">Calling...</div>
        </div>
      </div>
      <div class="call-video-container">
        <video id="remoteVideo" class="remote-video" autoplay playsinline></video>
        <video id="localVideo" class="local-video" autoplay playsinline muted></video>
      </div>
      <div class="call-controls">
        <button class="call-btn mute-btn" id="muteBtn" onclick="toggleMute()" title="Mute">
          <span id="muteIcon">🎤</span>
        </button>
        <button class="call-btn video-btn" id="videoBtn" onclick="toggleVideo()" title="Camera">
          <span id="videoIcon">📹</span>
        </button>
        <button class="call-btn screen-btn" id="screenBtn" onclick="toggleScreenShare()" title="Share Screen">
          <span>🖥️</span>
        </button>
        <button class="call-btn end-btn" onclick="endCall()" title="End Call">
          <span>📞</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(callModal);
  
  // Subscribe to call signals
  subscribeToCallSignals();
}

async function startCall(type) {
  if (!currentRoom && !currentDM) {
    showToast('Please select a room or DM first', 'warning');
    return;
  }
  
  try {
    currentCall = {
      type: type,
      roomId: currentRoom ? currentRoom.id : currentDM.id,
      initiator: true
    };
    
    // Get media stream
    if (type === 'screen') {
      localStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
    } else {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
    }
    
    // Show call modal
    document.getElementById('callModal').classList.add('active');
    document.getElementById('localVideo').srcObject = localStream;
    document.getElementById('callTitle').textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Call`;
    
    // Hide video elements if voice only
    if (type === 'voice') {
      document.getElementById('localVideo').style.display = 'none';
      document.getElementById('remoteVideo').style.display = 'none';
      document.getElementById('videoBtn').style.display = 'none';
    }
    
    // Create peer connection
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local stream
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('Received remote track');
      remoteStream = event.streams[0];
      document.getElementById('remoteVideo').srcObject = remoteStream;
      document.getElementById('callStatus').textContent = 'Connected';
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };
    
    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    sendSignal({
      type: 'offer',
      offer: offer,
      callType: type
    });
    
  } catch (error) {
    console.error('Error starting call:', error);
    showToast('Failed to start call: ' + error.message, 'error');
    endCall();
  }
}

async function handleIncomingCall(signal) {
  if (signal.type === 'offer') {
    // Show incoming call notification
    const accept = confirm(`Incoming ${signal.callType} call. Accept?`);
    
    if (!accept) {
      sendSignal({ type: 'reject' });
      return;
    }
    
    try {
      currentCall = {
        type: signal.callType,
        roomId: signal.roomId,
        initiator: false
      };
      
      // Get media stream
      if (signal.callType === 'screen') {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      } else {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: signal.callType === 'video',
          audio: true
        });
      }
      
      // Show call modal
      document.getElementById('callModal').classList.add('active');
      document.getElementById('localVideo').srcObject = localStream;
      document.getElementById('callTitle').textContent = `${signal.callType.charAt(0).toUpperCase() + signal.callType.slice(1)} Call`;
      document.getElementById('callStatus').textContent = 'Connecting...';
      
      if (signal.callType === 'voice') {
        document.getElementById('localVideo').style.display = 'none';
        document.getElementById('remoteVideo').style.display = 'none';
        document.getElementById('videoBtn').style.display = 'none';
      }
      
      // Create peer connection
      peerConnection = new RTCPeerConnection(ICE_SERVERS);
      
      // Add local stream
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
      
      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote track');
        remoteStream = event.streams[0];
        document.getElementById('remoteVideo').srcObject = remoteStream;
        document.getElementById('callStatus').textContent = 'Connected';
      };
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: 'ice-candidate',
            candidate: event.candidate
          });
        }
      };
      
      // Set remote description and create answer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      sendSignal({
        type: 'answer',
        answer: answer
      });
      
    } catch (error) {
      console.error('Error handling incoming call:', error);
      showToast('Failed to answer call', 'error');
      endCall();
    }
  } else if (signal.type === 'answer' && peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
  } else if (signal.type === 'ice-candidate' && peerConnection) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
  } else if (signal.type === 'end-call') {
    endCall();
  }
}

function sendSignal(signal) {
  const supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  
  const roomId = currentRoom ? currentRoom.id : (currentDM ? currentDM.id : null);
  if (!roomId) return;
  
  supabase
    .from('call_signals')
    .insert([{
      room_id: roomId,
      user_id: currentUser.id,
      signal: signal,
      created_at: new Date().toISOString()
    }])
    .then(({ error }) => {
      if (error) console.error('Error sending signal:', error);
    });
}

function subscribeToCallSignals() {
  const supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  
  callChannel = supabase
    .channel('call_signals')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'call_signals'
    }, (payload) => {
      if (payload.new.user_id !== currentUser.id) {
        handleIncomingCall(payload.new.signal);
      }
    })
    .subscribe();
}

function toggleMute() {
  if (!localStream) return;
  
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    document.getElementById('muteIcon').textContent = audioTrack.enabled ? '🎤' : '🔇';
  }
}

function toggleVideo() {
  if (!localStream) return;
  
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    document.getElementById('videoIcon').textContent = videoTrack.enabled ? '📹' : '📷';
  }
}

async function toggleScreenShare() {
  try {
    if (currentCall && currentCall.type === 'screen') {
      // Stop screen share
      localStream.getTracks().forEach(track => track.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream = newStream;
      document.getElementById('localVideo').srcObject = newStream;
      
      // Replace track in peer connection
      const videoTrack = newStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
      
      currentCall.type = 'video';
    } else {
      // Start screen share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      localStream = screenStream;
      document.getElementById('localVideo').srcObject = screenStream;
      
      // Replace track in peer connection
      const videoTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
      
      currentCall.type = 'screen';
    }
  } catch (error) {
    console.error('Error toggling screen share:', error);
    showToast('Failed to toggle screen share', 'error');
  }
}

function endCall() {
  // Send end signal
  if (currentCall) {
    sendSignal({ type: 'end-call' });
  }
  
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
  
  // Hide call modal
  document.getElementById('callModal').classList.remove('active');
  document.getElementById('localVideo').srcObject = null;
  document.getElementById('remoteVideo').srcObject = null;
  
  // Reset display
  document.getElementById('localVideo').style.display = 'block';
  document.getElementById('remoteVideo').style.display = 'block';
  document.getElementById('videoBtn').style.display = 'block';
  
  currentCall = null;
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCalls);
} else {
  initCalls();
}

console.log('WebRTC Calls loaded');
