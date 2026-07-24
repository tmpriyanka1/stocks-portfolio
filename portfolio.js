/**
 * PORTFOLIO.JS - Main Dashboard & Real-Time Valuation UI
 * 
 * CODE FLOW & ARCHITECTURE:
 * 1. INITIALIZATION: On DOM Load, verifies user authentication and sets up the global UI event listeners.
 * 2. DATA HYDRATION: Calls `pullCloudData()` to fetch the user's latest transaction history and cash ledger from the Node backend.
 * 3. ASSET AGGREGATION: Processes all transactions to build a live map of current open positions, active shares, and cost basis for both Stocks and Options.
 * 4. LIVE PRICING POLLER: Fires off periodically to fetch the latest stock/options prices from the Unusual Whales proxy in server.js. Maps OSI symbols correctly.
 * 5. PORTFOLIO CALCULATION: Combines open positions with live market prices to calculate unrealized/realized P&L, daily changes, buying power, and total net liquidity.
 * 6. UI RENDERER: Updates the DOM with glassmorphic cards, dynamic progress bars, and the main asset table based on calculated metrics..
 */
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_BACKEND_URL = isLocalhost ? 'http://127.0.0.1:5001/api/' : '/api/';

const LOCAL_BACKEND_CONFIG = {
  endpointUrl: BASE_BACKEND_URL + "trades"
};

const CLOUD_ENDPOINT = {
  endpointUrl: BASE_BACKEND_URL
};


// Tracks the currently-active filter pill ('all', 'stocks', 'options')
// so background cloud pulls and refresh always re-render the correct view
let activeFilterMode = 'all';

const defaultAssetData = {
  'NVDA': { name: 'NVIDIA Corporation', currentPrice: 485.00, stopLoss: 380.00, change24h: 3.25, icon: 'NV' },
  'AAPL': { name: 'Apple Inc.', currentPrice: 175.50, stopLoss: 150.00, change24h: 1.92, icon: 'AP' },
  'TSLA': { name: 'Tesla Inc.', currentPrice: 198.20, stopLoss: 185.00, change24h: -2.17, icon: 'TS' },
  'SPY': { name: 'SPDR S&P 500 ETF Trust', currentPrice: 753.00, stopLoss: 490.00, change24h: 0.45, icon: 'SP' },
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

function getDefaultAsset(ticker) {
  if (!ticker) return undefined;
  const upper = ticker.trim().toUpperCase();
  for (const k in defaultAssetData) {
    if (k.toUpperCase() === upper) {
      return defaultAssetData[k];
    }
  }
  return undefined;
}

function resolveAssetName(ticker) {
  const capitalized = ticker.trim().toUpperCase();

  let marketPrices = {};
  try {
    marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
  } catch (e) { }

  if (marketPrices[capitalized] && marketPrices[capitalized].name && marketPrices[capitalized].name !== capitalized) {
    return marketPrices[capitalized].name;
  }

  const defaultEntry = getDefaultAsset(capitalized);
  if (defaultEntry && defaultEntry.name) {
    return defaultEntry.name;
  }
  if (tickersDb && tickersDb[capitalized]) {
    return tickersDb[capitalized];
  }

  // Try matching option underlying ticker
  const isOption = ticker.includes('@') || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
  if (isOption) {
    const underlying = ticker.split(/[\s$@]/)[0].toUpperCase();
    if (marketPrices[underlying] && marketPrices[underlying].name) {
      return marketPrices[underlying].name;
    }
    const underlyingEntry = getDefaultAsset(underlying);
    if (underlyingEntry && underlyingEntry.name) {
      return underlyingEntry.name;
    }
    if (tickersDb && tickersDb[underlying]) {
      return tickersDb[underlying];
    }
  }

  // Fallback to extraction from regex
  const underlyingMatch = ticker.match(/^([A-Za-z]+)/);
  if (underlyingMatch) {
    const underlying = underlyingMatch[1].toUpperCase();
    if (marketPrices[underlying] && marketPrices[underlying].name) {
      return marketPrices[underlying].name;
    }
    const underlyingEntry = getDefaultAsset(underlying);
    if (underlyingEntry && underlyingEntry.name) {
      return underlyingEntry.name;
    }
    if (tickersDb && tickersDb[underlying]) {
      return tickersDb[underlying];
    }
  }

  return capitalized;
}

// 1. CORE DASHBOARD STATE ARRAY: global hardcoded portfolio asset array
let portfolioAssets = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    type: 'stocks',
    shares: 40,
    avgCost: 400.00,
    currentPrice: 485.00,
    stopLoss: 380.00,
    change24h: 3.25,
    icon: 'NV'
  },
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    type: 'stocks',
    shares: 250,
    avgCost: 165.00,
    currentPrice: 175.50,
    stopLoss: 150.00,
    change24h: 1.92,
    icon: 'AP'
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    type: 'stocks',
    shares: 85,
    avgCost: 210.00,
    currentPrice: 198.20,
    stopLoss: 185.00,
    change24h: -2.17,
    icon: 'TS'
  },
  {
    ticker: 'NVDA $490 Call',
    name: 'Exp 07/16/26 • Buy to Open',
    type: 'options',
    shares: 3,
    avgCost: 15.20,
    currentPrice: 18.50,
    stopLoss: 12.00,
    change24h: 20.31,
    icon: 'OC'
  },
  {
    ticker: 'AAPL $180 Call',
    name: 'Exp 06/18/26 • Buy to Open',
    type: 'options',
    shares: 2,
    avgCost: 5.50,
    currentPrice: 4.80,
    stopLoss: 4.00,
    change24h: -13.43,
    icon: 'OC'
  }
];

// 2. MOCK SPARKLINE HISTORY DATA (for mini graphs)
const sparklineData = {
  'NVDA': [420, 435, 430, 460, 480, 485],
  'AAPL': [160, 163, 168, 172, 174, 175.50],
  'TSLA': [215, 212, 208, 195, 202, 198.20],
  'NVDA $490 Call': [10.5, 12.0, 11.5, 14.0, 16.5, 18.50],
  'AAPL $180 Call': [7.2, 6.8, 5.5, 5.0, 5.2, 4.80]
};

/**
 * Generates an SVG path string from an array of numeric data points
 */
function generateSparklinePath(points, width, height) {
  if (!points || points.length === 0) return '';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min === 0 ? 1 : max - min;

  return points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    // Invert y axis for SVG coordinates
    const y = height - ((p - min) / range) * height;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

const CACHE_VERSION = '2.6';
if (localStorage.getItem('cache_version') !== CACHE_VERSION) {
  localStorage.removeItem('portfolio_market_prices');
  localStorage.setItem('cache_version', CACHE_VERSION);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Apply saved color theme
  const savedAccent = localStorage.getItem('portfolio_accent_color');
  if (savedAccent) {
    applyAccentColor(savedAccent);
  }

  // Display user name in header
  const usernameDisplay = document.getElementById('header-username-display');
  if (usernameDisplay) {
    usernameDisplay.textContent = typeof window.getSessionUser === 'function' ? window.getSessionUser() : 'Admin';
  }

  // ── Load server-persisted overrides into localStorage FIRST ──────────────
  // This fixes buying power showing $0.00 on reload: the server stores the
  // canonical override values (startingCash, buyingPowerOverride) and we must
  // hydrate localStorage before any calculation runs.
  fetch(CLOUD_ENDPOINT.endpointUrl + "overrides")
    .then(r => r.ok ? r.json() : null)
    .then(overrides => {
      if (overrides) {
        if (overrides.buyingPowerOverride !== null && overrides.buyingPowerOverride !== undefined && !isNaN(parseFloat(overrides.buyingPowerOverride))) {
          localStorage.setItem('portfolio_buying_power_user_set', 'true');
          localStorage.setItem('portfolio_buying_power', parseFloat(overrides.buyingPowerOverride).toFixed(2));
          if (overrides.buyingPowerOverrideTimestamp) {
            localStorage.setItem('portfolio_buying_power_timestamp', overrides.buyingPowerOverrideTimestamp);
          } else {
            localStorage.removeItem('portfolio_buying_power_timestamp');
          }
        } else {
          localStorage.removeItem('portfolio_buying_power_user_set');
          localStorage.removeItem('portfolio_buying_power');
          localStorage.removeItem('portfolio_buying_power_timestamp');
        }
        if (overrides.portfolioValueOverride && String(overrides.portfolioValueOverride).trim() !== '') {
          localStorage.setItem('portfolio_value_override', String(overrides.portfolioValueOverride).trim());
        } else {
          localStorage.removeItem('portfolio_value_override');
        }
      }
    })
    .catch(() => {/* offline — use whatever is in localStorage */ })
    .finally(() => {
      // Load tickers DB, then refresh and render
      loadTickersDb().then(() => {
        rebootDashboard();
      });
    });

  // Initialize comment popup modal
  initCommentModal();

  // Initialize quick trade (Buy/Sell) popup modal
  initQuickTradeModal();

  // Initialize edit asset popup modal
  initEditAssetModal();

  // Background Cloud Spreadsheet Pull
  pullCloudData().then(() => {
    startLivePriceEngine();
  });
});

