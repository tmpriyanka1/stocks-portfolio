document.addEventListener('DOMContentLoaded', () => {
  // Apply saved color theme
  const savedAccent = localStorage.getItem('portfolio_accent_color');
  if (savedAccent) {
    applyAccentColor(savedAccent);
  }

  // ── Session Awareness ──────────────────────────────────────────────────────
  // auth-guard.js runs first and sets window.__session. Wire up UI accordingly.
  const sessionRole = (typeof window.getSessionRole === 'function')
    ? window.getSessionRole()
    : 'admin'; // Fallback: if guard is bypassed (e.g. tests), default to admin

  const sessionUsername = (typeof window.getSessionUser === 'function')
    ? window.getSessionUser()
    : '';

  // Enforce admin-only visibility on the Administrative Control Zone
  const adminZone = document.querySelector('.admin-control-zone');
  if (adminZone) {
    if (sessionRole !== 'admin') {
      adminZone.style.display = 'none';
    }
  }

  // Populate the "Signed In" card
  const signedInUsername = document.getElementById('signedInUsername');
  if (signedInUsername && sessionUsername) {
    const roleLabel = sessionRole === 'admin' ? '🔑 Admin' : '👤 Member';
    signedInUsername.textContent = `${sessionUsername} · ${roleLabel}`;
  }

  // Wire Sign Out button
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      if (typeof window.logoutSession === 'function') {
        window.logoutSession();
      } else {
        sessionStorage.removeItem('portfolio_session');
        window.location.replace('login.html');
      }
    });
    // Hover effect
    signOutBtn.addEventListener('mouseenter', () => {
      signOutBtn.style.background = 'rgba(239,68,68,0.15)';
      signOutBtn.style.borderColor = 'rgba(239,68,68,0.5)';
    });
    signOutBtn.addEventListener('mouseleave', () => {
      signOutBtn.style.background = 'rgba(239,68,68,0.08)';
      signOutBtn.style.borderColor = 'rgba(239,68,68,0.3)';
    });
  }
  // ── End Session Awareness ──────────────────────────────────────────────────

  initProfileForm();
  initThemeAccordion();
  initPreferences();
  initPortfolioOverrides();
  initUserManagement();
  initTransactionHistory();
  initSecuritySettings();
  initNavigation();
  initPasswordToggles();
  initPnLGraph();
});

