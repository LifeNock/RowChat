// RESIZABLE SIDEBAR

let isResizing = false;
let lastDownX = 0;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 400;

function initResizableSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'sidebar-resize-handle';
  
  sidebar.appendChild(resizeHandle);
  
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    lastDownX = e.clientX;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    
    resizeHandle.classList.add('active');
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const offsetX = e.clientX - lastDownX;
    const currentWidth = sidebar.offsetWidth;
    const newWidth = Math.min(Math.max(currentWidth + offsetX, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
    
    sidebar.style.width = newWidth + 'px';
    lastDownX = e.clientX;
    
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
    }
  });
  
  // Load saved width
  const savedWidth = localStorage.getItem('sidebar-width');
  if (savedWidth) {
    sidebar.style.width = savedWidth + 'px';
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initResizableSidebar);
} else {
  initResizableSidebar();
}

console.log('Resizable sidebar loaded');