async function pullCloudData() {
  const url = LOCAL_BACKEND_CONFIG.endpointUrl;
  if (!url || url.includes("YOUR_API_URL")) return;

  try {
    await loadTickersDb();
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) throw new Error('Network response error.');
    const data = await response.json();

    if (Array.isArray(data)) {
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
        // Only use CurrentPrice if it's a real live price (> 0 and explicitly provided).
        // Do NOT fall back to costBasis here — that causes avg cost to appear as live price on refresh.
        const rawCurrentPrice = parseFloat(getVal(tx, 'CurrentPrice') || tx.currentPrice || 0);
        const hasRealPrice = rawCurrentPrice && rawCurrentPrice > 0;
        const rawDate = getVal(tx, 'Date') || tx.date;
        const date = (rawDate && String(rawDate).trim()) ? String(rawDate).trim() : '2026-01-01T00:00:00.000Z';
        const comment = String(getVal(tx, 'Trade Journal Note') || tx.comment || tx.note || '');
        const stopLoss = parseFloat(getVal(tx, 'SL') || tx.stopLoss || tx.stopLimit || 0);

        let rawType = String(getVal(tx, 'Asset Type') || tx.assetType || 'Stock');
        let assetType = rawType.toLowerCase().includes('option') ? 'options' : 'stocks';
        if (rawType.toUpperCase() === 'CASH' || ticker === 'CASH') {
          assetType = 'CASH';
        } else {
          // Also auto-detect options from the symbol itself (e.g. "SPY $723 CALL 6/11")
          if (!rawType.toLowerCase().includes('option') && /\b(call|put)\b/i.test(ticker)) {
            assetType = 'options';
          }
        }

        if (ticker && assetType !== 'CASH') {
          // Only write currentPrice to marketPrices if it's a genuinely fetched live price.
          // Omitting currentPrice here means updateLivePrices() will fetch real market data instead.
          const priceEntry = {
            name: name,
            change24h: parseFloat(getVal(tx, 'change24h') || tx.change24h || 0),
            icon: getVal(tx, 'Icon') || tx.icon || ticker.slice(0, 2).toUpperCase(),
            stopLoss: stopLoss
          };
          if (hasRealPrice) {
            priceEntry.currentPrice = rawCurrentPrice;
          }
          // Preserve existing live price if we already have one in cache
          const existing = marketPrices[ticker];
          if (existing && existing.currentPrice && !hasRealPrice) {
            priceEntry.currentPrice = existing.currentPrice;
          }
          marketPrices[ticker] = priceEntry;
        }

        const expiryDate = tx['Expiry Date'] || tx.expiryDate || tx.expiry || '';
        return { ticker, assetType, action, shares, price: costBasis, date, comment, stopLoss, expiryDate };
      }).filter(tx => tx.ticker !== '');

      localStorage.setItem('portfolio_market_prices', JSON.stringify(marketPrices));
      localStorage.setItem('portfolio_transactions', JSON.stringify(parsedTxs));

      // ── BUYING POWER BASELINE: derive from cash ledger and trades ─
      // Fetch and save cash transactions
      let cashTxs = [];
      try {
        const cashUrl = url.replace('/trades', '/cash');
        const cashResponse = await fetch(cashUrl, { method: 'GET' });
        if (cashResponse.ok) {
          cashTxs = await cashResponse.json();
          localStorage.setItem('portfolio_cash_ledger', JSON.stringify(cashTxs));
        }
      } catch (cashErr) {
        console.warn('Failed to fetch cash ledger from server:', cashErr);
        try {
          cashTxs = JSON.parse(localStorage.getItem('portfolio_cash_ledger') || '[]');
        } catch (e) {
          cashTxs = [];
        }
      }

      let dynamicCash = 0;
      cashTxs.forEach(tx => {
        if (!tx) return;
        const action = String(tx.action || '').toUpperCase();
        const amount = parseFloat(tx.price) || 0;
        if (action === 'DEPOSIT') {
          dynamicCash += amount;
        } else if (action === 'WITHDRAWAL') {
          dynamicCash -= amount;
        }
      });

      parsedTxs.forEach(tx => {
        if (!tx || !tx.ticker) return;
        if (tx.ticker === 'CASH' || tx.assetType === 'CASH') return;
        const action = String(tx.action || '').toUpperCase();
        const sharesNum = parseFloat(tx.shares) || 0;
        const priceNum = parseFloat(tx.price) || 0;
        const isOpt = tx.assetType === 'options' || (/\$\d/.test(tx.ticker) && /\b(call|put)\b/i.test(tx.ticker));
        const multiplier = isOpt ? 100 : 1;
        const cost = sharesNum * priceNum * multiplier;

        if (action === 'BUY') {
          dynamicCash -= cost;
        } else if (action === 'SELL') {
          dynamicCash += cost;
        }
      });

      const isUserSet = localStorage.getItem('portfolio_buying_power_user_set') === 'true';
      // When an override is active, portfolio_buying_power is the canonical balance
      // maintained by executeCashAdjustment and the server /api/overrides endpoint.
      // DO NOT recalculate it here — that would overwrite the correct override value.
      // Only derive buying power from dynamicCash when no override is set.
      if (!isUserSet) {
        const buyingPower = Math.max(0, dynamicCash);
        localStorage.setItem('portfolio_buying_power', buyingPower.toFixed(2));
      }
      // ─────────────────────────────────────────────────────────────────────

      // Re-render using the currently-active filter pill to preserve the user's view
      refreshPortfolioAssets();
      updateBalanceMetrics();
      renderAssetsTable(activeFilterMode);
    }
  } catch (err) {
    console.error('Background pull failed:', err);
  }
}


function rebootDashboard() {
  refreshPortfolioAssets();
  updateBalanceMetrics();
  initNavigation();
  initFilters();
  initManualRefreshBtn();

  // Render full portfolio instantly from local cache on load
  activeFilterMode = 'all';
  renderAssetsTable('all');
  initNotificationToggle();
  initCSVImporter();
}

