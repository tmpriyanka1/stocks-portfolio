document.addEventListener('DOMContentLoaded', () => {
  // Apply saved color theme
  const savedAccent = localStorage.getItem('portfolio_accent_color');
  if (savedAccent) {
    applyAccentColor(savedAccent);
  }

  initProfileForm();
  initThemeAccordion();
  initPreferences();
  initPortfolioOverrides();
  initNavigation();
});

function applyAccentColor(hexColor) {
  document.documentElement.style.setProperty('--accent', hexColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
}

/**
 * Loads user profile values from localStorage and sets blur events to save changes
 */
function initProfileForm() {
  const usernameInput = document.getElementById('usernameInput');
  const emailInput = document.getElementById('emailInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveBtn = document.getElementById('saveProfileBtn');

  if (usernameInput) {
    usernameInput.value = localStorage.getItem('portfolio_username') || 'Vanai';
    usernameInput.addEventListener('blur', () => {
      localStorage.setItem('portfolio_username', usernameInput.value);
    });
  }

  if (emailInput) {
    emailInput.value = localStorage.getItem('portfolio_email') || 'vanai@portfolio.com';
    emailInput.addEventListener('blur', () => {
      localStorage.setItem('portfolio_email', emailInput.value);
    });
  }

  if (apiKeyInput) {
    apiKeyInput.value = localStorage.getItem('portfolio_api_key') || '••••••••••••••••••••••••';
    apiKeyInput.addEventListener('blur', () => {
      localStorage.setItem('portfolio_api_key', apiKeyInput.value);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      showConfirmModal({
        icon: '👤',
        title: 'Save Profile Settings?',
        message: 'Are you sure you want to save your username, email, and API key settings?'
      }, () => {
        if (usernameInput) localStorage.setItem('portfolio_username', usernameInput.value);
        if (emailInput) localStorage.setItem('portfolio_email', emailInput.value);
        if (apiKeyInput) localStorage.setItem('portfolio_api_key', apiKeyInput.value);
        showToast('💾 Profile configurations saved!');
      });
    });
  }
}

/**
 * Handles theme accordion expanding/collapsing and accent color dot selection
 */
function initThemeAccordion() {
  const dots = document.querySelectorAll('.accent-dot');
  const activeColorPreview = document.getElementById('activeColorPreview');
  const themeNameText = document.getElementById('currentThemeName');

  // Generic Accordion Toggle for all accordion cards
  const accordions = document.querySelectorAll('.accordion-card');
  accordions.forEach(acc => {
    const header = acc.querySelector('.accordion-header');
    if (header) {
      header.addEventListener('click', () => {
        acc.classList.toggle('expanded');
      });
    }
  });

  // Load Initial Dot Active State
  const activeColor = localStorage.getItem('portfolio_accent_color') || '#6366f1';
  updateDotUI(activeColor);

  // Accent Dot Click Event
  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid triggering accordion close
      const color = dot.getAttribute('data-color');
      localStorage.setItem('portfolio_accent_color', color);
      applyAccentColor(color);
      updateDotUI(color);
      showToast('🎨 Accent theme updated!');
    });
  });

  function updateDotUI(color) {
    dots.forEach(d => {
      if (d.getAttribute('data-color') === color) {
        d.classList.add('active');
      } else {
        d.classList.remove('active');
      }
    });

    if (activeColorPreview) {
      activeColorPreview.style.backgroundColor = color;
      activeColorPreview.style.boxShadow = `0 0 6px ${color}`;
    }

    if (themeNameText) {
      const names = {
        '#6366f1': 'Indigo Theme',
        '#10b981': 'Emerald Green Theme',
        '#ef4444': 'Rose Red Theme',
        '#a855f7': 'Purple Theme',
        '#0ea5e9': 'Sky Blue Theme'
      };
      themeNameText.textContent = names[color] || 'Custom Highlight Color';
    }
  }
}

/**
 * Links UI preferences toggles to local storage keys
 */
