const CLOUD_SPREADSHEET_CONFIG = {
  endpointUrl: "https://sheetdb.io/api/v1/6q1u8mtg34ndo"
};

const defaultAssetData = {
  'NVDA': { name: 'NVIDIA Corporation', currentPrice: 485.00, stopLoss: 380.00, change24h: 3.25, icon: 'NV' },
  'AAPL': { name: 'Apple Inc.', currentPrice: 175.50, stopLoss: 150.00, change24h: 1.92, icon: 'AP' },
  'TSLA': { name: 'Tesla Inc.', currentPrice: 198.20, stopLoss: 185.00, change24h: -2.17, icon: 'TS' },
  'NVDA $490 Call': { name: 'Exp 07/16/26 • Buy to Open', currentPrice: 18.50, stopLoss: 12.00, change24h: 20.31, icon: 'OC' },
  'AAPL $180 Call': { name: 'Exp 06/18/26 • Buy to Open', currentPrice: 4.80, stopLoss: 4.00, change24h: -13.43, icon: 'OC' }
};

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved color theme
  const savedAccent = localStorage.getItem('portfolio_accent_color');
  if (savedAccent) {
    applyAccentColor(savedAccent);
  }

  // 1. Initialize Default Date Input to Current Local Date
  initDefaultDate();

  // 2. Wire up Tab Redirect Handlers
  initNavigation();

  // 3. Form Submit Validation & Toast Trigger
  initFormSubmit();

  // 4. System notification quick toggle
  initNotificationToggle();

  // Background sync with SheetDB
  pullCloudData();
});

function applyAccentColor(hexColor) {
  document.documentElement.style.setProperty('--accent', hexColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
}

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
function saveTransactionLocally(tx) {
  let txs = [];
  const stored = localStorage.getItem('portfolio_transactions');
  if (stored) {
    try {
      txs = JSON.parse(stored);
    } catch (e) {
      txs = [];
    }
  } else {
    // If none exist, seed with default mock transactions
    txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480.00, date: '2026-06-03T10:15:00', comment: 'Momentum breakout buy after consolidation at $478.' },
      { ticker: 'NVDA', assetType: 'stocks', action: 'SELL', shares: 10, price: 495.00, date: '2026-06-03T14:30:00', comment: 'Quick day trade scalp target hit. Captured +$15.00/share profit.' },
      { ticker: 'PLTR', assetType: 'stocks', action: 'BUY', shares: 50, price: 21.00, date: '2026-06-03T09:45:00', comment: 'Support level bounce entry. Adding PLTR for core options setup.' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 30, price: 170.00, date: '2026-05-30T11:00:00', comment: 'Adding to core Apple position on temporary market-wide pullback.' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 20, price: 172.00, date: '2026-05-31T13:45:00', comment: 'Averaging up on clear hourly trend confirmation and high volume.' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'SELL', shares: 50, price: 178.00, date: '2026-06-01T15:30:00', comment: 'Closed full Apple swing trade. Locked in solid gains ahead of WWDC.' },
      { ticker: 'TSLA', assetType: 'stocks', action: 'BUY', shares: 15, price: 185.00, date: '2026-05-29T10:30:00', comment: 'Long setup near key support level. Stop loss set at $180.' },
      { ticker: 'NVDA $490 Call', assetType: 'options', action: 'BUY', shares: 3, price: 15.20, date: '2026-05-28T09:35:00', comment: 'Buy to open NVDA $490 Calls. Expecting momentum push towards $500.' },
      { ticker: 'MSFT', assetType: 'stocks', action: 'BUY', shares: 40, price: 410.00, date: '2026-05-12T10:00:00', comment: 'AI integration catalyst play. Solid earnings growth expectations.' },
      { ticker: 'MSFT', assetType: 'stocks', action: 'SELL', shares: 20, price: 425.00, date: '2026-05-18T14:15:00', comment: 'Trimming half position at target 1 resistance. Keeping remainder.' },
      { ticker: 'COIN', assetType: 'stocks', action: 'BUY', shares: 25, price: 220.00, date: '2026-05-10T11:30:00', comment: 'Crypto breakout momentum entry above $218. High risk.' },
      { ticker: 'COIN', assetType: 'stocks', action: 'SELL', shares: 25, price: 205.00, date: '2026-05-15T10:10:00', comment: 'Stop loss triggered on crypto volatility. Closed for a loss.' },
      { ticker: 'AMZN', assetType: 'stocks', action: 'BUY', shares: 100, price: 160.00, date: '2026-01-15T14:00:00', comment: 'Post-Q4 earnings selloff dip buy. Solid long-term entry opportunity.' },
      { ticker: 'AMZN', assetType: 'stocks', action: 'SELL', shares: 100, price: 185.00, date: '2026-02-20T11:45:00', comment: 'Completed swing trade at resistance. Locked in +$2,500 total profit.' },
      { ticker: 'META', assetType: 'stocks', action: 'BUY', shares: 50, price: 450.00, date: '2025-10-05T10:15:00', comment: 'Ad revenue recovery play. Extremely cheap valuation relative to earnings.' },
      { ticker: 'META', assetType: 'stocks', action: 'SELL', shares: 20, price: 480.00, date: '2025-12-12T14:50:00', comment: 'Trimmed partial position for year-end tax optimization. Remaining 30 shares.' }
    ];
  }
  txs.push(tx);
  localStorage.setItem('portfolio_transactions', JSON.stringify(txs));
}

