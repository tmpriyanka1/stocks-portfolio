const CLOUD_SPREADSHEET_CONFIG = {
  endpointUrl: "https://script.google.com/macros/s/AKfycbyq1B_7D2saPLfHISuwJrJI8PkUiQrgK3sDetSQE0rbcnTjSvXqKE0Dzl5gw4rB_xw7/exec"
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

const SIMULATED_TODAY = new Date();

// 1. MOCK TRANSACTIONS HISTORY DATABASE
const portfolioTransactions = [
  // --- DAILY (June 3, 2026) ---
  {
    ticker: 'NVDA',
    assetType: 'stocks',
    action: 'BUY',
    shares: 10,
    price: 480.00,
    date: '2026-06-03T10:15:00',
    comment: 'Momentum breakout buy after consolidation at $478.'
  },
  {
    ticker: 'NVDA',
    assetType: 'stocks',
    action: 'SELL',
    shares: 10,
    price: 495.00,
    date: '2026-06-03T14:30:00',
    comment: 'Quick day trade scalp target hit. Captured +$15.00/share profit.'
  },
  {
    ticker: 'PLTR',
    assetType: 'stocks',
    action: 'BUY',
    shares: 50,
    price: 21.00,
    date: '2026-06-03T09:45:00',
    comment: 'Support level bounce entry. Adding PLTR for core options setup.'
  },

  // --- WEEKLY (May 28, 2026 - June 2, 2026) ---
  {
    ticker: 'AAPL',
    assetType: 'stocks',
    action: 'BUY',
    shares: 30,
    price: 170.00,
    date: '2026-05-30T11:00:00',
    comment: 'Adding to core Apple position on temporary market-wide pullback.'
  },
  {
    ticker: 'AAPL',
    assetType: 'stocks',
    action: 'BUY',
    shares: 20,
    price: 172.00,
    date: '2026-05-31T13:45:00',
    comment: 'Averaging up on clear hourly trend confirmation and high volume.'
  },
  {
    ticker: 'AAPL',
    assetType: 'stocks',
    action: 'SELL',
    shares: 50,
    price: 178.00,
    date: '2026-06-01T15:30:00',
    comment: 'Closed full Apple swing trade. Locked in solid gains ahead of WWDC.'
  },
  {
    ticker: 'TSLA',
    assetType: 'stocks',
    action: 'BUY',
    shares: 15,
    price: 185.00,
    date: '2026-05-29T10:30:00',
    comment: 'Long setup near key support level. Stop loss set at $180.'
  },
  {
    ticker: 'NVDA $490 Call',
    assetType: 'options',
    action: 'BUY',
    shares: 3,
    price: 15.20,
    date: '2026-05-28T09:35:00',
    comment: 'Buy to open NVDA $490 Calls. Expecting momentum push towards $500.'
  },

  // --- MONTHLY (May 5, 2026 - May 27, 2026) ---
  {
    ticker: 'MSFT',
    assetType: 'stocks',
    action: 'BUY',
    shares: 40,
    price: 410.00,
    date: '2026-05-12T10:00:00',
    comment: 'AI integration catalyst play. Solid earnings growth expectations.'
  },
  {
    ticker: 'MSFT',
    assetType: 'stocks',
    action: 'SELL',
    shares: 20,
    price: 425.00,
    date: '2026-05-18T14:15:00',
    comment: 'Trimming half position at target 1 resistance. Keeping remainder.'
  },
  {
    ticker: 'COIN',
    assetType: 'stocks',
    action: 'BUY',
    shares: 25,
    price: 220.00,
    date: '2026-05-10T11:30:00',
    comment: 'Crypto breakout momentum entry above $218. High risk.'
  },
  {
    ticker: 'COIN',
    assetType: 'stocks',
    action: 'SELL',
    shares: 25,
    price: 205.00,
    date: '2026-05-15T10:10:00',
    comment: 'Stop loss triggered on crypto volatility. Closed for a loss.'
  },

  // --- YEARLY (June 4, 2025 - May 4, 2026) ---
  {
    ticker: 'AMZN',
    assetType: 'stocks',
    action: 'BUY',
    shares: 100,
    price: 160.00,
    date: '2026-01-15T14:00:00',
    comment: 'Post-Q4 earnings selloff dip buy. Solid long-term entry opportunity.'
  },
  {
    ticker: 'AMZN',
    assetType: 'stocks',
    action: 'SELL',
    shares: 100,
    price: 185.00,
    date: '2026-02-20T11:45:00',
    comment: 'Completed swing trade at resistance. Locked in +$2,500 total profit.'
  },
  {
    ticker: 'META',
    assetType: 'stocks',
    action: 'BUY',
    shares: 50,
    price: 450.00,
    date: '2025-10-05T10:15:00',
    comment: 'Ad revenue recovery play. Extremely cheap valuation relative to earnings.'
  },
  {
    ticker: 'META',
    assetType: 'stocks',
    action: 'SELL',
    shares: 20,
    price: 480.00,
    date: '2025-12-12T14:50:00',
    comment: 'Trimmed partial position for year-end tax optimization. Remaining 30 shares.'
  }
];

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved color theme
  const savedAccent = localStorage.getItem('portfolio_accent_color');
  if (savedAccent) {
    applyAccentColor(savedAccent);
  }

  initTimeFilters();
  initNavigationRedirects();

  // INSTANT FIRST RENDER: use cached localStorage data to eliminate load latency
  renderLedger('daily');

  // Background cloud pull — updates UI silently once fresh data arrives
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
 * Filters the transaction list by selected time range pill relative to simulated date
 */
function getFilteredTransactions(range) {
  let txs = [];
  const stored = localStorage.getItem('portfolio_transactions');
  if (stored) {
    try {
      txs = JSON.parse(stored);
    } catch (e) {
      txs = portfolioTransactions;
    }
  } else {
    txs = portfolioTransactions;
    localStorage.setItem('portfolio_transactions', JSON.stringify(portfolioTransactions));
  }

  return txs.filter(tx => {
    if (!tx || !tx.date) return false;
    const txDate = new Date(tx.date);
    if (isNaN(txDate.getTime())) return false; // Skip malformed dates

    const diffTime = SIMULATED_TODAY - txDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (range === 'daily') {
      return txDate.getFullYear() === SIMULATED_TODAY.getFullYear() &&
             txDate.getMonth() === SIMULATED_TODAY.getMonth() &&
             txDate.getDate() === SIMULATED_TODAY.getDate();
    } else if (range === 'weekly') {
      return diffDays <= 7 && diffDays >= -1;
    } else if (range === 'monthly') {
      return diffDays <= 30 && diffDays >= -1;
    } else if (range === 'yearly') {
      return diffDays <= 365 && diffDays >= -1;
    }
    return true;
  });
}

/**
 * Groups raw transactions by ticker and computes weighted metrics
 */
function groupTransactionsByTicker(transactions) {
  const groups = {};

  transactions.forEach(tx => {
    if (!tx || !tx.ticker) return; // Skip invalid or malformed transaction lines
    
    const ticker = tx.ticker;
    const assetType = tx.assetType || 'stocks';

    if (!groups[ticker]) {
      groups[ticker] = {
        ticker: ticker,
        assetType: assetType,
        buyQty: 0,
        buyVal: 0,
        sellQty: 0,
        sellVal: 0,
        transactions: []
      };
    }

    const g = groups[ticker];
    g.transactions.push(tx);

    const sharesNum = parseFloat(tx.shares) || 0;
    const priceNum = parseFloat(tx.price) || 0;
    const action = tx.action || 'BUY';

    if (action === 'BUY') {
      g.buyQty += sharesNum;
      g.buyVal += sharesNum * priceNum;
    } else if (action === 'SELL') {
      g.sellQty += sharesNum;
      g.sellVal += sharesNum * priceNum;
    }
  });

  const results = [];
  for (const ticker in groups) {
    const g = groups[ticker];

    // Sort transactions oldest first for natural chronological history reading
    g.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    const avgBuy = g.buyQty > 0 ? (g.buyVal / g.buyQty) : 0;
    const avgSell = g.sellQty > 0 ? (g.sellVal / g.sellQty) : 0;

    const netShares = g.buyQty - g.sellQty;
    const closedShares = Math.min(g.buyQty, g.sellQty);

    // Realized P&L = closed quantity * (weighted selling average - weighted buying average)
    const realizedPL = closedShares > 0 ? closedShares * (avgSell - avgBuy) : 0;

    results.push({
      ticker: g.ticker,
      assetType: g.assetType,
      buyQty: g.buyQty,
      buyAvg: avgBuy,
      sellQty: g.sellQty,
      sellAvg: avgSell,
      netShares: netShares,
      realizedPL: realizedPL,
      transactions: g.transactions
    });
  }

  return results;
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
      if (defaultAssetData[root] && defaultAssetData[root].name) {
        return defaultAssetData[root].name
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

function getAssetName(ticker) {
  let marketPrices = {};
  try {
    marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
  } catch (e) {
    marketPrices = {};
  }

  if (marketPrices[ticker] && marketPrices[ticker].name) {
    return marketPrices[ticker].name;
  }
  if (defaultAssetData[ticker] && defaultAssetData[ticker].name) {
    return defaultAssetData[ticker].name;
  }

  const rootMatch = ticker.match(/^([A-Za-z]+)/);
  if (rootMatch) {
    const root = rootMatch[1].toUpperCase();
    if (marketPrices[root] && marketPrices[root].name) {
      return marketPrices[root].name;
    }
    if (defaultAssetData[root] && defaultAssetData[root].name) {
      return defaultAssetData[root].name;
    }
  }

  return ticker + ' Corporation';
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
 * Builds HTML code dynamically for a grouped Position Master Card
 */
function createMasterCardHTML(cardData) {
  const isCompleted = cardData.netShares <= 0;
  // Dual-source options detection: type field OR ticker pattern ($price + CALL/PUT)
  const isOption = cardData.assetType === 'options'
    || (/\$\d/.test(cardData.ticker) && /\b(call|put)\b/i.test(cardData.ticker));
  // Options: apply standard 100-share leverage multiplier to P&L display
  const multiplier = isOption ? 100 : 1;


  const buyAvgStr = cardData.buyAvg > 0 ? `$${cardData.buyAvg.toFixed(2)}` : '—';
  const sellAvgStr = cardData.sellAvg > 0 ? `$${cardData.sellAvg.toFixed(2)}` : '—';

  let pnlClass = 'neutral';
  let pnlSign = '';
  const realizedPLLeveraged = cardData.realizedPL * multiplier;
  if (realizedPLLeveraged > 0) {
    pnlClass = 'positive';
    pnlSign = '+';
  } else if (realizedPLLeveraged < 0) {
    pnlClass = 'negative';
  }
  const pnlStr = `$${Math.abs(realizedPLLeveraged).toFixed(2)}`;

  const assetTypeLabel = isOption ? 'Option' : 'Stock';
  const qtyLabel = isOption ? 'Contracts' : 'Shares';

  // OPTIONS CONTRACT SPECIFICATION PARSER
  // Extracts strike price and Call/Put type from ticker like "NVDA $490 Call"
  let optionBadgeHTML = '';
  if (isOption) {
    const contractType = /\bCall\b/i.test(cardData.ticker) ? 'call'
                       : /\bPut\b/i.test(cardData.ticker) ? 'put' : null;
    if (contractType) {
      optionBadgeHTML += `<span class="option-badge ${contractType}">${contractType.toUpperCase()}</span>`;
    }
  }

  const displayTicker = isOption ? formatOptionTicker(cardData.ticker) : cardData.ticker;
  const rawAssetName = getAssetName(cardData.ticker);
  const cleanName = cleanAssetName(rawAssetName);

  // Generate timeline nodes
  const timelineHTML = cardData.transactions.map(tx => {
    if (!tx) return '';
    
    const txDate = tx.date ? new Date(tx.date) : new Date();
    const isToday = !isNaN(txDate.getTime()) &&
                    txDate.getFullYear() === SIMULATED_TODAY.getFullYear() &&
                    txDate.getMonth() === SIMULATED_TODAY.getMonth() &&
                    txDate.getDate() === SIMULATED_TODAY.getDate();
                    
    const formattedDate = isNaN(txDate.getTime())
      ? 'Unknown Date'
      : (isToday
        ? txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));

    const action = tx.action || 'BUY';
    const actionClass = action.toLowerCase();
    const actionLabel = action === 'SELL' ? 'Sold' : 'Bought';

    const sharesVal = parseFloat(tx.shares) || 0;
    const priceVal = parseFloat(tx.price) || 0;
    const comment = tx.comment || '';
    // For options, show the leveraged contract value in the timeline
    const txValue = isOption ? (sharesVal * priceVal * 100) : (sharesVal * priceVal);

    return `
      <div class="timeline-item ${actionClass}">
        <div class="timeline-dot"></div>
        <div class="timeline-header">
          <span class="timeline-action-text">${actionLabel} ${sharesVal} ${isOption ? 'Contracts' : 'Shares'} @ $${priceVal.toFixed(2)}${isOption ? ' <span class="option-multiplier-hint">×100 = $' + txValue.toFixed(2) + '</span>' : ''}</span>
          <span class="timeline-date">${formattedDate}</span>
        </div>
        ${comment ? `<div class="timeline-comment">${comment}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="master-card" data-ticker="${cardData.ticker}">
      <div class="card-header-row">
        <div class="card-title-box">
          <div class="ticker-text-container" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
            <span class="card-ticker">${displayTicker}</span>
            <span class="card-asset-name">${cleanName}</span>
          </div>
          <span class="card-asset-type">${assetTypeLabel}</span>
          ${optionBadgeHTML ? `<div class="option-badges-row">${optionBadgeHTML}</div>` : ''}
        </div>
        <div class="card-actions-area">
          <span class="card-pnl-badge ${pnlClass}">Realized P&L: ${pnlSign}${pnlStr}</span>
          <div class="expand-caret">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="card-stats-row">
        <div class="stat-mini-item">
          <span class="stat-mini-label">Buy Average</span>
          <span class="stat-mini-value">${buyAvgStr}${isOption ? ' <span class="option-multiplier-hint">×100</span>' : ''}</span>
        </div>
        <div class="stat-mini-item" style="text-align: center;">
          <span class="stat-mini-label">Net Holdings</span>
          <span class="stat-mini-value" style="color: ${isCompleted ? 'var(--text-muted)' : 'var(--success)'}">
            ${isCompleted ? 'Completed' : `${cardData.netShares} ${qtyLabel}`}
          </span>
        </div>
        <div class="stat-mini-item">
          <span class="stat-mini-label">Sell Average</span>
          <span class="stat-mini-value">${sellAvgStr}${isOption ? ' <span class="option-multiplier-hint">×100</span>' : ''}</span>
        </div>
      </div>
      
      <!-- Expandable Chronological Timeline -->
      <div class="timeline-wrapper">
        <div class="timeline-container">
          ${timelineHTML}
        </div>
      </div>
    </div>
  `;
}

/**
 * Groups, formats, and renders Master Cards into Active vs Completed sections
 */
function renderLedger(range) {
  const activeList = document.getElementById('active-ledger-list');
  const completedList = document.getElementById('completed-ledger-list');

  if (!activeList || !completedList) return;

  const txs = getFilteredTransactions(range);
  const grouped = groupTransactionsByTicker(txs);

  const activeCards = grouped.filter(g => g.netShares > 0);
  const completedCards = grouped.filter(g => g.netShares <= 0);

  // Render 🟢 Active Positions
  if (activeCards.length === 0) {
    activeList.innerHTML = `<div class="ledger-empty">No active positions in this period.</div>`;
  } else {
    activeList.innerHTML = activeCards.map(createMasterCardHTML).join('');
  }

  // Render ⚪ Completed Positions
  if (completedCards.length === 0) {
    completedList.innerHTML = `<div class="ledger-empty">No completed positions in this period.</div>`;
  } else {
    completedList.innerHTML = completedCards.map(createMasterCardHTML).join('');
  }

  // Attach expanding interaction event listeners
  const cards = document.querySelectorAll('.master-card');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Ignore clicks inside timeline comments/details so users can select text/comments
      if (e.target.closest('.timeline-wrapper')) {
        return;
      }
      card.classList.toggle('expanded');
    });
  });
}

/**
 * Initial setup for top sliding filter pills row
 */
function initTimeFilters() {
  const filterBtns = document.querySelectorAll('.pill-btn');
  const slider = document.getElementById('ledger-slider');

  function updateSlider(btn) {
    if (slider && btn) {
      slider.style.width = `${btn.offsetWidth}px`;
      slider.style.transform = `translateX(${btn.offsetLeft}px)`;
    }
  }

  const initialActive = document.querySelector('.pill-btn.active');
  if (initialActive) {
    requestAnimationFrame(() => {
      updateSlider(initialActive);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.getAttribute('data-range');
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSlider(btn);

      renderLedger(range);
    });
  });

  window.addEventListener('resize', () => {
    const activeBtn = document.querySelector('.pill-btn.active');
    updateSlider(activeBtn);
  });
}

/**
 * Handles bottom navigation tab redirects and page routing
 */
function initNavigationRedirects() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetId = tab.getAttribute('data-target');

      if (targetId === 'screen-ledger') {
        e.preventDefault();
        return; // Already on Ledger page
      }

      e.preventDefault();
      // Redirect to portfolio.html with tab selection query params
      if (targetId === 'screen-dashboard') {
        window.location.href = 'portfolio.html';
      } else if (targetId === 'screen-entry') {
        window.location.href = 'entry.html';
      } else if (targetId === 'settings-screen') {
        window.location.href = 'settings.html';
      } else {
        window.location.href = `portfolio.html?tab=${targetId}`;
      }
    });
  });
}

async function pullCloudData() {
  const url = CLOUD_SPREADSHEET_CONFIG.endpointUrl;
  if (!url || url.includes("YOUR_API_URL")) return;

  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!response.ok) throw new Error('Network response error.');
    const data = await response.json();
    
    if (Array.isArray(data)) {
      let marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
      
      const parsedTxs = data.map(tx => {
        const ticker = String(tx.Symbol || '').trim();
        const name = String(tx.Name || '');
        const action = String(tx.Action || 'BUY');
        const shares = parseInt(tx.Shares || 0, 10);
        const costBasis = parseFloat(tx.CostBasis || 0);
        // Fallback: if CurrentPrice is missing or 0, use costBasis so balance never drops to $0
        const rawCurrentPrice = parseFloat(tx.CurrentPrice || 0);
        const currentPrice = (rawCurrentPrice && rawCurrentPrice > 0) ? rawCurrentPrice : costBasis;
        const date = String(tx.Date || new Date().toISOString());
        const comment = String(tx['Trade Journal Note'] || '');
        const stopLoss = parseFloat(tx.SL || 0);
        
        let rawType = String(tx['Asset Type'] || 'Stock');
        let assetType = rawType.toLowerCase().includes('option') ? 'options' : 'stocks';
        // Auto-detect options from symbol string (e.g. "SPY $723 CALL 6/11")
        if (!rawType.toLowerCase().includes('option') && /\b(call|put)\b/i.test(ticker)) {
          assetType = 'options';
        }

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

      // Re-render ledger with the current time-range filter
      const activeBtn = document.querySelector('.pill-btn.active');
      renderLedger(activeBtn ? activeBtn.getAttribute('data-range') : 'daily');
    }
  } catch (err) {
    console.error('Background pull failed:', err);
  }
}
