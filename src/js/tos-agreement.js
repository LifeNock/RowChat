// TOS AND PRIVACY POLICY AGREEMENT SYSTEM

const CURRENT_TOS_VERSION = '1.0';
const CURRENT_PRIVACY_VERSION = '1.0';

// Check if user needs to accept agreements
async function checkAgreements() {
  if (!currentUser) return;
  
  try {
    const supabase = getSupabase();
    
    const { data: user, error } = await supabase
      .from('users')
      .select('tos_accepted, tos_version, privacy_accepted, privacy_version')
      .eq('id', currentUser.id)
      .single();
    
    if (error) throw error;
    
    const needsTOS = !user.tos_accepted || user.tos_version !== CURRENT_TOS_VERSION;
    const needsPrivacy = !user.privacy_accepted || user.privacy_version !== CURRENT_PRIVACY_VERSION;
    
    if (needsTOS || needsPrivacy) {
      showAgreementModal(needsTOS, needsPrivacy);
    }
    
  } catch (error) {
    console.error('Error checking agreements:', error);
  }
}

// Show agreement modal
function showAgreementModal(needsTOS, needsPrivacy) {
  const modal = document.getElementById('agreementModal');
  if (!modal) return;
  
  const tosSection = document.getElementById('tosSection');
  const privacySection = document.getElementById('privacySection');
  const tosCheckbox = document.getElementById('agreeToTOS');
  const privacyCheckbox = document.getElementById('agreeToPrivacy');
  
  // Show/hide sections based on what's needed
  if (tosSection) tosSection.style.display = needsTOS ? 'block' : 'none';
  if (privacySection) privacySection.style.display = needsPrivacy ? 'block' : 'none';
  
  // Reset checkboxes
  if (tosCheckbox) tosCheckbox.checked = false;
  if (privacyCheckbox) privacyCheckbox.checked = false;
  
  // Update button state
  updateAcceptButton();
  
  // Show modal - can't be closed without accepting
  modal.classList.add('active');
  modal.style.pointerEvents = 'auto';
  
  // Disable close on overlay click
  const overlay = modal.querySelector('.modal-overlay');
  if (overlay) {
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        e.stopPropagation();
        showToast('You must accept the agreements to continue', 'warning');
      }
    };
  }
}

// Update accept button enabled state
function updateAcceptButton() {
  const tosCheckbox = document.getElementById('agreeToTOS');
  const privacyCheckbox = document.getElementById('agreeToPrivacy');
  const acceptBtn = document.getElementById('acceptAgreementsBtn');
  
  if (!acceptBtn) return;
  
  const tosSection = document.getElementById('tosSection');
  const privacySection = document.getElementById('privacySection');
  
  const tosNeeded = tosSection && tosSection.style.display !== 'none';
  const privacyNeeded = privacySection && privacySection.style.display !== 'none';
  
  const tosAccepted = !tosNeeded || (tosCheckbox && tosCheckbox.checked);
  const privacyAccepted = !privacyNeeded || (privacyCheckbox && privacyCheckbox.checked);
  
  acceptBtn.disabled = !(tosAccepted && privacyAccepted);
}

// Accept agreements
async function acceptAgreements() {
  const tosCheckbox = document.getElementById('agreeToTOS');
  const privacyCheckbox = document.getElementById('agreeToPrivacy');
  const tosSection = document.getElementById('tosSection');
  const privacySection = document.getElementById('privacySection');
  
  const acceptTOS = tosSection && tosSection.style.display !== 'none' && tosCheckbox && tosCheckbox.checked;
  const acceptPrivacy = privacySection && privacySection.style.display !== 'none' && privacyCheckbox && privacyCheckbox.checked;
  
  if (!acceptTOS && !acceptPrivacy) {
    showToast('Please check all boxes to continue', 'warning');
    return;
  }
  
  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();
    
    // Update user record
    const updates = {};
    
    if (acceptTOS) {
      updates.tos_accepted = true;
      updates.tos_accepted_at = now;
      updates.tos_version = CURRENT_TOS_VERSION;
    }
    
    if (acceptPrivacy) {
      updates.privacy_accepted = true;
      updates.privacy_accepted_at = now;
      updates.privacy_version = CURRENT_PRIVACY_VERSION;
    }
    
    const { error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', currentUser.id);
    
    if (updateError) throw updateError;
    
    // Log acceptances
    const logs = [];
    
    if (acceptTOS) {
      logs.push({
        user_id: currentUser.id,
        agreement_type: 'tos',
        version: CURRENT_TOS_VERSION,
        user_agent: navigator.userAgent
      });
    }
    
    if (acceptPrivacy) {
      logs.push({
        user_id: currentUser.id,
        agreement_type: 'privacy',
        version: CURRENT_PRIVACY_VERSION,
        user_agent: navigator.userAgent
      });
    }
    
    if (logs.length > 0) {
      await supabase.from('agreement_logs').insert(logs);
    }
    
    // Update current user object
    if (acceptTOS) {
      currentUser.tos_accepted = true;
      currentUser.tos_version = CURRENT_TOS_VERSION;
    }
    if (acceptPrivacy) {
      currentUser.privacy_accepted = true;
      currentUser.privacy_version = CURRENT_PRIVACY_VERSION;
    }
    
    // Close modal
    const modal = document.getElementById('agreementModal');
    if (modal) modal.classList.remove('active');
    
    showToast('Thank you for accepting', 'success');
    
  } catch (error) {
    console.error('Error accepting agreements:', error);
    showToast('Failed to save acceptance', 'error');
  }
}

// View full TOS
function viewFullTOS() {
  window.open('/tos.html', '_blank');
}

// View full Privacy Policy
function viewFullPrivacy() {
  window.open('/privacy.html', '_blank');
}

console.log('TOS Agreement system loaded');
