const CLOUD_SPREADSHEET_CONFIG = {
  endpointUrl: "https://vanai-portfolio-backend.onrender.com/api/trades"
};

const CLOUD_ENDPOINT = {
  endpointUrl: "https://vanai-portfolio-backend.onrender.com/api/"
};


const defaultAssetData = {
  'NVDA': { name: 'NVIDIA Corporation', currentPrice: 485.00, stopLoss: 380.00, change24h: 3.25, icon: 'NV' },
  'AAPL': { name: 'Apple Inc.', currentPrice: 175.50, stopLoss: 150.00, change24h: 1.92, icon: 'AP' },
  'TSLA': { name: 'Tesla Inc.', currentPrice: 198.20, stopLoss: 185.00, change24h: -2.17, icon: 'TS' },
  'SPY': { name: 'SPDR S&P 500 ETF Trust', currentPrice: 512.42, stopLoss: 490.00, change24h: 0.45, icon: 'SP' },
  'SPX': { name: 'S&P 500 Index', currentPrice: 5120.30, stopLoss: 5000.00, change24h: 0.52, icon: 'SX' },
  'NVDA $490 Call': { name: 'Exp 07/16/26 • Buy to Open', currentPrice: 18.50, stopLoss: 12.00, change24h: 20.31, icon: 'OC' },
  'AAPL $180 Call': { name: 'Exp 06/18/26 • Buy to Open', currentPrice: 4.80, stopLoss: 4.00, change24h: -13.43, icon: 'OC' }
};

let tickersDb = {};
async function loadTickersDb() {
  if (Object.keys(tickersDb).length > 0) return;
  try {
    const res = await fetch('tickers.json');
    if (res.ok) {
      tickersDb = await res.json();
    }
  } catch (e) {
    console.warn('Failed to load tickers.json:', e);
  }
}

function getVal(obj, key) {
  if (!obj) return undefined;
  if (obj[key] !== undefined) return obj[key];
  const lowerKey = key.toLowerCase();
  for (const k in obj) {
    if (k.toLowerCase() === lowerKey) {
      return obj[k];
    }
  }
  return undefined;
}

function resolveAssetName(ticker) {
  const capitalized = ticker.trim().toUpperCase();
  if (defaultAssetData[capitalized] && defaultAssetData[capitalized].name) {
    return defaultAssetData[capitalized].name;
  }
  if (tickersDb && tickersDb[capitalized]) {
    return tickersDb[capitalized];
  }

  // Try matching option underlying ticker
  const isOption = /\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker);
  if (isOption) {
    const underlying = ticker.split(' ')[0].toUpperCase();
    if (defaultAssetData[underlying] && defaultAssetData[underlying].name) {
      return defaultAssetData[underlying].name;
    }
    if (tickersDb && tickersDb[underlying]) {
      return tickersDb[underlying];
    }
  }

  // Fallback to extraction from regex
  const underlyingMatch = ticker.match(/^([A-Za-z]+)/);
  if (underlyingMatch) {
    const underlying = underlyingMatch[1].toUpperCase();
    if (defaultAssetData[underlying] && defaultAssetData[underlying].name) {
      return defaultAssetData[underlying].name;
    }
    if (tickersDb && tickersDb[underlying]) {
      return tickersDb[underlying];
    }
  }

  return capitalized;
}

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved color theme
  const savedAccent = localStorage.getItem('portfolio_accent_color');
  if (savedAccent) {
    applyAccentColor(savedAccent);
  }

  // Initialize form toggle modes selector
  initFormModeToggle();

  // 1. Initialize Default Date Input to Current Local Date & Time
  initDefaultDate();

  // 2. Wire up Tab Redirect Handlers
  initNavigation();

  // 3. Form Submit Validation & Toast Trigger
  initFormSubmit();

  // 3b. Initialize Action Pills Toggle (BUY/SELL)
  initActionPills();

  // 4. System notification quick toggle
  initNotificationToggle();

  // Capitalize ticker input live
  const inputTicker = document.getElementById('inputTicker');
  if (inputTicker) {
    inputTicker.addEventListener('input', () => {
      inputTicker.value = inputTicker.value.toUpperCase();
    });
  }

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
 * Automatically populates the transaction date selector to today's local date and time
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
  const timeInput = document.getElementById('inputTime');
  if (timeInput) {
    const today = new Date();
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const seconds = String(today.getSeconds()).padStart(2, '0');
    timeInput.value = `${hours}:${minutes}:${seconds}`;
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
 * Setup action pills toggle selectors (BUY/SELL)
 */
function initActionPills() {
  const pills = document.querySelectorAll('.action-pill');
  const actionInput = document.getElementById('inputAction');

  if (pills.length && actionInput) {
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        actionInput.value = pill.getAttribute('data-action');
      });
    });
  }
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
/**
 * Asynchronously fetches the asset's full name from local mock data or Yahoo Finance Search API
 */
