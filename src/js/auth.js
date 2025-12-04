// ============================================
// ROWCHAT - AUTHENTICATION
// ============================================

// Debug check
setTimeout(() => {
  const debugDiv = document.getElementById('debug');
  if (typeof supabase === 'undefined') {
    debugDiv.textContent = 'ERROR: Supabase not loaded!';
    debugDiv.style.background = 'red';
  } else {
    debugDiv.textContent = 'Supabase OK!';
    debugDiv.style.background = 'green';
  }
}, 1000);

// Show Login Form
function showLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
  hideAuthError();
}

// Show Register Form
function showRegister() {
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('loginForm').style.display = 'none';
  hideAuthError();
}

// Show Auth Error
function showAuthError(message) {
  const errorEl = document.getElementById('authError');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

// Hide Auth Error
function hideAuthError() {
  document.getElementById('authError').style.display = 'none';
}

// Hash Password
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'rowchat-salt-2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Login
async function login() {
  hideAuthError();
  
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!username || !password) {
    showAuthError('Please enter username and password');
    return;
  }
  
  showLoading(true);
  
  try {
    const passwordHash = await hashPassword(password);
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password_hash', passwordHash)
      .single();
    
    if (error || !data) {
      showAuthError('Invalid username or password');
      showLoading(false);
      return;
    }
    
    currentUser = data;
    localStorage.setItem('rowchat-user', JSON.stringify(data));
    
    await initializeApp();
  } catch (error) {
    console.error('Login error:', error);
    showAuthError('Login failed. Please try again.');
  }
  
  showLoading(false);
}

// Register
async function register() {
  hideAuthError();
  
  const username = document.getElementById('registerUsername').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerConfirm').value;
  
  // Validation
  if (!username || !password) {
    showAuthError('Please enter username and password');
    return;
  }
  
  if (username.length < 3) {
    showAuthError('Username must be at least 3 characters');
    return;
  }
  
  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }
  
  if (password !== confirm) {
    showAuthError('Passwords do not match');
    return;
  }
  
  showLoading(true);
  
  try {
    // Check if username exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();
    
    if (existing) {
      showAuthError('Username already taken');
      showLoading(false);
      return;
    }
    
    // Create user
    const passwordHash = await hashPassword(password);
    
    const { data, error } = await supabase
      .from('users')
      .insert([{
        username: username,
        email: email || null,
        password_hash: passwordHash,
        display_name: username
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    currentUser = data;
    localStorage.setItem('rowchat-user', JSON.stringify(data));
    
    // Auto-join general room
    await supabase
      .from('room_members')
      .insert([{
        room_id: 1,
        user_id: currentUser.id,
        role: 'member'
      }]);
    
    await initializeApp();
  } catch (error) {
    console.error('Register error:', error);
    showAuthError('Registration failed. Please try again.');
  }
  
  showLoading(false);
}

// Handle Enter key on auth forms
document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') login();
});

document.getElementById('registerConfirm')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') register();
});

console.log('Auth.js loaded');