function applyAccentColor(hexColor) {
  document.documentElement.style.setProperty('--accent', hexColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
}

/**
 * Loads user profile values from backend/localStorage and handles updates
 */
function initProfileForm() {
  const loginUsername = document.getElementById('loginUsername');
  const displayName = document.getElementById('displayName');
  const emailInput = document.getElementById('emailInput');
  const phoneInput = document.getElementById('phoneInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveBtn = document.getElementById('saveProfileBtn');
  const profileSaveBtn = document.getElementById('profileSaveBtn');

  const activeUser = (typeof window.getSessionUser === 'function')
    ? window.getSessionUser()
    : (localStorage.getItem('portfolio_username') || 'Vanai');

  if (loginUsername) {
    loginUsername.value = activeUser;
  }

  let initialDisplayName = localStorage.getItem('portfolio_displayName') || activeUser;
  let initialEmail = localStorage.getItem('portfolio_email') || 'vanai@portfolio.com';
  let initialPhone = localStorage.getItem('portfolio_phone') || '';

  if (displayName) displayName.value = initialDisplayName;
  if (emailInput) emailInput.value = initialEmail;
  if (phoneInput) phoneInput.value = initialPhone;

  // Retrieve updated details from backend
  fetch(CLOUD_ENDPOINT.endpointUrl + `profile?username=${encodeURIComponent(activeUser)}`)
    .then(res => {
      if (res.ok) return res.json();
      throw new Error('Failed to fetch profile details');
    })
    .then(data => {
      if (data) {
        initialDisplayName = data.displayName || activeUser;
        initialEmail = data.email || '';
        initialPhone = data.phoneNumber || '';

        if (displayName) displayName.value = initialDisplayName;
        if (emailInput) emailInput.value = initialEmail;
        if (phoneInput) phoneInput.value = initialPhone;

        localStorage.setItem('portfolio_displayName', initialDisplayName);
        localStorage.setItem('portfolio_email', initialEmail);
        localStorage.setItem('portfolio_phone', initialPhone);
      }
    })
    .catch(err => {
      console.warn('Could not retrieve profile from backend, using local/defaults:', err);
    });

  if (apiKeyInput) {
    apiKeyInput.value = localStorage.getItem('portfolio_api_key') || '••••••••••••••••••••••••';
    apiKeyInput.addEventListener('blur', () => {
      localStorage.setItem('portfolio_api_key', apiKeyInput.value);
    });
  }

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener('click', () => {
      const currentPasswordInput = document.getElementById('currentPasswordInput');
      const changePasswordInput = document.getElementById('changePasswordInput');
      const confirmPasswordInput = document.getElementById('confirmPasswordInput');

      const dispName = displayName ? displayName.value.trim() : '';
      const newEmail = emailInput ? emailInput.value.trim() : '';
      const newPhone = phoneInput ? phoneInput.value.trim() : '';

      if (!dispName || !newEmail || !newPhone) {
        showToast('⚠️ All fields are mandatory.', true);
        return;
      }

      let passwordToUpdate = null;
      let currentPwVal = '';
      if (currentPasswordInput && changePasswordInput && confirmPasswordInput) {
        const currentVal = currentPasswordInput.value;
        const changeVal = changePasswordInput.value;
        const confirmVal = confirmPasswordInput.value;

        if (currentVal || changeVal || confirmVal) {
          if (!currentVal) {
            showToast('⚠️ Current password is required to change password.', true);
            return;
          }
          if (!changeVal || !confirmVal) {
            showToast('⚠️ New password and confirm password are required.', true);
            return;
          }
          if (changeVal !== confirmVal) {
            showToast('⚠️ Passwords do not match.', true);
            return;
          }
          if (!validatePasswordStrength(changeVal)) {
            showToast('⚠️ Password must contain more than 8 characters, including alphabets, numbers, and special characters.', true);
            return;
          }
          passwordToUpdate = changeVal;
          currentPwVal = currentVal;
        }
      }

      showConfirmModal({
        icon: '👤',
        title: 'Update Profile details?',
        message: 'Are you sure you want to update your profile details?'
      }, async () => {
        try {
          const response = await fetch(CLOUD_ENDPOINT.endpointUrl + 'profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: activeUser,
              displayName: dispName,
              email: newEmail,
              phoneNumber: newPhone,
              currentPassword: currentPwVal,
              newPassword: passwordToUpdate || ''
            })
          });

          if (response.ok) {
            localStorage.setItem('portfolio_displayName', dispName);
            localStorage.setItem('portfolio_email', newEmail);
            localStorage.setItem('portfolio_phone', newPhone);
            if (passwordToUpdate) {
              localStorage.setItem('portfolio_password', passwordToUpdate);
            }

            // Sync to localUsers list
            let localUsers = [];
            try { localUsers = JSON.parse(localStorage.getItem('portfolio_users') || '[]'); } catch (e) { }
            let found = false;
            localUsers = localUsers.map(u => {
              if (u.username.toLowerCase() === activeUser.toLowerCase()) {
                u.displayName = dispName;
                u.email = newEmail;
                u.phoneNumber = newPhone;
                if (passwordToUpdate) u.password = passwordToUpdate;
                found = true;
              }
              return u;
            });
            if (!found) {
              localUsers.push({
                username: activeUser,
                displayName: dispName,
                role: window.getSessionRole() || 'member',
                email: newEmail,
                phoneNumber: newPhone,
                password: passwordToUpdate || localStorage.getItem('portfolio_password') || 'Admin@123!'
              });
            }
            localStorage.setItem('portfolio_users', JSON.stringify(localUsers));

            if (currentPasswordInput) currentPasswordInput.value = '';
            if (changePasswordInput) changePasswordInput.value = '';
            if (confirmPasswordInput) confirmPasswordInput.value = '';
            initialDisplayName = dispName;
            initialEmail = newEmail;
            initialPhone = newPhone;

            showToast('💾 Profile configurations and password saved!');
          } else {
            const errData = await response.json().catch(() => ({}));
            showToast(`⚠️ Error: ${errData.error || 'Failed to update profile.'}`, true);
          }
        } catch (err) {
          console.error('Offline profile update fallback:', err);
          localStorage.setItem('portfolio_displayName', dispName);
          localStorage.setItem('portfolio_email', newEmail);
          localStorage.setItem('portfolio_phone', newPhone);
          if (passwordToUpdate) {
            localStorage.setItem('portfolio_password', passwordToUpdate);
          }

          let localUsers = [];
          try { localUsers = JSON.parse(localStorage.getItem('portfolio_users') || '[]'); } catch (e) { }
          let found = false;
          localUsers = localUsers.map(u => {
            if (u.username.toLowerCase() === activeUser.toLowerCase()) {
              u.displayName = dispName;
              u.email = newEmail;
              u.phoneNumber = newPhone;
              if (passwordToUpdate) u.password = passwordToUpdate;
              found = true;
            }
            return u;
          });
          if (!found) {
            localUsers.push({
              username: activeUser,
              displayName: dispName,
              role: window.getSessionRole() || 'member',
              email: newEmail,
              phoneNumber: newPhone,
              password: passwordToUpdate || localStorage.getItem('portfolio_password') || 'Admin@123!'
            });
          }
          localStorage.setItem('portfolio_users', JSON.stringify(localUsers));

          if (currentPasswordInput) currentPasswordInput.value = '';
          if (changePasswordInput) changePasswordInput.value = '';
          if (confirmPasswordInput) confirmPasswordInput.value = '';
          initialDisplayName = dispName;
          initialEmail = newEmail;
          initialPhone = newPhone;

          showToast('💾 Profile configurations saved locally (Offline Mode)!');
        }
      });
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (apiKeyInput) localStorage.setItem('portfolio_api_key', apiKeyInput.value);
      showToast('💾 Profile configurations saved!');
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
      const isEnabled = toggleBlur.checked;
      localStorage.setItem('portfolio_blur_enabled', isEnabled ? 'true' : 'false');
      if (isEnabled) {
        document.body.classList.remove('disable-glass-blur');
      } else {
        document.body.classList.add('disable-glass-blur');
      }
      showToast(isEnabled ? '✨ Layout blur effects active!' : '⏹️ Layout blur effects disabled.');
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
  const bpInput = document.getElementById('buyingPowerInput');
  const pvInput = document.getElementById('portfolioValueInput');
  const bpPreview = document.getElementById('buyingPowerPreview');
  const pvPreview = document.getElementById('portfolioValuePreview');
  const saveBtn = document.getElementById('saveOverridesBtn');

  const fmt = v => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD'
  }).format(v);

  // ── Load current saved values into inputs ──────────────────────────────────
  const savedBP = localStorage.getItem('portfolio_buying_power');
  if (savedBP !== null && bpInput) {
    bpInput.value = parseFloat(savedBP).toFixed(2);
    if (bpPreview) bpPreview.textContent = 'Current Override: ' + fmt(parseFloat(savedBP));
  }

  const savedPV = localStorage.getItem('portfolio_value_override');
  if (savedPV !== null && pvInput) {
    pvInput.value = savedPV;
    if (pvPreview) pvPreview.textContent = 'Master Override verbatim active: ' + savedPV;
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
      const val = pvInput.value.trim();
      if (val !== '' && pvPreview) {
        pvPreview.textContent = 'Verbatim preview: ' + val;
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
      const bpVal = bpInput ? parseFloat(bpInput.value) : NaN;
      const pvVal = pvInput ? pvInput.value.trim() : '';

      const bpValid = !isNaN(bpVal) && bpVal >= 0;

      if (!bpValid) {
        showToast('⚠️ Please enter a valid buying power value.', true);
        return;
      }

      showConfirmModal({
        icon: '💾',
        title: 'Save Overrides?',
        message: 'Are you sure you want to save these custom cash and portfolio overrides?'
      }, () => {
        // Save buying power override
        localStorage.setItem('portfolio_buying_power', bpVal.toFixed(2));
        localStorage.setItem('portfolio_buying_power_user_set', 'true');

        // Save portfolio value override (empty string clears it)
        if (pvVal !== '') {
          localStorage.setItem('portfolio_value_override', pvVal);
        } else {
          localStorage.removeItem('portfolio_value_override');
        }

        // Sync to server
        fetch(CLOUD_ENDPOINT.endpointUrl + 'overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyingPowerOverride: bpVal,
            portfolioValueOverride: pvVal
          })
        })
          .then(() => showToast('✅ Portfolio overrides saved!'))
          .catch(err => {
            console.error('Failed to sync overrides to server:', err);
            showToast('✅ Portfolio overrides saved locally!');
          });

        // Update previews
        if (bpPreview) bpPreview.textContent = 'Current Override: ' + fmt(bpVal);
        if (pvPreview) pvPreview.textContent = pvVal !== '' ? 'Master Override verbatim active: ' + pvVal : 'Live calculation active';

        recalculateBuyingPower();
      });
    });
  }

  // ── Wallet & Capital Funds click handlers ───────────────────────────────
  const depositBtn = document.getElementById('depositFundsBtn');
  const withdrawBtn = document.getElementById('withdrawFundsBtn');

  if (depositBtn) {
    depositBtn.addEventListener('click', () => {
      showConfirmModal({
        icon: '💵',
        title: 'Deposit Funds',
        message: 'Enter the amount and reason for this deposit:',
        hasInput: true
      }, (amount, reason) => {
        if (isNaN(amount) || amount <= 0) {
          showToast('⚠️ Please enter a valid positive amount.', true);
          return;
        }
        executeCashAdjustment('DEPOSIT', amount, reason || '');
      });
    });
  }

  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', () => {
      showConfirmModal({
        icon: '💸',
        title: 'Withdraw Funds',
        message: 'Enter the amount and reason for this withdrawal:',
        hasInput: true
      }, (amount, reason) => {
        if (isNaN(amount) || amount <= 0) {
          showToast('⚠️ Please enter a valid positive amount.', true);
          return;
        }
        executeCashAdjustment('WITHDRAWAL', amount, reason || '');
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
  const inputContainer = document.getElementById('confirmModalInputContainer');
  const inputEl = document.getElementById('confirmModalInput');

  if (!modal || !confirmBtn || !cancelBtn) {
    if (confirm(options.message)) {
      onConfirm();
    }
    return;
  }

  iconEl.textContent = options.icon || '⚠️';
  titleEl.textContent = options.title || 'Are you sure?';
  msgEl.textContent = options.message || 'Please confirm this action.';

  const reasonEl = document.getElementById('confirmModalReason');

  if (options.hasInput) {
    if (inputContainer) inputContainer.style.display = 'block';
    if (inputEl) {
      inputEl.value = '';
      setTimeout(() => inputEl.focus(), 50);
    }
    if (reasonEl) reasonEl.value = '';
  } else {
    if (inputContainer) inputContainer.style.display = 'none';
  }

  modal.classList.add('active');

  const cleanup = () => {
    modal.classList.remove('active');
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    if (inputContainer) inputContainer.style.display = 'none';
  };

  function handleConfirm() {
    let result = undefined;
    if (options.hasInput && inputEl) {
      result = parseFloat(inputEl.value);
    }
    const reason = (options.hasInput && reasonEl) ? reasonEl.value.trim() : '';
    cleanup();
    onConfirm(result, reason);
  }

  function handleCancel() {
    cleanup();
  }

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
}

const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname;
const BASE_BACKEND_URL = isLocalHost ? 'http://localhost:5001/api/' : 'https://vanai-portfolio-backend.onrender.com/api/';

const CLOUD_SPREADSHEET_CONFIG = {
  endpointUrl: BASE_BACKEND_URL + "trades"
};

const CLOUD_ENDPOINT = {
  endpointUrl: BASE_BACKEND_URL
};

function saveTransactionLocally(tx) {
  let txs = [];
  const stored = localStorage.getItem('portfolio_transactions');
  if (stored) {
    try {
      txs = JSON.parse(stored);
    } catch (e) {
      txs = [];
    }
  }
  txs.push(tx);
  localStorage.setItem('portfolio_transactions', JSON.stringify(txs));
}

async function pushCashTransactionToCloud(tx, name) {
  try {
    const response = await fetch(CLOUD_ENDPOINT.endpointUrl + 'cash', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: tx.action,
        amount: Number(tx.price),
        date: tx.date.split('T')[0],
        time: tx.date.split('T')[1] || '12:00:00',
        author: tx.author || 'Admin',
        reason: tx.comment || tx.reason || ''
      })
    });
    if (!response.ok) throw new Error('Network response not ok');
    showToast("🟢 Cash Transaction Synced to Local Server!");
    // Return the saved record from server so caller can update local cache
    return await response.json().catch(() => null);
  } catch (err) {
    console.error('Local server cash post failed:', err);
    showToast("Transaction saved locally (Offline Mode)", true);
    return null;
  }
}

