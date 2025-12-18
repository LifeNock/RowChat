// RESIZABLE SIDEBAR

let isResizing = false;
let startX = 0;
let startWidth = 0;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 400;

function initResizableSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  
  // Make sure sidebar has position relative
  sidebar.style.position = 'relative';
  
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'sidebar-resize-handle';
  resizeHandle.innerHTML = '<div class="resize-indicator"></div>';
  
  sidebar.appendChild(resizeHandle);
  
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    
    resizeHandle.classList.add('active');
    sidebar.classList.add('resizing');
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const newWidth = Math.min(Math.max(startWidth + deltaX, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
    
    sidebar.style.width = newWidth + 'px';
    
    // Save to localStorage
    localStorage.setItem('sidebar-width', newWidth);
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      const resizeHandle = document.querySelector('.sidebar-resize-handle');
      if (resizeHandle) {
        resizeHandle.classList.remove('active');
      }
      sidebar.classList.remove('resizing');
    }
  });
  
  // Load saved width
  const savedWidth = localStorage.getItem('sidebar-width');
  if (savedWidth) {
    sidebar.style.width = savedWidth + 'px';
  }
}

// Initialize on page load
setTimeout(initResizableSidebar, 500);

console.log('Resizable sidebar loaded');
