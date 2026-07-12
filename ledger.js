const BASE_BACKEND_URL = '/api/';

const CLOUD_SPREADSHEET_CONFIG = {
  endpointUrl: BASE_BACKEND_URL + "trades"
};

const CLOUD_ENDPOINT = {
  endpointUrl: BASE_BACKEND_URL
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

function getDefaultAsset(ticker) {
  if (!ticker) return {};
  const upper = ticker.trim().toUpperCase();
  if (defaultAssetData[upper]) return defaultAssetData[upper];
  for (const key in defaultAssetData) {
    if (key.trim().toUpperCase() === upper) {
      return defaultAssetData[key];
    }
  }
  return {};
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

  const defAsset = getDefaultAsset(ticker);
  if (defAsset && defAsset.name && !defAsset.name.toLowerCase().startsWith('exp ')) {
    return defAsset.name;
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
    const undAsset = getDefaultAsset(underlying);
    if (undAsset && undAsset.name) {
      return undAsset.name;
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
    const undAsset = getDefaultAsset(underlying);
    if (undAsset && undAsset.name) {
      return undAsset.name;
    }
    if (tickersDb && tickersDb[underlying]) {
      return tickersDb[underlying];
    }
  }

  return capitalized;
}

const SIMULATED_TODAY = new Date();

let currentStartDate = null;
let currentEndDate = null;
let currentRangeType = 'daily';

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

  initNavigationRedirects();
  initAINotesCollapsible();

  // Load tickers DB, then initialize dropdowns and render ledger
  loadTickersDb().then(() => {
    initDropdownFilters();
  });

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
 * Checks if a transaction is within a start/end date range
 */
function isTxInRange(tx, startDate, endDate) {
  if (!tx || !tx.date) return false;
  const txDate = new Date(tx.date);
  if (isNaN(txDate.getTime())) return false; // Skip malformed dates
  if (!startDate || !endDate) return false;
  return txDate >= startDate && txDate <= endDate;
}

function getAllTransactions() {
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
  return txs;
}

/**
 * Filters the transaction list by start and end dates
 */
function getFilteredTransactions(startDate, endDate) {
  const txs = getAllTransactions();
  return txs.filter(tx => isTxInRange(tx, startDate, endDate));
}

/**
 * Groups raw transactions by ticker and computes weighted metrics
 */
function groupTransactionsByTicker(transactions, startDate, endDate) {
  let start = (startDate instanceof Date) ? startDate : null;
  let end = (endDate instanceof Date) ? endDate : null;

  if (!start || !end) {
    if (typeof startDate === 'string') {
      const refDate = new Date(SIMULATED_TODAY.getTime());
      if (startDate === 'daily') {
        start = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0);
        end = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
      } else if (startDate === 'weekly') {
        start = new Date(refDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = refDate;
      } else if (startDate === 'monthly') {
        start = new Date(refDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        end = refDate;
      } else if (startDate === 'yearly') {
        start = new Date(refDate.getFullYear() - 1, refDate.getMonth(), refDate.getDate(), 12, 0, 0);
        end = refDate;
      } else {
        start = new Date(0);
        end = new Date();
      }
    } else {
      start = new Date(0);
      end = new Date();
    }
  }

  const groups = {};
  transactions.forEach(tx => {
    if (!tx || !tx.ticker) return;
    if (tx.ticker === 'CASH' || tx.assetType === 'CASH') return;
    const ticker = tx.ticker;
    const assetType = tx.assetType || 'stocks';
    if (!groups[ticker]) {
      groups[ticker] = {
        ticker: ticker,
        assetType: assetType,
        transactions: []
      };
    }
    groups[ticker].transactions.push(tx);
  });

  const results = [];
  for (const ticker in groups) {
    const g = groups[ticker];
    g.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningShares = 0;
    let realizedPLInRange = 0;
    let buyQtyInRange = 0;
    let buyValInRange = 0;
    let sellQtyInRange = 0;
    let sellValInRange = 0;
    let hasSellInRange = false;
    const inRangeTransactions = [];

    // Buy layers queue for FIFO calculations
    const buyQueue = [];

    // Rolling balance as of end date
    let netSharesAsOfEndDate = 0;
    let avgBuyAsOfEndDate = 0;

    g.transactions.forEach(tx => {
      const sharesNum = parseFloat(tx.shares) || 0;
      const priceNum = parseFloat(tx.price) || 0;
      const action = tx.action || 'BUY';
      const txDate = new Date(tx.date);
      const isBeforeOrOnEnd = txDate <= end;
      const inRange = txDate >= start && txDate <= end;

      if (action === 'BUY') {
        runningShares += sharesNum;
        buyQueue.push({ shares: sharesNum, price: priceNum });

        if (inRange) {
          buyQtyInRange += sharesNum;
          buyValInRange += sharesNum * priceNum;
          inRangeTransactions.push(tx);
        }
      } else if (action === 'SELL') {
        let remainingToSell = sharesNum;
        let sellPnL = 0;

        while (remainingToSell > 0 && buyQueue.length > 0) {
          const oldestLayer = buyQueue[0];
          if (oldestLayer.shares <= remainingToSell) {
            sellPnL += oldestLayer.shares * (priceNum - oldestLayer.price);
            remainingToSell -= oldestLayer.shares;
            buyQueue.shift();
          } else {
            sellPnL += remainingToSell * (priceNum - oldestLayer.price);
            oldestLayer.shares -= remainingToSell;
            remainingToSell = 0;
          }
        }

        // If there's short selling or no match, assume 0 P&L for excess
        if (remainingToSell > 0) {
          remainingToSell = 0;
        }

        runningShares = Math.max(0, runningShares - sharesNum);

        if (inRange) {
          sellQtyInRange += sharesNum;
          sellValInRange += sharesNum * priceNum;
          realizedPLInRange += sellPnL;
          hasSellInRange = true;
          inRangeTransactions.push(tx);
        }
      }

      if (isBeforeOrOnEnd) {
        netSharesAsOfEndDate = runningShares;

        // Compute average cost of remaining layers in buyQueue
        let totalRemainingCost = 0;
        let totalRemainingShares = 0;
        buyQueue.forEach(layer => {
          totalRemainingCost += layer.shares * layer.price;
          totalRemainingShares += layer.shares;
        });
        avgBuyAsOfEndDate = totalRemainingShares > 0 ? (totalRemainingCost / totalRemainingShares) : 0;
      }
    });

    // Compute net shares today (current balance)
    let runningSharesAllTime = 0;
    let allTimeSellQty = 0;
    let allTimeSellVal = 0;
    let allTimeBuyQty = 0;
    let allTimeBuyVal = 0;
    g.transactions.forEach(tx => {
      const sharesNum = parseFloat(tx.shares) || 0;
      const priceNum = parseFloat(tx.price) || 0;
      const action = tx.action || 'BUY';
      if (action === 'BUY') {
        runningSharesAllTime += sharesNum;
        allTimeBuyQty += sharesNum;
        allTimeBuyVal += sharesNum * priceNum;
      } else if (action === 'SELL') {
        runningSharesAllTime = Math.max(0, runningSharesAllTime - sharesNum);
        allTimeSellQty += sharesNum;
        allTimeSellVal += sharesNum * priceNum;
      }
    });
    const currentSharesToday = runningSharesAllTime;
    const allTimeSellAvg = allTimeSellQty > 0 ? (allTimeSellVal / allTimeSellQty) : 0;
    const allTimeBuyAvg = allTimeBuyQty > 0 ? (allTimeBuyVal / allTimeBuyQty) : 0;

    if (netSharesAsOfEndDate > 0 || hasSellInRange) {
      const avgBuy = buyQtyInRange > 0 ? (buyValInRange / buyQtyInRange) : (avgBuyAsOfEndDate || allTimeBuyAvg);
      const avgSell = sellQtyInRange > 0 ? (sellValInRange / sellQtyInRange) : allTimeSellAvg;

      results.push({
        ticker: g.ticker,
        assetType: g.assetType,
        buyQty: buyQtyInRange,
        buyAvg: avgBuy,
        sellQty: sellQtyInRange,
        sellAvg: avgSell,
        netShares: netSharesAsOfEndDate,
        realizedPL: realizedPLInRange,
        transactions: g.transactions,
        inRangeTransactions: inRangeTransactions,
        hasSellInRange: hasSellInRange,
        currentSharesToday: currentSharesToday,
        avgBuyAsOfEndDate: avgBuyAsOfEndDate
      });
    }
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

  return resolveAssetName(ticker);
}

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
  const tickerDateMatch = ticker.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  if (tickerDateMatch) return `Exp ${tickerDateMatch[1]}`;

  // 3. Try to get it from defaultAssetData case-insensitively
  const defaultAsset = getDefaultAsset(ticker);
  if (defaultAsset && defaultAsset.name) {
    const nameMatch = defaultAsset.name.match(/Exp\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (nameMatch) return `Exp ${nameMatch[1]}`;
  }

  // 4. Fallback: try name field if it contains "Exp MM/DD/YY"
  if (name) {
    const nameMatch = name.match(/Exp\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (nameMatch) return `Exp ${nameMatch[1]}`;
  }
  return '';
}

function formatDateTime(d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const datePart = `${monthName} ${day},${year}`;

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timePart = `${hours}:${minutes}:${seconds} ${ampm}`;
  return `${datePart} ${timePart}`;
}

function isQuickDrawerComment(comment) {
  if (!comment) return false;
  const trimmed = comment.trim();
  return trimmed === 'Quick buy from portfolio drawer' || trimmed === 'Quick sell from portfolio drawer';
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
function createMasterCardHTML(cardData, listType) {
  // Dual-source options detection: type field OR ticker pattern ($price + CALL/PUT)
  const isOption = cardData.assetType === 'options'
    || (/\$\d/.test(cardData.ticker) && /\b(call|put)\b/i.test(cardData.ticker));
  // Options: apply standard 100-share leverage multiplier to P&L display
  const multiplier = isOption ? 100 : 1;

  const buyAvgVal = cardData.avgBuyAsOfEndDate || cardData.buyAvg || 0;
  const buyAvgStr = buyAvgVal > 0 ? `$${buyAvgVal.toFixed(2)}` : '—';
  const sellAvgStr = cardData.sellAvg > 0 ? `$${cardData.sellAvg.toFixed(2)}` : '—';

  // Retrieve current market price for Unrealized P&L
  let marketPrices = {};
  try {
    marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
  } catch (e) {
    marketPrices = {};
  }
  const marketEntry = getVal(marketPrices, cardData.ticker) || {};
  let currentPrice = parseFloat(marketEntry.currentPrice);
  if (isNaN(currentPrice)) {
    const defaultAsset = getDefaultAsset(cardData.ticker) || {};
    currentPrice = parseFloat(defaultAsset.currentPrice) || buyAvgVal || 0;
  }

  // 3-Tier P&L calculations
  const realizedPL = cardData.realizedPL * multiplier;
  const unrealizedPL = (cardData.netShares * currentPrice - cardData.netShares * buyAvgVal) * multiplier;

  let rightColumnHTML = '';
  if (listType === 'active') {
    const valueAmt = cardData.netShares * currentPrice * multiplier;
    rightColumnHTML = `
      <span class="stat-mini-label">Value</span>
      <span class="stat-mini-value">$${valueAmt.toFixed(2)}</span>
    `;
  } else {
    rightColumnHTML = `
      <span class="stat-mini-label">Sell Average</span>
      <span class="stat-mini-value">${sellAvgStr}${isOption ? ' <span class="option-multiplier-hint">×100</span>' : ''}</span>
    `;
  }

  // Class / sign formatting
  let realizedClass = 'pnl-neutral';
  let realizedSign = '';
  if (realizedPL > 0) { realizedClass = 'pnl-up'; realizedSign = '+'; }
  else if (realizedPL < 0) { realizedClass = 'pnl-down'; realizedSign = '-'; }

  let unrealizedClass = 'pnl-neutral';
  let unrealizedSign = '';
  if (unrealizedPL > 0) { unrealizedClass = 'pnl-up'; unrealizedSign = '+'; }
  else if (unrealizedPL < 0) { unrealizedClass = 'pnl-down'; unrealizedSign = '-'; }

  // Inject dynamic badges based on state matrix check (using calculateTradeStatus)
  let badgeHTML = '';
  const badge = cardData.hasOwnProperty('badgeOverride') && cardData.badgeOverride
    ? cardData.badgeOverride
    : calculateTradeStatus(cardData);
  if (badge) {
    badgeHTML = `<span class="badge ${badge.class}">${badge.icon} ${badge.label}</span>`;
  }

  const assetTypeLabel = isOption ? 'Option' : 'Stock';

  // OPTIONS CONTRACT SPECIFICATION PARSER
  let optionBadgeHTML = '';
  let colorPillarHTML = '';
  if (isOption) {
    const contractType = /\bCall\b/i.test(cardData.ticker) ? 'call'
      : /\bPut\b/i.test(cardData.ticker) ? 'put' : null;
    if (contractType) {
      optionBadgeHTML += `<span class="option-badge ${contractType}">${contractType.toUpperCase()}</span>`;
      colorPillarHTML = `<span class="color-pillar ${contractType}" title="${contractType.toUpperCase()}"></span>`;
    }
  }

  const displayTicker = isOption ? formatOptionTicker(cardData.ticker) : cardData.ticker;
  const rawAssetName = getAssetName(cardData.ticker);
  const cleanName = cleanAssetName(rawAssetName);
  const optionExpiry = isOption ? getOptionExpiry(cardData.ticker, rawAssetName) : '';

  // Generate timeline nodes (sorted in Reverse-Chronological Order)
  const timelineHTML = cardData.transactions.length === 0
    ? `<div style="padding: 10px 0; font-size: 11px; color: var(--text-muted); text-align: center; font-style: italic;">No transactions in this period.</div>`
    : cardData.transactions.slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(tx => {
        if (!tx) return '';

        const txDate = tx.date ? new Date(tx.date) : new Date();
        const action = tx.action || 'BUY';
        const actionClass = action.toLowerCase();
        const actionLabel = action === 'SELL' ? 'Sold' : 'Bought';

        const sharesVal = parseFloat(tx.shares) || 0;
        const priceVal = parseFloat(tx.price) || 0;
        const comment = tx.comment || '';

        const dateTimeStr = formatDateTime(txDate);

        // Filter out quick buy/sell drawer comments
        let displayComment = comment;
        if (isQuickDrawerComment(displayComment)) {
          displayComment = '';
        }

        return `
              <div class="timeline-item ${actionClass}">
                <div class="timeline-dot"></div>
                <div class="timeline-header">
                  <span class="timeline-action-text">${actionLabel} ${sharesVal} @ $${priceVal.toFixed(2)} - ${dateTimeStr}</span>
                </div>
                ${displayComment ? `<div class="timeline-comment">${displayComment}</div>` : ''}
              </div>
            `;
      }).join('');

  // Retrieve local notes database to build notes history timeline
  let tickerTimelineHTML = '';
  try {
    const allNotes = JSON.parse(localStorage.getItem('portfolio_notes') || '[]');
    const combinedNotes = [];

    // 1. Collect notes from portfolio_notes for this ticker
    allNotes.forEach(n => {
      if (n.ticker && n.ticker.trim().toUpperCase() === cardData.ticker.trim().toUpperCase()) {
        const dateStr = n.date || '2026-06-03';
        const timeStr = n.time || '00:00:00';
        const noteDate = new Date(`${dateStr}T${timeStr}`);
        combinedNotes.push({
          author: n.author || 'Admin',
          timestamp: noteDate,
          text: n.text || n.comment || ''
        });
      }
    });

    // Sort notes chronologically (oldest at the top)
    combinedNotes.sort((a, b) => a.timestamp - b.timestamp);

    if (combinedNotes.length > 0) {
      const formatTimestamp = (d) => formatDateTime(d);

      const notesListHTML = combinedNotes.map(n => `
        <div class="ticker-timeline-node" style="position: relative; padding-left: 20px; margin-bottom: 12px;">
          <div class="ticker-timeline-dot" style="position: absolute; left: 4px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent, #a855f7); border: 2px solid var(--bg-primary, #06070c); box-shadow: 0 0 8px var(--accent-glow, rgba(168, 85, 247, 0.4));"></div>
          <div class="ticker-timeline-meta" style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-bottom: 2px; font-family: var(--font-main);">
            <span class="ticker-timeline-author">👤 ${n.author}</span>
            <span class="ticker-timeline-timestamp">${formatTimestamp(n.timestamp)}</span>
          </div>
          <div class="ticker-timeline-text" style="font-size: 11px; color: var(--text-primary); text-align: left; line-height: 1.4; white-space: pre-wrap; font-family: var(--font-main);">${n.text}</div>
        </div>
      `).join('');

      tickerTimelineHTML = `
        <div class="ticker-timeline" style="margin-top: 14px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 10px; position: relative;">
          <div style="font-size: 10px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; text-align: left; font-family: var(--font-main);">Journal Notes Timeline</div>
          <div class="ticker-timeline-list" style="position: relative;">
            <div style="position: absolute; left: 7px; top: 6px; bottom: 6px; width: 1px; background: rgba(255,255,255,0.05);"></div>
            ${notesListHTML}
          </div>
        </div>
      `;
    } else {
      tickerTimelineHTML = `
        <div class="ticker-timeline" style="margin-top: 14px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 10px; text-align: center; font-size: 11px; color: var(--text-muted); font-style: italic; font-family: var(--font-main);">
          No journal notes logged for this asset.
        </div>
      `;
    }
  } catch (err) {
    console.error('Error generating notes history timeline:', err);
  }

  let pnlDisplayHTML = '';
  if (listType === 'active') {
    pnlDisplayHTML = `
      <div class="pnl-single-display" style="margin-top: 10px; font-size: 12px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 8px; font-family: var(--font-main); text-align: left;">
        <span style="color: var(--text-muted); font-size: 11px;">Unrealized P&L:</span> <strong class="unrealized-val ${unrealizedClass}" style="font-size: 13px;">${unrealizedSign}$${Math.abs(unrealizedPL).toFixed(2)}</strong>
      </div>
    `;
  } else {
    pnlDisplayHTML = `
      <div class="pnl-single-display" style="margin-top: 10px; font-size: 12px; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 8px; font-family: var(--font-main); text-align: left;">
        <span style="color: var(--text-muted); font-size: 11px;">Realized P&L:</span> <strong class="realized-val ${realizedClass}" style="font-size: 13px;">${realizedSign}$${Math.abs(realizedPL).toFixed(2)}</strong>
      </div>
    `;
  }

  return `
    <div class="master-card" data-ticker="${cardData.ticker}">
      <div class="card-header-row">
        <div class="card-title-box">
          <div class="ticker-text-container" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
            <div class="ticker-title-row" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="card-ticker" style="margin-bottom: 0;">${displayTicker}</span>
              ${badgeHTML}
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              ${colorPillarHTML}
              <span class="card-asset-name">${cleanName}</span>
            </div>
            ${optionExpiry ? `<span class="card-asset-expiry" style="color: var(--text-muted); font-size: 10px; display: block; margin-top: 2px;">${optionExpiry}</span>` : ''}
          </div>
          ${assetTypeLabel === 'Stock' ? '' : `<span class="card-asset-type">${assetTypeLabel}</span>`}
          ${optionBadgeHTML ? `<div class="option-badges-row">${optionBadgeHTML}</div>` : ''}
        </div>
        <div class="card-actions-area">
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
          <span class="stat-mini-value" style="color: ${listType === 'active' ? 'var(--success)' : 'var(--text-muted)'}">
            ${listType === 'active' ? `${cardData.netShares}` : `Sold ${cardData.sellQty}`}
          </span>
        </div>
        <div class="stat-mini-item">
          ${rightColumnHTML}
        </div>
      </div>

      ${pnlDisplayHTML}
      
      <!-- Expandable Chronological Timeline -->
      <div class="timeline-wrapper">
        <div class="timeline-container">
          ${timelineHTML}
        </div>
        ${tickerTimelineHTML}
      </div>
    </div>
  `;
}

/**
 * Groups, formats, and renders Master Cards into Active vs Completed sections
 */
function renderLedger(rangeType, startDate, endDate) {
  currentRangeType = rangeType;
  currentStartDate = startDate;
  currentEndDate = endDate;

  // Add skeleton pulse loading state to metric cards
  const metricCards = document.querySelectorAll('.metric-card');
  metricCards.forEach(card => card.classList.add('loading'));

  const activeList = document.getElementById('active-ledger-list');
  const completedList = document.getElementById('completed-ledger-list');

  if (!activeList || !completedList) return;

  const allTxs = getAllTransactions();
  const grouped = groupTransactionsByTicker(allTxs, startDate, endDate);

  const activeCards = [];
  const completedCards = [];

  grouped.forEach(g => {
    // Determine netSharesAsOfEndDate
    let netSharesAsOfEndDate = 0;
    let runningSharesTemp = 0;
    g.transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const sharesNum = parseFloat(tx.shares) || 0;
      const action = tx.action || 'BUY';
      if (action === 'BUY') {
        runningSharesTemp += sharesNum;
      } else if (action === 'SELL') {
        runningSharesTemp = Math.max(0, runningSharesTemp - sharesNum);
      }
      if (txDate <= endDate) {
        netSharesAsOfEndDate = runningSharesTemp;
      }
    });

    const badge = getAssetStateBadge(g, startDate, endDate);

    // Make sure card's netShares reflects the state at the end of the period
    g.netShares = netSharesAsOfEndDate;

    if (badge && badge.type === 'partial') {
      // Partially closed: split into active (remaining) and completed (sold)
      const activePortion = {
        ...g,
        badgeOverride: null // No badge under active positions
      };
      activeCards.push(activePortion);

      const completedPortion = {
        ...g,
        netShares: 0,
        badgeOverride: {
          type: 'partial',
          label: 'Partially Closed',
          class: 'badge-partial',
          icon: '🔵'
        }
      };
      completedCards.push(completedPortion);
    } else if (badge && badge.type === 'sold_later') {
      // Sold later: active at the time, closed later
      const activePortion = {
        ...g,
        badgeOverride: badge
      };
      activeCards.push(activePortion);
    } else if (badge && badge.type === 'closed') {
      // Closed during the period: only in completed list
      const completedPortion = {
        ...g,
        netShares: 0,
        badgeOverride: badge
      };
      completedCards.push(completedPortion);
    } else if (netSharesAsOfEndDate > 0) {
      // Regular active position (no sells in range): only in active list
      activeCards.push(g);
    }
  });

  // Render 🟢 Active Positions
  if (activeCards.length === 0) {
    activeList.innerHTML = `<div class="ledger-empty">No active positions in this period.</div>`;
  } else {
    activeList.innerHTML = activeCards.map(c => createMasterCardHTML(c, 'active')).join('');
  }

  // Render ⚪ Closed Positions
  if (completedCards.length === 0) {
    completedList.innerHTML = `<div class="ledger-empty">No closed positions in this period.</div>`;
  } else {
    completedList.innerHTML = completedCards.map(c => createMasterCardHTML(c, 'closed')).join('');
  }

  // Calculate and update Section 1 metrics
  calculateSection1Metrics(rangeType, startDate, endDate);

  // Sync timeframe data packets from the backend skeleton route
  fetch(CLOUD_ENDPOINT.endpointUrl + `reports?filter=${rangeType}`)
    .then(res => {
      if (res.ok) return res.json();
      throw new Error(`Server returned status ${res.status}`);
    })
    .then(data => {
      // Remove skeleton loading state
      const cards = document.querySelectorAll('.metric-card');
      cards.forEach(card => card.classList.remove('loading'));

      console.log(`[Reports Endpoint Sync] Successfully loaded timeframe packet for filter="${rangeType}":`, data);

      const containerEl = document.getElementById('ledger-scroll-container');
      const tableSection = document.querySelector('.table-section');
      let existingPlaceholder = document.getElementById('reports-empty-state-placeholder');

      if (data.trades && data.trades.length === 0) {
        // Hide the empty table structure
        if (containerEl) {
          containerEl.style.display = 'none';
        }

        // Inject a beautifully styled placeholder message
        if (!existingPlaceholder) {
          existingPlaceholder = document.createElement('div');
          existingPlaceholder.id = 'reports-empty-state-placeholder';
          existingPlaceholder.innerHTML = `
            <div style="text-align: center; padding: 48px 24px; color: var(--text-muted); font-family: var(--font-main); font-size: 14px;">
              <div style="font-size: 28px; margin-bottom: 12px; filter: grayscale(1); opacity: 0.5;">📊</div>
              <div style="font-weight: 550; letter-spacing: 0.3px;">No transaction history logged for this interval.</div>
            </div>
          `;
          if (tableSection) {
            tableSection.parentNode.insertBefore(existingPlaceholder, tableSection);
          }
        } else {
          existingPlaceholder.style.display = 'block';
        }
      } else {
        // Show table layout, hide placeholder
        if (containerEl) {
          containerEl.style.display = 'block';
        }
        if (existingPlaceholder) {
          existingPlaceholder.style.display = 'none';
        }
      }
    })
    .catch(err => {
      // Remove skeleton loading state
      const cards = document.querySelectorAll('.metric-card');
      cards.forEach(card => card.classList.remove('loading'));
      console.error(`[Reports Endpoint Sync Error] Failed to fetch reports timeframe packet:`, err);
    });

  // Fetch and update AI Journal Digest summary
  const filteredTxs = getFilteredTransactions(startDate, endDate);
  fetchAIJournalSummary(filteredTxs, rangeType);

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
/**
 * Initial setup for dropdown filters row
 */
function initDropdownFilters() {
  generatePeriodOptions();

  const containers = document.querySelectorAll('.pill-dropdown-container');
  const pillGroup = document.querySelector('.pill-group');

  function closeAllDropdowns() {
    containers.forEach(container => {
      const dropdown = container.querySelector('.glass-dropdown');
      if (dropdown) dropdown.classList.remove('show');
    });

    containers.forEach(container => {
      const type = container.getAttribute('data-type') || container.querySelector('.dropdown-toggle')?.getAttribute('data-type');
      if (type === currentRangeType) {
        container.classList.add('active');
      } else {
        container.classList.remove('active');
      }
    });
    if (pillGroup) {
      pillGroup.classList.remove('pill-group-dimmed');
      if (document.querySelector('.pill-dropdown-container.active')) {
        pillGroup.classList.add('pill-group-dimmed');
      }
    }
  }

  containers.forEach(container => {
    const type = container.getAttribute('data-type') || container.querySelector('.dropdown-toggle')?.getAttribute('data-type');
    const button = container.querySelector('.dropdown-toggle');
    const dropdown = container.querySelector('.glass-dropdown');

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShown = dropdown.classList.contains('show');

      closeAllDropdowns();

      if (!isShown) {
        dropdown.classList.add('show');
        containers.forEach(c => {
          if (c === container) {
            c.classList.add('active');
          } else {
            c.classList.remove('active');
          }
        });
        if (pillGroup) {
          pillGroup.classList.add('pill-group-dimmed');
        }
      } else {
        dropdown.classList.remove('show');
        closeAllDropdowns();
      }
    });

    dropdown.addEventListener('click', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      e.stopPropagation();

      const value = li.getAttribute('data-value');

      const { startDate, endDate } = getPeriodDateRange(type, value);
      currentStartDate = startDate;
      currentEndDate = endDate;
      currentRangeType = type;

      dropdown.querySelectorAll('li').forEach(item => {
        item.classList.remove('selected');
      });
      li.classList.add('selected');

      let displayText = value;
      if (type === 'monthly') {
        displayText = value.split(' ')[0];
      }
      const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
      button.innerHTML = `${capitalizedType}: ${displayText} <span class="chevron">⌵</span>`;

      containers.forEach(c => {
        if (c !== container) {
          const otherType = c.getAttribute('data-type') || c.querySelector('.dropdown-toggle')?.getAttribute('data-type');
          const otherButton = c.querySelector('.dropdown-toggle');
          const capitalizedOtherType = otherType.charAt(0).toUpperCase() + otherType.slice(1);
          otherButton.innerHTML = `${capitalizedOtherType} <span class="chevron">⌵</span>`;
          const otherDropdown = c.querySelector('.glass-dropdown');
          if (otherDropdown) {
            otherDropdown.querySelectorAll('li').forEach(item => {
              item.classList.remove('selected');
            });
          }
        }
      });

      const contextLabel = document.getElementById('reporting-context-label');
      if (contextLabel) {
        contextLabel.textContent = `Reporting for: ${formatDateRange(startDate, endDate)}`;
      }

      dropdown.classList.remove('show');
      closeAllDropdowns();

      renderLedger(currentRangeType, currentStartDate, currentEndDate);
    });
  });

  document.addEventListener('click', () => {
    closeAllDropdowns();
  });

  const dailyDropdown = document.getElementById('dropdown-daily');
  if (dailyDropdown) {
    const todayOption = dailyDropdown.querySelector('li[data-value="Today"]');
    if (todayOption) {
      todayOption.click();
    }
  }
}

function generatePeriodOptions() {
  const refDate = new Date(SIMULATED_TODAY.getTime());

  // 1. Daily
  const dailyUl = document.getElementById('dropdown-daily');
  if (dailyUl) {
    dailyUl.innerHTML = '';
    const options = ['Today', 'D-1', 'D-2', 'D-3'];
    options.forEach(opt => {
      const li = document.createElement('li');
      li.textContent = opt;
      li.setAttribute('data-value', opt);
      dailyUl.appendChild(li);
    });
  }

  // 2. Weekly
  const weeklyUl = document.getElementById('dropdown-weekly');
  if (weeklyUl) {
    weeklyUl.innerHTML = '';
    const options = ['This Week', 'W-1', 'W-2', 'W-3'];
    options.forEach(opt => {
      const li = document.createElement('li');
      li.textContent = opt;
      li.setAttribute('data-value', opt);
      weeklyUl.appendChild(li);
    });
  }

  // 3. Monthly
  const monthlyUl = document.getElementById('dropdown-monthly');
  if (monthlyUl) {
    monthlyUl.innerHTML = '';
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    let currentYear = refDate.getFullYear();
    let currentMonthIdx = refDate.getMonth();
    for (let i = 0; i < 12; i++) {
      const label = `${monthNames[currentMonthIdx]} ${currentYear}`;
      const li = document.createElement('li');
      li.textContent = label;
      li.setAttribute('data-value', label);
      monthlyUl.appendChild(li);

      currentMonthIdx--;
      if (currentMonthIdx < 0) {
        currentMonthIdx = 11;
        currentYear--;
      }
    }
  }

  // 4. Quarterly
  const quarterlyUl = document.getElementById('dropdown-quarterly');
  if (quarterlyUl) {
    quarterlyUl.innerHTML = '';
    let currentYear = refDate.getFullYear();
    let currentQuarter = Math.floor(refDate.getMonth() / 3) + 1;
    for (let i = 0; i < 8; i++) {
      const label = `${currentYear}-Q${currentQuarter}`;
      const li = document.createElement('li');
      li.textContent = label;
      li.setAttribute('data-value', label);
      quarterlyUl.appendChild(li);

      currentQuarter--;
      if (currentQuarter === 0) {
        currentQuarter = 4;
        currentYear--;
      }
    }
  }

  // 5. Yearly
  const yearlyUl = document.getElementById('dropdown-yearly');
  if (yearlyUl) {
    yearlyUl.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const year = refDate.getFullYear() - i;
      const label = `${year}`;
      const li = document.createElement('li');
      li.textContent = label;
      li.setAttribute('data-value', label);
      yearlyUl.appendChild(li);
    }
  }
}

function getPeriodDateRange(type, value) {
  let startDate = new Date();
  let endDate = new Date();
  const refDate = new Date(SIMULATED_TODAY.getTime());

  if (type === 'daily') {
    if (value === 'Today') {
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0);
      endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
    } else {
      const num = parseInt(value.replace('D-', ''), 10);
      const targetDate = new Date(refDate.getTime() - num * 24 * 60 * 60 * 1000);
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
      endDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
    }
  } else if (type === 'weekly') {
    if (value === 'This Week') {
      const day = refDate.getDay();
      const sunday = new Date(refDate.getTime() - day * 24 * 60 * 60 * 1000);
      startDate = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 0, 0, 0);
      endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
    } else {
      const num = parseInt(value.replace('W-', ''), 10);
      const day = refDate.getDay();
      const sundayOfThisWeek = new Date(refDate.getTime() - day * 24 * 60 * 60 * 1000);
      const targetSunday = new Date(sundayOfThisWeek.getTime() - num * 7 * 24 * 60 * 60 * 1000);
      const targetSaturday = new Date(targetSunday.getTime() + 6 * 24 * 60 * 60 * 1000);

      startDate = new Date(targetSunday.getFullYear(), targetSunday.getMonth(), targetSunday.getDate(), 0, 0, 0);
      endDate = new Date(targetSaturday.getFullYear(), targetSaturday.getMonth(), targetSaturday.getDate(), 23, 59, 59, 999);
    }
  } else if (type === 'monthly') {
    const parts = value.split(' ');
    const monthName = parts[0];
    const year = parseInt(parts[1], 10);
    const monthIndex = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ].indexOf(monthName);

    startDate = new Date(year, monthIndex, 1, 0, 0, 0);
    endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  } else if (type === 'quarterly') {
    const parts = value.split('-Q');
    const year = parseInt(parts[0], 10);
    const qNum = parseInt(parts[1], 10);

    let startMonth = 0;
    let endMonth = 2;
    if (qNum === 1) { startMonth = 0; endMonth = 2; }
    else if (qNum === 2) { startMonth = 3; endMonth = 5; }
    else if (qNum === 3) { startMonth = 6; endMonth = 8; }
    else if (qNum === 4) { startMonth = 9; endMonth = 11; }

    startDate = new Date(year, startMonth, 1, 0, 0, 0);
    endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
  } else if (type === 'yearly') {
    const year = parseInt(value, 10);
    startDate = new Date(year, 0, 1, 0, 0, 0);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  }

  return { startDate, endDate };
}

function formatShortDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatDateRange(startDate, endDate) {
  const startStr = formatShortDate(startDate);
  const endStr = formatShortDate(endDate);
  if (startStr === endStr) {
    return startStr;
  }
  return `${startStr} - ${endStr}`;
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
    await loadTickersDb();

    // Fetch trades
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) throw new Error('Network response error.');
    const data = await response.json();

    // Fetch notes/comments from local server
    try {
      const notesUrl = url.replace('/trades', '/notes');
      const notesResponse = await fetch(notesUrl, { method: 'GET' });
      if (notesResponse.ok) {
        const notesData = await notesResponse.json();
        localStorage.setItem('portfolio_notes', JSON.stringify(notesData));
      }
    } catch (notesErr) {
      console.warn('Failed to fetch notes from server:', notesErr);
    }

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
          if (!rawType.toLowerCase().includes('option') && /\b(call|put)\b/i.test(ticker)) {
            assetType = 'options';
          }
        }

        if (ticker && assetType !== 'CASH') {
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

          const queryTicker = assetType === 'options' ? ticker.split(/[\s$@]/)[0].toUpperCase() : ticker;
          if (!marketPrices[queryTicker] || !marketPrices[queryTicker].name || marketPrices[queryTicker].name === queryTicker) {
            fetchTickerNameFromInternet(queryTicker).then(fetchedName => {
              if (fetchedName) {
                let mp = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
                if (!mp[queryTicker]) mp[queryTicker] = {};
                mp[queryTicker].name = fetchedName;
                localStorage.setItem('portfolio_market_prices', JSON.stringify(mp));
                renderLedger(currentRangeType, currentStartDate, currentEndDate);
              }
            });
          }
        }

        const expiryDate = tx['Expiry Date'] || tx.expiryDate || tx.expiry || '';
        return { ticker, assetType, action, shares, price: costBasis, date, comment, stopLoss, expiryDate };
      }).filter(tx => tx.ticker !== '');

      localStorage.setItem('portfolio_market_prices', JSON.stringify(marketPrices));
      localStorage.setItem('portfolio_transactions', JSON.stringify(parsedTxs));

      // Fetch and save cash transactions
      try {
        const cashUrl = url.replace('/trades', '/cash');
        const cashResponse = await fetch(cashUrl, { method: 'GET' });
        if (cashResponse.ok) {
          const cashData = await cashResponse.json();
          localStorage.setItem('portfolio_cash_ledger', JSON.stringify(cashData));
        }
      } catch (cashErr) {
        console.warn('Failed to fetch cash ledger from server:', cashErr);
      }

      // Re-render ledger with the current range
      renderLedger(currentRangeType, currentStartDate, currentEndDate);
    }
  } catch (err) {
    console.error('Background pull failed:', err);
  }
}