function applyAccentColor(hexColor) {
  document.documentElement.style.setProperty('--accent', hexColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
}

function initCSVImporter() {
  const openImportBtn = document.getElementById('openImportBtn');
  const importModal = document.getElementById('importModal');
  const closeImportBtn = document.getElementById('closeImportBtn');
  const cancelImportBtn = document.getElementById('cancelImportBtn');
  const processImportBtn = document.getElementById('processImportBtn');
  const csvTextarea = document.getElementById('csvTextarea');

  if (!importModal) return;

  const openModal = () => {
    importModal.classList.add('active');
  };

  const closeModal = () => {
    importModal.classList.remove('active');
    if (csvTextarea) csvTextarea.value = '';
  };

  if (openImportBtn) openImportBtn.addEventListener('click', openModal);
  if (closeImportBtn) closeImportBtn.addEventListener('click', closeModal);
  if (cancelImportBtn) cancelImportBtn.addEventListener('click', closeModal);

  if (processImportBtn && csvTextarea) {
    processImportBtn.addEventListener('click', () => {
      const csvText = csvTextarea.value;
      if (!csvText.trim()) {
        showToast('⚠️ CSV content cannot be empty.', true);
        return;
      }

      try {
        const lines = csvText.split('\n');
        let txs = [];
        const stored = localStorage.getItem('portfolio_transactions');
        if (stored) {
          try {
            txs = JSON.parse(stored);
          } catch (e) {
            txs = [];
          }
        } else {
          // Fallback default mock list if never initialized
          txs = [
            { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480.00, date: '2026-06-03T10:15:00', comment: 'Momentum breakout buy after consolidation at $478.' },
            { ticker: 'NVDA', assetType: 'stocks', action: 'SELL', shares: 10, price: 495.00, date: '2026-06-03T14:30:00', comment: 'Quick day trade scalp target hit. Captured +$15.00/share profit.' },
            { ticker: 'PLTR', assetType: 'stocks', action: 'BUY', shares: 50, price: 21.00, date: '2026-06-03T09:45:00', comment: 'Support level bounce entry. Adding PLTR for core options setup.' },
            { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 30, price: 170.00, date: '2026-05-30T11:00:00', comment: 'Adding to core Apple position on temporary market-wide pullback.' },
            { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 20, price: 172.00, date: '2026-05-31T13:45:00', comment: 'Averaging up on clear hourly trend confirmation and high volume.' },
            { ticker: 'AAPL', assetType: 'SELL', shares: 50, price: 178.00, date: '2026-06-01T15:30:00', comment: 'Closed full Apple swing trade. Locked in solid gains ahead of WWDC.' },
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

        let marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
        let importCount = 0;

        // Ticker map of default hardcoded assets to filter them out of 'portfolio_market_prices' lookup key
        const defaultTickerKeys = ['NVDA', 'AAPL', 'TSLA', 'NVDA $490 Call', 'AAPL $180 Call'];

        lines.forEach((line, index) => {
          if (!line.trim()) return;
          // Skip header if it is header row
          if (index === 0 && line.toLowerCase().includes('symbol')) return;

          const parts = line.split(',');
          if (parts.length < 7) return;

          const symbol = parts[0].trim().toUpperCase();
          const name = parts[1].trim();
          const shares = parseInt(parts[2].trim(), 10);
          const costBasis = parseFloat(parts[3].trim());
          const currentPrice = parseFloat(parts[4].trim());
          const type = parts[5].trim().toLowerCase();
          const icon = parts[6].trim();

          if (!symbol || isNaN(shares) || isNaN(costBasis) || isNaN(currentPrice)) return;

          // Push into the transaction ledger
          const tx = {
            ticker: symbol,
            assetType: type,
            action: 'BUY',
            shares: shares,
            price: costBasis,
            date: new Date().toISOString().slice(0, 19),
            comment: 'CSV Portfolio Import'
          };
          txs.push(tx);

          // Lock custom metadata to 'portfolio_market_prices' dictionary only if not hardcoded asset
          if (!defaultTickerKeys.includes(symbol)) {
            marketPrices[symbol] = {
              name: name,
              currentPrice: currentPrice,
              change24h: 0.0,
              icon: icon || symbol.slice(0, 2).toUpperCase()
            };
          }
          importCount++;
        });

        if (importCount === 0) {
          showToast('⚠️ No valid rows found to import.', true);
          return;
        }

        localStorage.setItem('portfolio_transactions', JSON.stringify(txs));
        localStorage.setItem('portfolio_market_prices', JSON.stringify(marketPrices));

        closeModal();

        // 4. AUTOMATIC RECALCULATION & DASHBOARD REBOOT
        refreshPortfolioAssets();
        updateBalanceMetrics();
        renderAssetsTable('all');

        showToast(`🟢 Successfully parsed & loaded ${importCount} assets!`);
      } catch (err) {
        console.error(err);
        showToast('⚠️ Error parsing CSV spreadsheet data.', true);
      }
    });
  }
}

function refreshPortfolioAssets() {
  // Retrieve transactions from storage
  let txs = [];
  const stored = localStorage.getItem('portfolio_transactions');
  if (stored) {
    try {
      txs = JSON.parse(stored);
    } catch (e) {
      txs = [];
    }
  } else {
    // If not in storage yet, seed with initial list
    txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480.00, date: '2026-06-03T10:15:00', comment: 'Momentum breakout buy after consolidation at $478.' },
      { ticker: 'NVDA', assetType: 'stocks', action: 'SELL', shares: 10, price: 495.00, date: '2026-06-03T14:30:00', comment: 'Quick day trade scalp target hit. Captured +$15.00/share profit.' },
      { ticker: 'PLTR', assetType: 'stocks', action: 'BUY', shares: 50, price: 21.00, date: '2026-06-03T09:45:00', comment: 'Support level bounce entry. Adding PLTR for core options setup.' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 30, price: 170.00, date: '2026-05-30T11:00:00', comment: 'Adding to core Apple position on temporary market-wide pullback.' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 20, price: 172.00, date: '2026-05-31T13:45:00', comment: 'Averaging up on clear hourly trend confirmation and high volume.' },
      { ticker: 'AAPL', assetType: 'SELL', shares: 50, price: 178.00, date: '2026-06-01T15:30:00', comment: 'Closed full Apple swing trade. Locked in solid gains ahead of WWDC.' },
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
    localStorage.setItem('portfolio_transactions', JSON.stringify(txs));
  }

  // Aggregate holdings
  const groups = {};

  txs.forEach(tx => {
    if (!tx || !tx.ticker) return;
    if (tx.ticker === 'CASH' || tx.assetType === 'CASH') return;
    if (!groups[tx.ticker]) {
      groups[tx.ticker] = {
        ticker: tx.ticker,
        type: tx.assetType,
        shares: 0,
        avgCost: 0,
        lastPrice: tx.price,
        expiryDate: tx.expiryDate || tx['Expiry Date'] || '',
        comment: tx.comment || ''
      };
    }
    const g = groups[tx.ticker];
    g.lastPrice = tx.price;
    if (tx.expiryDate || tx['Expiry Date']) {
      g.expiryDate = tx.expiryDate || tx['Expiry Date'];
    }
    if (tx.comment) {
      g.comment = tx.comment;
    }
    if (tx.action === 'BUY') {
      const newShares = g.shares + tx.shares;
      if (newShares > 0) {
        g.avgCost = (g.shares * g.avgCost + tx.shares * tx.price) / newShares;
      }
      g.shares = newShares;
    } else if (tx.action === 'SELL') {
      g.shares = Math.max(0, g.shares - tx.shares);
    }
  });

  // Convert to assets array
  portfolioAssets = [];
  let customSLMap = {};
  try {
    customSLMap = JSON.parse(localStorage.getItem('portfolio_custom_sl') || '{}');
  } catch (e) {
    customSLMap = {};
  }

  for (const ticker in groups) {
    const g = groups[ticker];
    if (g.shares > 0) {
      const isOpt = g.type === 'options' || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
      let customPrices = {};
      try {
        customPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
      } catch (e) {
        customPrices = {};
      }
      const customDetails = customPrices[ticker] || {};

      let assetDetails = getDefaultAsset(ticker);
      if (assetDetails) {
        assetDetails = { ...assetDetails, ...customDetails };
      } else {
        assetDetails = customDetails;
        if (!assetDetails || !assetDetails.name) {
          assetDetails = {
            name: resolveAssetName(ticker),
            currentPrice: g.lastPrice,
            change24h: 0.0,
            icon: ticker.slice(0, 2).toUpperCase(),
            ...customDetails
          };
        }
      }

      let stopLossVal = 0;
      if (customSLMap[ticker] !== undefined) {
        stopLossVal = parseFloat(customSLMap[ticker]);
      } else if (assetDetails && assetDetails.stopLoss) {
        stopLossVal = assetDetails.stopLoss;
      }

      portfolioAssets.push({
        ticker: g.ticker || '',
        name: assetDetails.name || g.ticker,
        type: g.type || 'stocks',
        shares: Number(g.shares) || 0,
        avgCost: Number(g.avgCost) || 0,
        currentPrice: Number(assetDetails.currentPrice) || Number(g.lastPrice) || 0,
        stopLoss: Number(stopLossVal) || 0,
        change24h: Number(assetDetails.change24h) || 0,
        icon: assetDetails.icon || g.ticker.slice(0, 2).toUpperCase(),
        expiryDate: g.expiryDate || '',
        comment: g.comment || ''
      });
    }
  }
}

/**
 * Calculates and updates top portfolio balance card metrics dynamically.
 *
 * EQUITY ENGINE — uses raw transactions from localStorage plus live prices
 * from portfolio_market_prices so the ×100 options multiplier is always
 * applied on the correct cost-basis, not the pre-aggregated portfolioAssets.
 *
 * Portfolio Value  = Σ (shares × livePrice × multiplier)   per open position
 * Net Total        = buyingPowerBaseline (cash) + totalAssetEquity
 * Buying Power     = cash portion stored in portfolio_buying_power
 */
function updateBalanceMetrics() {
  const balanceCard = document.querySelector('.balance-card');
  const balanceAmountEl = document.querySelector('.balance-amount');
  const balanceChangeEl = document.querySelector('.balance-change');
  const activeOptionsEl = document.getElementById('active-options-value');

  if (!balanceAmountEl || !balanceChangeEl) return;

  // ── 1. LOAD RAW DATA SOURCES ─────────────────────────────────────────────
  let localTransactions = [];
  try {
    localTransactions = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]');
  } catch (e) {
    localTransactions = [];
  }

  let marketPrices = {};
  try {
    marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
  } catch (e) {
    marketPrices = {};
  }

  // ── 2. AGGREGATE OPEN POSITIONS (BUY-net shares per ticker) ──────────────
  const openPositions = {}; // ticker → { shares, assetType, avgCost }
  localTransactions.forEach(tx => {
    if (!tx || !tx.ticker) return;
    if (tx.ticker === 'CASH' || tx.assetType === 'CASH') return;
    if (!openPositions[tx.ticker]) {
      openPositions[tx.ticker] = { shares: 0, assetType: tx.assetType || 'stocks', avgCost: 0 };
    }
    const pos = openPositions[tx.ticker];
    const sharesNum = Number(tx.shares) || 0;
    const priceNum = parseFloat(tx.price) || 0;
    if (tx.action === 'BUY') {
      if (pos.shares < 0) {
        // Covering a short
        pos.shares += sharesNum;
        if (pos.shares > 0) {
          pos.avgCost = priceNum; // Flipped to long
        } else if (pos.shares === 0) {
          pos.avgCost = 0;
        }
      } else {
        // Adding to long
        const newShares = pos.shares + sharesNum;
        if (newShares > 0) {
          pos.avgCost = (pos.shares * pos.avgCost + sharesNum * priceNum) / newShares;
        }
        pos.shares = newShares;
      }
    } else if (tx.action === 'SELL') {
      if (pos.shares > 0) {
        // Closing a long
        pos.shares -= sharesNum;
        if (pos.shares < 0) {
          pos.avgCost = priceNum; // Flipped to short
        } else if (pos.shares === 0) {
          pos.avgCost = 0;
        }
      } else {
        // Adding to short
        const currentShortShares = Math.abs(pos.shares);
        const newShortShares = currentShortShares + sharesNum;
        if (newShortShares > 0) {
          pos.avgCost = (currentShortShares * pos.avgCost + sharesNum * priceNum) / newShortShares;
        }
        pos.shares -= sharesNum;
      }
    }
  });

  // ── 3. COMPUTE TOTAL ASSET EQUITY (options ×100, stocks ×1) ──────────────
  let totalAssetEquity = 0;
  let totalPrevEquity = 0;
  let optionContractsCount = 0;

  for (const ticker in openPositions) {
    if (ticker === 'CASH') continue;
    const pos = openPositions[ticker];
    if (pos.shares === 0) continue;

    // Resolve live price: cloud marketPrices → defaultAssetData → avgCost fallback
    const marketEntry = marketPrices[ticker] || getDefaultAsset(ticker) || {};
    const currentPrice = parseFloat(marketEntry.currentPrice) || pos.avgCost || 0;
    const change24h = parseFloat(marketEntry.change24h) || 0;

    // Dual-source options detection: explicit assetType field OR ticker pattern
    const isOpt = pos.assetType === 'options'
      || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
    const multiplier = isOpt ? 100 : 1;

    const isShort = Number(pos.shares) < 0;
    const activeShares = Math.abs(Number(pos.shares));
    const rawAssetValue = activeShares * parseFloat(currentPrice) * multiplier;

    if (isShort) {
      totalAssetEquity -= rawAssetValue;
    } else {
      totalAssetEquity += rawAssetValue;
    }

    // Previous-day estimate for today's change display
    let prevValue = 0;
    if (isShort) {
      prevValue = -(rawAssetValue / (1 + change24h / 100));
    } else {
      prevValue = (rawAssetValue / (1 + change24h / 100));
    }

    totalPrevEquity += prevValue;

    if (isOpt) optionContractsCount += activeShares;
  }

  // ── 4. NET PORTFOLIO VALUE = CASH (buying power) + OPEN POSITION EQUITY ──
  // Option B Implementation: Override is the true LIVE cash balance at the exact moment it was saved.
  let baseCashStr = localStorage.getItem('portfolio_buying_power');
  let bpTimestampStr = localStorage.getItem('portfolio_buying_power_timestamp');
  
  let baseCash = parseFloat(baseCashStr);
  let bpTimestamp = null;

  if (isNaN(baseCash)) {
    baseCash = 0; // No override set
  } else if (bpTimestampStr) {
    bpTimestamp = new Date(bpTimestampStr);
  }
  
  let cashTxs = [];
  try {
    cashTxs = JSON.parse(localStorage.getItem('portfolio_cash_ledger') || '[]');
  } catch (e) { cashTxs = []; }

  let dynamicCash = baseCash;
  
  cashTxs.forEach(tx => {
    if (!tx) return;
    // Skip transactions logged before the override timestamp
    if (bpTimestamp && tx.date && new Date(tx.date) <= bpTimestamp) return;

    const action = String(tx.action || '').toUpperCase();
    const amount = parseFloat(tx.price) || 0;
    if (action === 'DEPOSIT') dynamicCash += amount;
    else if (action === 'WITHDRAWAL') dynamicCash -= amount;
  });
  
  localTransactions.forEach(tx => {
    if (!tx || !tx.ticker) return;
    if (tx.ticker === 'CASH' || tx.assetType === 'CASH') return;
    // Skip trade cash flow that occurred before the override timestamp
    if (bpTimestamp && tx.date && new Date(tx.date) <= bpTimestamp) return;

    const action = String(tx.action || '').toUpperCase();
    const sharesNum = parseFloat(tx.shares) || 0;
    const priceNum = parseFloat(tx.price) || 0;
    const isOpt = tx.assetType === 'options' || (/\$\d/.test(tx.ticker) && /\b(call|put)\b/i.test(tx.ticker));
    const cost = sharesNum * priceNum * (isOpt ? 100 : 1);
    if (action === 'BUY') dynamicCash -= cost;
    else if (action === 'SELL') dynamicCash += cost;
  });
  
  let buyingPower = Math.max(0, dynamicCash);

  // Calculate Unrealized P&L and Realized P&L (FIFO queue method)
  let unrealizedPL = 0;
  for (const ticker in openPositions) {
    if (ticker === 'CASH') continue;
    const pos = openPositions[ticker];
    if (pos.shares === 0) continue;
    const marketEntry = marketPrices[ticker] || getDefaultAsset(ticker) || {};
    const currentPrice = parseFloat(marketEntry.currentPrice) || pos.avgCost || 0;
    const isOpt = pos.assetType === 'options' || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
    const multiplier = isOpt ? 100 : 1;

    const isShort = pos.shares < 0;
    const activeShares = Math.abs(pos.shares);
    if (isShort) {
      unrealizedPL += activeShares * (pos.avgCost - currentPrice) * multiplier;
    } else {
      unrealizedPL += activeShares * (currentPrice - pos.avgCost) * multiplier;
    }
  }

  let realizedPL = 0;
  const longQueues = {}; // ticker -> array of { shares, price }
  const shortQueues = {}; // ticker -> array of { shares, price }
  const sortedTxs = localTransactions.slice().sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedTxs.forEach(tx => {
    if (!tx || !tx.ticker) return;
    if (tx.ticker === 'CASH' || tx.assetType === 'CASH') return;

    const ticker = tx.ticker.toUpperCase();
    const action = tx.action ? tx.action.toUpperCase() : 'BUY';
    const sharesNum = parseFloat(tx.shares) || 0;
    const priceNum = parseFloat(tx.price) || 0;
    const isOpt = tx.assetType === 'options' || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
    const multiplier = isOpt ? 100 : 1;

    if (!longQueues[ticker]) longQueues[ticker] = [];
    if (!shortQueues[ticker]) shortQueues[ticker] = [];

    if (action === 'BUY') {
      let remainingToCover = sharesNum;
      let coverPnL = 0;

      while (remainingToCover > 0 && shortQueues[ticker].length > 0) {
        const oldestShort = shortQueues[ticker][0];
        if (oldestShort.shares <= remainingToCover) {
          // Explicit formula: Covered Shares * (Initial Short Sale Price of Oldest Available Short - Current Buy-back Execution Price) * Multiplier
          coverPnL += oldestShort.shares * (oldestShort.price - priceNum) * multiplier;
          remainingToCover -= oldestShort.shares;
          shortQueues[ticker].shift();
        } else {
          coverPnL += remainingToCover * (oldestShort.price - priceNum) * multiplier;
          oldestShort.shares -= remainingToCover;
          remainingToCover = 0;
        }
      }
      realizedPL += coverPnL;

      if (remainingToCover > 0) {
        longQueues[ticker].push({ shares: remainingToCover, price: priceNum });
      }
    } else if (action === 'SELL') {
      let remainingToSell = sharesNum;
      let sellPnL = 0;

      while (remainingToSell > 0 && longQueues[ticker].length > 0) {
        const oldestLong = longQueues[ticker][0];
        if (oldestLong.shares <= remainingToSell) {
          sellPnL += oldestLong.shares * (priceNum - oldestLong.price) * multiplier; // Standard
          remainingToSell -= oldestLong.shares;
          longQueues[ticker].shift();
        } else {
          sellPnL += remainingToSell * (priceNum - oldestLong.price) * multiplier; // Standard
          oldestLong.shares -= remainingToSell;
          remainingToSell = 0;
        }
      }
      realizedPL += sellPnL;

      if (remainingToSell > 0) {
        shortQueues[ticker].push({ shares: remainingToSell, price: priceNum });
      }
    }
  });

  // Options Expiration Realization Safeguard
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const processExpiration = (queues, isShort) => {
    Object.keys(queues).forEach(ticker => {
      const q = queues[ticker];
      if (q.length === 0) return;
      const isOpt = /\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker);
      if (!isOpt) return;

      const pos = openPositions[ticker];
      let expiryStr = pos ? pos.expiryDate : null;
      if (!expiryStr) {
        expiryStr = getOptionExpiry(ticker, null);
      }
      if (!expiryStr) {
        const match = ticker.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
        if (match) expiryStr = match[1];
      }

      if (expiryStr) {
        const expDate = new Date(expiryStr);
        if (expDate < todayDate) {
          let expirationPnL = 0;
          q.forEach(layer => {
            if (isShort) {
              // Expired Shorts Profit = Contracts * Initial Short Premium Received * 100
              expirationPnL += layer.shares * layer.price * 100;
            } else {
              // Bought long, expires at $0.00
              expirationPnL += layer.shares * (0 - layer.price) * 100;
            }
          });
          realizedPL += expirationPnL;
          q.length = 0; // Clear the queue

          // Force remove from openPositions to avoid hanging active equity
          if (pos) pos.shares = 0;
        }
      }
    });
  };

  processExpiration(longQueues, false);
  processExpiration(shortQueues, true);

  // IF the Master Portfolio Value Override input is set (not blank/empty):
  // Set Total Portfolio Value directly to that forced override number.
  // IF the Master Portfolio Value Override input is left BLANK (default live mode):
  // Calculate Total Portfolio Value dynamically as:
  // Total Portfolio Value = currentBuyingPower + Total Live Market Value of Open Positions.
  const portfolioValueOverride = localStorage.getItem('portfolio_value_override');
  const hasValueOverride = portfolioValueOverride !== null && portfolioValueOverride.trim() !== '';
  const netPortfolioValue = hasValueOverride
    ? parseFloat(portfolioValueOverride.trim())
    : buyingPower + totalAssetEquity;

  // ── 5. RENDER BALANCE CARD ────────────────────────────────────────────────
  const formattedBalance = hasValueOverride
    ? portfolioValueOverride.trim()
    : '$' + netPortfolioValue.toFixed(2);
  const formattedBP = '$' + buyingPower.toFixed(2);

  balanceAmountEl.textContent = formattedBalance;
  const totalBalanceEl2 = document.getElementById('total-balance');
  if (totalBalanceEl2) {
    totalBalanceEl2.textContent = formattedBalance;
  }

  const yesterdayNetPortfolioValue = totalPrevEquity + buyingPower;
  const totalChange = netPortfolioValue - yesterdayNetPortfolioValue;
  const denominator = yesterdayNetPortfolioValue;
  const totalChangePct = denominator > 0 ? (totalChange / denominator) * 100 : 0;
  const isPositive = totalChange >= 0;

  balanceChangeEl.className = `balance-change ${isPositive ? 'positive' : 'negative'}`;

  if (balanceCard) {
    balanceCard.classList.toggle('profit', isPositive);
    balanceCard.classList.toggle('loss', !isPositive);
  }

  const formattedChangeStr = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always'
  }).format(totalChange);

  const arrowSvg = isPositive
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  balanceChangeEl.innerHTML = `
    ${arrowSvg}
    <span>${formattedChangeStr} (${isPositive ? '+' : ''}${totalChangePct.toFixed(2)}%) Today</span>
  `;

  // Active options contract badge
  if (activeOptionsEl) {
    activeOptionsEl.textContent = `${optionContractsCount} Contracts`;
  }

  // ── 6. BUYING POWER (cash balance) ───────────────────────────────────────
  const bpElement = document.getElementById('buying-power-value') || document.getElementById('buying-power');
  if (bpElement) {
    bpElement.textContent = formattedBP;
  }
  const bpElement2 = document.getElementById('buying-power');
  if (bpElement2) {
    bpElement2.textContent = formattedBP;
  }
}

