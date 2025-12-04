// ============================================
// SUPABASE CONFIGURATION
// ============================================

const SUPABASE_URL = 'https://oulktlqdkjzrffheszgp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91bGt0bHFka2p6cmZmaGVzemdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDczMjIsImV4cCI6MjA4MDQyMzMyMn0.OBd7uqt8jiKHdFdk6oIDjDQoerInW-tzqyVjJKlZ9DM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// Export for use in other files
window.supabaseClient = supabase;