function saveCashLocally(tx) {
  let cashTxs = [];
  const stored = localStorage.getItem('portfolio_cash_ledger');
  if (stored) {
    try {
      cashTxs = JSON.parse(stored);
    } catch (e) {
      cashTxs = [];
    }
  }
  cashTxs.push(tx);
  localStorage.setItem('portfolio_cash_ledger', JSON.stringify(cashTxs));
}

async function executeCashAdjustment(actionType, amount, reason) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const txDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

  const activeUser = typeof window.getSessionUser === 'function' ? window.getSessionUser() : 'Admin';

  const tx = {
    ticker: "CASH",
    assetType: "CASH",
    action: actionType,
    shares: 0,
    price: amount,
    date: txDate,
    comment: reason || "",
    stopLoss: 0,
    author: activeUser || 'Admin'
  };

  // 1. Save locally in cash ledger immediately
  saveCashLocally(tx);

  // 2. Always update buying power directly — deposits add, withdrawals subtract.
  //    If no override is set, activate it now so user can see the running balance.
  const currentBP = parseFloat(localStorage.getItem('portfolio_buying_power') || '0');
  const adjustedBP = Math.max(0, currentBP + (actionType === 'DEPOSIT' ? amount : -amount));
  localStorage.setItem('portfolio_buying_power', adjustedBP.toFixed(2));
  localStorage.setItem('portfolio_buying_power_user_set', 'true');

  // Persist to server so portfolio tab loads the correct value on next visit
  fetch(CLOUD_ENDPOINT.endpointUrl + 'overrides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      buyingPowerOverride: adjustedBP,
      portfolioValueOverride: localStorage.getItem('portfolio_value_override') || ''
    })
  }).catch(err => console.error('Failed to sync overrides:', err));

  // 3. Update the override input preview on settings page
  const bpInputEl = document.getElementById('buyingPowerInput');
  const bpPreviewEl = document.getElementById('buyingPowerPreview');
  if (bpInputEl) bpInputEl.value = adjustedBP.toFixed(2);
  if (bpPreviewEl) {
    const fmt = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
    bpPreviewEl.textContent = 'Current Override: ' + fmt(adjustedBP);
  }

  // 4. Stream to cloud — AWAIT so the server has persisted the record (with reason)
  //    before initTransactionHistory re-fetches the server list.
  const name = actionType === 'DEPOSIT' ? "Capital Bank Deposit" : "Capital Bank Withdrawal";
  const savedRecord = await pushCashTransactionToCloud(tx, name);

  // If the server returned the canonical record, sync it into local cash ledger
  // so the reason field reflects exactly what the server stored.
  if (savedRecord) {
    let cashTxs = [];
    try { cashTxs = JSON.parse(localStorage.getItem('portfolio_cash_ledger') || '[]'); } catch (e) { }
    // Replace the last entry (the one we just pushed) with the server-confirmed version
    if (cashTxs.length > 0) {
      cashTxs[cashTxs.length - 1] = savedRecord;
      localStorage.setItem('portfolio_cash_ledger', JSON.stringify(cashTxs));
    }
  }

  // 5. Re-render transaction history — server now has the record saved
  initTransactionHistory();
}