function cleanAssetName(name) {
  if (!name) return '';
  // If the name is just a raw options contract ticker (e.g. contains $ strike and Call/Put),
  // we replace it with the underlying stock name to keep the layout clean and remove clutter.
  const isOptionName = /\$\d/.test(name) && /\b(call|put)\b/i.test(name);
  if (isOptionName) {
    const rootMatch = name.match(/^([A-Za-z]+)/);
    if (rootMatch) {
      const root = rootMatch[1].toUpperCase();
      const rootEntry = getDefaultAsset(root);
      if (rootEntry && rootEntry.name) {
        return rootEntry.name
          .replace(/\b(Corporation|Corp|Inc|Incorporated|LLC|Ltd|Co)\b\.?/gi, '')
          .trim();
      }
      return root;
    }
  }
  return name
    .replace(/\b(Corporation|Corp|Inc|Incorporated|LLC|Ltd|Co)\b\.?/gi, '')
    .trim();
}

function formatOptionTicker(ticker) {
  const strikeMatch = ticker.match(/\$(\d+(?:\.\d+)?)/);
  const strikePrice = strikeMatch ? strikeMatch[1] : null;
  const expiryMatch = ticker.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  const expiry = expiryMatch ? expiryMatch[1] : null;
  const rootMatch = ticker.match(/^([A-Za-z]+)/);
  const root = rootMatch ? rootMatch[1].toUpperCase() : ticker.split(' ')[0].toUpperCase();
  if (strikePrice) {
    return `${root} [$${strikePrice}]${expiry ? ' ' + expiry : ''}`;
  }
  return ticker;
}

/**
 * Extracts the expiry date from an option's stored `name` field.
 * The name is typically set as "Exp MM/DD/YY • Buy to Open" from defaultAssetData
 * or parsed from the ticker string itself.
 * Returns a formatted string like "Exp 07/16/26" or empty string.
 */
