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

  // ── Wallet & Capital Funds click handlers ───────────────────────────────
  const depositBtn = document.getElementById('depositFundsBtn');
  const withdrawBtn = document.getElementById('withdrawFundsBtn');

  if (depositBtn) {
    depositBtn.addEventListener('click', () => {
      showConfirmModal({
        icon: '💵',
        title: 'Deposit Funds',
        message: 'Enter the amount you would like to deposit to your wallet:',
        hasInput: true
      }, (amount) => {
        if (isNaN(amount) || amount <= 0) {
          showToast('⚠️ Please enter a valid positive amount.', true);
          return;
        }
        executeCashAdjustment('DEPOSIT', amount);
      });
    });
  }

  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', () => {
      showConfirmModal({
        icon: '💸',
        title: 'Withdraw Funds',
        message: 'Enter the amount you would like to withdraw from your wallet:',
        hasInput: true
      }, (amount) => {
        if (isNaN(amount) || amount <= 0) {
          showToast('⚠️ Please enter a valid positive amount.', true);
          return;
        }
        executeCashAdjustment('WITHDRAWAL', amount);
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

  if (options.hasInput) {
    if (inputContainer) inputContainer.style.display = 'block';
    if (inputEl) {
      inputEl.value = '';
      setTimeout(() => inputEl.focus(), 50);
    }
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
    cleanup();
    onConfirm(result);
  }

  function handleCancel() {
    cleanup();
  }

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
}

const CLOUD_SPREADSHEET_CONFIG = {
  endpointUrl: "https://script.google.com/macros/s/AKfycbyq1B_7D2saPLfHISuwJrJI8PkUiQrgK3sDetSQE0rbcnTjSvXqKE0Dzl5gw4rB_xw7/exec"
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
  const url = CLOUD_SPREADSHEET_CONFIG.endpointUrl;
  if (!url || url.includes("YOUR_API_URL")) {
    showToast("Transaction saved locally (Offline Mode)", true);
    return;
  }

  try {
    await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({
        data: [
          {
            Symbol: tx.ticker,
            Name: name,
            Date: tx.date,
            "Asset Type": tx.assetType,
            Action: tx.action,
            Shares: Number(tx.shares),
            CostBasis: Number(tx.price),
            "Avg Price": Number(tx.price),
            CurrentPrice: Number(tx.price),
            SL: 0,
            Icon: "",
            "Trade Journal Note": ""
          }
        ]
      })
    });
    showToast("🟢 Cash Transaction Synced to Cloud Sheet!");
  } catch (err) {
    console.error('Cloud post failed:', err);
    showToast("Transaction saved locally (Offline Mode)", true);
  }
}

function executeCashAdjustment(actionType, amount) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const txDate = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

  const tx = {
    ticker: "CASH",
    assetType: "CASH",
    action: actionType,
    shares: 1,
    price: amount,
    date: txDate,
    comment: "",
    stopLoss: 0
  };

  // 1. Save locally
  saveTransactionLocally(tx);

  // 2. Recalculate Buying Power
  let txs = [];
  try {
    txs = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]');
  } catch (e) {
    txs = [];
  }

  let totalCashAdjustments = 0;
  const openPositions = {};
  txs.forEach(t => {
    if (!t) return;
    if (t.ticker === 'CASH' || t.assetType === 'CASH') {
      if (t.action === 'DEPOSIT') {
        totalCashAdjustments += Number(t.price);
      } else if (t.action === 'WITHDRAWAL') {
        totalCashAdjustments -= Number(t.price);
      }
      return;
    }
    // Aggregate open positions
    if (!openPositions[t.ticker]) {
      openPositions[t.ticker] = { shares: 0, assetType: t.assetType || 'stocks', avgCost: 0 };
    }
    const pos = openPositions[t.ticker];
    const sharesNum = Number(t.shares) || 0;
    const priceNum  = parseFloat(t.price) || 0;
    if (t.action === 'BUY') {
      const newShares = pos.shares + sharesNum;
      if (newShares > 0) {
        pos.avgCost = (pos.shares * pos.avgCost + sharesNum * priceNum) / newShares;
      }
      pos.shares = newShares;
    } else if (t.action === 'SELL') {
      pos.shares = Math.max(0, pos.shares - sharesNum);
    }
  });

  let totalInvestedCapital = 0;
  for (const ticker in openPositions) {
    const pos = openPositions[ticker];
    if (pos.shares <= 0) continue;
    const isOpt = pos.assetType === 'options' || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
    const multiplier = isOpt ? 100 : 1;
    totalInvestedCapital += pos.shares * pos.avgCost * multiplier;
  }

  const INITIAL_CASH = 200000.00;
  let cashFlow = INITIAL_CASH;
  txs.forEach(t => {
    if (!t || t.ticker === 'CASH' || t.assetType === 'CASH') return;
    const cost = Number(t.shares) * parseFloat(t.price || 0);
    if (t.action === 'BUY') {
      cashFlow -= cost;
    } else if (t.action === 'SELL') {
      cashFlow += cost;
    }
  });
  const buyingPowerBaseline = Math.max(0, cashFlow);

  const isUserSet = localStorage.getItem('portfolio_buying_power_user_set') === 'true';
  const startingBase = isUserSet
    ? parseFloat(localStorage.getItem('portfolio_buying_power') || '200000.00')
    : (buyingPowerBaseline + totalInvestedCapital);

  const calculatedBuyingPower = startingBase + totalCashAdjustments - totalInvestedCapital;

  if (!isUserSet) {
    localStorage.setItem('portfolio_buying_power', calculatedBuyingPower.toFixed(2));
    // Update inputs
    const bpInput  = document.getElementById('buyingPowerInput');
    const bpPreview = document.getElementById('buyingPowerPreview');
    if (bpInput) bpInput.value = calculatedBuyingPower.toFixed(2);
    if (bpPreview) bpPreview.textContent = 'Current: $' + calculatedBuyingPower.toFixed(2);
  }

  // 3. Stream to cloud
  const name = actionType === 'DEPOSIT' ? "Capital Bank Deposit" : "Capital Bank Withdrawal";
  pushCashTransactionToCloud(tx, name);
}