/**
 * Password strength checker:
 * Password should contain more than 8 characters which includes alphabets, numbers, and special characters.
 */
function validatePasswordStrength(password) {
  if (password.length <= 8) {
    return false;
  }
  const hasAlphabet = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  return hasAlphabet && hasNumber && hasSpecial;
}

/**
 * User Ingestion Form Panel logic
 */
function initUserManagement() {
  const form = document.getElementById('addUserForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const addUsernameEl = document.getElementById('addUsername');
    const addRoleEl = document.getElementById('addRole');
    const addUserEmailEl = document.getElementById('addUserEmail');
    const addUserPhoneEl = document.getElementById('addUserPhone');
    const addUserPasswordEl = document.getElementById('addUserPassword');
    const addUserConfirmPasswordEl = document.getElementById('addUserConfirmPassword');

    if (!addUsernameEl || !addRoleEl || !addUserEmailEl || !addUserPhoneEl || !addUserPasswordEl || !addUserConfirmPasswordEl) return;

    const username = addUsernameEl.value.trim();
    const role = addRoleEl.value;
    const email = addUserEmailEl.value.trim();
    const phoneNumber = addUserPhoneEl.value.trim();
    const password = addUserPasswordEl.value;
    const confirmPassword = addUserConfirmPasswordEl.value;

    if (!username || !role || !email || !phoneNumber || !password || !confirmPassword) {
      showToast('⚠️ All fields are mandatory.', true);
      return;
    }

    // Local duplicate username check
    let localUsers = [];
    try {
      localUsers = JSON.parse(localStorage.getItem('portfolio_users') || '[]');
    } catch (e) {
      localUsers = [];
    }
    const usernameExists = localUsers.some(u => u.username.toLowerCase() === username.toLowerCase()) || username.toLowerCase() === 'admin';
    if (usernameExists) {
      showToast('⚠️ User name already exist.', true);
      return;
    }

    if (password !== confirmPassword) {
      showToast('⚠️ Passwords do not match.', true);
      return;
    }

    if (!validatePasswordStrength(password)) {
      showToast('⚠️ Password must contain more than 8 characters, including alphabets, numbers, and special characters.', true);
      return;
    }

    try {
      const response = await fetch(CLOUD_ENDPOINT.endpointUrl + 'users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, role, email, phoneNumber, password })
      });

      if (response.ok) {
        localUsers = localUsers.filter(u => u.username.toLowerCase() !== username.toLowerCase());
        localUsers.push({ username, role, email, phoneNumber, password });
        localStorage.setItem('portfolio_users', JSON.stringify(localUsers));

        showToast('✅ New user registered successfully!');
        form.reset();
      } else {
        const errData = await response.json().catch(() => ({}));
        showToast(`⚠️ Error: ${errData.error || 'Failed to register user.'}`, true);
      }
    } catch (err) {
      console.error('Failed to register user:', err);

      // Fallback: save to localStorage (Offline Mode)
      localUsers = localUsers.filter(u => u.username.toLowerCase() !== username.toLowerCase());
      localUsers.push({ username, role, email, phoneNumber, password });
      localStorage.setItem('portfolio_users', JSON.stringify(localUsers));

      showToast('✅ New user registered locally (Offline Mode)!');
      form.reset();
    }
  });
}