function getOptionExpiry(ticker, name) {
  // 1. Try to find from local storage transactions
  try {
    const stored = localStorage.getItem('portfolio_transactions');
    if (stored) {
      const txs = JSON.parse(stored);
      const matchTx = txs.find(tx => tx.ticker === ticker && (tx.expiryDate || tx['Expiry Date'] || tx.expiry));
      if (matchTx) {
        const exp = matchTx.expiryDate || matchTx['Expiry Date'] || matchTx.expiry;
        let formattedExp = exp;
        const ymdMatch = exp.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (ymdMatch) {
          formattedExp = `${parseInt(ymdMatch[2], 10)}/${parseInt(ymdMatch[3], 10)}/${ymdMatch[1].slice(-2)}`;
        }
        return `Exp ${formattedExp}`;
      }
    }
  } catch (e) {
    console.warn(e);
  }

  // 2. Try to extract date from ticker string FIRST (most reliable)
  // Handles patterns like "SPY $723 CALL 6/11", "AAPL $180 Call 06/20/26", "NVDA $490 CALL 7/16/26"
  const tickerDateMatch = ticker.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  if (tickerDateMatch) return `Exp ${tickerDateMatch[1]}`;

  // 3. Fallback: try name field if it contains "Exp MM/DD/YY" (defaultAssetData entries)
  // asset.name is often the company name from resolveAssetName(), so this is secondary
  if (name) {
    const nameMatch = name.match(/Exp\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (nameMatch) return `Exp ${nameMatch[1]}`;
  }
  return '';
}

/**
 * 2. ASSET HOLDERS GRID BUILDER ENGINE: dynamic layout function
 * targets the '#tableBody' element in portfolio.html.
 */
function renderAssetsTable(filterMode) {
  const tableBody = document.getElementById('tableBody');
  const skeleton = document.getElementById('skeleton-loader');

  // Clear out the temporary skeleton placeholder lines on initialization/render
  if (skeleton) {
    skeleton.style.display = 'none';
  }

  if (!tableBody) return;

  // Preserve the currently open drawer state across re-renders
  let openDrawerTicker = null;
  const openRows = tableBody.querySelectorAll('.asset-row.drawer-open');
  if (openRows.length > 0) {
    openDrawerTicker = openRows[0].dataset.ticker;
  }

  tableBody.innerHTML = '';

  let marketPrices = {};
  try {
    marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
  } catch (e) {
    marketPrices = {};
  }

  // Filter portfolio assets down to specific asset class
  const filtered = portfolioAssets.filter(asset => {
    if (filterMode === 'all') return true;
    return asset.type === filterMode;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <div class="empty-view" style="padding: 24px 0;">
        <p>No active assets found in this category.</p>
      </div>
    `;
    return;
  }

  // Map and dynamically render the assets rows
  filtered.forEach(asset => {
    // Dual-source options detection:
    // 1. asset.type field set to 'options'
    // 2. Ticker string contains a $ price + CALL/PUT keyword (e.g. "NVDA $490 Call", "SPY $723 CALL 6/11")
    const isOption = asset.type === 'options'
      || (/\$\d/.test(asset.ticker) && /\b(call|put)\b/i.test(asset.ticker));

    // Options: apply standard 100-share leverage multiplier to all position math
    const multiplier = isOption ? 100 : 1;

    // VALUE = shares * currentPrice (* 100 for options)
    const liveValue = asset.shares * asset.currentPrice * multiplier;
    const formattedVal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(liveValue);

    // TREND = (shares * livePrice * multiplier) - holdingsValue → P&L in dollars
    const holdingsValue = asset.shares * asset.avgCost * multiplier;
    const changeUsd = liveValue - holdingsValue;
    const isPositive = changeUsd >= 0;
    const changeSign = isPositive ? 'positive' : 'negative';
    const arrowSymbol = isPositive ? '▲' : '▼';
    const formattedChange = `${arrowSymbol} ${new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(changeUsd))}`;

    // Quantity label depending on asset type
    const qtySuffix = isOption ? 'CON' : 'SHR';

    // Generate mini sparkline path coordinates dynamically
    const points = sparklineData[asset.ticker] || [asset.avgCost, asset.currentPrice];
    const sparklinePath = generateSparklinePath(points, 90, 24);
    const chartStrokeColor = isPositive ? 'var(--success)' : 'var(--danger)';

    // Split ticker name: mainTicker = base symbol only (e.g. "SPY"), rest is contract detail
    const tickerParts = asset.ticker.split(' ');
    const mainTicker = tickerParts[0];

    // ── OPTIONS CONTRACT SPECIFICATION PARSER ──────────────────────────────
    // Handles: "NVDA $490 Call", "SPY $723 CALL 6/11", "AAPL $180 Put"
    let optionBadgeHTML = '';
    const displayTicker = isOption ? formatOptionTicker(asset.ticker) : mainTicker;

    if (isOption) {
      // Detect CALL or PUT — case-insensitive, whole-word boundary
      const contractType = /\bcall\b/i.test(asset.ticker) ? 'call'
        : /\bput\b/i.test(asset.ticker) ? 'put' : null;

      // Build colored badge pills (only keep CALL/PUT to prevent clutter)
      if (contractType) {
        optionBadgeHTML += `<span class="option-badge ${contractType}">${contractType.toUpperCase()}</span>`;
      }
    }

    let subTicker = cleanAssetName(asset.name);
    let optionExpiry = '';

    // Resolve underlying asset price
    const underlyingMatch = asset.ticker.match(/^([A-Za-z]+)/);
    const underlyingTicker = underlyingMatch ? underlyingMatch[1].toUpperCase() : mainTicker;
    const underlyingEntry = marketPrices[underlyingTicker] || getDefaultAsset(underlyingTicker) || {};
    const underlyingPrice = parseFloat(underlyingEntry.currentPrice) || parseFloat(underlyingEntry.price) || (underlyingTicker === 'SPX' ? 5120.30 : (underlyingTicker === 'SPY' ? 753.00 : 100.00));

    if (isOption) {
      const underlyingCompany = resolveAssetName(underlyingTicker);
      subTicker = cleanAssetName(underlyingCompany);
      optionExpiry = getOptionExpiry(asset.ticker, asset.name);
    }

    let colorPillarHTML = '';
    if (isOption) {
      const contractType = /\bcall\b/i.test(asset.ticker) ? 'call'
        : /\bput\b/i.test(asset.ticker) ? 'put' : null;
      if (contractType) {
        colorPillarHTML = `<span class="color-pillar ${contractType}" title="${contractType.toUpperCase()}"></span>`;
      }
    }

    const slDisplay = (asset.stopLoss && asset.stopLoss > 0) ? `$${asset.stopLoss.toFixed(2)}` : '—';
    const changeText = asset.change24h >= 0 ? `up ${asset.change24h.toFixed(2)}%` : `down ${Math.abs(asset.change24h).toFixed(2)}%`;

    const rowHTML = `
      <div class="asset-row" data-ticker="${asset.ticker}" role="button" tabindex="0">
        <!-- Column 1: Ticker & Name (No Icon Box) -->
        <div class="asset-col-ticker">
          <div class="ticker-text-container" style="align-items: flex-start;">
            <span class="asset-ticker">${displayTicker}</span>
            <div style="display: flex; align-items: center; gap: 4px;">
              ${colorPillarHTML}
              ${subTicker ? `<span class="asset-sub-ticker">${subTicker}</span>` : ''}
            </div>
            ${optionExpiry ? `<span class="asset-sub-ticker" style="color: var(--text-muted); font-size: 10px;">${optionExpiry}</span>` : ''}
            ${optionBadgeHTML ? `<div class="option-badges-row">${optionBadgeHTML}</div>` : ''}
          </div>
        </div>
        
        <!-- Column 2: Number of contracts/shares @ avg cost -->
        <div class="asset-col-shares-avg">
          <span class="asset-shares-qty">${asset.shares}</span>
          <span class="asset-avg-cost">@ $${asset.avgCost.toFixed(2)}</span>
        </div>
        
        <!-- Column 3: Stop Loss (SL) -->
        <div class="asset-col-sl">
          <span class="sl-price-val">${slDisplay}</span>
        </div>
        
        <!-- Column 4: Live price per contract -->
        <div class="asset-col-live-price">
          <span class="live-price-val">$${asset.currentPrice.toFixed(2)}</span>
          ${isOption ? `<span class="option-multiplier-hint-text">×100</span>` : ''}
          ${isOption ? `<div class="underlying-price-pill" title="Underlying Asset Price">${underlyingTicker}: $${underlyingPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>` : ''}
        </div>
        
        <!-- Column 5: Total position value -->
        <div class="asset-col-total-graph">
          <div class="total-value-row">
            <span class="asset-total-val">${formattedVal}</span>
            <span class="asset-row-perf ${changeSign}">${formattedChange}</span>
          </div>
        </div>
        
        <!-- Expanded Details Drawer (Covers full grid span) -->
        <div class="asset-details-drawer" style="display: none; grid-column: 1 / -1; width: 100%; margin-top: 12px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.08); flex-direction: column; align-items: flex-start; gap: 10px;">
          <div style="font-size: 12px; color: var(--text-secondary); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; width: 100%; gap: 6px;">
            <span>${asset.ticker} is currently trading at $${asset.currentPrice.toFixed(2)} (${changeText}) today.</span>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="quick-buy-btn glass-btn" data-action="BUY" style="padding: 5px 12px; font-size: 11px; border-radius: 6px; background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.35); color: #4ade80; cursor: pointer; font-weight: 600; transition: all 0.2s;">Buy</button>
              <button class="quick-sell-btn glass-btn" data-action="SELL" style="padding: 5px 12px; font-size: 11px; border-radius: 6px; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35); color: #f87171; cursor: pointer; font-weight: 600; transition: all 0.2s;">Sell</button>
              <button class="edit-asset-trigger-btn glass-btn" style="padding: 5px 12px; font-size: 11px; border-radius: 6px; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.35); color: #60a5fa; cursor: pointer; font-weight: 600; transition: all 0.2s;">Edit</button>
              <button class="add-comment-trigger-btn glass-btn" style="padding: 5px 12px; font-size: 11px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); cursor: pointer; transition: all 0.2s;">+ Add Comment</button>
              <button class="latest-news-btn glass-btn" style="padding: 5px 12px; font-size: 11px; border-radius: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary); cursor: pointer; transition: all 0.2s;">Latest News</button>
            </div>
          </div>
        </div>
      </div>
    `;

    tableBody.insertAdjacentHTML('beforeend', rowHTML);
  });

  // Attach feedback click listeners to the asset rows
  const assetRows = tableBody.querySelectorAll('.asset-row');
  assetRows.forEach(row => {
    row.addEventListener('click', (e) => {
      // Find the drawer in this row
      const drawer = row.querySelector('.asset-details-drawer');
      if (!drawer) return;

      // If the click occurred inside the drawer, don't close the drawer
      if (e.target.closest('.asset-details-drawer')) {
        return;
      }

      const isVisible = row.classList.contains('drawer-open');

      // Collapse all other drawers first
      const allRows = tableBody.querySelectorAll('.asset-row');
      allRows.forEach(r => {
        r.classList.remove('drawer-open');
        const d = r.querySelector('.asset-details-drawer');
        if (d) d.style.display = 'none';
      });

      // Toggle current drawer
      if (isVisible) {
        row.classList.remove('drawer-open');
        drawer.style.display = 'none';
      } else {
        row.classList.add('drawer-open');
        drawer.style.display = 'flex';
      }
    });

    // Handle clicks inside the drawer
    const drawer = row.querySelector('.asset-details-drawer');
    if (drawer) {
      // Close button on drawer click
      const drawerCloseBtn = drawer.querySelector('.asset-drawer-close-btn');
      if (drawerCloseBtn) {
        drawerCloseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          drawer.style.display = 'none';
        });
      }

      // Buy button
      const buyBtn = drawer.querySelector('.quick-buy-btn');
      if (buyBtn) {
        buyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ticker = row.getAttribute('data-ticker');
          openQuickTradeModal(ticker, 'BUY');
        });
      }

      // Sell button
      const sellBtn = drawer.querySelector('.quick-sell-btn');
      if (sellBtn) {
        sellBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ticker = row.getAttribute('data-ticker');
          openQuickTradeModal(ticker, 'SELL');
        });
      }

      // Edit button
      const editBtn = drawer.querySelector('.edit-asset-trigger-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ticker = row.getAttribute('data-ticker');
          openEditAssetModal(ticker);
        });
      }

      // Delete button
      const deleteBtn = drawer.querySelector('.delete-asset-trigger-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ticker = row.getAttribute('data-ticker');
          deleteAsset(ticker);
        });
      }

      // Add comment trigger button click (opens popup modal)
      const triggerBtn = drawer.querySelector('.add-comment-trigger-btn');
      if (triggerBtn) {
        triggerBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ticker = row.getAttribute('data-ticker');
          openCommentModal(ticker);
        });
      }

      // Latest News button click (window.open popup)
      const newsBtn = drawer.querySelector('.latest-news-btn');
      if (newsBtn) {
        newsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ticker = row.getAttribute('data-ticker');
          const baseTicker = ticker.split(' ')[0].toUpperCase();
          const newsUrl = `https://finance.yahoo.com/quote/${baseTicker}`;
          window.open(newsUrl, '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes');
        });
      }
    }
  });

  // Restore the open drawer if one was open before the re-render
  if (openDrawerTicker) {
    const rowToOpen = tableBody.querySelector(`.asset-row[data-ticker="${CSS.escape(openDrawerTicker)}"]`);
    if (rowToOpen) {
      rowToOpen.classList.add('drawer-open');
      const d = rowToOpen.querySelector('.asset-details-drawer');
      if (d) d.style.display = 'flex';
    }
  }
}

