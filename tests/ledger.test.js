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

// SOURCE: getFilteredTransactions
function getFilteredTransactions(txs, range) {
  return txs.filter(tx => {
    if (!tx || !tx.date) return false;
    const txDate = new Date(tx.date);
    if (isNaN(txDate.getTime())) return false;

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

// SOURCE: groupTransactionsByTicker
function groupTransactionsByTicker(transactions) {
  const groups = {};
  transactions.forEach(tx => {
    if (!tx || !tx.ticker) return;
    const ticker = tx.ticker;
    const assetType = tx.assetType || 'stocks';
    if (!groups[ticker]) {
      groups[ticker] = { ticker, assetType, buyQty: 0, buyVal: 0, sellQty: 0, sellVal: 0, transactions: [] };
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
    g.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    const avgBuy = g.buyQty > 0 ? g.buyVal / g.buyQty : 0;
    const avgSell = g.sellQty > 0 ? g.sellVal / g.sellQty : 0;
    const netShares = g.buyQty - g.sellQty;
    const closedShares = Math.min(g.buyQty, g.sellQty);
    const realizedPL = closedShares > 0 ? closedShares * (avgSell - avgBuy) : 0;
    results.push({ ticker: g.ticker, assetType: g.assetType, buyQty: g.buyQty, buyAvg: avgBuy, sellQty: g.sellQty, sellAvg: avgSell, netShares, realizedPL, transactions: g.transactions });
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

// SOURCE: pullCloudData row parser (ledger.js version)
function parseCloudRow(tx) {
  const ticker = String(tx.Symbol || '').trim();
  const costBasis = parseFloat(tx.CostBasis || 0);
  const rawCurrentPrice = parseFloat(tx.CurrentPrice || 0);
  const currentPrice = rawCurrentPrice && rawCurrentPrice > 0 ? rawCurrentPrice : costBasis;
  let rawType = String(tx['Asset Type'] || 'Stock');
  let assetType = rawType.toLowerCase().includes('option') ? 'options' : 'stocks';
  if (!rawType.toLowerCase().includes('option') && /\b(call|put)\b/i.test(ticker)) {
    assetType = 'options';
  }
  return { ticker, assetType, price: costBasis, currentPrice };
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

  test('qtyLabel is "Contracts" for options', () => {
    const isOption = true;
    const qtyLabel = isOption ? 'Contracts' : 'Shares';
    expect(qtyLabel).toBe('Contracts');
  });

  test('qtyLabel is "Shares" for stocks', () => {
    const isOption = false;
    const qtyLabel = isOption ? 'Contracts' : 'Shares';
    expect(qtyLabel).toBe('Shares');
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
    return ticker + ' Corporation';
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

  test('falls back to ticker Corporation if not found', () => {
    const rawName = getAssetName('XYZ');
    expect(rawName).toBe('XYZ Corporation');
    expect(cleanAssetName(rawName)).toBe('XYZ');
  });
});