/**
 * Security Settings Password Update logic
 */
function initSecuritySettings() {
  const form = document.getElementById('securityForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPasswordEl = document.getElementById('currentPassword');
    const newPasswordEl = document.getElementById('newPassword');
    const confirmPasswordEl = document.getElementById('confirmPassword');

    if (!currentPasswordEl || !newPasswordEl || !confirmPasswordEl) return;

    const currentPassword = currentPasswordEl.value;
    const newPassword = newPasswordEl.value;
    const confirmPassword = confirmPasswordEl.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('⚠️ All fields are mandatory.', true);
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('⚠️ New passwords do not match.', true);
      return;
    }

    if (!validatePasswordStrength(newPassword)) {
      showToast('⚠️ Password must contain more than 8 characters, including alphabets, numbers, and special characters.', true);
      return;
    }

    try {
      const response = await fetch(CLOUD_ENDPOINT.endpointUrl + 'password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (response.ok) {
        // Sync new password locally
        const activeUser = localStorage.getItem('portfolio_username') || 'Vanai';
        let localUsers = [];
        try {
          localUsers = JSON.parse(localStorage.getItem('portfolio_users') || '[]');
        } catch (e) {
          localUsers = [];
        }
        let found = false;
        localUsers = localUsers.map(u => {
          if (u.username === activeUser) {
            u.password = newPassword;
            found = true;
          }
          return u;
        });
        if (!found) {
          localUsers.push({ username: activeUser, role: 'member', password: newPassword });
        }
        localStorage.setItem('portfolio_users', JSON.stringify(localUsers));
        localStorage.setItem('portfolio_password', newPassword);

        showToast('✅ Password updated successfully!');
        form.reset();
      } else {
        const errData = await response.json().catch(() => ({}));
        showToast(`⚠️ Error: ${errData.error || 'Failed to update password.'}`, true);
      }
    } catch (err) {
      console.error('Failed to update password:', err);

      // Fallback: update password locally (Offline Mode)
      const activeUser = localStorage.getItem('portfolio_username') || 'Vanai';
      let localUsers = [];
      try {
        localUsers = JSON.parse(localStorage.getItem('portfolio_users') || '[]');
      } catch (e) {
        localUsers = [];
      }
      let found = false;
      localUsers = localUsers.map(u => {
        if (u.username === activeUser) {
          u.password = newPassword;
          found = true;
        }
        return u;
      });
      if (!found) {
        localUsers.push({ username: activeUser, role: 'member', password: newPassword });
      }
      localStorage.setItem('portfolio_users', JSON.stringify(localUsers));
      localStorage.setItem('portfolio_password', newPassword);

      showToast('✅ Password updated locally (Offline Mode)!');
      form.reset();
    }
  });
}