/**
 * 3. UNHIDDEN PILL TAB SELECTION ACTIONS:
 * Links filter execution hooks to middle pills ([All Assets], [Stocks], [Options])
 */
function initFilters() {
  const filterBtns = document.querySelectorAll('.pill-btn');
  const slider = document.querySelector('.pill-slider');

  // Slide active .pill-slider indicator box to the selected button
  function updateSlider(btn) {
    if (slider && btn) {
      slider.style.width = `${btn.offsetWidth}px`;
      slider.style.transform = `translateX(${btn.offsetLeft}px)`;
    }
  }

  // Set initial position of the slider
  const initialActive = document.querySelector('.pill-btn.active');
  if (initialActive) {
    requestAnimationFrame(() => {
      updateSlider(initialActive);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.getAttribute('data-filter');

      // Track the selected mode globally so cloud syncs always re-render correctly
      activeFilterMode = filterType;

      // Toggle .active design class to emphasize the focused element
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Move indicator slider
      updateSlider(btn);

      // Filter the assets view without altering any top parent card layouts
      renderAssetsTable(filterType);
    });
  });

  // Ensure the indicator position remains correct on mobile viewport rotation/resizing
  window.addEventListener('resize', () => {
    const activeBtn = document.querySelector('.pill-btn.active');
    updateSlider(activeBtn);
  });
}

/**
 * MANUAL REFRESH BUTTON:
 * Wires up the glassmorphic #manualRefreshBtn in the header.
 * Spins the icon, fetches fresh cloud data, then shows a success toast.
 */
function initManualRefreshBtn() {
  const btn = document.getElementById('manualRefreshBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (btn.classList.contains('spinning')) return; // Prevent double-tap
    btn.classList.add('spinning');
    try {
      await pullCloudData();
      startLivePriceEngine();
      showToast('🔄 Portfolio Valuation Refreshed!');
    } catch (e) {
      showToast('⚠️ Cloud sync failed. Check connection.', true);
    } finally {
      btn.classList.remove('spinning');
    }
  });
}

/**
 * 4. NATIVE ROUTER TOGGLES & REDIRECTS:
 * Global navigation routing supporting redirect to ledger.html
 */
function initNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  const screens = document.querySelectorAll('.screen-view');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetId = tab.getAttribute('data-target');

      if (targetId === 'screen-ledger') {
        e.preventDefault();
        window.location.href = 'ledger.html';
        return;
      }

      if (targetId === 'screen-entry') {
        e.preventDefault();
        window.location.href = 'entry.html';
        return;
      }

      if (targetId === 'settings-screen') {
        e.preventDefault();
        window.location.href = 'settings.html';
        return;
      }

      // Toggle active state design classes on bottom navigation tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Switch screen visibility immediately using active class
      screens.forEach(screen => {
        if (screen.id === targetId) {
          screen.classList.add('active');
        } else {
          screen.classList.remove('active');
        }
      });

      // Additional view resets (scroll to top on screen transitions)
      if (targetId === 'screen-dashboard') {
        const container = document.getElementById('holdings-container');
        if (container) container.scrollTop = 0;

        // Refresh filter slider position just in case layout shifts occurred
        const activeFilterBtn = document.querySelector('.pill-btn.active');
        const slider = document.querySelector('.pill-slider');
        if (slider && activeFilterBtn) {
          slider.style.width = `${activeFilterBtn.offsetWidth}px`;
          slider.style.transform = `translateX(${activeFilterBtn.offsetLeft}px)`;
        }
      }
    });
  });

  // Handle deep linking via URL params on load
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');
  if (targetTab && document.getElementById(targetTab)) {
    const matchingTab = Array.from(tabs).find(t => t.getAttribute('data-target') === targetTab);
    if (matchingTab) {
      requestAnimationFrame(() => {
        matchingTab.click();
      });
    }
  }
}

/**
 * Renders interactive toast feedback message when clicking on individual asset items
 */
function showAssetFeedback(asset) {
  const existingToast = document.querySelector('.app-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const changeText = asset.change24h >= 0 ? `up ${asset.change24h}%` : `down ${Math.abs(asset.change24h)}%`;
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.innerText = `${asset.ticker} is currently trading at $${asset.currentPrice.toFixed(2)} (${changeText}) today.`;

  Object.assign(toast.style, {
    position: 'absolute',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#f8fafc',
    padding: '10px 16px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '555',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    zIndex: '200',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    width: '80%',
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
  const bellBtn = document.getElementById('notification-bell');
  const badge = document.getElementById('notification-badge');

  // Load and apply initial state on boot (default to true)
  const isEnabled = localStorage.getItem('portfolio_notifications_enabled') !== 'false';
  syncNotificationUI(isEnabled);
  // if (isEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
  //   Notification.requestPermission();
  // }

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

// --------------------------------------------------------------------------
// AUTOMATED LIVE PRICE PULLING & SHEETDB SYNC ENGINE
// --------------------------------------------------------------------------
let livePriceIntervalId = null;
let lastServerSyncTime = 0;
const SERVER_SYNC_INTERVAL = 300000; // Throttle server sync to once every 5 minutes to preserve API limits

function isMarketOpen() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric'
  });

  const parts = formatter.formatToParts(new Date());
  let weekday, hour, minute;
  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }

  // Market is closed on Saturday and Sunday
  if (weekday === 'Sat' || weekday === 'Sun') return false;

  // Time in minutes from midnight ET
  const totalMinutes = hour * 60 + minute;
  // 9:30 AM = 9 * 60 + 30 = 570
  // 4:00 PM = 16 * 60 = 960

  return totalMinutes >= 570 && totalMinutes < 960;
}

function scheduleNextPriceUpdate() {
  if (livePriceIntervalId) clearTimeout(livePriceIntervalId);

  const isOpen = isMarketOpen();
  const nextInterval = isOpen ? 60000 : 900000; // 1 min vs 15 mins
  console.log(`[Market Poller] Market is ${isOpen ? 'OPEN' : 'CLOSED'}. Next update in ${nextInterval / 1000} seconds.`);

  livePriceIntervalId = setTimeout(() => {
    updateLivePrices().finally(() => scheduleNextPriceUpdate());
  }, nextInterval);
}

function startLivePriceEngine() {
  if (livePriceIntervalId) clearTimeout(livePriceIntervalId);
  // Execute an immediate update of prices on startup/refresh
  updateLivePrices().finally(() => scheduleNextPriceUpdate());
}

