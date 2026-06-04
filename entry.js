document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Default Date Input to Current Local Date
  initDefaultDate();

  // 2. Wire up Tab Redirect Handlers
  initNavigation();

  // 3. Form Submit Validation & Toast Trigger
  initFormSubmit();

  // 4. System notification quick toggle
  initNotificationToggle();
});

/**
 * Automatically populates the transaction date selector to today's local date
 */
function initDefaultDate() {
  const dateInput = document.getElementById('inputDate');
  if (dateInput) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
  }
}

/**
 * Setup navigation redirects for the bottom-tab-bar elements
 */
function initNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = btn.getAttribute('data-target');
      if (target === 'screen-dashboard') {
        e.preventDefault();
        window.location.href = 'portfolio.html';
      } else if (target === 'screen-ledger') {
        e.preventDefault();
        window.location.href = 'ledger.html';
      } else if (target === 'settings-screen') {
        e.preventDefault();
        window.location.href = 'settings.html';
      }
    });
  });
}

/**
 * Handle form submission validation and show verified visual alerts
 */
function initFormSubmit() {
  const tradeForm = document.getElementById('tradeForm');
  if (!tradeForm) return;

  tradeForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Stop default form navigation

    const ticker = document.getElementById('inputTicker').value.trim();
    const type = document.getElementById('inputType').value;
    const action = document.getElementById('inputAction').value;
    const shares = document.getElementById('inputShares').value;
    const price = document.getElementById('inputPrice').value;
    const date = document.getElementById('inputDate').value;
    const comment = document.getElementById('inputComment').value.trim();

    // Field verification loop
    if (!ticker || !type || !action || !shares || !price || !date) {
      showToast('⚠️ Please fill out all required execution fields.', true);
      return;
    }

    // Success Toast
    const actionColor = action === 'BUY' ? 'Bought' : 'Sold';
    const typeName = type === 'options' ? 'Contracts' : 'Shares';
    const message = `🟢 Validated: ${actionColor} ${shares} ${ticker} ${typeName} @ $${parseFloat(price).toFixed(2)}! Journal locked to ledger.`;
    
    showToast(message, false);

    // Send native system push notification if enabled
    if (localStorage.getItem('portfolio_notifications_enabled') === 'true') {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(`📈 Trade Executed: ${ticker}`, {
            body: `${actionColor} ${shares} ${typeName} @ $${parseFloat(price).toFixed(2)} logged to ledger.`,
          });
        } catch (err) {
          console.error('Push notification failed:', err);
        }
      }
    }

    // Reset input fields but keep default date intact
    document.getElementById('inputTicker').value = '';
    document.getElementById('inputShares').value = '';
    document.getElementById('inputPrice').value = '';
    document.getElementById('inputComment').value = '';
    initDefaultDate();
  });
}

/**
 * Renders a glassmorphic confirmation alert toast
 */
function showToast(message, isError) {
  const existingToast = document.querySelector('.app-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.innerText = message;
  
  if (isError) {
    toast.style.borderColor = 'rgba(239, 68, 68, 0.4)';
  }

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
    fontWeight: '550',
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
  }, 3000);
}

/**
 * Manages system notification toggle preferences and header bell clicks
 */
function initNotificationToggle() {
  const bellBtn = document.getElementById('notification-bell');
  const badge = document.getElementById('notification-badge');

  // Load and apply initial state on boot
  const isEnabled = localStorage.getItem('portfolio_notifications_enabled') === 'true';
  syncNotificationUI(isEnabled);

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
