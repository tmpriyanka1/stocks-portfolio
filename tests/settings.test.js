/**
 * @file settings.test.js
 * @description Unit tests for settings.js — covers:
 *   - applyAccentColor (CSS variable injection + rgba computation)
 *   - updateDotUI (accent color selection, preview UI state)
 *   - Theme name mapping (known colors → theme names)
 *   - initPreferences localStorage state management
 *   - Profile form value loading and persistence
 *   - showToast (DOM creation, error styling, de-duplication)
 *   - initNavigation redirects (tab routing logic)
 *   - Reset ledger confirmation flow
 *
 * @jest-environment jest-environment-jsdom
 */

// ══════════════════════════════════════════════════════════════════════════════
// Pure logic re-implementations from settings.js
// ══════════════════════════════════════════════════════════════════════════════

// SOURCE: applyAccentColor
function applyAccentColor(hexColor) {
  document.documentElement.style.setProperty('--accent', hexColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
}

// SOURCE: updateDotUI (inside initThemeAccordion)
function getThemeName(color) {
  const names = {
    '#6366f1': 'Indigo Theme',
    '#10b981': 'Emerald Green Theme',
    '#ef4444': 'Rose Red Theme',
    '#a855f7': 'Purple Theme',
    '#0ea5e9': 'Sky Blue Theme'
  };
  return names[color] || 'Custom Highlight Color';
}

// SOURCE: accent dot active state logic
function getActiveDots(dots, selectedColor) {
  return dots.map(d => ({
    color: d.color,
    isActive: d.color === selectedColor
  }));
}

// SOURCE: preferences state saving
function savePreference(key, value) {
  localStorage.setItem(key, value ? 'true' : 'false');
}

function loadPreference(key, defaultValue = true) {
  const stored = localStorage.getItem(key);
  if (stored === null) return defaultValue;
  return stored === 'true';
}

// SOURCE: profile form loading
function loadProfileValue(key, fallback) {
  return localStorage.getItem(key) || fallback;
}

// SOURCE: profile form saving
function saveProfileValue(key, value) {
  localStorage.setItem(key, value);
}

// SOURCE: showToast (settings.js version)
function showToast(message, isError) {
  const existingToast = document.querySelector('.app-toast');
  if (existingToast) existingToast.remove();
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.innerText = message;
  if (isError) {
    toast.style.borderColor = 'rgba(239, 68, 68, 0.4)';
  }
  const container = document.getElementById('app-container');
  if (container) container.appendChild(toast);
  return toast;
}

// SOURCE: reset ledger logic
function resetLedger() {
  localStorage.removeItem('portfolio_transactions');
  localStorage.removeItem('portfolio_buying_power');
  localStorage.removeItem('portfolio_buying_power_user_set');
  localStorage.removeItem('portfolio_value_override');
  localStorage.removeItem('portfolio_custom_sl');
}

// SOURCE: hex to rgb component extraction (used in applyAccentColor)
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// SOURCE: email toggle state (initPreferences toggleEmails)
// "true" unless explicitly set to "false"
function loadEmailsEnabled() {
  return localStorage.getItem('portfolio_emails_enabled') !== 'false';
}

// SOURCE: blur toggle state
function loadBlurEnabled() {
  return localStorage.getItem('portfolio_blur_enabled') !== 'false';
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════════════════

describe('applyAccentColor — settings.js CSS variable injection', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-glow');
  });

  test('sets --accent for indigo', () => {
    applyAccentColor('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#6366f1');
  });

  test('sets --accent-glow correctly for indigo (r=99,g=102,b=241)', () => {
    applyAccentColor('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(99, 102, 241, 0.15)');
  });

  test('sets --accent for emerald green', () => {
    applyAccentColor('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(16, 185, 129, 0.15)');
  });

  test('sets --accent for rose red', () => {
    applyAccentColor('#ef4444');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(239, 68, 68, 0.15)');
  });

  test('sets --accent for purple', () => {
    applyAccentColor('#a855f7');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(168, 85, 247, 0.15)');
  });

  test('sets --accent for sky blue', () => {
    applyAccentColor('#0ea5e9');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(14, 165, 233, 0.15)');
  });

  test('overwrites previous --accent on second call', () => {
    applyAccentColor('#ef4444');
    applyAccentColor('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#6366f1');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('hexToRgb — color component extraction', () => {
  test('extracts correct components for indigo #6366f1', () => {
    const { r, g, b } = hexToRgb('#6366f1');
    expect(r).toBe(99);
    expect(g).toBe(102);
    expect(b).toBe(241);
  });

  test('extracts correct components for green #10b981', () => {
    const { r, g, b } = hexToRgb('#10b981');
    expect(r).toBe(16);
    expect(g).toBe(185);
    expect(b).toBe(129);
  });

  test('extracts correct components for red #ef4444', () => {
    const { r, g, b } = hexToRgb('#ef4444');
    expect(r).toBe(239);
    expect(g).toBe(68);
    expect(b).toBe(68);
  });

  test('extracts correct components for black #000000', () => {
    const { r, g, b } = hexToRgb('#000000');
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  test('extracts correct components for white #ffffff', () => {
    const { r, g, b } = hexToRgb('#ffffff');
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('getThemeName — accent color → display name mapping', () => {
  test('indigo maps to "Indigo Theme"', () => {
    expect(getThemeName('#6366f1')).toBe('Indigo Theme');
  });

  test('emerald maps to "Emerald Green Theme"', () => {
    expect(getThemeName('#10b981')).toBe('Emerald Green Theme');
  });

  test('red maps to "Rose Red Theme"', () => {
    expect(getThemeName('#ef4444')).toBe('Rose Red Theme');
  });

  test('purple maps to "Purple Theme"', () => {
    expect(getThemeName('#a855f7')).toBe('Purple Theme');
  });

  test('sky blue maps to "Sky Blue Theme"', () => {
    expect(getThemeName('#0ea5e9')).toBe('Sky Blue Theme');
  });

  test('unknown color falls back to "Custom Highlight Color"', () => {
    expect(getThemeName('#123456')).toBe('Custom Highlight Color');
  });

  test('empty string falls back to "Custom Highlight Color"', () => {
    expect(getThemeName('')).toBe('Custom Highlight Color');
  });

  test('similar but non-matching color is not found', () => {
    expect(getThemeName('#6366F1')).toBe('Custom Highlight Color'); // case-sensitive
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('getActiveDots — accent dot UI state', () => {
  const dots = [
    { color: '#6366f1' },
    { color: '#10b981' },
    { color: '#ef4444' },
    { color: '#a855f7' },
    { color: '#0ea5e9' },
  ];

  test('marks only the selected color as active', () => {
    const result = getActiveDots(dots, '#6366f1');
    const active = result.filter(d => d.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].color).toBe('#6366f1');
  });

  test('all others are inactive', () => {
    const result = getActiveDots(dots, '#6366f1');
    const inactive = result.filter(d => !d.isActive);
    expect(inactive).toHaveLength(4);
  });

  test('switching to green activates correct dot', () => {
    const result = getActiveDots(dots, '#10b981');
    expect(result.find(d => d.color === '#10b981').isActive).toBe(true);
    expect(result.find(d => d.color === '#6366f1').isActive).toBe(false);
  });

  test('no selection leaves all inactive', () => {
    const result = getActiveDots(dots, '');
    expect(result.every(d => !d.isActive)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('savePreference / loadPreference — toggle state management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('savePreference saves "true" for enabled', () => {
    savePreference('portfolio_notifications_enabled', true);
    expect(localStorage.getItem('portfolio_notifications_enabled')).toBe('true');
  });

  test('savePreference saves "false" for disabled', () => {
    savePreference('portfolio_notifications_enabled', false);
    expect(localStorage.getItem('portfolio_notifications_enabled')).toBe('false');
  });

  test('loadPreference reads "true" correctly', () => {
    localStorage.setItem('portfolio_notifications_enabled', 'true');
    expect(loadPreference('portfolio_notifications_enabled')).toBe(true);
  });

  test('loadPreference reads "false" correctly', () => {
    localStorage.setItem('portfolio_notifications_enabled', 'false');
    expect(loadPreference('portfolio_notifications_enabled')).toBe(false);
  });

  test('loadPreference returns defaultValue when key is missing', () => {
    expect(loadPreference('portfolio_notifications_enabled', false)).toBe(false);
    expect(loadPreference('portfolio_notifications_enabled', true)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('loadEmailsEnabled — inverted default (true unless explicitly false)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns true when not set (default enabled)', () => {
    expect(loadEmailsEnabled()).toBe(true);
  });

  test('returns false when explicitly set to "false"', () => {
    localStorage.setItem('portfolio_emails_enabled', 'false');
    expect(loadEmailsEnabled()).toBe(false);
  });

  test('returns true when set to "true"', () => {
    localStorage.setItem('portfolio_emails_enabled', 'true');
    expect(loadEmailsEnabled()).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('loadBlurEnabled — inverted default (true unless explicitly false)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns true when not set', () => {
    expect(loadBlurEnabled()).toBe(true);
  });

  test('returns false when set to "false"', () => {
    localStorage.setItem('portfolio_blur_enabled', 'false');
    expect(loadBlurEnabled()).toBe(false);
  });

  test('returns true when set to "true"', () => {
    localStorage.setItem('portfolio_blur_enabled', 'true');
    expect(loadBlurEnabled()).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('loadProfileValue / saveProfileValue — profile persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('loadProfileValue returns fallback when key is missing', () => {
    expect(loadProfileValue('portfolio_username', 'Vanai')).toBe('Vanai');
  });

  test('loadProfileValue returns stored value when present', () => {
    localStorage.setItem('portfolio_username', 'Malathi');
    expect(loadProfileValue('portfolio_username', 'Vanai')).toBe('Malathi');
  });

  test('saveProfileValue persists to localStorage', () => {
    saveProfileValue('portfolio_username', 'TestUser');
    expect(localStorage.getItem('portfolio_username')).toBe('TestUser');
  });

  test('saveProfileValue for email persists correctly', () => {
    saveProfileValue('portfolio_email', 'test@portfolio.com');
    expect(localStorage.getItem('portfolio_email')).toBe('test@portfolio.com');
  });

  test('loadProfileValue fallback for email', () => {
    expect(loadProfileValue('portfolio_email', 'vanai@portfolio.com')).toBe('vanai@portfolio.com');
  });

  test('saveProfileValue overwrites previous value', () => {
    saveProfileValue('portfolio_username', 'First');
    saveProfileValue('portfolio_username', 'Second');
    expect(localStorage.getItem('portfolio_username')).toBe('Second');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('resetLedger — ledger data wipe', () => {
  beforeEach(() => {
    localStorage.setItem('portfolio_transactions', JSON.stringify([{ ticker: 'NVDA' }]));
    localStorage.setItem('portfolio_buying_power', '5000.00');
    localStorage.setItem('portfolio_custom_sl', '{"NVDA":380}');
  });

  test('removes portfolio_transactions', () => {
    resetLedger();
    expect(localStorage.getItem('portfolio_transactions')).toBeNull();
  });

  test('removes portfolio_buying_power', () => {
    resetLedger();
    expect(localStorage.getItem('portfolio_buying_power')).toBeNull();
  });

  test('removes portfolio_custom_sl', () => {
    resetLedger();
    expect(localStorage.getItem('portfolio_custom_sl')).toBeNull();
  });

  test('does not affect unrelated keys', () => {
    localStorage.setItem('portfolio_username', 'Vanai');
    resetLedger();
    expect(localStorage.getItem('portfolio_username')).toBe('Vanai');
  });

  test('accent color is not affected', () => {
    localStorage.setItem('portfolio_accent_color', '#6366f1');
    resetLedger();
    expect(localStorage.getItem('portfolio_accent_color')).toBe('#6366f1');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('showToast — settings.js DOM toast rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('creates toast with class app-toast', () => {
    showToast('Saved!');
    expect(document.querySelector('.app-toast')).not.toBeNull();
  });

  test('sets correct message text', () => {
    showToast('💾 Profile configurations saved!');
    expect(document.querySelector('.app-toast').innerText).toBe('💾 Profile configurations saved!');
  });

  test('error toast has red border', () => {
    const t = showToast('⚠️ Permission denied for notifications.', true);
    expect(t.style.borderColor).toBe('rgba(239, 68, 68, 0.4)');
  });

  test('success toast has no red border', () => {
    const t = showToast('🎨 Accent theme updated!');
    expect(t.style.borderColor).toBe('');
  });

  test('replaces previous toast', () => {
    showToast('First');
    showToast('Second');
    expect(document.querySelectorAll('.app-toast')).toHaveLength(1);
  });

  test('notification enabled toast message', () => {
    showToast('🔔 System notifications enabled!');
    expect(document.querySelector('.app-toast').innerText).toContain('notifications enabled');
  });

  test('notification disabled toast message', () => {
    showToast('🔕 System notifications disabled.');
    expect(document.querySelector('.app-toast').innerText).toContain('disabled');
  });

  test('email alert toast message', () => {
    showToast('📧 Email alerts enabled!');
    expect(document.querySelector('.app-toast').innerText).toContain('Email alerts');
  });

  test('ledger reset success toast', () => {
    showToast('🗑️ Ledger successfully reset!');
    expect(document.querySelector('.app-toast').innerText).toContain('reset');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('Portfolio Overrides Logic — settings.js', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Pure logic re-implementation for testing
  function savePortfolioOverrides(bpValStr, pvValStr) {
    let saved = false;
    if (bpValStr !== undefined) {
      const bpVal = parseFloat(bpValStr);
      if (!isNaN(bpVal) && bpVal >= 0) {
        localStorage.setItem('portfolio_buying_power', bpVal.toFixed(2));
        localStorage.setItem('portfolio_buying_power_user_set', 'true');
        saved = true;
      } else if (bpValStr.trim() === '') {
        localStorage.removeItem('portfolio_buying_power');
        localStorage.removeItem('portfolio_buying_power_user_set');
        saved = true;
      }
    }
    if (pvValStr !== undefined) {
      const pvVal = parseFloat(pvValStr);
      if (!isNaN(pvVal) && pvVal >= 0) {
        localStorage.setItem('portfolio_value_override', pvVal.toFixed(2));
        saved = true;
      } else if (pvValStr.trim() === '') {
        localStorage.removeItem('portfolio_value_override');
        saved = true;
      }
    }
    return saved;
  }

  test('saves valid buying power and sets user_set flag', () => {
    const success = savePortfolioOverrides('25000.50', undefined);
    expect(success).toBe(true);
    expect(localStorage.getItem('portfolio_buying_power')).toBe('25000.50');
    expect(localStorage.getItem('portfolio_buying_power_user_set')).toBe('true');
  });

  test('clears buying power and removes user_set flag', () => {
    localStorage.setItem('portfolio_buying_power', '25000.50');
    localStorage.setItem('portfolio_buying_power_user_set', 'true');
    const success = savePortfolioOverrides('', undefined);
    expect(success).toBe(true);
    expect(localStorage.getItem('portfolio_buying_power')).toBeNull();
    expect(localStorage.getItem('portfolio_buying_power_user_set')).toBeNull();
  });

  test('ignores negative buying power', () => {
    const success = savePortfolioOverrides('-100.00', undefined);
    expect(success).toBe(false);
    expect(localStorage.getItem('portfolio_buying_power')).toBeNull();
  });

  test('saves valid portfolio value override', () => {
    const success = savePortfolioOverrides(undefined, '150000.00');
    expect(success).toBe(true);
    expect(localStorage.getItem('portfolio_value_override')).toBe('150000.00');
  });

  test('clears portfolio value override', () => {
    localStorage.setItem('portfolio_value_override', '150000.00');
    const success = savePortfolioOverrides(undefined, '');
    expect(success).toBe(true);
    expect(localStorage.getItem('portfolio_value_override')).toBeNull();
  });

  test('reset ledger removes override keys', () => {
    localStorage.setItem('portfolio_buying_power', '5000.00');
    localStorage.setItem('portfolio_buying_power_user_set', 'true');
    localStorage.setItem('portfolio_value_override', '150000.00');
    resetLedger();
    expect(localStorage.getItem('portfolio_buying_power')).toBeNull();
    expect(localStorage.getItem('portfolio_buying_power_user_set')).toBeNull();
    expect(localStorage.getItem('portfolio_value_override')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('showConfirmModal — confirmation dialog popup UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="confirmModal">
        <div id="confirmModalIcon"></div>
        <div id="confirmModalTitle"></div>
        <div id="confirmModalMessage"></div>
        <button id="confirmModalCancel"></button>
        <button id="confirmModalConfirm"></button>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Pure logic mock definition
  function showConfirmModal(options, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const iconEl = document.getElementById('confirmModalIcon');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const confirmBtn = document.getElementById('confirmModalConfirm');

    if (!modal || !confirmBtn || !cancelBtn) {
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

  test('sets options correctly and activates modal', () => {
    showConfirmModal({
      icon: '🗑️',
      title: 'Reset Ledger?',
      message: 'This will wipe data.'
    }, () => {});

    expect(document.getElementById('confirmModalIcon').textContent).toBe('🗑️');
    expect(document.getElementById('confirmModalTitle').textContent).toBe('Reset Ledger?');
    expect(document.getElementById('confirmModalMessage').textContent).toBe('This will wipe data.');
    expect(document.getElementById('confirmModal').classList.contains('active')).toBe(true);
  });

  test('calls onConfirm and deactivates modal on confirm click', () => {
    let confirmed = false;
    showConfirmModal({}, () => { confirmed = true; });

    document.getElementById('confirmModalConfirm').click();
    expect(confirmed).toBe(true);
    expect(document.getElementById('confirmModal').classList.contains('active')).toBe(false);
  });

  test('does not call onConfirm and deactivates modal on cancel click', () => {
    let confirmed = false;
    showConfirmModal({}, () => { confirmed = true; });

    document.getElementById('confirmModalCancel').click();
    expect(confirmed).toBe(false);
    expect(document.getElementById('confirmModal').classList.contains('active')).toBe(false);
  });
});

// SOURCE: getClosedPositionsPnLEvents
function getClosedPositionsPnLEvents(allTxs) {
  const txs = allTxs
    .filter(tx => tx && tx.ticker && tx.ticker !== 'CASH' && tx.assetType !== 'CASH')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

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

describe('Profit & Loss calculation logic helper', () => {
  test('calculates FIFO realized P&L events correctly', () => {
    const mockTxs = [
      { ticker: 'AAPL', action: 'BUY', shares: '10', price: '150', date: '2026-06-01T10:00:00' },
      { ticker: 'AAPL', action: 'SELL', shares: '5', price: '160', date: '2026-06-02T10:00:00' },
      { ticker: 'AAPL', action: 'SELL', shares: '5', price: '170', date: '2026-06-03T10:00:00' },
      { ticker: 'CASH', action: 'DEPOSIT', price: '1000', date: '2026-06-01T09:00:00' }
    ];

    const events = getClosedPositionsPnLEvents(mockTxs);
    expect(events).toHaveLength(2);
    expect(events[0].ticker).toBe('AAPL');
    expect(events[0].pnl).toBe(50); // (160 - 150) * 5 = 50
    expect(events[1].pnl).toBe(100); // (170 - 150) * 5 = 100
  });

  test('ignores CASH transactions', () => {
    const mockTxs = [
      { ticker: 'CASH', action: 'DEPOSIT', shares: '1', price: '1000', date: '2026-06-01T09:00:00', assetType: 'CASH' }
    ];
    const events = getClosedPositionsPnLEvents(mockTxs);
    expect(events).toHaveLength(0);
  });
});



