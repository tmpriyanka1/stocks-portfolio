document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize navigation click redirects
  initNavigation();

  // 2. Load and wire up Profile Settings updates
  initProfileSettings();

  // 3. Accent Color Theme switching logic
  initAccentSelector();

  // 4. Preferences & Action buttons triggers
  initActionHandlers();

  // 5. System notification preferences toggle
  initNotificationToggle();
});

/**
 * Handle bottom-tab-bar redirect triggers
 */
function initNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = btn.getAttribute('data-target');
      
      if (target === 'settings-screen') {
        e.preventDefault();
        return; // Already on Settings screen
      }
      
      e.preventDefault();
      if (target === 'screen-dashboard') {
        window.location.href = 'portfolio.html';
      } else if (target === 'screen-ledger') {
        window.location.href = 'ledger.html';
      } else if (target === 'screen-entry') {
        window.location.href = 'entry.html';
      }
    });
  });
}

/**
 * Sync user profile name input to screen previews dynamically
 */
function initProfileSettings() {
  const usernameInput = document.getElementById('usernameInput');
  const avatarPreview = document.getElementById('avatarPreview');
  const titleUsername = document.getElementById('titleUsername');
  const saveBtn = document.getElementById('saveProfileBtn');

  // Load saved username if present
  const savedName = localStorage.getItem('portfolio_username') || 'Vanai';
  if (usernameInput) usernameInput.value = savedName;
  updateUserDisplay(savedName);

  if (saveBtn && usernameInput) {
    saveBtn.addEventListener('click', () => {
      const newName = usernameInput.value.trim();
      if (newName === '') {
        showToast('⚠️ Profile name cannot be blank!', true);
        return;
      }
      
      localStorage.setItem('portfolio_username', newName);
      updateUserDisplay(newName);
      showToast('🟢 Profile settings saved successfully.');
    });
  }

  function updateUserDisplay(name) {
    if (titleUsername) titleUsername.textContent = name;
    if (avatarPreview && name.length > 0) {
      avatarPreview.textContent = name.charAt(0).toUpperCase();
    }
  }
}

/**
 * Switch global accent color themes instantly using CSS custom properties
 */
function initAccentSelector() {
  const accordion = document.getElementById('themeAccordion');
  const dots = document.querySelectorAll('.accent-dot');
  const activeColorPreview = document.getElementById('activeColorPreview');
  const currentThemeName = document.getElementById('currentThemeName');
  
  // Load saved theme color from localStorage
  const savedColor = localStorage.getItem('portfolio_accent_color') || '#6366f1';
  document.documentElement.style.setProperty('--accent', savedColor);
  
  // Function to map hex to readable names
  const getColorName = (hex) => {
    switch (hex) {
      case '#6366f1': return 'Indigo Theme';
      case '#10b981': return 'Emerald Green Theme';
      case '#ef4444': return 'Rose Red Theme';
      case '#a855f7': return 'Purple Theme';
      case '#0ea5e9': return 'Sky Blue Theme';
      default: return 'Custom Theme';
    }
  };

  // Set initial preview state
  if (activeColorPreview) {
    activeColorPreview.style.backgroundColor = savedColor;
    activeColorPreview.style.boxShadow = `0 0 6px ${savedColor}`;
  }
  if (currentThemeName) {
    currentThemeName.textContent = getColorName(savedColor);
  }

  // Toggle Accordion Panel Expansion on header click
  if (accordion) {
    accordion.addEventListener('click', (e) => {
      // Toggle expansion ONLY if clicking header elements or card outside content
      const isContentClick = e.target.closest('.accordion-content');
      if (!isContentClick) {
        accordion.classList.toggle('expanded');
      }
    });
  }
  
  dots.forEach(dot => {
    const color = dot.getAttribute('data-color');
    if (color === savedColor) {
      dots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    }

    dot.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent accordion from collapsing closed when color is selected
      
      dots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      
      // Update global CSS custom accent color property dynamically
      document.documentElement.style.setProperty('--accent', color);
      localStorage.setItem('portfolio_accent_color', color);
      
      // Sync preview states
      if (activeColorPreview) {
        activeColorPreview.style.backgroundColor = color;
        activeColorPreview.style.boxShadow = `0 0 6px ${color}`;
      }
      if (currentThemeName) {
        currentThemeName.textContent = getColorName(color);
      }
      
      showToast(`🎨 Color theme switched to ${dot.getAttribute('aria-label') || 'accent'}!`);
    });
  });
}