async function updateLivePrices() {
  let marketPrices = {};
  try {
    marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
  } catch (e) {
    marketPrices = {};
  }

  const now = Date.now();
  const shouldSyncServer = (now - lastServerSyncTime) >= SERVER_SYNC_INTERVAL || lastServerSyncTime === 0;

  // Build a deduplicated list of tickers to fetch
  const tickerSet = new Set();
  const osiToOriginalMap = {};
  let allAssetsToFetch = [...portfolioAssets];
  try {
    const txs = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]');
    txs.forEach(tx => {
      if (tx.ticker && !allAssetsToFetch.some(a => a.ticker === tx.ticker)) {
        allAssetsToFetch.push({ ticker: tx.ticker, type: tx.assetType || 'stocks' });
      }
    });
  } catch(e) {}

  for (const asset of allAssetsToFetch) {
    if (asset.ticker) {
      const isOption = asset.type === 'options' || (/\$\d/.test(asset.ticker) && /\b(call|put)\b/i.test(asset.ticker)) || asset.ticker.includes('@');

      if (isOption) {
        let expiry = asset.expiryDate;
        if (!expiry) {
          expiry = getOptionExpiry(asset.ticker, asset.name);
        }
        const osi = getOSIOptionSymbol(asset.ticker, expiry, asset.comment, asset.type);
        if (osi && /^[A-Z]{1,6}\d{6}[CP]\d{8}$/i.test(osi)) {
          tickerSet.add(osi);
          osiToOriginalMap[osi] = asset.ticker.toUpperCase();
        } else {
          const baseMatch = asset.ticker.match(/^([A-Za-z]+)/);
          if (baseMatch) {
            const base = baseMatch[1].toUpperCase();
            tickerSet.add(base);
            osiToOriginalMap[base] = asset.ticker.toUpperCase();
          }
        }
      } else {
        const t = asset.ticker.toUpperCase();
        tickerSet.add(t);
        osiToOriginalMap[t] = t;
      }
    }
  }
  const tickersToFetch = [...tickerSet];
  if (tickersToFetch.length === 0) return;

  // ── Fetch all prices in one server call (Secure Proxy to Unusual Whales) ──
  let fetchedResults = {};
  try {
    const res = await fetch(
      `/api/market-prices?tickers=${encodeURIComponent(tickersToFetch.join(','))}`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (res.ok) {
      const uwPayload = await res.json();

      // Flexibly parse the JSON payload from Unusual Whales (array, {data:[]}, or ticker map)
      let items = [];
      if (Array.isArray(uwPayload)) {
        items = uwPayload;
      } else if (uwPayload.data && Array.isArray(uwPayload.data)) {
        items = uwPayload.data;
      } else if (uwPayload.results && Array.isArray(uwPayload.results)) {
        items = uwPayload.results;
      } else if (typeof uwPayload === 'object' && uwPayload !== null) {
        // Fallback for ticker-mapped objects { "AAPL": { price: 150 } } or { "DRAM": 58.28 }
        items = Object.keys(uwPayload).map(k => {
          if (typeof uwPayload[k] === 'object' && uwPayload[k] !== null) {
            return { symbol: k, ...uwPayload[k] };
          }
          return { symbol: k, price: uwPayload[k] };
        });
      }

      for (const item of items) {
        let t = (item.ticker || item.symbol || '').toUpperCase();
        if (!t) continue;

        // Map the backend returned OSI/symbol back to the original UI ticker (e.g. "SPY @735 CALL")
        if (osiToOriginalMap[t]) {
          t = osiToOriginalMap[t];
        }

        // Extract live market price
        const livePrice = parseFloat(item.price || item.last_price || item.last || item.current_price || item.mid || ((parseFloat(item.bid || 0) + parseFloat(item.ask || 0)) / 2)) || 0;

        // Extract previous close for variance formula
        const prevClose = parseFloat(item.previous_close || item.prev_close || item.close || item.previousClose) || livePrice;

        let change24h = 0;
        if (item.change_percent !== undefined) {
          change24h = parseFloat(item.change_percent);
        } else if (item.change !== undefined && prevClose > 0) {
          change24h = (parseFloat(item.change) / prevClose) * 100;
        } else if (livePrice > 0 && prevClose > 0) {
          change24h = ((livePrice - prevClose) / prevClose) * 100;
        }

        fetchedResults[t] = {
          price: livePrice,
          change24h: change24h || 0,
          name: item.name || t
        };
      }
    } else {
      console.warn('[updateLivePrices] Secure Proxy fetch returned', res.status);
    }
  } catch (err) {
    console.warn('[updateLivePrices] Server unreachable, using cached prices:', err.message);
  }

  let updatedAny = false;

  for (const asset of allAssetsToFetch) {
    const ticker = asset.ticker;
    if (!ticker) continue;

    const upperTicker = ticker.toUpperCase();
    const fetchEntry = fetchedResults[upperTicker];

    let price = asset.currentPrice || 0;
    let change24h = asset.change24h || 0;
    let name = asset.name || ticker;

    if (fetchEntry) {
      price = fetchEntry.price;
      change24h = fetchEntry.change24h;
      if (fetchEntry.name && fetchEntry.name !== fetchEntry.baseTicker) {
        name = fetchEntry.name;
      }
    } else {
      // Fallback: use what's already cached in marketPrices
      const cached = marketPrices[upperTicker] || marketPrices[asset.ticker];
      if (cached && cached.currentPrice) {
        price = cached.currentPrice;
        change24h = cached.change24h || 0;
      }
    }

    // Update marketPrices cache entry
    if (marketPrices[ticker]) {
      marketPrices[ticker].currentPrice = price;
      marketPrices[ticker].change24h = change24h;
      if (name && name !== ticker) marketPrices[ticker].name = name;
    } else {
      marketPrices[ticker] = {
        name,
        currentPrice: price,
        change24h,
        icon: asset.icon || ticker.slice(0, 2).toUpperCase(),
        stopLoss: asset.stopLoss
      };
    }

    // Stop Loss Alert
    if (asset.stopLoss && asset.stopLoss > 0 && price > 0) {
      if (price <= asset.stopLoss) {
        const alertKey = `portfolio_sl_alert_fired_${ticker}_${asset.stopLoss}`;
        if (!sessionStorage.getItem(alertKey)) {
          sessionStorage.setItem(alertKey, 'true');
          const title = `⚠️ Stop Limit Hit for ${ticker}!`;
          const body = `${name || ticker} live price is $${price.toFixed(2)}, which has met your Stop Limit of $${asset.stopLoss.toFixed(2)}.`;
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try { new Notification(title, { body }); } catch (e) { console.warn('Notification failed:', e); }
          }
          showToast(`🚨 ${title} ${body}`, true);
          addStoredNotification(title, body);
        }
      } else if (price <= asset.stopLoss + 1) {
        const alertKey = `portfolio_sl_alert_warning_${ticker}_${asset.stopLoss}`;
        if (!sessionStorage.getItem(alertKey)) {
          sessionStorage.setItem(alertKey, 'true');
          const title = `⚠️ Approaching Stop Limit for ${ticker}!`;
          const body = `${name || ticker} live price is $${price.toFixed(2)}, which is within $1.00 of your Stop Limit ($${asset.stopLoss.toFixed(2)}).`;
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try { new Notification(title, { body }); } catch (e) { console.warn('Notification failed:', e); }
          }
          showToast(`⚠️ ${title} ${body}`);
          addStoredNotification(title, body);
        }
      }
    }

    updatedAny = true;

    // Sync to server (throttled)
    if (shouldSyncServer && price > 0) {
      syncPriceToServer(ticker, price);
    }
  }

  if (updatedAny) {
    localStorage.setItem('portfolio_market_prices', JSON.stringify(marketPrices));
    refreshPortfolioAssets();
    updateBalanceMetrics();
    renderAssetsTable(activeFilterMode);

    if (shouldSyncServer) {
      lastServerSyncTime = now;
    }
  }
}


async function syncPriceToServer(ticker, price) {
  const url = LOCAL_BACKEND_CONFIG.endpointUrl;
  if (!url || url.includes("YOUR_API_URL")) {
    return; // offline/fallback mode
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'updatePrice',
        Symbol: ticker,
        CurrentPrice: Number(price)
      })
    });
    if (response.ok) {
      console.log(`Successfully synced live price $${price.toFixed(2)} for ${ticker} to the backend server.`);
    } else {
      console.warn(`Failed to sync price for ${ticker} to the backend server.`);
    }
  } catch (e) {
    console.error(`Error syncing price for ${ticker} to the backend server:`, e);
  }
}

function openCommentModal(ticker) {
  const modal = document.getElementById('commentModal');
  const title = document.getElementById('commentModalTitle');
  const input = document.getElementById('commentModalInput');
  if (modal && title && input) {
    title.textContent = `Add Comment for ${ticker.toUpperCase()}`;
    input.value = '';
    modal.setAttribute('data-current-ticker', ticker);
    modal.classList.add('active');
    input.focus();
  }
}

