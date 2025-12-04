// ============================================
// ROWCHAT - MEDIA & FILE UPLOADS
// ============================================

window.pendingFile = null;

// File Input Handler
document.getElementById('fileInput')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('File too large. Maximum size is 50MB', 'error');
    e.target.value = '';
    return;
  }
  
  window.pendingFile = file;
  showFilePreview(file);
});

// Show File Preview
function showFilePreview(file) {
  const previewBar = document.getElementById('filePreviewBar');
  const preview = document.getElementById('filePreview');
  
  let previewHTML = '';
  
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewHTML = `
        <img src="${e.target.result}" style="max-height: 60px; max-width: 100px; border-radius: 6px; margin-right: 12px;">
        <div>
          <div style="font-size: 14px; color: var(--text-primary);">${escapeHtml(file.name)}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${formatFileSize(file.size)}</div>
        </div>
      `;
      preview.innerHTML = previewHTML;
    };
    reader.readAsDataURL(file);
  } else if (file.type.startsWith('video/')) {
    previewHTML = `
      <div style="width: 60px; height: 60px; background: var(--bg-tertiary); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-right: 12px;">
        🎥
      </div>
      <div>
        <div style="font-size: 14px; color: var(--text-primary);">${escapeHtml(file.name)}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${formatFileSize(file.size)}</div>
      </div>
    `;
    preview.innerHTML = previewHTML;
  } else {
    previewHTML = `
      <div style="width: 60px; height: 60px; background: var(--bg-tertiary); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-right: 12px;">
        📄
      </div>
      <div>
        <div style="font-size: 14px; color: var(--text-primary);">${escapeHtml(file.name)}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">${formatFileSize(file.size)}</div>
      </div>
    `;
    preview.innerHTML = previewHTML;
  }
  
  previewBar.style.display = 'flex';
}

// Cancel File
function cancelFile() {
  window.pendingFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('filePreviewBar').style.display = 'none';
}

// Upload File to Supabase
async function uploadFile(file) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    let bucket = 'files';
    if (file.type.startsWith('image/')) {
      bucket = 'avatars';
    } else if (file.type.startsWith('video/')) {
      bucket = 'videos';
    }
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Upload error:', error);
      throw error;
    }
    
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    showToast('Failed to upload file', 'error');
    return null;
  }
}

// Upload Avatar
async function uploadAvatar(file) {
  try {
    // Check if image
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return null;
    }
    
    // Check size (2MB limit for avatars)
    if (file.size > 2 * 1024 * 1024) {
      showToast('Avatar too large. Maximum size is 2MB', 'error');
      return null;
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar-${currentUser.id}-${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) throw error;
    
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    showToast('Failed to upload avatar', 'error');
    return null;
  }
}

// Format File Size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Handle Paste Event for Images
document.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        window.pendingFile = file;
        showFilePreview(file);
      }
      break;
    }
  }
});

// Open Profile Modal
function openProfileModal() {
  document.getElementById('userMenu').style.display = 'none';
  
  const modal = document.getElementById('profileModal');
  const avatarPreview = document.getElementById('profileAvatarPreview');
  const displayNameInput = document.getElementById('profileDisplayName');
  const bioInput = document.getElementById('profileBio');
  
  // Set current values
  if (currentUser.avatar_url) {
    avatarPreview.innerHTML = `<img src="${currentUser.avatar_url}">`;
  } else {
    avatarPreview.textContent = currentUser.username.charAt(0).toUpperCase();
  }
  
  displayNameInput.value = currentUser.display_name || '';
  bioInput.value = currentUser.bio || '';
  
  modal.classList.add('active');
}

// Close Profile Modal
function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('active');
}

// Avatar Input Handler
document.getElementById('avatarInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('profileAvatarPreview').innerHTML = `<img src="${e.target.result}">`;
  };
  reader.readAsDataURL(file);
  
  window.pendingAvatar = file;
});

// Save Profile
async function saveProfile() {
  const displayName = document.getElementById('profileDisplayName').value.trim();
  const bio = document.getElementById('profileBio').value.trim();
  
  try {
    let avatarUrl = currentUser.avatar_url;
    
    // Upload avatar if changed
    if (window.pendingAvatar) {
      avatarUrl = await uploadAvatar(window.pendingAvatar);
      if (!avatarUrl) return;
      window.pendingAvatar = null;
    }
    
    // Update user
    const { error } = await supabase
      .from('users')
      .update({
        display_name: displayName || currentUser.username,
        bio: bio,
        avatar_url: avatarUrl
      })
      .eq('id', currentUser.id);
    
    if (error) throw error;
    
    // Update current user
    currentUser.display_name = displayName || currentUser.username;
    currentUser.bio = bio;
    currentUser.avatar_url = avatarUrl;
    
    localStorage.setItem('rowchat-user', JSON.stringify(currentUser));
    
    updateUserUI();
    showToast('Profile updated!', 'success');
    closeProfileModal();
  } catch (error) {
    console.error('Error saving profile:', error);
    showToast('Failed to save profile', 'error');
  }
}

console.log('Media.js loaded');