/**
 * Checks if a transaction occurred before the specified start date
 */
function isTxBeforeRange(tx, startDate) {
  if (!tx || !tx.date) return false;
  const txDate = new Date(tx.date);
  if (isNaN(txDate.getTime())) return false;
  if (!startDate) return false;
  return txDate < startDate;
}

/**
 * Calculates Section 1 metrics and updates DOM snapshot card plus sparkline
 */
function calculateSection1Metrics(rangeType, startDate, endDate) {
  // ── CASH (buying power) CALCULATIONS ──
  let cashTxs = [];
  try {
    cashTxs = JSON.parse(localStorage.getItem('portfolio_cash_ledger') || '[]');
  } catch (e) {
    cashTxs = [];
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

  const rawTxs = getAllTransactions();
  rawTxs.forEach(tx => {
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

  let buyingPower = Math.max(0, dynamicCash);

  const isUserSet = localStorage.getItem('portfolio_buying_power_user_set') === 'true';
  if (isUserSet) {
    buyingPower = parseFloat(localStorage.getItem('portfolio_buying_power') || '0');
  }

  const allTxs = getAllTransactions().filter(tx => tx.ticker !== 'CASH' && tx.assetType !== 'CASH');

  const intervalTimes = [];
  const start = new Date(startDate.getTime());
  const end = new Date(endDate.getTime());

  if (rangeType === 'daily') {
    for (let h = 0; h <= 24; h++) {
      intervalTimes.push(new Date(start.getTime() + h * 60 * 60 * 1000));
    }
  } else if (rangeType === 'weekly') {
    for (let d = 0; d <= 7; d++) {
      intervalTimes.push(new Date(start.getTime() + d * 24 * 60 * 60 * 1000));
    }
  } else if (rangeType === 'monthly') {
    const numDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    for (let d = 0; d <= numDays; d++) {
      intervalTimes.push(new Date(start.getTime() + d * 24 * 60 * 60 * 1000));
    }
  } else if (rangeType === 'quarterly') {
    const step = (end.getTime() - start.getTime()) / 12;
    for (let i = 0; i <= 12; i++) {
      intervalTimes.push(new Date(start.getTime() + i * step));
    }
  } else {
    const step = (end.getTime() - start.getTime()) / 12;
    for (let i = 0; i <= 12; i++) {
      intervalTimes.push(new Date(start.getTime() + i * step));
    }
  }

  // Calculate valuation at each interval boundary
  const rollingValuations = intervalTimes.map(t => {
    let val = 0;
    allTxs.forEach(tx => {
      if (new Date(tx.date) <= t) {
        const isOption = tx.assetType === 'options' || (/\$\d/.test(tx.ticker) && /\b(call|put)\b/i.test(tx.ticker));
        const multiplier = isOption ? 100 : 1;
        const txVal = (parseFloat(tx.shares) || 0) * (parseFloat(tx.price) || 0) * multiplier;
        if (tx.action === 'BUY') {
          val += txVal;
        } else if (tx.action === 'SELL') {
          val -= txVal;
        }
      }
    });
    return val;
  });

  const periodOpenCost = rollingValuations[0];
  const periodCurrentValue = rollingValuations[rollingValuations.length - 1];
  const netPnL = periodCurrentValue - periodOpenCost;

  // DOM elements updates
  const startValEl = document.getElementById('snap-start-value');
  const currentValEl = document.getElementById('snap-current-value');
  const pnlEl = document.getElementById('snap-pnl-value');

  let closedPL = 0;
  let activePL = 0;

  let marketPrices = {};
  try {
    marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
  } catch (e) {
    marketPrices = {};
  }

  const allGroups = groupTransactionsByTicker(allTxs, startDate, endDate);
  allGroups.forEach(pos => {
    const isOption = pos.assetType === 'options' || (/\$\d/.test(pos.ticker) && /\b(call|put)\b/i.test(pos.ticker));
    const multiplier = isOption ? 100 : 1;

    // Closed P&L
    closedPL += pos.realizedPL * multiplier;

    // Active P&L
    if (pos.netShares > 0) {
      const marketEntry = getVal(marketPrices, pos.ticker) || {};
      const costBasis = pos.avgBuyAsOfEndDate || pos.buyAvg || 0;
      let currentPrice = parseFloat(marketEntry.currentPrice);
      if (isNaN(currentPrice)) {
        const defaultAsset = getDefaultAsset(pos.ticker) || {};
        currentPrice = parseFloat(defaultAsset.currentPrice) || costBasis || 0;
      }
      const unrealizedPL = (pos.netShares * currentPrice - pos.netShares * costBasis) * multiplier;
      activePL += unrealizedPL;
    }
  });

  let totalAssetValue = 0;
  allGroups.forEach(pos => {
    if (pos.netShares > 0) {
      const marketEntry = getVal(marketPrices, pos.ticker) || {};
      const costBasis = pos.avgBuyAsOfEndDate || pos.buyAvg || 0;
      let currentPrice = parseFloat(marketEntry.currentPrice);
      if (isNaN(currentPrice)) {
        const defaultAsset = getDefaultAsset(pos.ticker) || {};
        currentPrice = parseFloat(defaultAsset.currentPrice) || costBasis || 0;
      }
      const isOption = pos.assetType === 'options' || (/\$\d/.test(pos.ticker) && /\b(call|put)\b/i.test(pos.ticker));
      const multiplier = isOption ? 100 : 1;
      totalAssetValue += pos.netShares * currentPrice * multiplier;
    }
  });

  const totalPortfolioValue = buyingPower + totalAssetValue;
  const totalValueEl = document.getElementById('summary-total-value');
  if (totalValueEl) {
    totalValueEl.textContent = '$' + totalPortfolioValue.toFixed(2);
  }

  const totalPerformance = closedPL + activePL;
  const perfEl = document.getElementById('total-performance-value');
  if (perfEl) {
    perfEl.classList.remove('pnl-up', 'pnl-down', 'pnl-neutral', 'text-profit', 'text-loss');
    if (totalPerformance > 0) {
      perfEl.textContent = `+$${totalPerformance.toFixed(2)}`;
      perfEl.classList.add('pnl-up', 'text-profit');
    } else if (totalPerformance < 0) {
      perfEl.textContent = `-$${Math.abs(totalPerformance).toFixed(2)}`;
      perfEl.classList.add('pnl-down', 'text-loss');
    } else {
      perfEl.textContent = `$0.00`;
      perfEl.classList.add('pnl-neutral');
    }
  }

  // Update the Realized, Unrealized, and Total P&L elements
  const summaryRealizedEl = document.getElementById('summary-realized-pnl');
  const summaryUnrealizedEl = document.getElementById('summary-unrealized-pnl');
  const summaryTotalEl = document.getElementById('summary-total-pnl');

  const updatePnLElement = (el, val) => {
    if (!el) return;
    el.classList.remove('pnl-up', 'pnl-down', 'pnl-neutral', 'neutral', 'text-profit', 'text-loss');
    if (val > 0) {
      el.textContent = `+$${val.toFixed(2)}`;
      el.classList.add('pnl-up', 'text-profit');
    } else if (val < 0) {
      el.textContent = `-$${Math.abs(val).toFixed(2)}`;
      el.classList.add('pnl-down', 'text-loss');
    } else {
      el.textContent = `$0.00`;
      el.classList.add('pnl-neutral');
    }
  };

  updatePnLElement(summaryRealizedEl, closedPL);
  updatePnLElement(summaryUnrealizedEl, activePL);
  updatePnLElement(summaryTotalEl, totalPerformance);

  const accountValueOverride = localStorage.getItem('portfolio_value_override');
  if (accountValueOverride && accountValueOverride.trim() !== '') {
    const trimmedOverride = accountValueOverride.trim();
    if (perfEl) {
      perfEl.textContent = trimmedOverride;
      perfEl.className = 'pnl-neutral';
    }
    if (totalValueEl) {
      totalValueEl.textContent = trimmedOverride;
    }
  }

  if (startValEl) startValEl.textContent = "$" + periodOpenCost.toFixed(2);
  if (currentValEl) currentValEl.textContent = "$" + periodCurrentValue.toFixed(2);

  if (pnlEl) {
    pnlEl.classList.remove('pnl-up', 'pnl-down', 'pnl-neutral');
    if (netPnL > 0) {
      pnlEl.textContent = `+$${netPnL.toFixed(2)}`;
      pnlEl.classList.add('pnl-up');
    } else if (netPnL < 0) {
      pnlEl.textContent = `-$${Math.abs(netPnL).toFixed(2)}`;
      pnlEl.classList.add('pnl-down');
    } else {
      pnlEl.textContent = `$0.00`;
      pnlEl.classList.add('pnl-neutral');
    }
  }

  // Draw SVG sparkline
  const width = 300;
  const height = 60;
  const padding = 5;
  const points = [];

  const minVal = Math.min(...rollingValuations);
  const maxVal = Math.max(...rollingValuations);
  const valRange = maxVal - minVal;

  if (rollingValuations.length === 1) {
    points.push({ x: 0, y: height / 2 });
    points.push({ x: width, y: height / 2 });
  } else {
    rollingValuations.forEach((val, index) => {
      const x = (index / (rollingValuations.length - 1)) * width;
      let y = height / 2;
      if (valRange > 0) {
        y = (height - 2 * padding) - ((val - minVal) / valRange) * (height - 2 * padding) + padding;
      }
      points.push({ x, y });
    });
  }

  const lineD = points.map((p, idx) => (idx === 0 ? 'M' : 'L') + ` ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = lineD + ` L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

  const trendPath = document.getElementById('snap-trend-path');
  const graphArea = document.getElementById('snap-graph-area');
  const dotsGroup = document.getElementById('snap-graph-dots');

  if (trendPath) {
    trendPath.setAttribute('d', lineD);
    if (netPnL > 0) {
      trendPath.setAttribute('stroke', 'var(--success, #10b981)');
    } else if (netPnL < 0) {
      trendPath.setAttribute('stroke', 'var(--danger, #ef4444)');
    } else {
      trendPath.setAttribute('stroke', 'var(--text-muted)');
    }
  }
  if (graphArea) {
    graphArea.setAttribute('d', areaD);
  }

  if (dotsGroup) {
    dotsGroup.innerHTML = '';
    points.forEach(p => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', p.x.toFixed(1));
      circle.setAttribute('cy', p.y.toFixed(1));
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', netPnL > 0 ? 'var(--success, #10b981)' : netPnL < 0 ? 'var(--danger, #ef4444)' : 'var(--text-muted)');
      circle.setAttribute('stroke', 'var(--bg-primary, #06070c)');
      circle.setAttribute('stroke-width', '1');
      circle.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      circle.style.cursor = 'pointer';

      circle.addEventListener('mouseover', () => {
        circle.setAttribute('r', '5.5');
        circle.setAttribute('stroke-width', '1.5');
      });
      circle.addEventListener('mouseout', () => {
        circle.setAttribute('r', '3');
        circle.setAttribute('stroke-width', '1');
      });

      dotsGroup.appendChild(circle);
    });
  }
}

/**
 * Issues a POST request to Google Apps Script endpoint to get Gemini summary of Trade Journal notes
 */
async function fetchAIJournalSummary(transactions, currentRange) {
  const briefTextEl = document.getElementById('snap-ai-brief-text');
  if (!briefTextEl) return;

  // 1. Load notes from portfolio_notes
  let allNotes = [];
  try {
    allNotes = JSON.parse(localStorage.getItem('portfolio_notes') || '[]');
  } catch (e) {
    allNotes = [];
  }

  // 2. Filter comments that match the current date range
  const matchedNotes = [];

  allNotes.forEach(n => {
    if (!n.date) return;
    const timeStr = n.time || '00:00:00';
    const noteDate = new Date(`${n.date}T${timeStr}`);
    if (noteDate >= currentStartDate && noteDate <= currentEndDate) {
      if (n.text && n.text.trim().length > 0) {
        matchedNotes.push(n.text.trim());
      }
    }
  });

  // Also include transaction comments in the period
  transactions.forEach(tx => {
    if (tx.comment && tx.comment.trim().length > 0) {
      matchedNotes.push(tx.comment.trim());
    }
  });

  if (matchedNotes.length === 0) {
    briefTextEl.textContent = "No journal notes logged for this reporting period.";
    return;
  }

  briefTextEl.textContent = "Generating AI Summary...";

  const compileLocalSummary = (notesList, range) => {
    // Unique notes
    const unique = [...new Set(notesList)];
    if (unique.length === 0) return "No journal notes logged for this reporting period.";
    return `Compiled Trades & Notes: ${unique.join(' ')}`;
  };

  const enforceLineLimit = (text, range) => {
    if (!text) return '';
    let cleanText = text.replace(/^(📝\s*)?Compiled\s+Journal\s+Digest\s*(\([^)]*\))?:?\s*\n?/i, '').trim();
    const lines = cleanText.split('\n').filter(l => l.trim().length > 0);
    const maxLines = (range === 'daily' || range === 'weekly') ? 5 : 10;
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n');
    }
    return cleanText;
  };

  const url = CLOUD_SPREADSHEET_CONFIG.endpointUrl;
  if (!url || url.includes("YOUR_API_URL") || url.includes("localhost") || url.includes("127.0.0.1")) {
    briefTextEl.textContent = compileLocalSummary(matchedNotes, currentRange);
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'getAIJournalSummary',
        notes: matchedNotes,
        range: currentRange
      })
    });
    if (!response.ok) {
      throw new Error('Network response error.');
    }
    const data = await response.text();

    let isJson = false;
    let jsonParsed = null;
    try {
      const trimmed = data.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        jsonParsed = JSON.parse(trimmed);
        isJson = true;
      }
    } catch (e) {
      isJson = false;
    }

    if (isJson && jsonParsed) {
      if (jsonParsed.summary) {
        briefTextEl.textContent = enforceLineLimit(jsonParsed.summary, currentRange);
      } else {
        briefTextEl.textContent = compileLocalSummary(matchedNotes, currentRange);
      }
    } else {
      briefTextEl.textContent = enforceLineLimit(data, currentRange) || compileLocalSummary(matchedNotes, currentRange);
    }
  } catch (err) {
    console.error('AI Journal summary fetch failed:', err);
    briefTextEl.textContent = compileLocalSummary(matchedNotes, currentRange);
  }
}

