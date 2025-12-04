// ============================================
// ROWCHAT - AUTHENTICATION (FIXED)
// ============================================

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
  console.error('Auth Error:', message);
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
  
  console.log('Attempting login for:', username);
  showLoading(true);
  
  try {
    // Get the correct Supabase client
    const supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    const passwordHash = await hashPassword(password);
    console.log('Password hashed, querying database...');
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password_hash', passwordHash)
      .single();
    
    console.log('Login query result:', { data, error });
    
    if (error || !data) {
      showAuthError('Invalid username or password');
      showLoading(false);
      return;
    }
    
    currentUser = data;
    localStorage.setItem('rowchat-user', JSON.stringify(data));
    
    console.log('Login successful!');
    await initializeApp();
  } catch (error) {
    console.error('Login error:', error);
    showAuthError('Login failed: ' + error.message);
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
  
  console.log('Registration attempt:', { username, email });
  
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
    // Get the correct Supabase client
    const supabase = window.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    console.log('Checking if username exists...');
    
    // Check if username exists
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    
    console.log('Username check result:', { existing, checkError });
    
    if (existing) {
      showAuthError('Username already taken');
      showLoading(false);
      return;
    }
    
    // Create user
    const passwordHash = await hashPassword(password);
    console.log('Creating user...');
    
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
    
    console.log('User creation result:', { data, error });
    
    if (error) {
      console.error('Registration error details:', error);
      showAuthError('Registration failed: ' + error.message);
      showLoading(false);
      return;
    }
    
    currentUser = data;
    localStorage.setItem('rowchat-user', JSON.stringify(data));
    
    console.log('User created successfully! Auto-joining general room...');
    
    // Auto-join general room
    try {
      await supabase
        .from('room_members')
        .insert([{
          room_id: 1,
          user_id: currentUser.id,
          role: 'member'
        }]);
      console.log('Joined general room');
    } catch (roomError) {
      console.error('Failed to join general room:', roomError);
      // Don't fail registration if room join fails
    }
    
    console.log('Registration complete! Initializing app...');
    await initializeApp();
  } catch (error) {
    console.error('Registration exception:', error);
    showAuthError('Registration failed: ' + error.message);
  }
  
  showLoading(false);
}

// Handle Enter key on auth forms
document.addEventListener('DOMContentLoaded', () => {
  const loginPassword = document.getElementById('loginPassword');
  const registerConfirm = document.getElementById('registerConfirm');
  
  if (loginPassword) {
    loginPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') login();
    });
  }
  
  if (registerConfirm) {
    registerConfirm.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') register();
    });
  }
});

console.log('Auth.js loaded with console debugging');