function calculateNetCash(txs, cashTxs) {
  let cash = 0;

  // 1. Process cash ledger
  cashTxs.forEach(t => {
    if (!t) return;
    const action = String(t.action || '').toUpperCase();
    const amount = parseFloat(t.price) || 0;
    if (action === 'DEPOSIT') {
      cash += amount;
    } else if (action === 'WITHDRAWAL') {
      cash -= amount;
    }
  });

  // 2. Process trades
  txs.forEach(t => {
    if (!t || !t.ticker) return;
    const ticker = t.ticker.toUpperCase();
    const action = String(t.action || '').toUpperCase();
    if (ticker === 'CASH' || t.assetType === 'CASH') {
      const amount = parseFloat(t.price) || 0;
      if (action === 'DEPOSIT') {
        cash += amount;
      } else if (action === 'WITHDRAWAL') {
        cash -= amount;
      }
      return;
    }
    const sharesNum = parseFloat(t.shares) || 0;
    const priceNum = parseFloat(t.price) || 0;
    const isOpt = t.assetType === 'options' || (/\$\d/.test(t.ticker) && /\b(call|put)\b/i.test(t.ticker));
    const multiplier = isOpt ? 100 : 1;
    const cost = sharesNum * priceNum * multiplier;

    if (action === 'BUY') {
      cash -= cost;
    } else if (action === 'SELL') {
      cash += cost;
    }
  });

  return cash;
}

function recalculateBuyingPower() {
  // ── Clean model ──────────────────────────────────────────────────────────
  // When an override is set, portfolio_buying_power IS the canonical balance.
  // Deposits/withdrawals have already adjusted it directly in executeCashAdjustment.
  // When no override is set, fall back to pure netCash from all transactions.
  const isUserSet = localStorage.getItem('portfolio_buying_power_user_set') === 'true';

  let buyingPower = 0;
  if (isUserSet) {
    // Already maintained directly — just read it
    buyingPower = parseFloat(localStorage.getItem('portfolio_buying_power') || '0');
  } else {
    // No override: derive from trade + cash ledger history
    let txs = [];
    try { txs = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]'); } catch (e) { }
    let cashTxs = [];
    try { cashTxs = JSON.parse(localStorage.getItem('portfolio_cash_ledger') || '[]'); } catch (e) { }
    buyingPower = Math.max(0, calculateNetCash(txs, cashTxs));
    localStorage.setItem('portfolio_buying_power', buyingPower.toFixed(2));
  }

  // Update inputs on Settings page if present
  const bpInput = document.getElementById('buyingPowerInput');
  const bpPreview = document.getElementById('buyingPowerPreview');
  if (bpInput) bpInput.value = buyingPower.toFixed(2);
  if (bpPreview) {
    const fmt = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
    bpPreview.textContent = (isUserSet ? 'Current Override: ' : 'Current: ') + fmt(buyingPower);
  }
}

