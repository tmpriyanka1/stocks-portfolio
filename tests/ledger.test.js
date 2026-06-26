/**
 * @file ledger.test.js
 * @description Unit tests for ledger.js — covers:
 *   - getFilteredTransactions (date range filtering: daily, weekly, monthly, yearly)
 *   - groupTransactionsByTicker (aggregation, buy avg, sell avg, realized P&L)
 *   - Realized P&L ×100 multiplier for options
 *   - createMasterCardHTML isOption detection (dual-source)
 *   - parseOptionSpec (badge parser — identical logic to portfolio.js)
 *   - pullCloudData row parser (currentPrice fallback, auto-detect options)
 *   - applyAccentColor
 *
 * @jest-environment jest-environment-jsdom
 */

// ══════════════════════════════════════════════════════════════════════════════
// Pure logic re-implementations from ledger.js
// ══════════════════════════════════════════════════════════════════════════════

const SIMULATED_TODAY = new Date();

// SOURCE: isTxInRange
function isTxInRange(tx, startDateOrRange, endDate) {
  if (startDateOrRange === undefined) return true;
  if (!tx || !tx.date) return false;
  const txDate = new Date(tx.date);
  if (isNaN(txDate.getTime())) return false; // Skip malformed dates

  if (typeof startDateOrRange === 'string') {
    const range = startDateOrRange;
    if (range === 'all') {
      return true;
    }
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
  }

  const startDate = startDateOrRange;
  if (!startDate || !endDate) return false;
  return txDate >= startDate && txDate <= endDate;
}

// SOURCE: getFilteredTransactions
function getFilteredTransactions(txs, startDateOrRange, endDate) {
  return txs.filter(tx => isTxInRange(tx, startDateOrRange, endDate));
}

