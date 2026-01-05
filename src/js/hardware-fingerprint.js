// HARDWARE FINGERPRINTING FOR BANS

let hardwareId = null;

// Generate hardware fingerprint
async function generateHardwareFingerprint() {
  try {
    const components = [];
    
    // Screen resolution
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    
    // Timezone
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    // Language
    components.push(navigator.language);
    
    // Platform
    components.push(navigator.platform);
    
    // Hardware concurrency (CPU cores)
    components.push(navigator.hardwareConcurrency || 'unknown');
    
    // Device memory
    components.push(navigator.deviceMemory || 'unknown');
    
    // Canvas fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 50;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('RowChat', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Fingerprint', 4, 17);
    const canvasData = canvas.toDataURL();
    components.push(canvasData.slice(-50)); // Last 50 chars
    
    // WebGL fingerprint
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
    
    // Audio context fingerprint
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      
      gainNode.gain.value = 0;
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(0);
      
      await new Promise(resolve => {
        scriptProcessor.onaudioprocess = function() {
          const frequencyData = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(frequencyData);
          components.push(frequencyData.slice(0, 10).join(','));
          oscillator.stop();
          resolve();
        };
      });
      
      audioContext.close();
    } catch (e) {
      components.push('audio-unavailable');
    }
    
    // Hash all components
    const fingerprintString = components.join('|||');
    const hash = await hashString(fingerprintString);
    
    return hash;
    
  } catch (error) {
    console.error('Error generating hardware fingerprint:', error);
    return 'fallback-' + Date.now();
  }
}

// Hash function
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Save hardware ID to database
async function saveHardwareId(userId, hwId) {
  try {
    const supabase = getSupabase();
    
    await supabase
      .from('users')
      .update({ hardware_id: hwId })
      .eq('id', userId);
    
  } catch (error) {
    console.error('Error saving hardware ID:', error);
  }
}

// Check if hardware is banned
async function checkHardwareBan(hwId) {
  try {
    const supabase = getSupabase();
    
    const { data: ban, error } = await supabase
      .from('bans')
      .select('*')
      .eq('hardware_id', hwId)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    return ban;
    
  } catch (error) {
    console.error('Error checking hardware ban:', error);
    return null;
  }
}

// Initialize hardware fingerprint
async function initHardwareFingerprint() {
  hardwareId = await generateHardwareFingerprint();
  console.log('Hardware fingerprint generated:', hardwareId.slice(0, 8) + '...');
  
  // Check if hardware is banned before login
  const hwBan = await checkHardwareBan(hardwareId);
  if (hwBan) {
    showToast('This device has been permanently banned', 'error');
    setTimeout(() => {
      window.location.href = 'about:blank';
    }, 3000);
    return false;
  }
  
  return true;
}

console.log('Hardware fingerprint module loaded');