function initPreferences() {
  const toggleNotifications = document.getElementById('toggleNotifications');
  const toggleEmails = document.getElementById('toggleEmails');
  const toggleBlur = document.getElementById('toggleBlur');
  const resetBtn = document.getElementById('resetLedgerBtn');

  if (toggleNotifications) {
    toggleNotifications.checked = localStorage.getItem('portfolio_notifications_enabled') === 'true';
    toggleNotifications.addEventListener('change', () => {
      if (toggleNotifications.checked) {
        if (typeof Notification !== 'undefined') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              localStorage.setItem('portfolio_notifications_enabled', 'true');
              showToast('🔔 System notifications enabled!');
            } else {
              toggleNotifications.checked = false;
              localStorage.setItem('portfolio_notifications_enabled', 'false');
              showToast('⚠️ Permission denied for notifications.', true);
            }
          });
        } else {
          localStorage.setItem('portfolio_notifications_enabled', 'true');
          showToast('🔔 Notifications enabled (mock mode)!');
        }
      } else {
        localStorage.setItem('portfolio_notifications_enabled', 'false');
        showToast('🔕 System notifications disabled.');
      }
    });
  }

  if (toggleEmails) {
    toggleEmails.checked = localStorage.getItem('portfolio_emails_enabled') !== 'false';
    toggleEmails.addEventListener('change', () => {
      localStorage.setItem('portfolio_emails_enabled', toggleEmails.checked ? 'true' : 'false');
      showToast(toggleEmails.checked ? '📧 Email alerts enabled!' : '🔕 Email alerts disabled.');
    });
  }

  if (toggleBlur) {
    toggleBlur.checked = localStorage.getItem('portfolio_blur_enabled') !== 'false';
    toggleBlur.addEventListener('change', () => {
      localStorage.setItem('portfolio_blur_enabled', toggleBlur.checked ? 'true' : 'false');
      showToast(toggleBlur.checked ? '✨ Layout blur effects active!' : '⏹️ Layout blur effects disabled.');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      showConfirmModal({
        icon: '🗑️',
        title: 'Reset Local Ledger?',
        message: 'Are you sure you want to wipe all local trades, overrides, and cash balances? This action is permanent.'
      }, () => {
        localStorage.removeItem('portfolio_transactions');
        localStorage.removeItem('portfolio_buying_power');
        localStorage.removeItem('portfolio_buying_power_user_set');
        localStorage.removeItem('portfolio_value_override');
        localStorage.removeItem('portfolio_custom_sl');
        showToast('🗑️ Ledger successfully reset!');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      });
    });
  }
}

/**
 * Portfolio Overrides — lets the user manually set Buying Power (cash)
 * and a Total Portfolio Value override from the Settings screen.
 */