/**
 * Handle form submission validation and show verified visual alerts
 */
function initFormSubmit() {
  const tradeForm = document.getElementById('tradeForm');
  if (!tradeForm) return;

  tradeForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Stop default form navigation

    const ticker = document.getElementById('inputTicker').value.trim().toUpperCase();
    const type = document.getElementById('inputType').value;
    const action = document.getElementById('inputAction').value;
    const shares = document.getElementById('inputShares').value;
    const price = document.getElementById('inputPrice').value;
    const date = document.getElementById('inputDate').value;
    const slInput = document.getElementById('inputSL').value;
    const comment = document.getElementById('inputComment').value.trim();

    // Field verification loop
    if (!ticker || !type || !action || !shares || !price || !date) {
      showToast('⚠️ Please fill out all required execution fields.', true);
      return;
    }

    const sharesInt = parseInt(shares, 10);
    const priceFloat = parseFloat(price);
    const slValue = slInput ? parseFloat(slInput) : 0;

    // Parse values into transaction object
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const txDate = `${date}T${hours}:${minutes}:${seconds}`;

    const tx = {
      ticker: ticker,
      assetType: type,
      action: action,
      shares: sharesInt,
      price: priceFloat,
      date: txDate,
      comment: comment,
      stopLoss: slValue
    };

    const actionColor = action === 'BUY' ? 'Bought' : 'Sold';
    const typeName = type === 'options' ? 'Contracts' : 'Shares';

    // 1. Immediately append the new trade to the local array so the app updates instantly.
    saveTransactionLocally(tx);

    // Deduct buying power
    if (action === 'BUY') {
      let bp = parseFloat(localStorage.getItem('portfolio_buying_power') || '12342.90');
      bp -= sharesInt * priceFloat;
      localStorage.setItem('portfolio_buying_power', bp.toFixed(2));
    }

    // Reset fields and notification immediately
    resetFormAndNotifications();

    // 2. In the background, execute asynchronous POST request
    pushTradeToCloud(tx);

    function resetFormAndNotifications() {
      // Send native system push notification if enabled
      if (localStorage.getItem('portfolio_notifications_enabled') === 'true') {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(`📈 Trade Executed: ${ticker}`, {
              body: `${actionColor} ${shares} ${typeName} @ $${priceFloat.toFixed(2)} logged to ledger.`,
            });
          } catch (err) {
            console.error('Push notification failed:', err);
          }
        }
      }

      // Reset fields
      document.getElementById('inputTicker').value = '';
      document.getElementById('inputShares').value = '';
      document.getElementById('inputPrice').value = '';
      document.getElementById('inputSL').value = '';
      document.getElementById('inputComment').value = '';
      initDefaultDate();
    }
  });
}

async function pushTradeToCloud(tx) {
  const url = CLOUD_SPREADSHEET_CONFIG.endpointUrl;
  if (url.includes("YOUR_SHEETDB_API_ID")) {
    console.error(new Error("SheetDB API ID is a placeholder."));
    showToast("Trade saved locally (Offline Mode)", true);
    return;
  }

  const defaultNames = {
    'NVDA': 'NVIDIA Corporation',
    'AAPL': 'Apple Inc.',
    'TSLA': 'Tesla Inc.',
    'NVDA $490 Call': 'Exp 07/16/26 • Buy to Open',
    'AAPL $180 Call': 'Exp 06/18/26 • Buy to Open'
  };
  const nameValue = defaultNames[tx.ticker] || (tx.ticker + ' Corporation');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          {
            Symbol: tx.ticker,
            Name: nameValue,
            Shares: Number(tx.shares),
            CostBasis: Number(tx.price),
            CurrentPrice: Number(tx.price),
            Type: tx.assetType,
            Icon: tx.ticker.substring(0, 2).toUpperCase(),
            Action: tx.action,
            Date: tx.date,
            'Trade Journal Note': tx.comment,
            SL: tx.stopLoss ? Number(tx.stopLoss) : ""
          }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`Cloud submission returned non-ok status: ${response.status}`);
    }
    showToast("🟢 Trade Synced to Cloud Sheet!");
  } catch (err) {
    console.error(err);
    showToast("Trade saved locally (Offline Mode)", true);
  }
}