function getAssetStateBadge(cardData, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  let runningShares = 0;
  let liquidationDate = null;

  // Transactions are already sorted chronologically in cardData.transactions
  cardData.transactions.forEach(tx => {
    const sharesNum = parseFloat(tx.shares) || 0;
    const action = tx.action || 'BUY';

    if (action === 'BUY') {
      runningShares += sharesNum;
    } else if (action === 'SELL') {
      runningShares = Math.max(0, runningShares - sharesNum);
      if (runningShares === 0) {
        liquidationDate = new Date(tx.date);
      } else {
        liquidationDate = null;
      }
    }
  });

  const currentSharesToday = runningShares;
  const hasSellInRange = cardData.hasSellInRange;

  // Calculate netSharesAsOfEndDate
  let netSharesAsOfEndDate = 0;
  let runningSharesTemp = 0;
  cardData.transactions.forEach(tx => {
    const txDate = new Date(tx.date);
    const sharesNum = parseFloat(tx.shares) || 0;
    const action = tx.action || 'BUY';
    if (action === 'BUY') {
      runningSharesTemp += sharesNum;
    } else if (action === 'SELL') {
      runningSharesTemp = Math.max(0, runningSharesTemp - sharesNum);
    }
    if (txDate <= end) {
      netSharesAsOfEndDate = runningSharesTemp;
    }
  });

  if (netSharesAsOfEndDate > 0) {
    if (currentSharesToday === 0 && liquidationDate && liquidationDate > end) {
      return {
        type: 'sold_later',
        label: 'Sold Later',
        class: 'badge-sold-later',
        icon: '🟡'
      };
    }
    if (hasSellInRange) {
      return {
        type: 'partial',
        label: 'Partial Close',
        class: 'badge-partial',
        icon: '🔵'
      };
    }
    return null;
  } else {
    if (liquidationDate && liquidationDate >= start && liquidationDate <= end) {
      return {
        type: 'closed',
        label: 'Closed',
        class: 'badge-closed',
        icon: '⚪'
      };
    }
    return null;
  }
}

