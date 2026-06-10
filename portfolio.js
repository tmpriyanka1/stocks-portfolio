const CLOUD_SPREADSHEET_CONFIG = {
  endpointUrl: "https://script.google.com/macros/s/AKfycbyq1B_7D2saPLfHISuwJrJI8PkUiQrgK3sDetSQE0rbcnTjSvXqKE0Dzl5gw4rB_xw7/exec"
};

const defaultAssetData = {
  'NVDA': { name: 'NVIDIA Corporation', currentPrice: 485.00, stopLoss: 380.00, change24h: 3.25, icon: 'NV' },
  'AAPL': { name: 'Apple Inc.', currentPrice: 175.50, stopLoss: 150.00, change24h: 1.92, icon: 'AP' },
  'TSLA': { name: 'Tesla Inc.', currentPrice: 198.20, stopLoss: 185.00, change24h: -2.17, icon: 'TS' },
  'NVDA $490 Call': { name: 'Exp 07/16/26 • Buy to Open', currentPrice: 18.50, stopLoss: 12.00, change24h: 20.31, icon: 'OC' },
  'AAPL $180 Call': { name: 'Exp 06/18/26 • Buy to Open', currentPrice: 4.80, stopLoss: 4.00, change24h: -13.43, icon: 'OC' }
};

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

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved color theme
  const savedAccent = localStorage.getItem('portfolio_accent_color');
  if (savedAccent) {
    applyAccentColor(savedAccent);
  }

  // Load local cache instantly for zero-blocking first print
  rebootDashboard();

  // Background Cloud Spreadsheet Pull
  pullCloudData().then(() => {
    startLivePriceEngine();
  });
});