function initCommentModal() {
  const modal = document.getElementById('commentModal');
  const input = document.getElementById('commentModalInput');
  const closeBtn = document.getElementById('closeCommentModalBtn');
  const cancelBtn = document.getElementById('cancelCommentModalBtn');
  const saveBtn = document.getElementById('saveCommentModalBtn');

  if (!modal) return;

  const closeModal = () => {
    modal.classList.remove('active');
    if (input) input.value = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (saveBtn && input) {
    saveBtn.addEventListener('click', async () => {
      const ticker = modal.getAttribute('data-current-ticker');
      const commentText = input.value.trim();
      if (!ticker || !commentText) return;

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

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
          text: commentText
        };

        const response = await fetch(CLOUD_ENDPOINT.endpointUrl + 'notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          // Cache locally
          const allNotes = JSON.parse(localStorage.getItem('portfolio_notes') || '[]');
          allNotes.push(payload);
          localStorage.setItem('portfolio_notes', JSON.stringify(allNotes));

          closeModal();
          showToast('✨ Comment saved successfully!');
        } else {
          throw new Error('Failed to save comment to server.');
        }
      } catch (err) {
        console.error('Error saving quick comment:', err);
        showToast('❌ Failed to save comment.', true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// QUICK TRADE MODAL (Buy / Sell from asset drawer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens the quick-trade popup for the given ticker and action ('BUY' or 'SELL').
 * Pre-fills the average price with the asset's current live price.
 */
function openQuickTradeModal(ticker, action) {
  const modal = document.getElementById('quickTradeModal');
  const titleEl = document.getElementById('quickTradeModalTitle');
  const sharesInput = document.getElementById('qtSharesInput');
  const priceInput = document.getElementById('qtPriceInput');
  const commentInput = document.getElementById('qtCommentInput');
  if (!modal) return;

  // Pre-fill price from live asset data
  const asset = portfolioAssets.find(a => a.ticker === ticker);
  const livePrice = asset ? asset.currentPrice : 0;

  titleEl.textContent = `${action === 'BUY' ? '🟢 Buy' : '🔴 Sell'} — ${ticker}`;
  modal.setAttribute('data-current-ticker', ticker);
  modal.setAttribute('data-current-action', action);

  // Clear and pre-fill fields
  sharesInput.value = '';
  priceInput.value = livePrice > 0 ? livePrice.toFixed(2) : '';
  commentInput.value = '';

  modal.classList.add('active');
  sharesInput.focus();
}

/**
 * Wires up the close and submit buttons for the quick-trade modal.
 * Submit stores the trade in localStorage transactions AND posts to the server.
 */
function initQuickTradeModal() {
  const modal = document.getElementById('quickTradeModal');
  const closeBtn = document.getElementById('closeQuickTradeModalBtn');
  const submitBtn = document.getElementById('submitQuickTradeBtn');
  const sharesInput = document.getElementById('qtSharesInput');
  const priceInput = document.getElementById('qtPriceInput');
  const dateInput = document.getElementById('qtDateInput');
  const commentInput = document.getElementById('qtCommentInput');

  if (!modal) return;

  // Only close via Close button — backdrop click does NOT dismiss
  const closeModal = () => {
    modal.classList.remove('active');
    if (sharesInput) sharesInput.value = '';
    if (priceInput) priceInput.value = '';
    if (dateInput) dateInput.value = '';
    if (commentInput) commentInput.value = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const ticker = modal.getAttribute('data-current-ticker');
      const action = modal.getAttribute('data-current-action') || 'BUY';
      const shares = parseInt(sharesInput.value, 10);
      const price = parseFloat(priceInput.value);
      const comment = (commentInput.value || '').trim();

      if (!ticker || isNaN(shares) || shares <= 0) {
        showToast('⚠️ Please enter a valid number of shares.', true);
        return;
      }
      if (isNaN(price) || price <= 0) {
        showToast('⚠️ Please enter a valid price.', true);
        return;
      }

      // Determine asset type from portfolioAssets
      const asset = portfolioAssets.find(a => a.ticker === ticker);
      const assetType = asset ? (asset.type || 'stocks') : 'stocks';

      let isoDate;
      if (dateInput && dateInput.value) {
        const userDate = new Date(dateInput.value);
        if (!isNaN(userDate.getTime())) {
          isoDate = userDate.toISOString();
        }
      }
      
      if (!isoDate) {
        isoDate = new Date().toISOString();
      }

      const tx = {
        ticker: ticker.trim().toUpperCase(),
        assetType,
        action,
        shares,
        price: Math.round(price * 100) / 100,
        date: isoDate,
        comment: comment || `Quick ${action.toLowerCase()} from portfolio drawer`
      };

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      try {
        // 1. POST to backend server (stored in trades.ndjson)
        // Field names must match server.js POST /api/trades handler:
        // expects: ticker, price, shares (or quantity), action, assetType, date, comment
        const response = await fetch(CLOUD_ENDPOINT.endpointUrl + 'trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: tx.ticker,
            action: action,
            shares: shares,
            price: tx.price,
            assetType: assetType,
            date: isoDate,
            comment: tx.comment
          })
        });

        if (!response.ok) throw new Error('Server error saving trade.');

        // 2. Save to localStorage transactions ledger so portfolio re-calculates instantly
        let txs = [];
        try { txs = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]'); } catch (e) { txs = []; }
        txs.push(tx);
        localStorage.setItem('portfolio_transactions', JSON.stringify(txs));

        // 3. Recalculate and re-render immediately
        refreshPortfolioAssets();
        updateBalanceMetrics();
        renderAssetsTable(activeFilterMode);

        closeModal();
        showToast(`✅ ${action === 'BUY' ? 'Buy' : 'Sell'} order recorded for ${ticker}!`);

      } catch (err) {
        console.error('Quick trade save error:', err);
        // Still save locally even if server is down
        let txs = [];
        try { txs = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]'); } catch (e) { txs = []; }
        txs.push(tx);
        localStorage.setItem('portfolio_transactions', JSON.stringify(txs));

        refreshPortfolioAssets();
        updateBalanceMetrics();
        renderAssetsTable(activeFilterMode);

        closeModal();
        showToast(`⚠️ Saved locally (server offline). ${action} for ${ticker} recorded.`, true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    });
  }
}

function openEditAssetModal(ticker) {
  const modal = document.getElementById('editAssetModal');
  const titleEl = document.getElementById('editAssetModalTitle');
  const sharesInput = document.getElementById('editSharesInput');
  const priceInput = document.getElementById('editPriceInput');
  const stopLossInput = document.getElementById('editStopLossInput');
  const expiryInput = document.getElementById('editExpiryInput');
  const expiryGroup = document.getElementById('editExpiryGroup');
  const sharesLabel = document.getElementById('editSharesLabel');

  if (!modal) return;

  const asset = portfolioAssets.find(a => a.ticker === ticker);
  if (!asset) return;

  modal.setAttribute('data-current-ticker', ticker);
  if (titleEl) titleEl.textContent = `Edit Asset — ${ticker}`;

  if (sharesInput) sharesInput.value = asset.shares;
  if (priceInput) priceInput.value = asset.avgCost;
  if (stopLossInput) stopLossInput.value = asset.stopLoss || '';

  const isOption = asset.type === 'options' || ticker.includes('@') || ticker.includes('$') || ticker.includes('Call') || ticker.includes('Put');

  if (isOption) {
    if (sharesLabel) sharesLabel.textContent = 'CONTRACTS';
    if (expiryGroup) expiryGroup.style.display = 'flex';
    if (expiryInput) {
      expiryInput.value = asset.expiryDate || '';
    }
  } else {
    if (sharesLabel) sharesLabel.textContent = 'SHARES';
    if (expiryGroup) expiryGroup.style.display = 'none';
  }

  modal.classList.add('active');
}

function initEditAssetModal() {
  const modal = document.getElementById('editAssetModal');
  const closeBtn = document.getElementById('closeEditAssetModalBtn');
  const submitBtn = document.getElementById('submitEditAssetBtn');
  const sharesInput = document.getElementById('editSharesInput');
  const priceInput = document.getElementById('editPriceInput');
  const stopLossInput = document.getElementById('editStopLossInput');
  const expiryInput = document.getElementById('editExpiryInput');

  if (!modal) return;

  const closeModal = () => {
    modal.classList.remove('active');
    if (sharesInput) sharesInput.value = '';
    if (priceInput) priceInput.value = '';
    if (stopLossInput) stopLossInput.value = '';
    if (expiryInput) expiryInput.value = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const ticker = modal.getAttribute('data-current-ticker');
      if (!ticker) return;

      const shares = parseFloat(sharesInput.value);
      const price = parseFloat(priceInput.value);
      const stopLoss = parseFloat(stopLossInput.value) || 0;
      const expiryDate = expiryInput.value || '';

      if (isNaN(shares) || shares <= 0) {
        showToast('⚠️ Please enter a valid number of shares.', true);
        return;
      }
      if (isNaN(price) || price <= 0) {
        showToast('⚠️ Please enter a valid price.', true);
        return;
      }

      const asset = portfolioAssets.find(a => a.ticker === ticker);
      const assetType = asset ? (asset.type || 'stocks') : 'stocks';

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      try {
        const response = await fetch(CLOUD_ENDPOINT.endpointUrl + `trades/ticker/${encodeURIComponent(ticker)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shares,
            price,
            stopLoss,
            assetType,
            expiryDate
          })
        });

        if (!response.ok) throw new Error('Server error updating asset.');

        // Re-fetch everything from backend to refresh cache and UI
        await pullCloudData();
        refreshPortfolioAssets();
        updateBalanceMetrics();
        renderAssetsTable(activeFilterMode);

        closeModal();
        showToast(`✅ Asset ${ticker} successfully updated!`);

      } catch (err) {
        console.error('Update asset error:', err);
        showToast('⚠️ Failed to save changes on server.', true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
  }
}

async function deleteAsset(ticker) {
  if (!ticker) return;
  if (!confirm(`Are you sure you want to completely delete all transaction records for ${ticker}? This action cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(CLOUD_ENDPOINT.endpointUrl + `trades/ticker/${encodeURIComponent(ticker)}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Server error deleting asset.');

    // Re-fetch everything from backend to refresh cache and UI
    await pullCloudData();
    refreshPortfolioAssets();
    updateBalanceMetrics();
    renderAssetsTable(activeFilterMode);

    showToast(`✅ Asset ${ticker} has been completely deleted.`);
  } catch (err) {
    console.error('Delete asset error:', err);
    showToast(`⚠️ Failed to delete asset ${ticker} on server.`, true);
  }
}

function getOSIOptionSymbol(ticker, expiryStr, comment, assetType) {
  // Underlying ticker
  const rootMatch = ticker.match(/^([A-Za-z]+)/);
  if (!rootMatch) return null;
  const root = rootMatch[1].toUpperCase();

  // Extract strike price
  // Handles "$490", "@735", "735" etc.
  const strikeMatch = ticker.match(/(?:[\$@])?(\d+(?:\.\d+)?)/);
  if (!strikeMatch) return null;
  const strikeVal = parseFloat(strikeMatch[1]);

  // Extract expiry date
  // Format MM/DD/YY or YYYY-MM-DD
  let expiryDate = null;
  if (expiryStr) {
    // try YYYY-MM-DD
    const ymd = expiryStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      expiryDate = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
    } else {
      // try MM/DD/YY or MM/DD/YYYY
      const mdy = expiryStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if (mdy) {
        let y = parseInt(mdy[3], 10);
        if (y < 100) y += 2000;
        expiryDate = new Date(y, parseInt(mdy[1], 10) - 1, parseInt(mdy[2], 10));
      }
    }
  }

  // If still no expiry, try extracting from ticker
  if (!expiryDate) {
    const tickerDateMatch = ticker.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (tickerDateMatch) {
      let y = tickerDateMatch[3] ? parseInt(tickerDateMatch[3], 10) : null;
      if (y === null) {
        y = new Date().getFullYear();
      } else if (y < 100) {
        y += 2000;
      }
      expiryDate = new Date(y, parseInt(tickerDateMatch[1], 10) - 1, parseInt(tickerDateMatch[2], 10));
    }
  }

  if (!expiryDate) return null;

  // Format YYMMDD
  const yy = String(expiryDate.getFullYear()).slice(-2);
  const mm = String(expiryDate.getMonth() + 1).padStart(2, '0');
  const dd = String(expiryDate.getDate()).padStart(2, '0');
  const yymmdd = `${yy}${mm}${dd}`;

  // Determine Call or Put
  const isPut = /\bput\b/i.test(ticker) || (comment && /\b(put|drop|down|below|short)\b/i.test(comment));
  const optionTypeChar = isPut ? 'P' : 'C';

  // Format Strike: 8 digits (5 integer, 3 fractional)
  const integerPart = Math.floor(strikeVal);
  const fractionalPart = Math.round((strikeVal - integerPart) * 1000);
  const strikeFormatted = String(integerPart).padStart(5, '0') + String(fractionalPart).padEnd(3, '0');

  return `${root}${yymmdd}${optionTypeChar}${strikeFormatted}`;
}

// --- Notification Center Logic ---
function getStoredNotifications() {
  try {
    return JSON.parse(localStorage.getItem('portfolio_unread_notifications') || '[]');
  } catch(e) {
    return [];
  }
}

function saveStoredNotifications(notifs) {
  localStorage.setItem('portfolio_unread_notifications', JSON.stringify(notifs));
  renderNotificationCenter();
}

function addStoredNotification(title, body) {
  const notifs = getStoredNotifications();
  notifs.unshift({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    title,
    body,
    timestamp: new Date().toISOString()
  });
  // Keep max 50 notifications
  if (notifs.length > 50) notifs.pop();
  saveStoredNotifications(notifs);
}

function renderNotificationCenter() {
  const notifs = getStoredNotifications();
  const badge = document.getElementById('notification-badge');
  const list = document.getElementById('notification-list');
  
  if (badge) {
    if (notifs.length > 0) {
      badge.textContent = notifs.length > 99 ? '99+' : notifs.length;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (list) {
    if (notifs.length === 0) {
      list.innerHTML = '<div class="notification-empty">No new notifications</div>';
    } else {
      list.innerHTML = notifs.map(n => `
        <div class="notification-item">
          <div class="notification-title">${n.title}</div>
          <div class="notification-body">${n.body}</div>
          <div class="notification-time">${new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${new Date(n.timestamp).toLocaleDateString()}</div>
        </div>
      `).join('');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderNotificationCenter();

  const bellBtn = document.getElementById('notification-bell');
  const dropdown = document.getElementById('notification-dropdown');
  const clearBtn = document.getElementById('clear-notifications-btn');

  if (bellBtn && dropdown) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      saveStoredNotifications([]);
    });
  }
});