async function pullCloudData() {
  const url = CLOUD_SPREADSHEET_CONFIG.endpointUrl;
  if (url.includes("YOUR_SHEETDB_API_ID")) {
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Cloud spreadsheet endpoint returned error response.');
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      const defaultTickerKeys = ['NVDA', 'AAPL', 'TSLA', 'NVDA $490 Call', 'AAPL $180 Call'];
      
      let marketPrices = {};
      try {
        marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
      } catch (e) {
        marketPrices = {};
      }

      let localTxs = [];
      try {
        localTxs = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]');
      } catch (e) {
        localTxs = [];
      }

      const parsedTxs = data.map(tx => {
        const ticker = (tx.Symbol || tx.Ticker || tx.ticker || '').trim();
        const name = tx.Name || tx.name || '';
        const shares = parseInt(tx.Shares || tx.shares || 0, 10);
        const costBasis = parseFloat(tx.CostBasis || tx['Cost Basis'] || tx.costBasis || tx.price || tx.avgCost || 0);
        const assetType = tx.Type || tx.assetType || tx.type || 'stocks';
        
        // Find matching local transaction to preserve Action, Date, and Comment
        const match = localTxs.find(local => 
          local.ticker === ticker && 
          local.shares === shares && 
          Math.abs(local.price - costBasis) < 0.01 &&
          local.assetType === assetType
        );

        const action = tx.Action || tx.action || (match ? match.action : 'BUY');
        const date = tx.Date || tx.date || (match ? match.date : new Date().toISOString());
        const comment = tx['Trade Journal Note'] || tx.Comment || tx.comment || (match ? match.comment : '');
        
        let stopLoss = 0;
        let slSpecified = false;
        if (tx.SL !== undefined && tx.SL !== null) {
          slSpecified = true;
          stopLoss = tx.SL === '' ? 0 : (isNaN(parseFloat(tx.SL)) ? 0 : parseFloat(tx.SL));
        } else if (tx.sl !== undefined && tx.sl !== null) {
          slSpecified = true;
          stopLoss = tx.sl === '' ? 0 : (isNaN(parseFloat(tx.sl)) ? 0 : parseFloat(tx.sl));
        } else if (match && match.stopLoss !== undefined) {
          stopLoss = match.stopLoss;
          slSpecified = true;
        }

        if (ticker) {
          const isDefault = defaultTickerKeys.includes(ticker);
          const defaultData = defaultAssetData[ticker] || {};

          marketPrices[ticker] = {
            name: name || (marketPrices[ticker] ? marketPrices[ticker].name : (isDefault ? defaultData.name : ticker + ' Corporation')),
            currentPrice: isDefault ? defaultData.currentPrice : ((tx.CurrentPrice || tx.currentPrice) ? parseFloat(tx.CurrentPrice || tx.currentPrice) : (marketPrices[ticker] ? marketPrices[ticker].currentPrice : costBasis)),
            change24h: isDefault ? defaultData.change24h : ((tx.change24h || tx.change) ? parseFloat(tx.change24h || tx.change) : (marketPrices[ticker] ? marketPrices[ticker].change24h : 0.0)),
            icon: tx.Icon || tx.icon || (marketPrices[ticker] ? marketPrices[ticker].icon : (isDefault ? defaultData.icon : ticker.slice(0, 2).toUpperCase())),
            stopLoss: slSpecified ? stopLoss : (isDefault ? defaultData.stopLoss : 0.0)
          };
        }

        return {
          ticker: ticker,
          assetType: assetType,
          action: action,
          shares: shares,
          price: costBasis,
          date: date,
          comment: comment,
          stopLoss: stopLoss
        };
      }).filter(tx => tx.ticker !== '');

      localStorage.setItem('portfolio_market_prices', JSON.stringify(marketPrices));
      localStorage.setItem('portfolio_transactions', JSON.stringify(parsedTxs));
    }
  } catch (err) {
    console.error('Background pull failed:', err);
  }
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
    background: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(12px)',
    webkitBackdropFilter: 'blur(12px)',
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