function initPortfolioOverrides() {
  const bpInput  = document.getElementById('buyingPowerInput');
  const pvInput  = document.getElementById('portfolioValueInput');
  const bpPreview = document.getElementById('buyingPowerPreview');
  const pvPreview = document.getElementById('portfolioValuePreview');
  const saveBtn  = document.getElementById('saveOverridesBtn');

  const fmt = v => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD'
  }).format(v);

  // ── Load current saved values into inputs ──────────────────────────────────
  const savedBP = localStorage.getItem('portfolio_buying_power');
  if (savedBP !== null && bpInput) {
    bpInput.value = parseFloat(savedBP).toFixed(2);
    if (bpPreview) bpPreview.textContent = 'Current: ' + fmt(parseFloat(savedBP));
  }

  const savedPV = localStorage.getItem('portfolio_value_override');
  if (savedPV !== null && pvInput) {
    pvInput.value = parseFloat(savedPV).toFixed(2);
    if (pvPreview) pvPreview.textContent = 'Override active: ' + fmt(parseFloat(savedPV));
  } else if (pvPreview) {
    pvPreview.textContent = 'Live calculation active';
  }

  // ── Live formatted previews while typing ──────────────────────────────────
  if (bpInput) {
    bpInput.addEventListener('input', () => {
      const val = parseFloat(bpInput.value);
      if (!isNaN(val) && bpPreview) {
        bpPreview.textContent = fmt(val);
        bpPreview.classList.add('active');
      } else if (bpPreview) {
        bpPreview.textContent = '';
        bpPreview.classList.remove('active');
      }
    });
  }

  if (pvInput) {
    pvInput.addEventListener('input', () => {
      const val = parseFloat(pvInput.value);
      if (!isNaN(val) && pvPreview) {
        pvPreview.textContent = 'Override: ' + fmt(val);
        pvPreview.classList.add('active');
      } else if (pvPreview) {
        pvPreview.textContent = 'Will restore live calculation';
        pvPreview.classList.remove('active');
      }
    });
  }

  // ── Save handler ──────────────────────────────────────────────────────────
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      showConfirmModal({
        icon: '💾',
        title: 'Save Overrides?',
        message: 'Are you sure you want to save these custom cash and portfolio overrides?'
      }, () => {
        let saved = false;

        // Buying Power override
        if (bpInput) {
          const bpVal = parseFloat(bpInput.value);
          if (!isNaN(bpVal) && bpVal >= 0) {
            localStorage.setItem('portfolio_buying_power', bpVal.toFixed(2));
            localStorage.setItem('portfolio_buying_power_user_set', 'true');
            if (bpPreview) {
              bpPreview.textContent = 'Saved: ' + fmt(bpVal);
              bpPreview.classList.add('active');
            }
            saved = true;
          } else if (bpInput.value.trim() === '') {
            // Clear — will fall back to default in portfolio.js
            localStorage.removeItem('portfolio_buying_power');
            localStorage.removeItem('portfolio_buying_power_user_set');
            if (bpPreview) bpPreview.textContent = 'Reset to default';
            saved = true;
          }
        }

        // Portfolio Value override
        if (pvInput) {
          const pvVal = parseFloat(pvInput.value);
          if (!isNaN(pvVal) && pvVal >= 0) {
            localStorage.setItem('portfolio_value_override', pvVal.toFixed(2));
            if (pvPreview) {
              pvPreview.textContent = 'Override active: ' + fmt(pvVal);
              pvPreview.classList.add('active');
            }
            saved = true;
          } else if (pvInput.value.trim() === '') {
            // Clear override → restore live calculation
            localStorage.removeItem('portfolio_value_override');
            if (pvPreview) pvPreview.textContent = 'Live calculation restored';
            saved = true;
          }
        }

        if (saved) {
          showToast('✅ Portfolio overrides saved! Refresh the Portfolio tab to see the updated values.');
        } else {
          showToast('⚠️ Please enter valid positive numbers.', true);
        }
      });
    });
  }
}

/**
 * Handles settings tab bar redirects
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
      } else if (target === 'screen-entry') {
        e.preventDefault();
        window.location.href = 'entry.html';
      }
    });
  });
}

/**
 * Renders glassmorphic confirmation alert toast
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
 * Custom Confirmation Modal helper
 */
function showConfirmModal(options, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const iconEl = document.getElementById('confirmModalIcon');
  const titleEl = document.getElementById('confirmModalTitle');
  const msgEl = document.getElementById('confirmModalMessage');
  const cancelBtn = document.getElementById('confirmModalCancel');
  const confirmBtn = document.getElementById('confirmModalConfirm');

  if (!modal || !confirmBtn || !cancelBtn) {
    if (confirm(options.message)) {
      onConfirm();
    }
    return;
  }

  iconEl.textContent = options.icon || '⚠️';
  titleEl.textContent = options.title || 'Are you sure?';
  msgEl.textContent = options.message || 'Please confirm this action.';

  modal.classList.add('active');

  const cleanup = () => {
    modal.classList.remove('active');
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  function handleConfirm() {
    cleanup();
    onConfirm();
  }

  function handleCancel() {
    cleanup();
  }

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
}