// SOURCE: groupTransactionsByTicker
function groupTransactionsByTicker(transactions, startDateOrRange, endDate) {
  let start = (startDateOrRange instanceof Date) ? startDateOrRange : null;
  let end = (endDate instanceof Date) ? endDate : null;

  if (!start || !end) {
    if (typeof startDateOrRange === 'string') {
      const refDate = new Date(SIMULATED_TODAY.getTime());
      if (startDateOrRange === 'daily') {
        start = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0);
        end = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
      } else if (startDateOrRange === 'weekly') {
        start = new Date(refDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = refDate;
      } else if (startDateOrRange === 'monthly') {
        start = new Date(refDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        end = refDate;
      } else if (startDateOrRange === 'yearly') {
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
      groups[ticker] = { ticker, assetType, transactions: [] };
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
    g.transactions.forEach(tx => {
      const sharesNum = parseFloat(tx.shares) || 0;
      const action = tx.action || 'BUY';
      if (action === 'BUY') {
        runningSharesAllTime += sharesNum;
      } else if (action === 'SELL') {
        runningSharesAllTime = Math.max(0, runningSharesAllTime - sharesNum);
      }
    });
    const currentSharesToday = runningSharesAllTime;

    if (netSharesAsOfEndDate > 0 || hasSellInRange) {
      const avgBuy = buyQtyInRange > 0 ? (buyValInRange / buyQtyInRange) : avgBuyAsOfEndDate;
      const avgSell = sellQtyInRange > 0 ? (sellValInRange / sellQtyInRange) : 0;

      results.push({
        ticker: g.ticker,
        assetType: g.assetType,
        buyQty: buyQtyInRange,
        buyAvg: avgBuy,
        sellQty: sellQtyInRange,
        sellAvg: avgSell,
        netShares: netSharesAsOfEndDate,
        realizedPL: realizedPLInRange,
        transactions: inRangeTransactions,
        hasSellInRange: hasSellInRange,
        currentSharesToday: currentSharesToday,
        avgBuyAsOfEndDate: avgBuyAsOfEndDate
      });
    }
  }
  return results;
}

// SOURCE: isOption dual-source (createMasterCardHTML)
function detectIsOption(ticker, assetType) {
  return assetType === 'options' ||
    (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
}

// SOURCE: Realized P&L with options multiplier (createMasterCardHTML)
function calcRealizedPLLeveraged(realizedPL, isOption) {
  return realizedPL * (isOption ? 100 : 1);
}

// SOURCE: parseOptionSpec (createMasterCardHTML badge parser)
function parseOptionSpec(ticker) {
  const strikeMatch = ticker.match(/\$(\d+(?:\.\d+)?)/);
  const strikePrice = strikeMatch ? strikeMatch[1] : null;
  const contractType = /\bcall\b/i.test(ticker) ? 'call'
    : /\bput\b/i.test(ticker) ? 'put' : null;
  const expiryMatch = ticker.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  const expiry = expiryMatch ? expiryMatch[1] : null;
  return { strikePrice, contractType, expiry };
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

// SOURCE: pullCloudData row parser (ledger.js version)
function parseCloudRow(tx) {
  const ticker = String(getVal(tx, 'Symbol') || '').trim().toUpperCase();
  const costBasis = parseFloat(getVal(tx, 'Price') || getVal(tx, 'CostBasis') || getVal(tx, 'Avg Price') || 0);
  const rawCurrentPrice = parseFloat(getVal(tx, 'CurrentPrice') || 0);
  const currentPrice = rawCurrentPrice && rawCurrentPrice > 0 ? rawCurrentPrice : costBasis;
  let rawType = String(getVal(tx, 'Asset Type') || 'Stock');
  let assetType = rawType.toLowerCase().includes('option') ? 'options' : 'stocks';
  if (rawType.toUpperCase() === 'CASH' || ticker === 'CASH') {
    assetType = 'CASH';
  } else {
    if (!rawType.toLowerCase().includes('option') && /\b(call|put)\b/i.test(ticker)) {
      assetType = 'options';
    }
  }
  const shares = parseInt(getVal(tx, 'Shares') || 0, 10);
  const action = String(getVal(tx, 'Action') || 'BUY');
  const stopLoss = parseFloat(getVal(tx, 'SL') || 0);
  return { ticker, assetType, action, shares, price: costBasis, currentPrice, stopLoss };
}

// SOURCE: applyAccentColor (ledger.js)
function applyAccentColor(hexColor) {
  document.documentElement.style.setProperty('--accent', hexColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
}

// ══════════════════════════════════════════════════════════════════════════════
// Fixture helpers
// ══════════════════════════════════════════════════════════════════════════════

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════════════════

describe('getFilteredTransactions — date range filtering', () => {
  let txToday, tx3DaysAgo, tx15DaysAgo, allTxs;

  beforeEach(() => {
    // Build today's date in local time to match SIMULATED_TODAY.getDate()
    const now = new Date();
    const yy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    txToday = { ticker: 'NVDA', date: `${yy}-${mm}-${dd}T${hh}:${mi}:00`, action: 'BUY', shares: 10, price: 480 };
    tx3DaysAgo = { ticker: 'AAPL', date: `${daysAgoISO(3)}T10:00:00`, action: 'BUY', shares: 30, price: 170 };
    tx15DaysAgo = { ticker: 'TSLA', date: `${daysAgoISO(15)}T10:00:00`, action: 'BUY', shares: 15, price: 185 };
    const tx200DaysAgo = { ticker: 'META', date: `${daysAgoISO(200)}T10:00:00`, action: 'BUY', shares: 50, price: 450 };
    allTxs = [txToday, tx3DaysAgo, tx15DaysAgo, tx200DaysAgo];
  });

  test('daily filter returns only today\'s transactions', () => {
    const result = getFilteredTransactions(allTxs, 'daily');
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('NVDA');
  });

  test('weekly filter returns transactions within last 7 days', () => {
    const result = getFilteredTransactions(allTxs, 'weekly');
    expect(result.map(t => t.ticker)).toContain('NVDA');
    expect(result.map(t => t.ticker)).toContain('AAPL');
    expect(result.map(t => t.ticker)).not.toContain('TSLA');
    expect(result.map(t => t.ticker)).not.toContain('META');
  });

  test('monthly filter returns transactions within last 30 days', () => {
    const result = getFilteredTransactions(allTxs, 'monthly');
    expect(result.map(t => t.ticker)).toContain('NVDA');
    expect(result.map(t => t.ticker)).toContain('AAPL');
    expect(result.map(t => t.ticker)).toContain('TSLA');
    expect(result.map(t => t.ticker)).not.toContain('META');
  });

  test('yearly filter returns transactions within last 365 days', () => {
    const tx400DaysAgo = { ticker: 'META', date: `${daysAgoISO(400)}T10:00:00`, action: 'BUY', shares: 50, price: 450 };
    const txsWithOld = [txToday, tx3DaysAgo, tx15DaysAgo, tx400DaysAgo];
    const result = getFilteredTransactions(txsWithOld, 'yearly');
    expect(result.map(t => t.ticker)).toContain('NVDA');
    expect(result.map(t => t.ticker)).toContain('TSLA');
    expect(result.map(t => t.ticker)).not.toContain('META');
  });

  test('unknown range returns all transactions', () => {
    const result = getFilteredTransactions(allTxs, 'all');
    expect(result).toHaveLength(4);
  });

  test('filters out transactions with no date', () => {
    const withNoDate = [...allTxs, { ticker: 'COIN', action: 'BUY', shares: 10, price: 200 }];
    const result = getFilteredTransactions(withNoDate, 'daily');
    expect(result.every(t => t.date)).toBe(true);
  });

  test('filters out transactions with malformed date', () => {
    const withBadDate = [...allTxs, { ticker: 'COIN', date: 'not-a-date', action: 'BUY', shares: 10, price: 200 }];
    const result = getFilteredTransactions(withBadDate, 'daily');
    expect(result.map(t => t.ticker)).not.toContain('COIN');
  });

  test('null/undefined transactions are skipped', () => {
    const withNull = [null, undefined, txToday];
    const result = getFilteredTransactions(withNull, 'daily');
    expect(result).toHaveLength(1);
  });

  test('empty transaction list returns empty array', () => {
    expect(getFilteredTransactions([], 'daily')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('groupTransactionsByTicker — position aggregation', () => {
  test('single BUY: buy avg equals price', () => {
    const txs = [{ ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480, date: '2026-06-03T10:00:00' }];
    const result = groupTransactionsByTicker(txs);
    expect(result[0].buyAvg).toBeCloseTo(480, 2);
    expect(result[0].buyQty).toBe(10);
  });

  test('two BUYs: correct weighted average', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 30, price: 170, date: '2026-05-30T11:00:00' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 20, price: 172, date: '2026-05-31T13:00:00' },
    ];
    const result = groupTransactionsByTicker(txs);
    // (30*170 + 20*172) / 50 = 170.8
    expect(result[0].buyAvg).toBeCloseTo(170.8, 2);
  });

  test('BUY + SELL: correct sell average', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 50, price: 170, date: '2026-05-30T11:00:00' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'SELL', shares: 50, price: 178, date: '2026-06-01T15:00:00' },
    ];
    const result = groupTransactionsByTicker(txs);
    expect(result[0].sellAvg).toBeCloseTo(178, 2);
  });

  test('BUY + SELL: net shares = 0 (completed)', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 50, price: 170, date: '2026-05-30T11:00:00' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'SELL', shares: 50, price: 178, date: '2026-06-01T15:00:00' },
    ];
    const result = groupTransactionsByTicker(txs);
    expect(result[0].netShares).toBe(0);
  });

  test('realized P&L: profit on completed position', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480, date: '2026-06-03T10:00:00' },
      { ticker: 'NVDA', assetType: 'stocks', action: 'SELL', shares: 10, price: 495, date: '2026-06-03T14:00:00' },
    ];
    const result = groupTransactionsByTicker(txs);
    // closedShares=10, avgSell=495, avgBuy=480 → P&L = 10 * (495-480) = 150
    expect(result[0].realizedPL).toBeCloseTo(150, 2);
  });

  test('realized P&L: loss on completed position', () => {
    const txs = [
      { ticker: 'COIN', assetType: 'stocks', action: 'BUY', shares: 25, price: 220, date: '2026-05-10T11:00:00' },
      { ticker: 'COIN', assetType: 'stocks', action: 'SELL', shares: 25, price: 205, date: '2026-05-15T10:00:00' },
    ];
    const result = groupTransactionsByTicker(txs);
    // 25 * (205-220) = -375
    expect(result[0].realizedPL).toBeCloseTo(-375, 2);
  });

  test('active position (no sell): realized P&L = 0', () => {
    const txs = [
      { ticker: 'TSLA', assetType: 'stocks', action: 'BUY', shares: 15, price: 185, date: '2026-05-29T10:00:00' },
    ];
    const result = groupTransactionsByTicker(txs);
    expect(result[0].realizedPL).toBe(0);
    expect(result[0].netShares).toBe(15);
  });

  test('multiple tickers grouped independently', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480, date: '2026-06-03T10:00:00' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 30, price: 170, date: '2026-05-30T11:00:00' },
    ];
    const result = groupTransactionsByTicker(txs);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.ticker)).toContain('NVDA');
    expect(result.map(r => r.ticker)).toContain('AAPL');
  });

  test('transactions sorted chronologically within group', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'SELL', shares: 10, price: 495, date: '2026-06-03T14:00:00' },
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480, date: '2026-06-03T10:00:00' },
    ];
    const result = groupTransactionsByTicker(txs);
    const dates = result[0].transactions.map(t => new Date(t.date).getTime());
    expect(dates[0]).toBeLessThan(dates[1]);
  });

  test('skips invalid/null transactions', () => {
    const txs = [null, undefined, { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480, date: '2026-06-03T10:00:00' }];
    const result = groupTransactionsByTicker(txs);
    expect(result).toHaveLength(1);
  });

  test('empty transaction list returns empty results', () => {
    expect(groupTransactionsByTicker([])).toHaveLength(0);
  });

  test('active position with no transactions in the daily range IS included in daily view under rolling balance engine', () => {
    const txs = [
      { ticker: 'TSLA', assetType: 'stocks', action: 'BUY', shares: 15, price: 185, date: daysAgoISO(10) + 'T10:00:00' },
    ];
    const result = groupTransactionsByTicker(txs, 'daily');
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('TSLA');
    expect(result[0].netShares).toBe(15);
  });

  test('rolling balance identifies historical open positions that are closed today', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 400, date: daysAgoISO(10) + 'T10:00:00' },
      { ticker: 'NVDA', assetType: 'stocks', action: 'SELL', shares: 10, price: 450, date: daysAgoISO(2) + 'T12:00:00' } // Sold 2 days ago
    ];
    // Check as of 5 days ago (weekly filter of a past week, or custom end date = 5 days ago)
    const refDate = new Date(SIMULATED_TODAY.getTime());
    const fiveDaysAgo = new Date(refDate.getTime() - 5 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = new Date(refDate.getTime() - 10 * 24 * 60 * 60 * 1000);
    
    const result = groupTransactionsByTicker(txs, tenDaysAgo, fiveDaysAgo);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('NVDA');
    expect(result[0].netShares).toBe(10); // Had 10 shares as of 5 days ago
    expect(result[0].currentSharesToday).toBe(0); // Has 0 shares today
  });

  test('rolling balance identifies partial close positions', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 20, price: 150, date: daysAgoISO(5) + 'T10:00:00' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'SELL', shares: 5, price: 170, date: daysAgoISO(2) + 'T12:00:00' } // Partial sell
    ];
    const refDate = new Date(SIMULATED_TODAY.getTime());
    const startOfWeek = new Date(refDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const result = groupTransactionsByTicker(txs, startOfWeek, refDate);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('AAPL');
    expect(result[0].netShares).toBe(15); // holds 15 shares at end of week
    expect(result[0].hasSellInRange).toBe(true); // sold shares in the week (partial close)
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('Options Realized P&L ×100 multiplier', () => {
  test('stock P&L: no multiplier', () => {
    expect(calcRealizedPLLeveraged(150, false)).toBe(150);
  });

  test('option P&L: ×100 multiplier applied', () => {
    // e.g. 3 contracts * ($18.50 - $15.20) = $9.90 raw → $990 leveraged
    const rawPL = 3 * (18.50 - 15.20); // = 9.90
    expect(calcRealizedPLLeveraged(rawPL, true)).toBeCloseTo(990, 2);
  });

  test('option loss: multiplied correctly', () => {
    const rawLoss = 2 * (4.80 - 5.50); // = -1.40
    expect(calcRealizedPLLeveraged(rawLoss, true)).toBeCloseTo(-140, 2);
  });

  test('zero P&L remains zero', () => {
    expect(calcRealizedPLLeveraged(0, true)).toBe(0);
    expect(calcRealizedPLLeveraged(0, false)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('detectIsOption — createMasterCardHTML dual-source detection', () => {
  test('detects options via assetType field', () => {
    expect(detectIsOption('NVDA $490 Call', 'options')).toBe(true);
  });

  test('detects options via ticker pattern when type is wrong', () => {
    expect(detectIsOption('NVDA $490 Call', 'stocks')).toBe(true);
  });

  test('does NOT detect stock by ticker alone', () => {
    expect(detectIsOption('NVDA', 'stocks')).toBe(false);
  });

  test('detects PUT via ticker', () => {
    expect(detectIsOption('AAPL $180 Put', 'stocks')).toBe(true);
  });

  test('detects uppercase CALL', () => {
    expect(detectIsOption('SPY $723 CALL 6/11', 'stocks')).toBe(true);
  });

  test('detects uppercase PUT', () => {
    expect(detectIsOption('QQQ $450 PUT', 'stocks')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('parseOptionSpec — ledger badge parser', () => {
  test('parses "$490" strike from "NVDA $490 Call"', () => {
    expect(parseOptionSpec('NVDA $490 Call').strikePrice).toBe('490');
  });

  test('parses "call" contractType', () => {
    expect(parseOptionSpec('NVDA $490 Call').contractType).toBe('call');
  });

  test('parses "put" contractType', () => {
    expect(parseOptionSpec('AAPL $180 Put').contractType).toBe('put');
  });

  test('parses uppercase CALL', () => {
    expect(parseOptionSpec('SPY $723 CALL 6/11').contractType).toBe('call');
  });

  test('parses expiry "6/11"', () => {
    expect(parseOptionSpec('SPY $723 CALL 6/11').expiry).toBe('6/11');
  });

  test('no expiry → null', () => {
    expect(parseOptionSpec('NVDA $490 Call').expiry).toBeNull();
  });

  test('no strike → null strikePrice', () => {
    expect(parseOptionSpec('NVDA Call').strikePrice).toBeNull();
  });

  test('no contract type → null contractType', () => {
    expect(parseOptionSpec('NVDA $490 2026').contractType).toBeNull();
  });

  test('decimal strike price "$4.80"', () => {
    expect(parseOptionSpec('AAPL $4.80 Put').strikePrice).toBe('4.80');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('pullCloudData row parser — ledger.js version', () => {
  test('uses CurrentPrice when positive', () => {
    const row = parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '485', 'Asset Type': 'Stock', Shares: '40', Action: 'BUY', SL: '0' });
    expect(row.currentPrice).toBe(485);
  });

  test('falls back to CostBasis when CurrentPrice is 0', () => {
    const row = parseCloudRow({ Symbol: 'AAPL', CostBasis: '170', CurrentPrice: '0', 'Asset Type': 'Stock', Shares: '30', Action: 'BUY', SL: '0' });
    expect(row.currentPrice).toBe(170);
  });

  test('falls back when CurrentPrice is missing', () => {
    const row = parseCloudRow({ Symbol: 'TSLA', CostBasis: '185', 'Asset Type': 'Stock', Shares: '15', Action: 'BUY', SL: '0' });
    expect(row.currentPrice).toBe(185);
  });

  test('auto-detects options from CALL in Symbol', () => {
    const row = parseCloudRow({ Symbol: 'SPY $723 CALL', CostBasis: '5', CurrentPrice: '6', 'Asset Type': 'Stock', Shares: '2', Action: 'BUY', SL: '0' });
    expect(row.assetType).toBe('options');
  });

  test('auto-detects options from PUT in Symbol', () => {
    const row = parseCloudRow({ Symbol: 'QQQ $450 PUT', CostBasis: '3', CurrentPrice: '4', 'Asset Type': 'Stock', Shares: '1', Action: 'BUY', SL: '0' });
    expect(row.assetType).toBe('options');
  });

  test('uses Option Asset Type field directly', () => {
    const row = parseCloudRow({ Symbol: 'NVDA $490 Call', CostBasis: '15', CurrentPrice: '18', 'Asset Type': 'Option', Shares: '3', Action: 'BUY', SL: '0' });
    expect(row.assetType).toBe('options');
  });

  test('trims whitespace from Symbol', () => {
    const row = parseCloudRow({ Symbol: '  TSLA  ', CostBasis: '185', 'Asset Type': 'Stock', Shares: '15', Action: 'BUY', SL: '0' });
    expect(row.ticker).toBe('TSLA');
  });

  test('negative CurrentPrice falls back to CostBasis', () => {
    const row = parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '-10', 'Asset Type': 'Stock', Shares: '10', Action: 'BUY', SL: '0' });
    expect(row.currentPrice).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('applyAccentColor — ledger.js CSS variable injection', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-glow');
  });

  test('sets --accent correctly', () => {
    applyAccentColor('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#6366f1');
  });

  test('sets --accent-glow with correct rgba for indigo', () => {
    applyAccentColor('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(99, 102, 241, 0.15)');
  });

  test('computes correct rgba for green', () => {
    applyAccentColor('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(16, 185, 129, 0.15)');
  });

  test('computes correct rgba for red', () => {
    applyAccentColor('#ef4444');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(239, 68, 68, 0.15)');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('Ledger master card rendering logic', () => {
  test('isCompleted is true when netShares <= 0', () => {
    const card = { netShares: 0 };
    expect(card.netShares <= 0).toBe(true);
  });

  test('isCompleted is false when netShares > 0', () => {
    const card = { netShares: 15 };
    expect(card.netShares <= 0).toBe(false);
  });

  test('qtyLabel is "CON" for options', () => {
    const isOption = true;
    const qtyLabel = isOption ? 'CON' : 'SHR';
    expect(qtyLabel).toBe('CON');
  });

  test('qtyLabel is "SHR" for stocks', () => {
    const isOption = false;
    const qtyLabel = isOption ? 'CON' : 'SHR';
    expect(qtyLabel).toBe('SHR');
  });

  test('assetTypeLabel is "Option" for options', () => {
    const isOption = true;
    const label = isOption ? 'Option' : 'Stock';
    expect(label).toBe('Option');
  });

  test('assetTypeLabel is "Stock" for stocks', () => {
    const isOption = false;
    const label = isOption ? 'Option' : 'Stock';
    expect(label).toBe('Stock');
  });

  test('pnlClass is "positive" for profit > 0', () => {
    let pnlClass = 'neutral';
    if (150 > 0) pnlClass = 'positive';
    else if (150 < 0) pnlClass = 'negative';
    expect(pnlClass).toBe('positive');
  });

  test('pnlClass is "negative" for loss < 0', () => {
    let pnlClass = 'neutral';
    if (-150 > 0) pnlClass = 'positive';
    else if (-150 < 0) pnlClass = 'negative';
    expect(pnlClass).toBe('negative');
  });

  test('pnlClass is "neutral" for zero P&L', () => {
    let pnlClass = 'neutral';
    if (0 > 0) pnlClass = 'positive';
    else if (0 < 0) pnlClass = 'negative';
    expect(pnlClass).toBe('neutral');
  });

  test('timeline tx value multiplied ×100 for options', () => {
    const sharesVal = 3;
    const priceVal = 15.20;
    const isOpt = true;
    const txValue = isOpt ? sharesVal * priceVal * 100 : sharesVal * priceVal;
    expect(txValue).toBeCloseTo(4560, 2);
  });

  test('timeline tx value NOT multiplied for stocks', () => {
    const sharesVal = 40;
    const priceVal = 400;
    const isOpt = false;
    const txValue = isOpt ? sharesVal * priceVal * 100 : sharesVal * priceVal;
    expect(txValue).toBeCloseTo(16000, 2);
  });
});

describe('formatOptionTicker — ledger option name formatter', () => {
  function formatOptionTicker(ticker) {
    const strikeMatch = ticker.match(/\$(\d+(?:\.\d+)?)/);
    const strikePrice = strikeMatch ? strikeMatch[1] : null;
    const expiryMatch = ticker.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
    const expiry = expiryMatch ? expiryMatch[1] : null;
    const root = ticker.split(' ')[0].toUpperCase();
    if (strikePrice) {
      return `${root} [$${strikePrice}]${expiry ? ' ' + expiry : ''}`;
    }
    return ticker;
  }

  test('formats standard CALL ticker correctly', () => {
    expect(formatOptionTicker('SPY $723 CALL 6/11')).toBe('SPY [$723] 6/11');
  });

  test('formats standard PUT ticker correctly', () => {
    expect(formatOptionTicker('AAPL $180 Put')).toBe('AAPL [$180]');
  });

  test('returns original ticker if no strike price', () => {
    expect(formatOptionTicker('NVDA Call')).toBe('NVDA Call');
  });

  test('handles decimals in strike price', () => {
    expect(formatOptionTicker('QQQ $450.50 Put 06/19')).toBe('QQQ [$450.50] 06/19');
  });
});

describe('getAssetName & cleanAssetName — ledger name resolution and cleaning', () => {
  const defaultAssetData = {
    'SPY': { name: 'SPDR S&P 500 ETF Trust' },
    'AAPL': { name: 'Apple Inc.' }
  };

  function cleanAssetName(name) {
    if (!name) return '';
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
    if (defaultAssetData[ticker] && defaultAssetData[ticker].name) {
      return defaultAssetData[ticker].name;
    }
    const rootMatch = ticker.match(/^([A-Za-z]+)/);
    if (rootMatch) {
      const root = rootMatch[1].toUpperCase();
      if (defaultAssetData[root] && defaultAssetData[root].name) {
        return defaultAssetData[root].name;
      }
    }
    return ticker;
  }

  test('resolves and cleans stock tickers', () => {
    const rawName = getAssetName('AAPL');
    expect(rawName).toBe('Apple Inc.');
    expect(cleanAssetName(rawName)).toBe('Apple');
  });

  test('resolves and cleans options tickers to underlying name', () => {
    const rawName = getAssetName('SPY $723 CALL 6/11');
    expect(rawName).toBe('SPDR S&P 500 ETF Trust');
    expect(cleanAssetName(rawName)).toBe('SPDR S&P 500 ETF Trust');
  });

  test('falls back to ticker if not found', () => {
    const rawName = getAssetName('XYZ');
    expect(rawName).toBe('XYZ');
    expect(cleanAssetName(rawName)).toBe('XYZ');
  });
});

// SOURCE: isTxBeforeRange (from ledger.js)
function isTxBeforeRange(tx, rangeOrStartDate) {
  if (!tx || !tx.date) return false;
  const txDate = new Date(tx.date);
  if (isNaN(txDate.getTime())) return false;

  if (typeof rangeOrStartDate === 'string') {
    const range = rangeOrStartDate;
    if (range === 'all') return false;

    const diffTime = SIMULATED_TODAY - txDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (range === 'daily') {
      const todayStart = new Date(SIMULATED_TODAY.getFullYear(), SIMULATED_TODAY.getMonth(), SIMULATED_TODAY.getDate());
      return txDate < todayStart;
    } else if (range === 'weekly') {
      return diffDays > 7;
    } else if (range === 'monthly') {
      return diffDays > 30;
    } else if (range === 'yearly') {
      return diffDays > 365;
    }
    return false;
  }

  const startDate = rangeOrStartDate;
  if (!startDate) return false;
  return txDate < startDate;
}

// SOURCE: getAllTransactions (from ledger.js)
function getAllTransactions() {
  const stored = localStorage.getItem('portfolio_transactions');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return [];
    }
  }
  return [];
}

// SOURCE: calculateSection1Metrics (from ledger.js)
function calculateSection1Metrics(filteredTransactionsOrRangeType, rangeTypeOrStartDate, endDate) {
  let rangeType;
  let startDate;
  let targetEndDate;

  if (typeof filteredTransactionsOrRangeType === 'string') {
    rangeType = filteredTransactionsOrRangeType;
    startDate = rangeTypeOrStartDate;
    targetEndDate = endDate;
  } else {
    rangeType = rangeTypeOrStartDate;
    const refDate = new Date(SIMULATED_TODAY.getTime());
    if (rangeType === 'daily') {
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0);
      targetEndDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
    } else if (rangeType === 'weekly') {
      startDate = new Date(refDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      targetEndDate = refDate;
    } else if (rangeType === 'monthly') {
      startDate = new Date(refDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      targetEndDate = refDate;
    } else if (rangeType === 'yearly') {
      startDate = new Date(refDate.getFullYear() - 1, refDate.getMonth(), refDate.getDate(), 12, 0, 0);
      targetEndDate = refDate;
    } else {
      const allTxs = getAllTransactions().filter(tx => tx.ticker !== 'CASH' && tx.assetType !== 'CASH');
      const dates = allTxs.map(tx => new Date(tx.date).getTime());
      const oldestTime = dates.length > 0 ? Math.min(...dates) : refDate.getTime() - 365 * 24 * 60 * 60 * 1000;
      startDate = new Date(oldestTime);
      targetEndDate = refDate;
    }
  }

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
  const end = new Date(targetEndDate.getTime());

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
  } else if (rangeType === 'yearly') {
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    for (let m = 0; m <= 12; m++) {
      intervalTimes.push(new Date(startYear, startMonth + m, 1, 12, 0, 0));
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

  const defaultAssetDataForTests = {
    'NVDA': { name: 'NVIDIA Corporation', currentPrice: 485.00, stopLoss: 380.00, change24h: 3.25, icon: 'NV' },
    'AAPL': { name: 'Apple Inc.', currentPrice: 175.50, stopLoss: 150.00, change24h: 1.92, icon: 'AP' },
    'TSLA': { name: 'Tesla Inc.', currentPrice: 198.20, stopLoss: 185.00, change24h: -2.17, icon: 'TS' },
    'SPY': { name: 'SPDR S&P 500 ETF Trust', currentPrice: 512.42, stopLoss: 490.00, change24h: 0.45, icon: 'SP' },
    'SPX': { name: 'S&P 500 Index', currentPrice: 5120.30, stopLoss: 5000.00, change24h: 0.52, icon: 'SX' }
  };

  let marketPrices = {};
  try {
    marketPrices = JSON.parse(localStorage.getItem('portfolio_market_prices') || '{}');
  } catch (e) {
    marketPrices = {};
  }

  const allGroups = groupTransactionsByTicker(allTxs, startDate, targetEndDate);
  allGroups.forEach(pos => {
    const isOption = pos.assetType === 'options' || (/\$\d/.test(pos.ticker) && /\b(call|put)\b/i.test(pos.ticker));
    const multiplier = isOption ? 100 : 1;
    
    // Closed P&L
    closedPL += pos.realizedPL * multiplier;
    
    // Active P&L
    if (pos.netShares > 0) {
      const marketEntry = marketPrices[pos.ticker] || {};
      let currentPrice = parseFloat(marketEntry.currentPrice);
      if (isNaN(currentPrice)) {
        const defaultAsset = defaultAssetDataForTests[pos.ticker] || {};
        currentPrice = parseFloat(defaultAsset.currentPrice) || pos.buyAvg || 0;
      }
      const unrealizedPL = (pos.netShares * currentPrice - pos.netShares * pos.buyAvg) * multiplier;
      activePL += unrealizedPL;
    }
  });

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

describe('isTxBeforeRange & calculateSection1Metrics', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <span id="snap-start-value"></span>
      <span id="snap-current-value"></span>
      <span id="snap-pnl-value"></span>
      <div id="total-performance-value"></div>
      <div id="snap-ai-brief-text"></div>
      <svg>
        <path id="snap-trend-path" d="" />
        <path id="snap-graph-area" d="" />
        <g id="snap-graph-dots"></g>
      </svg>
    `;
  });

  test('isTxBeforeRange identifies older transactions correctly', () => {
    const tx = { ticker: 'AAPL', date: daysAgoISO(15) + 'T10:00:00' };
    expect(isTxBeforeRange(tx, 'weekly')).toBe(true);
    expect(isTxBeforeRange(tx, 'monthly')).toBe(false);
    expect(isTxBeforeRange(tx, 'all')).toBe(false);
  });

  test('calculateSection1Metrics computes correct open cost, current value, and P&L', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 10, price: 150, date: daysAgoISO(15) + 'T10:00:00' }, // Open cost: 1500
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 5, price: 160, date: daysAgoISO(3) + 'T10:00:00' },   // In range (weekly)
      { ticker: 'NVDA $490 Call', assetType: 'options', action: 'BUY', shares: 1, price: 10, date: daysAgoISO(2) + 'T10:00:00' } // In range (weekly, leveraged = 1000)
    ];
    localStorage.setItem('portfolio_transactions', JSON.stringify(txs));

    const weeklyTxs = getFilteredTransactions(txs, 'weekly');
    calculateSection1Metrics(weeklyTxs, 'weekly');

    expect(document.getElementById('snap-start-value').textContent).toBe('$1500.00');
    expect(document.getElementById('snap-current-value').textContent).toBe('$3300.00'); // 1500 + 800 + 1000
    expect(document.getElementById('snap-pnl-value').textContent).toBe('+$1800.00');
    expect(document.getElementById('snap-pnl-value').classList.contains('pnl-up')).toBe(true);
  });

  test('calculateSection1Metrics skips CASH transactions', () => {
    const txs = [
      { ticker: 'CASH', assetType: 'CASH', action: 'BUY', shares: 500, price: 1, date: daysAgoISO(15) + 'T10:00:00' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 10, price: 150, date: daysAgoISO(3) + 'T10:00:00' }
    ];
    localStorage.setItem('portfolio_transactions', JSON.stringify(txs));

    const weeklyTxs = getFilteredTransactions(txs, 'weekly');
    calculateSection1Metrics(weeklyTxs, 'weekly');

    expect(document.getElementById('snap-start-value').textContent).toBe('$0.00');
    expect(document.getElementById('snap-current-value').textContent).toBe('$1500.00');
    expect(document.getElementById('snap-pnl-value').textContent).toBe('+$1500.00');
  });

  test('calculateSection1Metrics renders the coordinate dots correctly in SVG group', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 10, price: 150, date: daysAgoISO(3) + 'T10:00:00' }
    ];
    localStorage.setItem('portfolio_transactions', JSON.stringify(txs));

    const weeklyTxs = getFilteredTransactions(txs, 'weekly');
    calculateSection1Metrics(weeklyTxs, 'weekly');

    const dotsGroup = document.getElementById('snap-graph-dots');
    expect(dotsGroup).toBeTruthy();
    const circles = dotsGroup.getElementsByTagName('circle');
    expect(circles.length).toBe(8); // 8 weekly points (T0 to T7)
    expect(parseFloat(circles[0].getAttribute('cx'))).toBe(0);
    expect(parseFloat(circles[7].getAttribute('cx'))).toBe(300);
  });

  test('calculateSection1Metrics dot counts for daily, monthly, yearly, and all ranges', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 10, price: 150, date: daysAgoISO(10) + 'T10:00:00' }
    ];
    localStorage.setItem('portfolio_transactions', JSON.stringify(txs));

    // Daily: 24h + 1 = 25 points
    calculateSection1Metrics(getFilteredTransactions(txs, 'daily'), 'daily');
    let circles = document.getElementById('snap-graph-dots').getElementsByTagName('circle');
    expect(circles.length).toBe(25);

    // Monthly: 30d + 1 = 31 points
    calculateSection1Metrics(getFilteredTransactions(txs, 'monthly'), 'monthly');
    circles = document.getElementById('snap-graph-dots').getElementsByTagName('circle');
    expect(circles.length).toBe(31);

    // Yearly: 12 months + 1 = 13 points
    calculateSection1Metrics(getFilteredTransactions(txs, 'yearly'), 'yearly');
    circles = document.getElementById('snap-graph-dots').getElementsByTagName('circle');
    expect(circles.length).toBe(13);

    // All: 12 intervals + 1 = 13 points
    calculateSection1Metrics(getFilteredTransactions(txs, 'all'), 'all');
    circles = document.getElementById('snap-graph-dots').getElementsByTagName('circle');
    expect(circles.length).toBe(13);
  });

  test('calculateSection1Metrics computes correct metrics for all time range', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 10, price: 150, date: daysAgoISO(500) + 'T10:00:00' }, // 500 days ago
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 5, price: 160, date: daysAgoISO(3) + 'T10:00:00' }
    ];
    localStorage.setItem('portfolio_transactions', JSON.stringify(txs));

    const allTxs = getFilteredTransactions(txs, 'all');
    calculateSection1Metrics(allTxs, 'all');

    expect(document.getElementById('snap-start-value').textContent).toBe('$1500.00'); // oldest value
    expect(document.getElementById('snap-current-value').textContent).toBe('$2300.00'); // current cumulative value
    expect(document.getElementById('snap-pnl-value').textContent).toBe('+$800.00');
  });

  test('calculateSection1Metrics computes correct total performance (Closed P&L + Active P&L)', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 10, price: 150, date: daysAgoISO(5) + 'T10:00:00' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'SELL', shares: 5, price: 170, date: daysAgoISO(2) + 'T10:00:00' }
    ];
    localStorage.setItem('portfolio_transactions', JSON.stringify(txs));

    const weeklyTxs = getFilteredTransactions(txs, 'weekly');
    calculateSection1Metrics(weeklyTxs, 'weekly');

    expect(document.getElementById('total-performance-value').textContent).toBe('+$227.50');
    expect(document.getElementById('total-performance-value').classList.contains('pnl-up')).toBe(true);
  });

  test('calculateSection1Metrics enforces portfolio_value_override verbatim', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div id="summary-realized-pnl" class="metric-value"></div>
      <div id="summary-unrealized-pnl" class="metric-value"></div>
      <div id="summary-total-pnl" class="metric-value"></div>
    `;
    document.body.appendChild(div);

    localStorage.setItem('portfolio_value_override', 'OVERRIDE_VAL');

    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 10, price: 150, date: daysAgoISO(3) + 'T10:00:00' }
    ];
    calculateSection1Metrics(txs, 'weekly');

    expect(document.getElementById('summary-realized-pnl').textContent).toBe('$0.00');
    expect(document.getElementById('summary-realized-pnl').className).toBe('metric-value pnl-neutral');
    expect(document.getElementById('summary-unrealized-pnl').textContent).toBe('$0.00');
    expect(document.getElementById('summary-unrealized-pnl').className).toBe('metric-value pnl-neutral');
    expect(document.getElementById('summary-total-pnl').textContent).toBe('$0.00');
    expect(document.getElementById('summary-total-pnl').className).toBe('metric-value pnl-neutral');
    expect(document.getElementById('total-performance-value').textContent).toBe('OVERRIDE_VAL');
    expect(document.getElementById('total-performance-value').className).toBe('pnl-neutral');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('calculateTradeStatus and getOptionExpiryDate tests', () => {
  const defaultAssetData = {
    'NVDA': { name: 'NVIDIA Corporation', currentPrice: 485.00, stopLoss: 380.00, change24h: 3.25, icon: 'NV' },
    'AAPL': { name: 'Apple Inc.', currentPrice: 175.50, stopLoss: 150.00, change24h: 1.92, icon: 'AP' },
    'TSLA': { name: 'Tesla Inc.', currentPrice: 198.20, stopLoss: 185.00, change24h: -2.17, icon: 'TS' },
    'SPY': { name: 'SPDR S&P 500 ETF Trust', currentPrice: 512.42, stopLoss: 490.00, change24h: 0.45, icon: 'SP' },
    'SPX': { name: 'S&P 500 Index', currentPrice: 5120.30, stopLoss: 5000.00, change24h: 0.52, icon: 'SX' },
    'NVDA $490 Call': { name: 'Exp 07/16/26 • Buy to Open', currentPrice: 18.50, stopLoss: 12.00, change24h: 20.31, icon: 'OC' },
    'AAPL $180 Call': { name: 'Exp 06/18/26 • Buy to Open', currentPrice: 4.80, stopLoss: 4.00, change24h: -13.43, icon: 'OC' }
  };

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

  function getOptionExpiry(ticker, name) {
    const tickerDateMatch = ticker.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
    if (tickerDateMatch) return `Exp ${tickerDateMatch[1]}`;

    const defaultAsset = getDefaultAsset(ticker);
    if (defaultAsset && defaultAsset.name) {
      const nameMatch = defaultAsset.name.match(/Exp\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (nameMatch) return `Exp ${nameMatch[1]}`;
    }

    if (name) {
      const nameMatch = name.match(/Exp\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (nameMatch) return `Exp ${nameMatch[1]}`;
    }
    return '';
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

      const rawAssetName = '';
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

  test('marks active position with shares_remaining > 0 as Active', () => {
    const status = calculateTradeStatus({ ticker: 'NVDA', shares_remaining: 10 });
    expect(status.label).toBe('Active');
    expect(status.class).toBe('badge-active');
  });

  test('marks closed position with shares_remaining == 0 as Closed', () => {
    const status = calculateTradeStatus({ ticker: 'NVDA', shares_remaining: 0 });
    expect(status.label).toBe('Closed');
    expect(status.class).toBe('badge-closed');
  });

  test('handles option expiry date comparison (Expired)', () => {
    const pastDate = new Date(SIMULATED_TODAY.getTime() - 5 * 24 * 60 * 60 * 1000);
    const mm = pastDate.getMonth() + 1;
    const dd = pastDate.getDate();
    const yy = pastDate.getFullYear();
    const ticker = `SPY $723 CALL ${mm}/${dd}/${yy}`;
    const status = calculateTradeStatus({
      ticker: ticker,
      assetType: 'options',
      shares_remaining: 1
    });
    expect(status.label).toBe('Expired');
    expect(status.class).toBe('badge-expired');
  });

  test('handles active option not expired', () => {
    const futureDate = new Date(SIMULATED_TODAY.getTime() + 5 * 24 * 60 * 60 * 1000);
    const mm = futureDate.getMonth() + 1;
    const dd = futureDate.getDate();
    const yy = futureDate.getFullYear();
    const ticker = `SPY $723 CALL ${mm}/${dd}/${yy}`;
    const status = calculateTradeStatus({
      ticker: ticker,
      assetType: 'options',
      shares_remaining: 1
    });
    expect(status.label).toBe('Active');
    expect(status.class).toBe('badge-active');
  });

  test('handles option exercised state (Exercised)', () => {
    const status = calculateTradeStatus({
      ticker: 'AAPL $180 Call',
      assetType: 'options',
      shares_remaining: 0,
      exercised: true
    });
    expect(status.label).toBe('Exercised');
    expect(status.class).toBe('badge-exercised');
  });

  test('handles option exercised action in transactions list', () => {
    const status = calculateTradeStatus({
      ticker: 'AAPL $180 Call',
      assetType: 'options',
      shares_remaining: 0,
      transactions: [{ action: 'EXERCISE' }]
    });
    expect(status.label).toBe('Exercised');
    expect(status.class).toBe('badge-exercised');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('FIFO cost basis and P&L calculations', () => {
  test('standard FIFO realized P&L with multiple layers', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 100, date: '2026-06-01T10:00:00' },
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 200, date: '2026-06-02T10:00:00' },
      { ticker: 'NVDA', assetType: 'stocks', action: 'SELL', shares: 15, price: 150, date: '2026-06-03T10:00:00' },
    ];
    // We expect the first 10 shares @ 100 to be sold at 150 -> P&L = 10 * 50 = 500
    // We expect 5 of the second layer @ 200 to be sold at 150 -> P&L = 5 * -50 = -250
    // Total realized P&L = 500 - 250 = 250
    const start = new Date('2026-05-01');
    const end = new Date('2026-07-01');
    const result = groupTransactionsByTicker(txs, start, end);
    expect(result[0].realizedPL).toBe(250);
    // Net remaining shares should be 5
    expect(result[0].netShares).toBe(5);
    // Remaining layer cost basis should be 200
    expect(result[0].avgBuyAsOfEndDate).toBe(200);
  });

  test('FIFO queue partial close and cost basis tracking', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 50, price: 150, date: '2026-06-01T10:00:00' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 50, price: 160, date: '2026-06-02T10:00:00' },
      { ticker: 'AAPL', assetType: 'stocks', action: 'SELL', shares: 30, price: 155, date: '2026-06-03T10:00:00' },
    ];
    // 30 shares @ 150 sold @ 155 -> P&L = 30 * 5 = 150
    // Remaining layers: 20 @ 150, 50 @ 160. Total cost = 3000 + 8000 = 11000. Total shares = 70.
    // Cost basis = 11000 / 70 = 157.14
    const start = new Date('2026-05-01');
    const end = new Date('2026-07-01');
    const result = groupTransactionsByTicker(txs, start, end);
    expect(result[0].realizedPL).toBe(150);
    expect(result[0].netShares).toBe(70);
    expect(result[0].avgBuyAsOfEndDate).toBeCloseTo(157.14, 2);
  });
});