function getOptionExpiryDate(ticker, name) {
  const expiryStr = getOptionExpiry(ticker, name);
  if (!expiryStr) return null;
  const match = expiryStr.match(/Exp\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
  if (!match) return null;
  const month = parseInt(match[1], 10) - 1;
  const day = parseInt(match[2], 10);
  let year = match[3] ? parseInt(match[3], 10) : null;
  if (year === null) {
    year = (typeof SIMULATED_TODAY !== 'undefined' ? SIMULATED_TODAY : new Date()).getFullYear();
  } else if (year < 100) {
    year += 2000;
  }
  const dateObj = new Date(year, month, day);
  dateObj.setHours(0, 0, 0, 0);
  return dateObj;
}

function calculateTradeStatus(trade) {
  if (!trade) return null;

  const sharesRemaining = typeof trade.shares_remaining !== 'undefined'
    ? parseFloat(trade.shares_remaining)
    : (typeof trade.netShares !== 'undefined' ? parseFloat(trade.netShares) : 0);

  const isOption = trade.assetType === 'options'
    || (trade.ticker && /\$\d/.test(trade.ticker) && /\b(call|put)\b/i.test(trade.ticker));

  if (isOption) {
    const isExercised = trade.exercised === true
      || (trade.transactions && trade.transactions.some(tx => tx && tx.action && tx.action.toUpperCase() === 'EXERCISE'));

    if (isExercised) {
      return {
        class: 'badge-exercised',
        icon: '🔵',
        label: 'Exercised'
      };
    }

    const rawAssetName = typeof getAssetName === 'function' ? getAssetName(trade.ticker) : '';
    const expiryDate = getOptionExpiryDate(trade.ticker, rawAssetName);
    if (expiryDate) {
      const currentDate = new Date((typeof SIMULATED_TODAY !== 'undefined' ? SIMULATED_TODAY : new Date()).getTime());
      currentDate.setHours(0, 0, 0, 0);

      if (currentDate > expiryDate) {
        return {
          class: 'badge-expired',
          icon: '🔴',
          label: 'Expired'
        };
      }
    }
  }

  if (sharesRemaining > 0) {
    return {
      class: 'badge-active',
      icon: '🟢',
      label: 'Active'
    };
  } else {
    return {
      class: 'badge-closed',
      icon: '⚪',
      label: 'Closed'
    };
  }
}

function initAINotesCollapsible() {
  const openBtn = document.getElementById('open-ai-modal-btn');
  const container = document.getElementById('ai-digest-container');
  const header = document.getElementById('ai-digest-header');
  const body = document.getElementById('ai-digest-body');
  const dismissBtn = document.getElementById('dismiss-ai-digest-btn');
  const toggleIcon = document.getElementById('ai-digest-toggle-icon');

  if (!container || !header || !body || !dismissBtn || !toggleIcon) return;

  // Toggle expand/collapse when clicking header (excluding dismiss button click)
  header.addEventListener('click', (e) => {
    if (e.target.closest('#dismiss-ai-digest-btn')) {
      return; // Handled by dismiss button listener
    }

    const isCollapsed = body.style.display === 'none';
    if (isCollapsed) {
      body.style.display = 'block';
      toggleIcon.textContent = '▼';
      container.classList.remove('collapsed');
    } else {
      body.style.display = 'none';
      toggleIcon.textContent = '▶';
      container.classList.add('collapsed');
    }
  });

  // Dismiss button hides container entirely
  dismissBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.style.display = 'none';
  });

  // Open button displays and expands container
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      container.style.display = 'block';
      body.style.display = 'block';
      toggleIcon.textContent = '▼';
      container.classList.remove('collapsed');

      // Auto-scroll to show the container
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}

async function fetchTickerNameFromInternet(ticker) {
  try {
    const targetUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const wrapper = await res.json();
      if (wrapper && wrapper.contents) {
        const json = JSON.parse(wrapper.contents);
        if (json && json.quotes && json.quotes[0]) {
          const name = json.quotes[0].longname || json.quotes[0].shortname;
          if (name) return name;
        }
      }
    }
  } catch (e) {
    console.warn(`Failed to fetch ticker name for ${ticker} from internet:`, e);
  }
  return null;
}

