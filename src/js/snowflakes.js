// ROWCHAT - CHRISTMAS SNOWFLAKES

let snowflakeInterval = null;

function createSnowflake() {
  const snowflake = document.createElement('div');
  snowflake.style.cssText = `
    position: fixed !important;
    top: -10px;
    left: ${Math.random() * 100}%;
    width: ${Math.random() * 3 + 2}px;
    height: ${Math.random() * 3 + 2}px;
    background: #ffffff !important;
    border-radius: 50%;
    opacity: ${Math.random() * 0.3 + 0.4};
    pointer-events: none;
    z-index: 999999;
  `;
  
  document.body.appendChild(snowflake);
  
  const duration = Math.random() * 10000 + 10000;
  const drift = (Math.random() - 0.5) * 100;
  
  let startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = elapsed / duration;
    
    if (progress >= 1) {
      snowflake.remove();
      return;
    }
    
    const top = progress * (window.innerHeight + 20);
    const left = parseFloat(snowflake.style.left) + (drift * progress * 0.01);
    
    snowflake.style.top = top + 'px';
    snowflake.style.left = left + '%';
    
    requestAnimationFrame(animate);
  }
  
  animate();
}

function startSnowfall() {
  if (snowflakeInterval) return;
  
  snowflakeInterval = setInterval(() => {
    createSnowflake();
  }, 200);
}

function stopSnowfall() {
  if (snowflakeInterval) {
    clearInterval(snowflakeInterval);
    snowflakeInterval = null;
  }
  
  document.querySelectorAll('div[style*="z-index: 999999"]').forEach(el => {
    if (el.style.borderRadius === '50%' && el.style.backgroundColor === 'white') {
      el.remove();
    }
  });
}

function checkTheme() {
  const theme = document.body.getAttribute('data-theme');
  
  if (theme === 'christmas') {
    startSnowfall();
  } else {
    stopSnowfall();
  }
}

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'data-theme') {
      checkTheme();
    }
  });
});

observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['data-theme']
});

checkTheme();

console.log('Snowflakes.js loaded - switch to Christmas theme to see snowflakes');