async function initTransactionHistory() {
  const tableBody = document.getElementById('history-table-body');
  if (!tableBody) return;

  let cashTxs = [];
  try {
    const res = await fetch(CLOUD_ENDPOINT.endpointUrl + 'cash');
    if (res.ok) {
      cashTxs = await res.json();
      localStorage.setItem('portfolio_cash_ledger', JSON.stringify(cashTxs));
    } else {
      cashTxs = JSON.parse(localStorage.getItem('portfolio_cash_ledger') || '[]');
    }
  } catch (err) {
    console.warn('Failed to fetch cash ledger from server:', err);
    cashTxs = JSON.parse(localStorage.getItem('portfolio_cash_ledger') || '[]');
  }

  // Sort cash transactions chronologically descending (newest first)
  cashTxs.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (cashTxs.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px 0;">
          No cash transactions found.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = cashTxs.map(tx => {
    const action = String(tx.action || '').toUpperCase();
    const amount = parseFloat(tx.price) || 0;
    const author = tx.author || 'Admin';
    const reason = (tx.comment && tx.comment.trim()) || (tx.reason && tx.reason.trim()) || (tx.note && tx.note.trim()) || '—';

    // Format date and time
    let formattedDate = '';
    if (tx.date) {
      try {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else {
          formattedDate = tx.date.replace('T', ' ');
        }
      } catch (e) {
        formattedDate = tx.date;
      }
    }

    const badgeClass = action === 'DEPOSIT' ? 'deposit' : 'withdrawal';
    const amountClass = action === 'DEPOSIT' ? 'deposit' : 'withdrawal';
    const amountSign = action === 'DEPOSIT' ? '+' : '-';

    return `
      <tr>
        <td>
          <span class="history-badge ${badgeClass}">${action}</span>
        </td>
        <td class="history-date">${formattedDate}</td>
        <td class="history-amount ${amountClass}">${amountSign}$${amount.toFixed(2)}</td>
        <td class="history-author" style="max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${reason}">${reason}</td>
        <td class="history-author">${author}</td>
      </tr>
    `;
  }).join('');
}

function initPasswordToggles() {
  const containers = document.querySelectorAll('.password-input-container');
  containers.forEach(container => {
    const input = container.querySelector('input');
    const toggleBtn = container.querySelector('.password-toggle-btn');
    if (!input || !toggleBtn) return;

    toggleBtn.textContent = input.type === 'password' ? 'Show' : 'Hide';

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.textContent = 'Hide';
      } else {
        input.type = 'password';
        toggleBtn.textContent = 'Show';
      }
    });
  });
}

/**
 * Profit & Loss graph section initialization and rendering
 */
async function initPnLGraph() {
  const accordion = document.getElementById('pnlGraphAccordion');
  if (!accordion) return;

  const filterBtns = document.querySelectorAll('.pnl-filter-btn');
  let activeTimeframe = 'weekly';

  // Load all transactions
  let allTxs = [];
  try {
    const res = await fetch(CLOUD_ENDPOINT.endpointUrl + 'trades');
    if (res.ok) {
      allTxs = await res.json();
    } else {
      throw new Error('Not OK');
    }
  } catch (e) {
    console.warn('Offline: fallback to local portfolio_transactions', e);
    try {
      allTxs = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]');
    } catch (err) {
      allTxs = [];
    }
  }

  // Pre-calculate P&L events
  const pnlEvents = getClosedPositionsPnLEvents(allTxs);

  // Initial render
  renderPnLChart(pnlEvents, activeTimeframe, allTxs);

  // Setup click listeners for timeframe filters
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid triggering accordion close/expand
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTimeframe = btn.getAttribute('data-timeframe');
      renderPnLChart(pnlEvents, activeTimeframe, allTxs);
    });
  });
}

function getClosedPositionsPnLEvents(allTxs) {
  // Sort all transactions chronologically (ascending)
  const txs = allTxs
    .filter(tx => tx && tx.ticker && tx.ticker !== 'CASH' && tx.assetType !== 'CASH')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Group transactions by ticker
  const groups = {};
  txs.forEach(tx => {
    if (!groups[tx.ticker]) {
      groups[tx.ticker] = [];
    }
    groups[tx.ticker].push(tx);
  });

  const pnlEvents = [];

  for (const ticker in groups) {
    const tickerTxs = groups[ticker];
    const buyQueue = [];

    tickerTxs.forEach(tx => {
      const sharesNum = parseFloat(tx.shares) || 0;
      const priceNum = parseFloat(tx.price) || 0;
      const action = tx.action || 'BUY';
      const isOption = tx.assetType === 'options' || (/\$\d/.test(tx.ticker) && /\b(call|put)\b/i.test(tx.ticker));
      const multiplier = isOption ? 100 : 1;

      if (action === 'BUY') {
        buyQueue.push({ shares: sharesNum, price: priceNum });
      } else if (action === 'SELL') {
        let remainingToSell = sharesNum;
        let sellPnL = 0;

        while (remainingToSell > 0 && buyQueue.length > 0) {
          const oldestLayer = buyQueue[0];
          if (oldestLayer.shares <= remainingToSell) {
            sellPnL += oldestLayer.shares * (priceNum - oldestLayer.price) * multiplier;
            remainingToSell -= oldestLayer.shares;
            buyQueue.shift();
          } else {
            sellPnL += remainingToSell * (priceNum - oldestLayer.price) * multiplier;
            oldestLayer.shares -= remainingToSell;
            remainingToSell = 0;
          }
        }

        pnlEvents.push({
          date: new Date(tx.date),
          pnl: sellPnL,
          ticker: tx.ticker
        });
      }
    });
  }

  return pnlEvents;
}