/**
 * Wire preference switches and Danger Zone buttons
 */
function initActionHandlers() {
  const resetBtn = document.getElementById('resetLedgerBtn');
  const toggleBlur = document.getElementById('toggleBlur');
  
  // Danger Zone: Reset local database/ledger mock alert
  if (resetBtn) {
    let confirmStage = false;
    
    resetBtn.addEventListener('click', () => {
      if (!confirmStage) {
        confirmStage = true;
        resetBtn.innerText = '⚠️ ARE YOU SURE? (Click to Confirm)';
        resetBtn.style.background = 'rgba(239, 68, 68, 0.2)';
        resetBtn.style.borderColor = 'var(--danger)';
        
        setTimeout(() => {
          confirmStage = false;
          resetBtn.innerText = '🗑️ Reset Local Ledger';
          resetBtn.style.background = 'rgba(239, 68, 68, 0.06)';
          resetBtn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        }, 5000); // 5s timeout to auto reset back to primary state
      } else {
        confirmStage = false;
        resetBtn.innerText = '🗑️ Reset Local Ledger';
        resetBtn.style.background = 'rgba(239, 68, 68, 0.06)';
        resetBtn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        
        showToast('🗑️ Local ledger database wiped and reset.', true);
      }
    });
  }

  // Toggle glass effects switch
  if (toggleBlur) {
    toggleBlur.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.documentElement.style.setProperty('--backdrop-blur-val', '16px');
        showToast('✨ Layout frosted blur effects enabled.');
      } else {
        document.documentElement.style.setProperty('--backdrop-blur-val', '0px');
        showToast('💨 Layout frosted blur effects disabled.');
      }
    });
  }
}

/**
 * Render glassmorphic toast notification alerts
 */
function showToast(message, isError) {
  const existingToast = document.querySelector('.app-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.innerText = message;

  Object.assign(toast.style, {
    position: 'absolute',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid ' + (isError ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.35)'),
    color: '#f8fafc',
    padding: '12px 18px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '555',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
    zIndex: '200',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    width: '85%',
    textAlign: 'center'
  });

  document.getElementById('app-container').appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/**
 * Manages system notification toggle preferences and header bell clicks
 */
function initNotificationToggle() {
  const toggleNotifications = document.getElementById('toggleNotifications');
  const bellBtn = document.getElementById('notification-bell');
  const badge = document.getElementById('notification-badge');

  // Load and apply initial state on boot
  const isEnabled = localStorage.getItem('portfolio_notifications_enabled') === 'true';
  syncNotificationUI(isEnabled);

  // Toggle switch change listener
  if (toggleNotifications) {
    toggleNotifications.addEventListener('change', (e) => {
      handleToggle(e.target.checked);
    });
  }

  // Bell click quick toggle
  if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentState = localStorage.getItem('portfolio_notifications_enabled') === 'true';
      handleToggle(!currentState);
    });
  }

  function handleToggle(enable) {
    if (enable) {
      if (typeof Notification !== 'undefined') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            saveState(true);
            showToast('🔔 System notifications enabled!');
          } else {
            saveState(false);
            showToast('⚠️ Permission denied for notifications.', true);
          }
        });
      } else {
        saveState(true);
        showToast('🔔 Notifications enabled (mock mode)!');
      }
    } else {
      saveState(false);
      showToast('🔕 System notifications disabled.');
    }
  }

  function saveState(enabled) {
    localStorage.setItem('portfolio_notifications_enabled', enabled ? 'true' : 'false');
    syncNotificationUI(enabled);
  }

  function syncNotificationUI(enabled) {
    if (toggleNotifications) {
      toggleNotifications.checked = enabled;
    }
    if (badge) {
      badge.style.display = enabled ? 'block' : 'none';
    }
    if (bellBtn) {
      if (enabled) {
        bellBtn.classList.remove('disabled');
      } else {
        bellBtn.classList.add('disabled');
      }
    }
  }
}