async function fetchAssetName(ticker) {
  const localName = resolveAssetName(ticker);
  if (localName !== ticker.trim().toUpperCase()) {
    return localName;
  }

  if (!tickersDb || Object.keys(tickersDb).length === 0) {
    await loadTickersDb();
    const afterFetch = resolveAssetName(ticker);
    if (afterFetch !== ticker.trim().toUpperCase()) {
      return afterFetch;
    }
  }

  const capitalized = ticker.trim().toUpperCase();
  const isOption = /\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker);
  let queryTicker = isOption ? ticker.split(' ')[0].toUpperCase() : capitalized;

  try {
    const targetUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${queryTicker}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const wrapper = await res.json();
      if (wrapper && wrapper.contents) {
        const json = JSON.parse(wrapper.contents);
        if (json && json.quotes && json.quotes.length > 0) {
          const match = json.quotes.find(q => q.symbol === queryTicker) || json.quotes[0];
          let name = match.longname || match.shortname || queryTicker;
          name = name.replace(/\b(Corporation|Corp|Inc|Incorporated|LLC|Ltd|Co|Class\s+[A-Z]|Common\s+Stock|Ordinary\s+Shares|PLC)\b\.?/gi, '').trim();
          name = name.replace(/[,.\-\s]+$/, '').trim();
          // Title case it
          name = name.toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          return name;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to fetch name from Yahoo search API:', e);
  }

  return queryTicker;
}

/**
 * Handle form submission validation and show verified visual alerts
 */
function initFormSubmit() {
  const tradeForm = document.getElementById('tradeForm');
  if (!tradeForm) return;

  tradeForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop default form navigation

    const mode = document.getElementById('formMode').value;

    if (mode === 'cash') {
      const cashAction = document.getElementById('inputCashAction').value;
      const amount = document.getElementById('inputPrice').value;
      const date = document.getElementById('inputDate').value;
      const time = document.getElementById('inputTime').value;

      if (!cashAction || !amount || !date || !time) {
        showToast('⚠️ Please fill out all required cash ledger fields.', true);
        return;
      }

      const amountFloat = parseFloat(amount);
      if (isNaN(amountFloat) || amountFloat <= 0) {
        showToast('⚠️ Amount must be a positive number.', true);
        return;
      }

      const txDate = `${date}T${time}`;
      const tx = {
        ticker: 'CASH',
        assetType: 'CASH',
        action: cashAction,
        shares: 0,
        price: amountFloat,
        date: txDate,
        comment: '',
        stopLoss: 0
      };

      // 1. Immediately append to local transactions
      saveTransactionLocally(tx);

      // Also save to cash ledger locally
      let cashTxs = [];
      try {
        cashTxs = JSON.parse(localStorage.getItem('portfolio_cash_ledger') || '[]');
      } catch (e) {
        cashTxs = [];
      }
      cashTxs.push(tx);
      localStorage.setItem('portfolio_cash_ledger', JSON.stringify(cashTxs));

      // Deduct or add to buying power locally
      let bp = parseFloat(localStorage.getItem('portfolio_buying_power') || '12342.90');
      if (cashAction === 'DEPOSIT') {
        bp += amountFloat;
      } else if (cashAction === 'WITHDRAWAL') {
        bp -= amountFloat;
      }
      localStorage.setItem('portfolio_buying_power', bp.toFixed(2));

      resetFormAndNotifications();
      pushCashToCloud(tx);
      return;
    }

    let ticker = document.getElementById('inputTicker').value.trim().toUpperCase();
    const type = document.getElementById('inputType').value;
    if (mode === 'option') {
      const optionType = document.getElementById('inputOptionType').value;
      if (!/\b(call|put)\b/i.test(ticker)) {
        ticker = `${ticker} ${optionType.charAt(0).toUpperCase() + optionType.slice(1).toLowerCase()}`;
      }
    }
    const actionInput = document.getElementById('inputAction');
    const action = actionInput ? actionInput.value : 'BUY';
    const shares = document.getElementById('inputShares').value;
    const price = document.getElementById('inputPrice').value;
    const date = document.getElementById('inputDate').value;
    const time = document.getElementById('inputTime').value;
    const slInput = document.getElementById('inputSL').value;
    const comment = document.getElementById('inputComment').value.trim();
    const expiryDate = document.getElementById('inputExpiry').value;

    if (mode === 'option' && !expiryDate) {
      showToast('⚠️ Please select an Expiry Date for the option.', true);
      return;
    }

    // Field verification loop
    if (!ticker || !type || !action || !shares || !price || !date || !time) {
      showToast('⚠️ Please fill out all required execution fields.', true);
      return;
    }

    const sharesInt = parseInt(shares, 10);
    const priceFloat = parseFloat(price);
    const slValue = slInput ? parseFloat(slInput) : 0;

    if (isNaN(sharesInt) || sharesInt <= 0) {
      showToast('⚠️ Quantity must be a positive number.', true);
      return;
    }
    if (isNaN(priceFloat) || priceFloat <= 0) {
      showToast('⚠️ Price must be a positive number.', true);
      return;
    }

    const txDate = `${date}T${time}`;

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
    if (mode === 'option') {
      tx.expiryDate = expiryDate;
    }

    const actionColor = action === 'BUY' ? 'Bought' : 'Sold';
    const typeName = type === 'options' ? 'CON' : 'SHR';

    // 2. Immediately append the new trade to the local array so the app updates instantly.
    saveTransactionLocally(tx);

    // Save resolved name to marketPrices in local storage immediately so it shows up in the app
    let marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
    if (!marketPrices[ticker]) {
      marketPrices[ticker] = {
        name: ticker,
        currentPrice: priceFloat,
        change24h: 0.0,
        icon: ticker.slice(0, 2).toUpperCase(),
        stopLoss: slValue
      };
    }
    localStorage.setItem('portfolio_market_prices', JSON.stringify(marketPrices));

    // Deduct or add buying power
    if (action === 'BUY') {
      let bp = parseFloat(localStorage.getItem('portfolio_buying_power') || '12342.90');
      bp -= sharesInt * priceFloat;
      localStorage.setItem('portfolio_buying_power', bp.toFixed(2));
    } else if (action === 'SELL') {
      let bp = parseFloat(localStorage.getItem('portfolio_buying_power') || '12342.90');
      bp += sharesInt * priceFloat;
      localStorage.setItem('portfolio_buying_power', bp.toFixed(2));
    }

    // Reset fields and notification immediately
    resetFormAndNotifications();

    // 3. Resolve the asset name and push to cloud in the background asynchronously
    (async () => {
      let resolvedName = ticker;
      try {
        resolvedName = await fetchAssetName(ticker);
        let prices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
        if (prices[ticker]) {
          prices[ticker].name = resolvedName;
          localStorage.setItem('portfolio_market_prices', JSON.stringify(prices));
        }
      } catch (err) {
        console.warn('Failed to resolve asset name in background:', err);
      }
      pushTradeToCloud(tx, resolvedName);
    })();

    function resetFormAndNotifications() {
      // Send native system push notification if enabled
      if (mode !== 'cash' && localStorage.getItem('portfolio_notifications_enabled') === 'true') {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(`📈 Trade Executed: ${ticker}`, {
              body: `${actionColor} ${shares} ${typeName} @ $${priceFloat.toFixed(2)} logged to ledger.`,
            });
          } catch (err) {
            console.error('Push notification failed:', err);
          }
        }
      } else if (mode === 'cash' && localStorage.getItem('portfolio_notifications_enabled') === 'true') {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(`💰 Cash Flow: ${cashAction}`, {
              body: `${cashAction} of $${amountFloat.toFixed(2)} logged to ledger.`,
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
      const expiryInput = document.getElementById('inputExpiry');
      if (expiryInput) expiryInput.value = '';

      // Reset action pill selection
      if (document.getElementById('inputAction')) {
        document.getElementById('inputAction').value = 'BUY';
      }
      const pills = document.querySelectorAll('.action-pill');
      pills.forEach(p => {
        if (p.getAttribute('data-action') === 'BUY') {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });

      // Reset cash action selector to DEPOSIT
      const cashActionSelect = document.getElementById('inputCashAction');
      if (cashActionSelect) {
        cashActionSelect.value = 'DEPOSIT';
      }

      initDefaultDate();
    }
  });
}

async function pushTradeToCloud(tx, resolvedName) {
  const url = CLOUD_SPREADSHEET_CONFIG.endpointUrl;
  if (!url || url.includes("YOUR_API_URL")) {
    showToast("Trade saved locally (Offline Mode)", true);
    return;
  }

  const bodyData = {
    ticker: tx.ticker,
    action: tx.action,
    quantity: Number(tx.shares),
    price: Number(tx.price),
    date: tx.date,
    stopLimit: tx.stopLoss ? Number(tx.stopLoss) : 0,
    note: tx.comment,
    assetType: tx.assetType
  };
  if (tx.assetType === 'options') {
    bodyData['Expiry Date'] = tx.expiryDate || '';
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    });
    if (!response.ok) throw new Error('Network response not ok');
    showToast("🟢 Trade Synced to Local Server!");
  } catch (err) {
    console.error('Local server post failed:', err);
    showToast("Trade saved locally (Offline Mode)", true);
  }
}