function renderPnLChart(pnlEvents, timeframe, allTxs) {
  const pnlBarChart = document.getElementById('pnlBarChart');
  const pnlChartLabels = document.getElementById('pnlChartLabels');
  const pnlEmptyState = document.getElementById('pnlEmptyState');

  if (!pnlBarChart || !pnlChartLabels || !pnlEmptyState) return;

  pnlBarChart.innerHTML = '';
  pnlChartLabels.innerHTML = '';

  // Get dynamic refDate aligned with transaction history or today
  let refDate = new Date();
  if (allTxs && allTxs.length > 0) {
    const dates = allTxs.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
    if (dates.length > 0) {
      const maxDate = new Date(Math.max(...dates));
      if (Math.abs(Date.now() - maxDate.getTime()) > 30 * 24 * 60 * 60 * 1000) {
        refDate = maxDate;
      }
    }
  }

  // Create segments
  const segments = [];

  if (timeframe === 'weekly') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - i);
      segments.push({
        start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0),
        end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999),
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        pnl: 0
      });
    }
  } else if (timeframe === 'monthly') {
    for (let i = 3; i >= 0; i--) {
      const startD = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - (i * 7 + 6));
      const endD = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - (i * 7));
      segments.push({
        start: new Date(startD.getFullYear(), startD.getMonth(), startD.getDate(), 0, 0, 0),
        end: new Date(endD.getFullYear(), endD.getMonth(), endD.getDate(), 23, 59, 59, 999),
        label: `Wk ${4 - i}`,
        pnl: 0
      });
    }
  } else if (timeframe === 'yearly') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
      const startD = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
      const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      segments.push({
        start: startD,
        end: endD,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        pnl: 0
      });
    }
  } else if (timeframe === 'all') {
    let minYear = refDate.getFullYear() - 1;
    if (pnlEvents && pnlEvents.length > 0) {
      const years = pnlEvents.map(e => e.date.getFullYear());
      minYear = Math.min(...years);
    }
    const maxYear = refDate.getFullYear();
    for (let yr = minYear; yr <= maxYear; yr++) {
      segments.push({
        start: new Date(yr, 0, 1, 0, 0, 0),
        end: new Date(yr, 11, 31, 23, 59, 59, 999),
        label: `${yr}`,
        pnl: 0
      });
    }
  }

  // Populate segments
  pnlEvents.forEach(e => {
    const t = e.date.getTime();
    segments.forEach(seg => {
      if (t >= seg.start.getTime() && t <= seg.end.getTime()) {
        seg.pnl += e.pnl;
      }
    });
  });

  const maxAbs = Math.max(...segments.map(s => Math.abs(s.pnl)), 0);

  if (maxAbs === 0) {
    pnlEmptyState.style.display = 'block';
    pnlBarChart.style.opacity = '0';
    // Still render blank labels
    segments.forEach(seg => {
      const labelEl = document.createElement('span');
      labelEl.style.cssText = 'flex: 1; text-align: center;';
      labelEl.textContent = seg.label;
      pnlChartLabels.appendChild(labelEl);
    });
  } else {
    pnlEmptyState.style.display = 'none';
    pnlBarChart.style.opacity = '1';

    segments.forEach(seg => {
      const col = document.createElement('div');
      col.className = 'chart-col';
      col.style.cssText = 'flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; position: relative;';

      // Baseline dot
      const baselineDot = document.createElement('div');
      baselineDot.style.cssText = 'position: absolute; bottom: 50%; transform: translateY(50%); width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.25);';
      col.appendChild(baselineDot);

      if (seg.pnl > 0) {
        const upperHalf = document.createElement('div');
        upperHalf.style.cssText = 'position: absolute; bottom: 50%; width: 18px; height: 50%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;';

        const bar = document.createElement('div');
        bar.className = 'pnl-bar-positive';
        const pct = (seg.pnl / maxAbs) * 100;
        bar.style.cssText = `height: ${pct}%; width: 100%; position: relative;`;

        const tooltip = document.createElement('div');
        tooltip.className = 'bar-tooltip bar-tooltip-up';
        tooltip.textContent = `+$${seg.pnl.toFixed(2)}`;
        bar.appendChild(tooltip);

        upperHalf.appendChild(bar);
        col.appendChild(upperHalf);
      } else if (seg.pnl < 0) {
        const lowerHalf = document.createElement('div');
        lowerHalf.style.cssText = 'position: absolute; top: 50%; width: 18px; height: 50%; display: flex; flex-direction: column; justify-content: flex-start; align-items: center;';

        const bar = document.createElement('div');
        bar.className = 'pnl-bar-negative';
        const pct = (Math.abs(seg.pnl) / maxAbs) * 100;
        bar.style.cssText = `height: ${pct}%; width: 100%; position: relative;`;

        const tooltip = document.createElement('div');
        tooltip.className = 'bar-tooltip bar-tooltip-down';
        tooltip.textContent = `-$${Math.abs(seg.pnl).toFixed(2)}`;
        bar.appendChild(tooltip);

        lowerHalf.appendChild(bar);
        col.appendChild(lowerHalf);
      }

      pnlBarChart.appendChild(col);

      // Add Label
      const labelEl = document.createElement('span');
      labelEl.style.cssText = 'flex: 1; text-align: center;';
      labelEl.textContent = seg.label;
      pnlChartLabels.appendChild(labelEl);
    });
  }
}