async function pullCloudData() {
  const url = CLOUD_SPREADSHEET_CONFIG.endpointUrl;
  if (!url || url.includes("YOUR_API_URL")) return;

  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!response.ok) throw new Error('Network response error.');
    const data = await response.json();
    
    if (Array.isArray(data)) {
      const defaultTickerKeys = ['NVDA', 'AAPL', 'TSLA', 'NVDA $490 Call', 'AAPL $180 Call'];
      let marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
      
      const parsedTxs = data.map(tx => {
        const ticker = String(tx.Symbol || '').trim();
        const name = String(tx.Name || '');
        const action = String(tx.Action || 'BUY');
        const shares = parseInt(tx.Shares || 0, 10);
        const costBasis = parseFloat(tx.CostBasis || 0);
        const currentPrice = parseFloat(tx.CurrentPrice || costBasis);
        const date = String(tx.Date || new Date().toISOString());
        const comment = String(tx['Trade Journal Note'] || '');
        const stopLoss = parseFloat(tx.SL || 0);
        
        let rawType = String(tx['Asset Type'] || 'Stock');
        let assetType = rawType.toLowerCase().includes('option') ? 'options' : 'stocks';

        if (ticker) {
          marketPrices[ticker] = {
            name: name,
            currentPrice: currentPrice,
            change24h: parseFloat(tx.change24h || 0),
            icon: tx.Icon || ticker.slice(0, 2).toUpperCase(),
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


function rebootDashboard() {
  refreshPortfolioAssets();
  updateBalanceMetrics();
  initNavigation();
  initFilters();

  // Render full portfolio instantly on load
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
    if (!groups[tx.ticker]) {
      groups[tx.ticker] = {
        ticker: tx.ticker,
        type: tx.assetType,
        shares: 0,
        avgCost: 0,
        lastPrice: tx.price
      };
    }
    const g = groups[tx.ticker];
    g.lastPrice = tx.price;
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
      let assetDetails = defaultAssetData[ticker];
      let customPrices = {};
      try {
        customPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
      } catch (e) {
        customPrices = {};
      }
      const customDetails = customPrices[ticker] || {};

      if (assetDetails) {
        assetDetails = { ...assetDetails, ...customDetails };
      } else {
        assetDetails = customDetails;
        if (!assetDetails || !assetDetails.name) {
          assetDetails = {
            name: ticker + ' Corporation',
            currentPrice: g.lastPrice,
            change24h: 0.0,
            icon: ticker.slice(0, 2).toUpperCase()
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
        name: assetDetails.name || (g.ticker + ' Corporation'),
        type: g.type || 'stocks',
        shares: Number(g.shares) || 0,
        avgCost: Number(g.avgCost) || 0,
        currentPrice: Number(assetDetails.currentPrice) || Number(g.lastPrice) || 0,
        stopLoss: Number(stopLossVal) || 0,
        change24h: Number(assetDetails.change24h) || 0,
        icon: assetDetails.icon || g.ticker.slice(0, 2).toUpperCase()
      });
    }
  }
}

/**
 * Calculates and updates top portfolio balance card metrics dynamically
 */
function updateBalanceMetrics() {
  const balanceCard = document.querySelector('.balance-card');
  const balanceAmountEl = document.querySelector('.balance-amount');
  const balanceChangeEl = document.querySelector('.balance-change');
  const activeOptionsEl = document.getElementById('active-options-value');

  if (!balanceAmountEl || !balanceChangeEl) return;

  let totalValue = 0;
  let totalPrevValue = 0;
  let optionContractsCount = 0;

  portfolioAssets.forEach(asset => {
    const value = asset.shares * asset.currentPrice;
    const prevValue = value / (1 + asset.change24h / 100);
    totalValue += value;
    totalPrevValue += prevValue;

    if (asset.type === 'options') {
      optionContractsCount += asset.shares;
    }
  });

  const totalChange = totalValue - totalPrevValue;
  const totalChangePct = (totalChange / totalPrevValue) * 100;

  // Format total balance
  balanceAmountEl.textContent = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(totalValue);

  // Format daily change percentage and dollar change
  const isPositive = totalChange >= 0;
  const changeClass = isPositive ? 'positive' : 'negative';

  balanceChangeEl.className = `balance-change ${changeClass}`;

  // Add profit/loss class to balance card to update main chart colors dynamically
  if (balanceCard) {
    if (isPositive) {
      balanceCard.classList.remove('loss');
      balanceCard.classList.add('profit');
    } else {
      balanceCard.classList.remove('profit');
      balanceCard.classList.add('loss');
    }
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

  // Update active options contracts
  if (activeOptionsEl) {
    activeOptionsEl.textContent = `${optionContractsCount} Contracts`;
  }

  // Update Buying Power
  const bpElement = document.getElementById('buying-power-value');
  if (bpElement) {
    let bpVal = parseFloat(localStorage.getItem('portfolio_buying_power') || '12342.90');
    bpElement.textContent = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(bpVal);
  }
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
  tableBody.innerHTML = '';

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
    // Calculating and formatting total holdings value (shares * average price)
    const holdingsValue = asset.shares * asset.avgCost;
    const formattedVal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(holdingsValue);

    // Formatting positive or negative total trade P&L (shares * current price - shares * average price)
    const changeUsd = (asset.shares * asset.currentPrice) - holdingsValue;
    const isPositive = changeUsd >= 0;
    const changeSign = isPositive ? 'positive' : 'negative';
    const arrowSymbol = isPositive ? '▲' : '▼';
    const formattedChange = `${arrowSymbol} ${new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(changeUsd))}`;

    // Quantity label depending on asset type
    const qtySuffix = asset.type === 'options' ? (asset.shares === 1 ? 'Cont.' : 'Conts.') : (asset.shares === 1 ? 'Share' : 'Shares');

    // Generate mini sparkline path coordinates dynamically
    const points = sparklineData[asset.ticker] || [asset.avgCost, asset.currentPrice];
    const sparklinePath = generateSparklinePath(points, 90, 24);
    const chartStrokeColor = isPositive ? 'var(--success)' : 'var(--danger)';

    // Split ticker name for premium two-line display (e.g. NVDA $490 Call -> NVDA and $490 Call)
    const tickerParts = asset.ticker.split(' ');
    const mainTicker = tickerParts[0];
    const subTicker = tickerParts.slice(1).join(' ');

    const slDisplay = (asset.stopLoss && asset.stopLoss > 0) ? `$${asset.stopLoss.toFixed(2)}` : '—';

    const rowHTML = `
      <div class="asset-row" data-ticker="${asset.ticker}" role="button" tabindex="0">
        <!-- Column 1: Icon & Ticker -->
        <div class="asset-col-ticker">
          <div class="asset-icon-box">${asset.icon}</div>
          <div class="ticker-text-container">
            <span class="asset-ticker">${mainTicker}</span>
            ${subTicker ? `<span class="asset-sub-ticker">${subTicker}</span>` : ''}
          </div>
        </div>
        
        <!-- Column 2: Number of stocks @ avg value -->
        <div class="asset-col-shares-avg">
          <span class="asset-shares-qty">${asset.shares} ${qtySuffix}</span>
          <span class="asset-avg-cost">@ $${asset.avgCost.toFixed(2)}</span>
        </div>
        
        <!-- Column 3: Stop Loss (SL) -->
        <div class="asset-col-sl">
          <span class="sl-price-val">${slDisplay}</span>
        </div>
        
        <!-- Column 4: Live value price -->
        <div class="asset-col-live-price">
          <span class="live-price-val">$${asset.currentPrice.toFixed(2)}</span>
        </div>
        
        <!-- Column 4: Total holding value and mini graph -->
        <div class="asset-col-total-graph">
          <div class="total-value-row">
            <span class="asset-total-val">${formattedVal}</span>
            <span class="asset-row-perf ${changeSign}">${formattedChange}</span>
          </div>
          <div class="asset-mini-chart">
            <svg class="mini-chart" viewBox="0 0 90 24" preserveAspectRatio="none">
              <path d="${sparklinePath}" fill="none" stroke="${chartStrokeColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    `;

    tableBody.insertAdjacentHTML('beforeend', rowHTML);
  });

  // Attach feedback click listeners to the asset rows
  const assetRows = tableBody.querySelectorAll('.asset-row');
  assetRows.forEach(row => {
    row.addEventListener('click', () => {
      const ticker = row.getAttribute('data-ticker');
      const asset = filtered.find(a => a.ticker === ticker);
      if (asset) {
        showAssetFeedback(asset);
      }
    });
  });
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
let lastCloudSyncTime = 0;
const CLOUD_SYNC_INTERVAL = 300000; // Throttle sheet sync to once every 5 minutes to preserve API limits

function startLivePriceEngine() {
  if (livePriceIntervalId) clearInterval(livePriceIntervalId);
  // Execute an immediate update of prices on startup/refresh
  updateLivePrices();
  // Set interval to update prices locally every 15 seconds
  livePriceIntervalId = setInterval(updateLivePrices, 15000);
}

async function updateLivePrices() {
  if (!portfolioAssets || portfolioAssets.length === 0) return;

  let marketPrices = {};
  try {
    marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
  } catch (e) {
    marketPrices = {};
  }

  let updatedAny = false;
  const now = Date.now();
  const shouldSyncCloud = (now - lastCloudSyncTime) >= CLOUD_SYNC_INTERVAL || lastCloudSyncTime === 0;

  for (const asset of portfolioAssets) {
    const ticker = asset.ticker;
    if (!ticker) continue;

    // Filter out options or other derivatives where API data is hard to query
    const isOption = asset.type === 'options' || ticker.includes('$') || ticker.includes('Call') || ticker.includes('Put');
    
    let price = asset.currentPrice;
    let change24h = asset.change24h;
    let success = false;

    if (!isOption) {
      try {
        // Attempt to fetch actual stock/crypto quote from Yahoo Finance API via CORS proxy
        const targetUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const wrapper = await res.json();
          if (wrapper && wrapper.contents) {
            const json = JSON.parse(wrapper.contents);
            if (json && json.chart && json.chart.result && json.chart.result[0]) {
              const meta = json.chart.result[0].meta;
              if (meta && meta.regularMarketPrice !== undefined) {
                price = meta.regularMarketPrice;
                const prevClose = meta.chartPreviousClose || price;
                change24h = ((price - prevClose) / prevClose) * 100;
                success = true;
              }
            }
          }
        }
      } catch (e) {
        console.warn(`Yahoo Finance API proxy fetch failed for ${ticker}, using local simulator fallback.`, e);
      }
    }

    // Local simulator fallback: add realistic small random market fluctuations (+/- 0.05% to 0.25%)
    if (!success) {
      const pct = (Math.random() - 0.5) * 0.3; // +/- 0.15% fluctuation
      price = price * (1 + pct / 100);
      change24h = change24h + pct;
      success = true;
    }

    // Save back to marketPrices cache
    if (marketPrices[ticker]) {
      marketPrices[ticker].currentPrice = price;
      marketPrices[ticker].change24h = change24h;
    } else {
      marketPrices[ticker] = {
        name: asset.name,
        currentPrice: price,
        change24h: change24h,
        icon: asset.icon || ticker.slice(0, 2).toUpperCase(),
        stopLoss: asset.stopLoss
      };
    }
    updatedAny = true;

    // Sync the updated live price back to SheetDB spreadsheet (throttled)
    if (shouldSyncCloud) {
      syncPriceToCloud(ticker, price);
    }
  }

  if (updatedAny) {
    localStorage.setItem('portfolio_market_prices', JSON.stringify(marketPrices));
    
    // Refresh the local assets array and re-render dashboard components
    refreshPortfolioAssets();
    updateBalanceMetrics();
    renderAssetsTable('all');
    
    if (shouldSyncCloud) {
      lastCloudSyncTime = now;
    }
  }
}

async function syncPriceToCloud(ticker, price) {
  const url = CLOUD_SPREADSHEET_CONFIG.endpointUrl;
  if (!url || url.includes("YOUR_API_URL")) {
    return; // offline/fallback mode
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({
        action: 'updatePrice',
        Symbol: ticker,
        CurrentPrice: Number(price)
      })
    });
    if (response.ok) {
      console.log(`Successfully synced live price $${price.toFixed(2)} for ${ticker} to Google Sheets.`);
    } else {
      console.warn(`Failed to sync price for ${ticker} to Google Sheets.`);
    }
  } catch (e) {
    console.error(`Error syncing price for ${ticker} to Google Sheets:`, e);
  }
}