async function pullCloudData() {
  const url = CLOUD_SPREADSHEET_CONFIG.endpointUrl;
  if (!url || url.includes("YOUR_API_URL")) return;

  try {
    await loadTickersDb();
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!response.ok) throw new Error('Network response error.');
    const data = await response.json();

    if (Array.isArray(data)) {
      const defaultTickerKeys = ['NVDA', 'AAPL', 'TSLA', 'NVDA $490 Call', 'AAPL $180 Call'];
      let marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');

      const parsedTxs = data.map(tx => {
        const ticker = String(getVal(tx, 'Symbol') || tx.ticker || '').trim().toUpperCase();
        let name = String(getVal(tx, 'Name') || tx.name || '').trim();
        if (!name) {
          name = resolveAssetName(ticker);
        }
        const action = String(getVal(tx, 'Action') || tx.action || 'BUY');
        const shares = parseInt(getVal(tx, 'Shares') || tx.shares || tx.quantity || 0, 10);
        const costBasis = parseFloat(getVal(tx, 'Price') || getVal(tx, 'CostBasis') || getVal(tx, 'Avg Price') || tx.price || 0);
        const rawCurrentPrice = parseFloat(getVal(tx, 'CurrentPrice') || tx.currentPrice || 0);
        const currentPrice = (rawCurrentPrice && rawCurrentPrice > 0) ? rawCurrentPrice : costBasis;
        const rawDate = getVal(tx, 'Date') || tx.date;
        const date = (rawDate && String(rawDate).trim()) ? String(rawDate).trim() : '2026-01-01T00:00:00.000Z';
        const comment = String(getVal(tx, 'Trade Journal Note') || tx.comment || tx.note || '');
        const stopLoss = parseFloat(getVal(tx, 'SL') || tx.stopLoss || tx.stopLimit || 0);

        let rawType = String(getVal(tx, 'Asset Type') || tx.assetType || 'Stock');
        let assetType = rawType.toLowerCase().includes('option') ? 'options' : 'stocks';
        if (rawType.toUpperCase() === 'CASH' || ticker === 'CASH') {
          assetType = 'CASH';
        } else {
          if (!rawType.toLowerCase().includes('option') && /\b(call|put)\b/i.test(ticker)) {
            assetType = 'options';
          }
        }

        if (ticker && assetType !== 'CASH') {
          marketPrices[ticker] = {
            name: name,
            currentPrice: currentPrice,
            change24h: parseFloat(tx.change24h || 0),
            icon: getVal(tx, 'Icon') || tx.icon || ticker.slice(0, 2).toUpperCase(),
            stopLoss: stopLoss
          };
        }

        return { ticker, assetType, action, shares, price: costBasis, date, comment, stopLoss };
      }).filter(tx => tx.ticker !== '');

      localStorage.setItem('portfolio_market_prices', JSON.stringify(marketPrices));
      localStorage.setItem('portfolio_transactions', JSON.stringify(parsedTxs));

      if (typeof updateDashboardUI === 'function') updateDashboardUI();
      if (typeof renderAssetLists === 'function') renderAssetLists();
      if (typeof renderLedgerTable === 'function') renderLedgerTable();
      if (typeof renderLedger === 'function') {
        const activeBtn = document.querySelector('.pill-btn.active');
        renderLedger(activeBtn ? activeBtn.getAttribute('data-range') : 'daily');
      }
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

// Expose helper to save note to local server (Quick-Comment Pipeline)
async function saveNoteToLocalServer(ticker, text) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}:${seconds}`;

  const payload = {
    ticker: ticker.trim().toUpperCase(),
    author: 'Admin',
    date: dateStr,
    time: timeStr,
    text: text
  };

  const response = await fetch(CLOUD_ENDPOINT.endpointUrl + 'notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response;
}

function initFormModeToggle() {
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  const modeInput = document.getElementById('formMode');
  const typeInput = document.getElementById('inputType');

  const groupTicker = document.getElementById('group-ticker');
  const groupAction = document.getElementById('group-action');
  const groupCashAction = document.getElementById('group-cash-action');
  const groupShares = document.getElementById('group-shares');
  const labelPrice = document.getElementById('labelPrice');
  const inputPrice = document.getElementById('inputPrice');
  const groupExpiry = document.getElementById('group-expiry');
  const groupOptionType = document.getElementById('group-option-type');
  const groupSl = document.getElementById('group-sl');
  const groupComment = document.getElementById('group-comment');

  const inputTicker = document.getElementById('inputTicker');
  const inputShares = document.getElementById('inputShares');
  const inputExpiry = document.getElementById('inputExpiry');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode');
      modeInput.value = mode;

      if (mode === 'stock') {
        typeInput.value = 'stocks';
        groupTicker.classList.remove('hidden');
        groupAction.classList.add('hidden');
        groupCashAction.classList.add('hidden');
        groupShares.classList.remove('hidden');
        labelPrice.textContent = 'Price ($)';
        inputPrice.placeholder = 'e.g. 485.00';
        groupExpiry.classList.add('hidden');
        if (groupOptionType) groupOptionType.classList.add('hidden');
        groupSl.classList.remove('hidden');
        groupComment.classList.remove('hidden');

        // Toggle required attributes
        inputTicker.required = true;
        inputShares.required = true;
        inputExpiry.required = false;
      } else if (mode === 'option') {
        typeInput.value = 'options';
        groupTicker.classList.remove('hidden');
        groupAction.classList.add('hidden');
        groupCashAction.classList.add('hidden');
        groupShares.classList.remove('hidden');
        labelPrice.textContent = 'Price ($)';
        inputPrice.placeholder = 'e.g. 18.50';
        groupExpiry.classList.remove('hidden');
        if (groupOptionType) groupOptionType.classList.remove('hidden');
        groupSl.classList.remove('hidden');
        groupComment.classList.remove('hidden');

        // Toggle required attributes
        inputTicker.required = true;
        inputShares.required = true;
        inputExpiry.required = true;
      } else if (mode === 'cash') {
        typeInput.value = 'CASH';
        groupTicker.classList.add('hidden');
        groupAction.classList.add('hidden');
        groupCashAction.classList.remove('hidden');
        groupShares.classList.add('hidden');
        labelPrice.textContent = 'Amount ($)';
        inputPrice.placeholder = 'e.g. 1000.00';
        groupExpiry.classList.add('hidden');
        if (groupOptionType) groupOptionType.classList.add('hidden');
        groupSl.classList.add('hidden');
        groupComment.classList.add('hidden');

        // Toggle required attributes
        inputTicker.required = false;
        inputShares.required = false;
        inputExpiry.required = false;
      }
    });
  });
}

async function pushCashToCloud(tx) {
  try {
    const activeUser = typeof window.getSessionUser === 'function' ? window.getSessionUser() : 'Admin';
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
        author: activeUser || 'Admin'
      })
    });
    if (!response.ok) throw new Error('Network response not ok');
    showToast("🟢 Cash Transaction Synced!");
  } catch (err) {
    console.error('Local server cash post failed:', err);
    showToast("Cash transaction saved locally (Offline)", true);
  }
}
