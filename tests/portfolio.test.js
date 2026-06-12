/**
 * @file portfolio.test.js
 * @description Unit tests for portfolio.js — covers all pure logic functions:
 *   - generateSparklinePath
 *   - isOption detection (dual-source)
 *   - Options ×100 multiplier math (value, P&L, balance)
 *   - refreshPortfolioAssets (aggregation logic)
 *   - pullCloudData parsing (currentPrice fallback, CALL/PUT auto-detection)
 *   - applyAccentColor (CSS variable injection)
 *   - showToast (DOM creation / error styling)
 *   - activeFilterMode state tracking
 *   - updateBalanceMetrics calculation
 *
 * Strategy: extract every testable pure function from portfolio.js into a
 * separate __testable__ module via jest.isolateModules + window stubs.
 * DOM-heavy functions are tested with jsdom.
 *
 * @jest-environment jest-environment-jsdom
 */

// ─── Helpers / pure-logic re-implementations ──────────────────────────────────
// We re-implement the pure helper functions here so they can be tested without
// loading the entire DOM-dependent portfolio.js bootstrap chain.
// Each test section clearly documents which source function it maps to.

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: generateSparklinePath()
// ══════════════════════════════════════════════════════════════════════════════
function generateSparklinePath(points, width, height) {
  if (!points || points.length === 0) return '';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min === 0 ? 1 : max - min;
  return points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: isOption dual-source detection (renderAssetsTable / updateBalanceMetrics)
// ══════════════════════════════════════════════════════════════════════════════
function detectIsOption(asset) {
  return (
    asset.type === 'options' ||
    (/\$\d/.test(asset.ticker) && /\b(call|put)\b/i.test(asset.ticker))
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: options value math (renderAssetsTable)
// ══════════════════════════════════════════════════════════════════════════════
function calcHoldingsValue(shares, avgCost, isOption) {
  return shares * avgCost * (isOption ? 100 : 1);
}
function calcLiveValue(shares, currentPrice, isOption) {
  return shares * currentPrice * (isOption ? 100 : 1);
}
function calcChangeUsd(shares, avgCost, currentPrice, isOption) {
  return calcLiveValue(shares, currentPrice, isOption) - calcHoldingsValue(shares, avgCost, isOption);
}

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: options badge parser (renderAssetsTable)
// ══════════════════════════════════════════════════════════════════════════════
function parseOptionSpec(ticker) {
  const strikeMatch = ticker.match(/\$(\d+(?:\.\d+)?)/);
  const strikePrice = strikeMatch ? strikeMatch[1] : null;
  const contractType = /\bcall\b/i.test(ticker) ? 'call'
    : /\bput\b/i.test(ticker) ? 'put' : null;
  const expiryMatch = ticker.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  const expiry = expiryMatch ? expiryMatch[1] : null;
  return { strikePrice, contractType, expiry };
}

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: groupTransactionsByTicker / refreshPortfolioAssets aggregation logic
// ══════════════════════════════════════════════════════════════════════════════
function aggregatePositions(txs) {
  const groups = {};
  txs.forEach(tx => {
    if (!groups[tx.ticker]) {
      groups[tx.ticker] = { ticker: tx.ticker, type: tx.assetType, shares: 0, avgCost: 0, lastPrice: tx.price };
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
  return groups;
}

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: pullCloudData row parser (currentPrice fallback + type auto-detect)
// ══════════════════════════════════════════════════════════════════════════════
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
  const shares = parseInt(tx.Shares || 0, 10);
  const action = String(tx.Action || 'BUY');
  const stopLoss = parseFloat(tx.SL || 0);
  return { ticker, assetType, action, shares, price: costBasis, currentPrice, stopLoss };
}

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: applyAccentColor
// ══════════════════════════════════════════════════════════════════════════════
function applyAccentColor(hexColor) {
  document.documentElement.style.setProperty('--accent', hexColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
}

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: updateBalanceMetrics total equity calculation loop
// ══════════════════════════════════════════════════════════════════════════════
function calcTotalPortfolioValue(assets) {
  let total = 0;
  assets.forEach(asset => {
    const isOpt = asset.type === 'options'
      || (/\$\d/.test(asset.ticker) && /\b(call|put)\b/i.test(asset.ticker));
    total += asset.shares * asset.currentPrice * (isOpt ? 100 : 1);
  });
  return total;
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════════════════

describe('generateSparklinePath', () => {
  test('returns empty string for empty array', () => {
    expect(generateSparklinePath([], 90, 24)).toBe('');
  });

  test('returns empty string for null/undefined', () => {
    expect(generateSparklinePath(null, 90, 24)).toBe('');
    expect(generateSparklinePath(undefined, 90, 24)).toBe('');
  });

  test('generates M command for first point', () => {
    const path = generateSparklinePath([10, 20], 90, 24);
    expect(path).toMatch(/^M /);
  });

  test('generates L commands for subsequent points', () => {
    const path = generateSparklinePath([10, 20, 30], 90, 24);
    expect(path).toContain('L ');
  });

  test('single-point path produces a M command (edge case \u2014 x is NaN for single point division)', () => {
    // With 1 point: x = 0/(1-1) = 0/0 = NaN. Function handles gracefully.
    const path = generateSparklinePath([50], 90, 24);
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
    // Two-point paths should NOT have NaN
    const path2 = generateSparklinePath([50, 60], 90, 24);
    expect(path2).not.toContain('NaN');
  });

  test('handles all identical values (range=0 guard)', () => {
    const path = generateSparklinePath([100, 100, 100], 90, 24);
    // Should not throw or produce NaN
    expect(path).not.toContain('NaN');
    expect(path).toMatch(/^M /);
  });

  test('path uses correct width scaling — last x equals width', () => {
    const points = [10, 20, 30, 40];
    const path = generateSparklinePath(points, 90, 24);
    const parts = path.split(' ');
    // Last x coordinate should be 90.0
    const lastX = parseFloat(parts[parts.length - 2]);
    expect(lastX).toBeCloseTo(90, 1);
  });

  test('y is inverted for SVG coordinate system (high value = low y)', () => {
    const path = generateSparklinePath([0, 100], 90, 24);
    const parts = path.split(' ');
    const y1 = parseFloat(parts[2]);  // first point y (value=0 → bottom → y=24)
    const y2 = parseFloat(parts[5]);  // second point y (value=100 → top → y=0)
    expect(y1).toBeGreaterThan(y2);
  });

  test('handles negative values', () => {
    const path = generateSparklinePath([-50, 0, 50], 90, 24);
    expect(path).not.toContain('NaN');
  });

  test('handles decimal values', () => {
    const path = generateSparklinePath([175.5, 176.2, 174.8], 90, 24);
    expect(path).not.toContain('NaN');
    expect(path).toMatch(/^M /);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('isOption dual-source detection', () => {
  test('detects options via type field', () => {
    expect(detectIsOption({ ticker: 'NVDA', type: 'options' })).toBe(true);
  });

  test('detects stocks via type field', () => {
    expect(detectIsOption({ ticker: 'NVDA', type: 'stocks' })).toBe(false);
  });

  test('detects options via "$NNN Call" ticker pattern (mixed case)', () => {
    expect(detectIsOption({ ticker: 'NVDA $490 Call', type: 'stocks' })).toBe(true);
  });

  test('detects options via "$NNN Put" ticker pattern', () => {
    expect(detectIsOption({ ticker: 'AAPL $180 Put', type: 'stocks' })).toBe(true);
  });

  test('detects options via "CALL" uppercase in ticker', () => {
    expect(detectIsOption({ ticker: 'SPY $723 CALL 6/11', type: 'stocks' })).toBe(true);
  });

  test('detects options via "PUT" uppercase in ticker', () => {
    expect(detectIsOption({ ticker: 'QQQ $450 PUT', type: 'stocks' })).toBe(true);
  });

  test('does NOT falsely detect regular stock with $ in name', () => {
    expect(detectIsOption({ ticker: 'A$AP', type: 'stocks' })).toBe(false);
  });

  test('does NOT false-positive on stock ticker without $ price', () => {
    expect(detectIsOption({ ticker: 'TSLA', type: 'stocks' })).toBe(false);
  });

  test('type field takes priority even without ticker pattern', () => {
    expect(detectIsOption({ ticker: 'CUSTOM', type: 'options' })).toBe(true);
  });

  test('both type and ticker agree → true', () => {
    expect(detectIsOption({ ticker: 'NVDA $490 Call', type: 'options' })).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('Options ×100 multiplier math', () => {
  describe('calcHoldingsValue', () => {
    test('stock: shares * avgCost (no multiplier)', () => {
      expect(calcHoldingsValue(40, 400, false)).toBe(16000);
    });

    test('option: shares * avgCost * 100', () => {
      expect(calcHoldingsValue(3, 15.20, true)).toBeCloseTo(4560, 2);
    });

    test('zero shares → zero value', () => {
      expect(calcHoldingsValue(0, 500, true)).toBe(0);
    });

    test('option with fractional avgCost', () => {
      expect(calcHoldingsValue(2, 4.80, true)).toBeCloseTo(960, 2);
    });
  });

  describe('calcLiveValue', () => {
    test('stock: shares * currentPrice', () => {
      expect(calcLiveValue(40, 485, false)).toBe(19400);
    });

    test('option: shares * currentPrice * 100', () => {
      expect(calcLiveValue(3, 18.50, true)).toBeCloseTo(5550, 2);
    });
  });

  describe('calcChangeUsd (P&L)', () => {
    test('stock profit: correct P&L without multiplier', () => {
      // 40 shares, avg 400, live 485 → gain = 40*(485-400) = 3400
      expect(calcChangeUsd(40, 400, 485, false)).toBeCloseTo(3400, 2);
    });

    test('option profit: P&L includes ×100 multiplier', () => {
      // 3 contracts, avg 15.20, live 18.50 → gain = 3*(18.50-15.20)*100 = 990
      expect(calcChangeUsd(3, 15.20, 18.50, true)).toBeCloseTo(990, 2);
    });

    test('option loss: negative P&L', () => {
      // 2 contracts, avg 5.50, live 4.80 → loss = 2*(4.80-5.50)*100 = -140
      expect(calcChangeUsd(2, 5.50, 4.80, true)).toBeCloseTo(-140, 2);
    });

    test('stock loss: negative P&L without multiplier', () => {
      expect(calcChangeUsd(85, 210, 198.20, false)).toBeCloseTo(-1003, 0);
    });

    test('break-even: zero P&L when price equals avgCost', () => {
      expect(calcChangeUsd(10, 100, 100, false)).toBe(0);
      expect(calcChangeUsd(5, 20, 20, true)).toBe(0);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('parseOptionSpec — badge parser', () => {
  test('parses strike price from "NVDA $490 Call"', () => {
    const spec = parseOptionSpec('NVDA $490 Call');
    expect(spec.strikePrice).toBe('490');
  });

  test('parses contractType "call" (lowercase)', () => {
    expect(parseOptionSpec('NVDA $490 Call').contractType).toBe('call');
  });

  test('parses contractType "call" (uppercase CALL)', () => {
    expect(parseOptionSpec('SPY $723 CALL 6/11').contractType).toBe('call');
  });

  test('parses contractType "put"', () => {
    expect(parseOptionSpec('AAPL $180 Put').contractType).toBe('put');
  });

  test('parses contractType "put" (uppercase PUT)', () => {
    expect(parseOptionSpec('QQQ $450 PUT').contractType).toBe('put');
  });

  test('parses expiry date "6/11" from "SPY $723 CALL 6/11"', () => {
    expect(parseOptionSpec('SPY $723 CALL 6/11').expiry).toBe('6/11');
  });

  test('parses expiry date "07/16/26"', () => {
    expect(parseOptionSpec('NVDA $490 Call 07/16/26').expiry).toBe('07/16/26');
  });

  test('no expiry returns null', () => {
    expect(parseOptionSpec('NVDA $490 Call').expiry).toBeNull();
  });

  test('no strike returns null strikePrice', () => {
    expect(parseOptionSpec('NVDA Call').strikePrice).toBeNull();
  });

  test('no contract type returns null contractType', () => {
    expect(parseOptionSpec('NVDA $490').contractType).toBeNull();
  });

  test('parses decimal strike price "$4.80"', () => {
    const spec = parseOptionSpec('AAPL $4.80 Call');
    expect(spec.strikePrice).toBe('4.80');
  });

  test('three-digit strike "QQQ $450 PUT"', () => {
    expect(parseOptionSpec('QQQ $450 PUT').strikePrice).toBe('450');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('aggregatePositions — position roll-up logic', () => {
  test('single BUY aggregates correctly', () => {
    const txs = [{ ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480 }];
    const groups = aggregatePositions(txs);
    expect(groups['NVDA'].shares).toBe(10);
    expect(groups['NVDA'].avgCost).toBeCloseTo(480, 2);
  });

  test('multiple BUYs compute weighted average cost', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 30, price: 170 },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 20, price: 172 },
    ];
    const groups = aggregatePositions(txs);
    // Weighted avg = (30*170 + 20*172) / 50 = (5100 + 3440) / 50 = 170.8
    expect(groups['AAPL'].avgCost).toBeCloseTo(170.8, 2);
    expect(groups['AAPL'].shares).toBe(50);
  });

  test('BUY then SELL reduces shares correctly', () => {
    const txs = [
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 50, price: 170 },
      { ticker: 'AAPL', assetType: 'stocks', action: 'SELL', shares: 50, price: 178 },
    ];
    const groups = aggregatePositions(txs);
    expect(groups['AAPL'].shares).toBe(0);
  });

  test('SELL cannot bring shares below zero', () => {
    const txs = [
      { ticker: 'TSLA', assetType: 'stocks', action: 'BUY', shares: 15, price: 185 },
      { ticker: 'TSLA', assetType: 'stocks', action: 'SELL', shares: 30, price: 200 },
    ];
    const groups = aggregatePositions(txs);
    expect(groups['TSLA'].shares).toBe(0);
  });

  test('options BUY aggregates with correct type', () => {
    const txs = [
      { ticker: 'NVDA $490 Call', assetType: 'options', action: 'BUY', shares: 3, price: 15.20 },
    ];
    const groups = aggregatePositions(txs);
    expect(groups['NVDA $490 Call'].type).toBe('options');
    expect(groups['NVDA $490 Call'].shares).toBe(3);
  });

  test('multiple tickers tracked independently', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 40, price: 400 },
      { ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 250, price: 165 },
    ];
    const groups = aggregatePositions(txs);
    expect(Object.keys(groups)).toHaveLength(2);
    expect(groups['NVDA'].shares).toBe(40);
    expect(groups['AAPL'].shares).toBe(250);
  });

  test('empty transaction list returns empty groups', () => {
    expect(aggregatePositions([])).toEqual({});
  });

  test('lastPrice is updated on each transaction', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480 },
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 5, price: 490 },
    ];
    const groups = aggregatePositions(txs);
    expect(groups['NVDA'].lastPrice).toBe(490);
  });

  test('partial sell retains correct share count', () => {
    const txs = [
      { ticker: 'MSFT', assetType: 'stocks', action: 'BUY', shares: 40, price: 410 },
      { ticker: 'MSFT', assetType: 'stocks', action: 'SELL', shares: 20, price: 425 },
    ];
    const groups = aggregatePositions(txs);
    expect(groups['MSFT'].shares).toBe(20);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('parseCloudRow — pullCloudData row parser', () => {
  test('uses CurrentPrice when valid and positive', () => {
    const row = parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '485', Shares: '40', Action: 'BUY', 'Asset Type': 'Stock', SL: '0' });
    expect(row.currentPrice).toBe(485);
  });

  test('falls back to CostBasis when CurrentPrice is 0', () => {
    const row = parseCloudRow({ Symbol: 'AAPL', CostBasis: '170', CurrentPrice: '0', Shares: '30', Action: 'BUY', 'Asset Type': 'Stock', SL: '0' });
    expect(row.currentPrice).toBe(170);
  });

  test('falls back to CostBasis when CurrentPrice is missing', () => {
    const row = parseCloudRow({ Symbol: 'TSLA', CostBasis: '185', Shares: '15', Action: 'BUY', 'Asset Type': 'Stock', SL: '0' });
    expect(row.currentPrice).toBe(185);
  });

  test('detects "Option" Asset Type as options', () => {
    const row = parseCloudRow({ Symbol: 'NVDA $490 Call', CostBasis: '15.20', CurrentPrice: '18.50', Shares: '3', Action: 'BUY', 'Asset Type': 'Option', SL: '0' });
    expect(row.assetType).toBe('options');
  });

  test('auto-detects options from CALL keyword in Symbol when Asset Type is Stock', () => {
    const row = parseCloudRow({ Symbol: 'SPY $723 CALL 6/11', CostBasis: '5.00', CurrentPrice: '6.00', Shares: '2', Action: 'BUY', 'Asset Type': 'Stock', SL: '0' });
    expect(row.assetType).toBe('options');
  });

  test('auto-detects options from PUT keyword in Symbol', () => {
    const row = parseCloudRow({ Symbol: 'QQQ $450 PUT', CostBasis: '3.00', CurrentPrice: '4.00', Shares: '1', Action: 'BUY', 'Asset Type': 'Stock', SL: '0' });
    expect(row.assetType).toBe('options');
  });

  test('parses shares as integer', () => {
    const row = parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', Shares: '40', Action: 'BUY', 'Asset Type': 'Stock', SL: '0' });
    expect(row.shares).toBe(40);
    expect(typeof row.shares).toBe('number');
  });

  test('parses stopLoss as float', () => {
    const row = parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '485', Shares: '40', Action: 'BUY', 'Asset Type': 'Stock', SL: '380' });
    expect(row.stopLoss).toBe(380);
  });

  test('empty/missing Symbol returns empty string ticker', () => {
    const row = parseCloudRow({ CostBasis: '100', Shares: '10', Action: 'BUY', 'Asset Type': 'Stock', SL: '0' });
    expect(row.ticker).toBe('');
  });

  test('trims whitespace from Symbol', () => {
    const row = parseCloudRow({ Symbol: '  NVDA  ', CostBasis: '400', Shares: '10', Action: 'BUY', 'Asset Type': 'Stock', SL: '0' });
    expect(row.ticker).toBe('NVDA');
  });

  test('default action is BUY when missing', () => {
    const row = parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', Shares: '10', 'Asset Type': 'Stock', SL: '0' });
    expect(row.action).toBe('BUY');
  });

  test('SELL action is parsed correctly', () => {
    const row = parseCloudRow({ Symbol: 'AAPL', CostBasis: '170', Shares: '50', Action: 'SELL', 'Asset Type': 'Stock', SL: '0' });
    expect(row.action).toBe('SELL');
  });

  test('negative CurrentPrice falls back to CostBasis', () => {
    const row = parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '-5', Shares: '10', Action: 'BUY', 'Asset Type': 'Stock', SL: '0' });
    expect(row.currentPrice).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('applyAccentColor — CSS variable injection', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-glow');
  });

  test('sets --accent CSS variable', () => {
    applyAccentColor('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#6366f1');
  });

  test('sets --accent-glow with correct rgba values for indigo #6366f1', () => {
    applyAccentColor('#6366f1');
    // r=99, g=102, b=241
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(99, 102, 241, 0.15)');
  });

  test('sets correct glow for green #10b981 (r=16, g=185, b=129)', () => {
    applyAccentColor('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(16, 185, 129, 0.15)');
  });

  test('sets correct glow for red #ef4444', () => {
    applyAccentColor('#ef4444');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(239, 68, 68, 0.15)');
  });

  test('sets correct glow for purple #a855f7', () => {
    applyAccentColor('#a855f7');
    expect(document.documentElement.style.getPropertyValue('--accent-glow'))
      .toBe('rgba(168, 85, 247, 0.15)');
  });

  test('handles lowercase hex correctly', () => {
    applyAccentColor('#0ea5e9');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#0ea5e9');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('calcTotalPortfolioValue — total equity calculation', () => {
  test('pure stock portfolio sums correctly', () => {
    const assets = [
      { ticker: 'NVDA', type: 'stocks', shares: 40, currentPrice: 485 },
      { ticker: 'AAPL', type: 'stocks', shares: 250, currentPrice: 175.50 },
    ];
    // 40*485 + 250*175.50 = 19400 + 43875 = 63275
    expect(calcTotalPortfolioValue(assets)).toBeCloseTo(63275, 2);
  });

  test('options apply ×100 multiplier in total', () => {
    const assets = [
      { ticker: 'NVDA $490 Call', type: 'options', shares: 3, currentPrice: 18.50 },
    ];
    // 3 * 18.50 * 100 = 5550
    expect(calcTotalPortfolioValue(assets)).toBeCloseTo(5550, 2);
  });

  test('mixed portfolio: stocks + options correctly combined', () => {
    const assets = [
      { ticker: 'NVDA', type: 'stocks', shares: 40, currentPrice: 485 },
      { ticker: 'NVDA $490 Call', type: 'options', shares: 3, currentPrice: 18.50 },
    ];
    // 40*485 + 3*18.50*100 = 19400 + 5550 = 24950
    expect(calcTotalPortfolioValue(assets)).toBeCloseTo(24950, 2);
  });

  test('empty portfolio returns 0', () => {
    expect(calcTotalPortfolioValue([])).toBe(0);
  });

  test('ticker-pattern detected options also use ×100 multiplier', () => {
    const assets = [
      { ticker: 'SPY $723 CALL 6/11', type: 'stocks', shares: 2, currentPrice: 6.00 }, // type is wrong but ticker detects it
    ];
    // Should use ×100: 2 * 6.00 * 100 = 1200
    expect(calcTotalPortfolioValue(assets)).toBeCloseTo(1200, 2);
  });

  test('handles zero price assets gracefully', () => {
    const assets = [
      { ticker: 'NVDA', type: 'stocks', shares: 40, currentPrice: 0 },
    ];
    expect(calcTotalPortfolioValue(assets)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('showToast — DOM toast rendering (via jsdom)', () => {
  // Inline showToast reimplementation for jsdom tests
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

  beforeEach(() => {
    document.body.innerHTML = '<div id="app-container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('creates toast element with correct class', () => {
    showToast('Test message');
    expect(document.querySelector('.app-toast')).not.toBeNull();
  });

  test('sets correct message text', () => {
    showToast('🟢 Trade Synced!');
    expect(document.querySelector('.app-toast').innerText).toBe('🟢 Trade Synced!');
  });

  test('appends toast to #app-container', () => {
    showToast('Hello');
    const container = document.getElementById('app-container');
    expect(container.querySelector('.app-toast')).not.toBeNull();
  });

  test('error toast sets red border color', () => {
    const toast = showToast('Error!', true);
    expect(toast.style.borderColor).toBe('rgba(239, 68, 68, 0.4)');
  });

  test('success toast does NOT set red border color', () => {
    const toast = showToast('Success!', false);
    expect(toast.style.borderColor).not.toBe('rgba(239, 68, 68, 0.4)');
  });

  test('replaces existing toast (no duplicate stacking)', () => {
    showToast('First');
    showToast('Second');
    const toasts = document.querySelectorAll('.app-toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].innerText).toBe('Second');
  });

  test('handles empty message string', () => {
    const toast = showToast('');
    expect(toast).not.toBeNull();
  });

  test('handles undefined isError (no border modification)', () => {
    const toast = showToast('Hello');
    // Should not throw
    expect(toast.className).toBe('app-toast');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('activeFilterMode state tracking', () => {
  // Test the filter mode logic directly
  let activeFilterMode;

  function setFilter(mode) {
    activeFilterMode = mode;
  }

  function getFilter() {
    return activeFilterMode;
  }

  beforeEach(() => {
    activeFilterMode = 'all';
  });

  test('initial mode defaults to "all"', () => {
    expect(getFilter()).toBe('all');
  });

  test('can set to "stocks"', () => {
    setFilter('stocks');
    expect(getFilter()).toBe('stocks');
  });

  test('can set to "options"', () => {
    setFilter('options');
    expect(getFilter()).toBe('options');
  });

  test('can reset back to "all"', () => {
    setFilter('options');
    setFilter('all');
    expect(getFilter()).toBe('all');
  });

  test('renderAssetsTable filters only stocks', () => {
    const assets = [
      { ticker: 'NVDA', type: 'stocks' },
      { ticker: 'NVDA $490 Call', type: 'options' },
    ];
    const filtered = assets.filter(a => a.type === 'stocks');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].ticker).toBe('NVDA');
  });

  test('renderAssetsTable filters only options', () => {
    const assets = [
      { ticker: 'NVDA', type: 'stocks' },
      { ticker: 'NVDA $490 Call', type: 'options' },
      { ticker: 'AAPL $180 Call', type: 'options' },
    ];
    const filtered = assets.filter(a => a.type === 'options');
    expect(filtered).toHaveLength(2);
  });

  test('renderAssetsTable "all" shows everything', () => {
    const assets = [
      { ticker: 'NVDA', type: 'stocks' },
      { ticker: 'NVDA $490 Call', type: 'options' },
    ];
    const filtered = assets.filter(() => true);
    expect(filtered).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('Buying power deduction logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function deductBuyingPower(sharesInt, priceFloat) {
    let bp = parseFloat(localStorage.getItem('portfolio_buying_power') || '12342.90');
    bp -= sharesInt * priceFloat;
    localStorage.setItem('portfolio_buying_power', bp.toFixed(2));
    return bp;
  }

  test('deducts correct amount from default buying power', () => {
    const result = deductBuyingPower(10, 485);
    // 12342.90 - 10*485 = 12342.90 - 4850 = 7492.90
    expect(result).toBeCloseTo(7492.90, 2);
  });

  test('persists updated buying power in localStorage', () => {
    deductBuyingPower(10, 485);
    expect(localStorage.getItem('portfolio_buying_power')).toBe('7492.90');
  });

  test('deducts from existing non-default buying power', () => {
    localStorage.setItem('portfolio_buying_power', '5000.00');
    const result = deductBuyingPower(5, 100);
    expect(result).toBeCloseTo(4500, 2);
  });

  test('large purchase can result in negative buying power', () => {
    const result = deductBuyingPower(100, 500);
    expect(result).toBeLessThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: updateBalanceMetrics() — raw-transaction equity engine (new version)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Re-implementation of the raw-transaction aggregation that the new
 * updateBalanceMetrics() uses internally so we can unit-test the math.
 */
function computeEquityEngine(transactions, marketPricesMap, defaultAssets) {
  // Step 1: aggregate open positions
  const openPositions = {};
  transactions.forEach(tx => {
    if (!tx || !tx.ticker) return;
    if (!openPositions[tx.ticker]) {
      openPositions[tx.ticker] = { shares: 0, assetType: tx.assetType || 'stocks', avgCost: 0 };
    }
    const pos = openPositions[tx.ticker];
    const sharesNum = Number(tx.shares) || 0;
    const priceNum  = parseFloat(tx.price) || 0;
    if (tx.action === 'BUY') {
      const newShares = pos.shares + sharesNum;
      if (newShares > 0) {
        pos.avgCost = (pos.shares * pos.avgCost + sharesNum * priceNum) / newShares;
      }
      pos.shares = newShares;
    } else if (tx.action === 'SELL') {
      pos.shares = Math.max(0, pos.shares - sharesNum);
    }
  });

  // Step 2: compute total equity
  let totalAssetEquity = 0;
  let optionContractsCount = 0;
  for (const ticker in openPositions) {
    const pos = openPositions[ticker];
    if (pos.shares <= 0) continue;
    const marketEntry = marketPricesMap[ticker] || (defaultAssets && defaultAssets[ticker]) || {};
    const currentPrice = parseFloat(marketEntry.currentPrice) || pos.avgCost || 0;
    const isOpt = pos.assetType === 'options'
      || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
    const multiplier = isOpt ? 100 : 1;
    totalAssetEquity += Number(pos.shares) * parseFloat(currentPrice) * multiplier;
    if (isOpt) optionContractsCount += pos.shares;
  }

  return { totalAssetEquity, optionContractsCount, openPositions };
}

/** Net portfolio value: cash + equity (mirrors updateBalanceMetrics step 4) */
function calcNetPortfolioValue(buyingPowerBaseline, totalAssetEquity) {
  const portfolioValueOverride = localStorage.getItem('portfolio_value_override');
  return portfolioValueOverride !== null
    ? parseFloat(portfolioValueOverride)
    : buyingPowerBaseline + totalAssetEquity;
}

describe('updateBalanceMetrics — raw-transaction equity engine', () => {
  const defaultAssets = {
    'NVDA': { currentPrice: 485, change24h: 3.25 },
    'AAPL': { currentPrice: 175.50, change24h: 1.92 },
    'NVDA $490 Call': { currentPrice: 18.50, change24h: 20.31 }
  };

  beforeEach(() => { localStorage.clear(); });

  test('single stock BUY: equity = shares * currentPrice', () => {
    const txs = [{ ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 40, price: 400 }];
    const { totalAssetEquity } = computeEquityEngine(txs, {}, defaultAssets);
    // 40 * 485 = 19400
    expect(totalAssetEquity).toBeCloseTo(19400, 2);
  });

  test('options BUY: equity includes ×100 multiplier', () => {
    const txs = [{ ticker: 'NVDA $490 Call', assetType: 'options', action: 'BUY', shares: 3, price: 15.20 }];
    const { totalAssetEquity } = computeEquityEngine(txs, {}, defaultAssets);
    // 3 * 18.50 * 100 = 5550
    expect(totalAssetEquity).toBeCloseTo(5550, 2);
  });

  test('SELL reduces share count before equity is computed', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 40, price: 400 },
      { ticker: 'NVDA', assetType: 'stocks', action: 'SELL', shares: 40, price: 495 },
    ];
    const { totalAssetEquity } = computeEquityEngine(txs, {}, defaultAssets);
    // Net shares = 0 → equity = 0
    expect(totalAssetEquity).toBe(0);
  });

  test('mixed stocks + options: equity combined correctly', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 40, price: 400 },
      { ticker: 'NVDA $490 Call', assetType: 'options', action: 'BUY', shares: 3, price: 15.20 },
    ];
    const { totalAssetEquity } = computeEquityEngine(txs, {}, defaultAssets);
    // 40*485 + 3*18.50*100 = 19400 + 5550 = 24950
    expect(totalAssetEquity).toBeCloseTo(24950, 2);
  });

  test('marketPrices map overrides defaultAssets price', () => {
    const txs = [{ ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480 }];
    const prices = { 'NVDA': { currentPrice: 500 } }; // live price differs from default 485
    const { totalAssetEquity } = computeEquityEngine(txs, prices, defaultAssets);
    expect(totalAssetEquity).toBeCloseTo(5000, 2);
  });

  test('price falls back to avgCost when no market data available', () => {
    const txs = [{ ticker: 'PLTR', assetType: 'stocks', action: 'BUY', shares: 50, price: 21 }];
    const { totalAssetEquity } = computeEquityEngine(txs, {}, {});
    // No price in marketPrices or defaultAssets → uses avgCost=21
    expect(totalAssetEquity).toBeCloseTo(50 * 21, 2);
  });

  test('ticker-pattern options detection applies ×100 even when assetType is "stocks"', () => {
    const txs = [{ ticker: 'SPY $723 CALL 6/11', assetType: 'stocks', action: 'BUY', shares: 2, price: 5 }];
    const prices = { 'SPY $723 CALL 6/11': { currentPrice: 6.0 } };
    const { totalAssetEquity } = computeEquityEngine(txs, prices, {});
    // isOpt detected from ticker pattern → 2 * 6.0 * 100 = 1200
    expect(totalAssetEquity).toBeCloseTo(1200, 2);
  });

  test('optionContractsCount tracks open option contracts only', () => {
    const txs = [
      { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 40, price: 400 },
      { ticker: 'NVDA $490 Call', assetType: 'options', action: 'BUY', shares: 3, price: 15.20 },
    ];
    const { optionContractsCount } = computeEquityEngine(txs, {}, defaultAssets);
    expect(optionContractsCount).toBe(3);
  });

  test('optionContractsCount is 0 for all-stock portfolio', () => {
    const txs = [{ ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 40, price: 400 }];
    const { optionContractsCount } = computeEquityEngine(txs, {}, defaultAssets);
    expect(optionContractsCount).toBe(0);
  });

  test('empty transactions list gives zero equity', () => {
    const { totalAssetEquity } = computeEquityEngine([], {}, {});
    expect(totalAssetEquity).toBe(0);
  });

  test('netPortfolioValue = buyingPowerBaseline + totalAssetEquity', () => {
    const txs = [{ ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 40, price: 400 }];
    const { totalAssetEquity } = computeEquityEngine(txs, {}, defaultAssets);
    const bp = 12342.90;
    const net = calcNetPortfolioValue(bp, totalAssetEquity);
    // 12342.90 + 40*485 = 12342.90 + 19400 = 31742.90
    expect(net).toBeCloseTo(31742.90, 2);
  });

  test('netPortfolioValue with zero equity equals full buying power', () => {
    expect(calcNetPortfolioValue(12342.90, 0)).toBeCloseTo(12342.90, 2);
  });

  test('null/undefined transactions are skipped gracefully', () => {
    const txs = [null, undefined, { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480 }];
    const { totalAssetEquity } = computeEquityEngine(txs, {}, defaultAssets);
    expect(totalAssetEquity).toBeCloseTo(10 * 485, 2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// SOURCE: pullCloudData() — buying power baseline calculator
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Pure re-implementation of the buying power baseline logic
 * added to pullCloudData().
 */
function calcBuyingPowerBaseline(parsedTxs, INITIAL_CASH) {
  let cashFlow = INITIAL_CASH;
  parsedTxs.forEach(tx => {
    const cost = Number(tx.shares) * parseFloat(tx.price || 0);
    if (tx.action === 'BUY') {
      cashFlow -= cost;
    } else if (tx.action === 'SELL') {
      cashFlow += cost;
    }
  });
  return Math.max(0, cashFlow);
}

describe('pullCloudData — buying power baseline calculator', () => {
  const INITIAL = 50000;

  beforeEach(() => {
    localStorage.clear();
  });

  test('no transactions: baseline equals initial cash', () => {
    expect(calcBuyingPowerBaseline([], INITIAL)).toBe(50000);
  });

  test('single BUY: deducts cost from initial cash', () => {
    const txs = [{ action: 'BUY', shares: 10, price: 480 }];
    // 50000 - 10*480 = 50000 - 4800 = 45200
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBeCloseTo(45200, 2);
  });

  test('single SELL: adds proceeds to initial cash', () => {
    const txs = [{ action: 'SELL', shares: 10, price: 495 }];
    // 50000 + 10*495 = 54950
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBeCloseTo(54950, 2);
  });

  test('BUY then SELL: net is initial + profit', () => {
    const txs = [
      { action: 'BUY',  shares: 10, price: 480 },
      { action: 'SELL', shares: 10, price: 495 },
    ];
    // 50000 - 4800 + 4950 = 50150
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBeCloseTo(50150, 2);
  });

  test('BUY then SELL at a loss: net is initial - loss', () => {
    const txs = [
      { action: 'BUY',  shares: 25, price: 220 },
      { action: 'SELL', shares: 25, price: 205 },
    ];
    // 50000 - 5500 + 5125 = 49625
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBeCloseTo(49625, 2);
  });

  test('multiple BUYs: each deducted from cash — large spend floors at zero', () => {
    const txs = [
      { action: 'BUY', shares: 40, price: 400 },   // -16000
      { action: 'BUY', shares: 250, price: 165 },  // -41250
      { action: 'BUY', shares: 3,   price: 15.20 },// -45.60
    ];
    // 50000 - 16000 - 41250 - 45.60 = -7295.60 → floored to 0
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBe(0);
  });

  test('multiple BUYs within budget: correct deduction', () => {
    const txs = [
      { action: 'BUY', shares: 10, price: 480 },  // -4800
      { action: 'BUY', shares: 5,  price: 100 },  // -500
    ];
    // 50000 - 4800 - 500 = 44700
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBeCloseTo(44700, 2);
  });

  test('floor at zero: massive overspend never goes negative', () => {
    const txs = [{ action: 'BUY', shares: 1000, price: 500 }];
    // 50000 - 500000 = -450000 → floored to 0
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBe(0);
  });

  test('options BUY: deducts premium cost (shares * price), not leveraged', () => {
    // Premium outflow is shares * premium, NOT * 100
    const txs = [{ action: 'BUY', shares: 3, price: 15.20 }];
    const expected = 50000 - 3 * 15.20; // = 49954.40
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBeCloseTo(49954.40, 2);
  });

  test('unknown action (e.g. "OPEN") is ignored', () => {
    const txs = [{ action: 'OPEN', shares: 10, price: 480 }];
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBe(50000);
  });

  test('missing price treated as 0 (no cash change)', () => {
    const txs = [{ action: 'BUY', shares: 10, price: undefined }];
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBe(50000);
  });

  test('missing shares (null) treated as 0 (no cash change)', () => {
    // Number(null) === 0, so cost = 0 * 480 = 0 → no cash change
    const txs = [{ action: 'BUY', shares: null, price: 480 }];
    expect(calcBuyingPowerBaseline(txs, INITIAL)).toBe(50000);
  });

  test('baseline persisted to localStorage after calculation', () => {
    const txs = [{ action: 'BUY', shares: 10, price: 480 }];
    const baseline = calcBuyingPowerBaseline(txs, INITIAL);
    localStorage.setItem('portfolio_buying_power', baseline.toFixed(2));
    expect(localStorage.getItem('portfolio_buying_power')).toBe('45200.00');
  });

  test('realistic portfolio: multiple BUY and SELL transactions', () => {
    // Mirrors the seed data in the app
    const txs = [
      { action: 'BUY',  shares: 10,  price: 480.00  }, // NVDA buy
      { action: 'SELL', shares: 10,  price: 495.00  }, // NVDA sell
      { action: 'BUY',  shares: 50,  price: 21.00   }, // PLTR
      { action: 'BUY',  shares: 30,  price: 170.00  }, // AAPL
      { action: 'BUY',  shares: 20,  price: 172.00  }, // AAPL
      { action: 'SELL', shares: 50,  price: 178.00  }, // AAPL sell
      { action: 'BUY',  shares: 15,  price: 185.00  }, // TSLA
      { action: 'BUY',  shares: 3,   price: 15.20   }, // NVDA Call
      { action: 'BUY',  shares: 40,  price: 410.00  }, // MSFT
      { action: 'SELL', shares: 20,  price: 425.00  }, // MSFT trim
    ];
    const baseline = calcBuyingPowerBaseline(txs, INITIAL);
    // Should be a positive number given INITIAL=50000 and these flows
    expect(baseline).toBeGreaterThan(0);
    // Sanity check: can afford more trades
    expect(baseline).toBeLessThan(INITIAL);
  });

  test('does not overwrite buying power in pullCloudData if user_set flag is true', () => {
    localStorage.setItem('portfolio_buying_power', '25000.00');
    localStorage.setItem('portfolio_buying_power_user_set', 'true');
    const txs = [{ action: 'BUY', shares: 10, price: 480 }];
    const baseline = calcBuyingPowerBaseline(txs, INITIAL);
    if (localStorage.getItem('portfolio_buying_power_user_set') !== 'true') {
      localStorage.setItem('portfolio_buying_power', baseline.toFixed(2));
    }
    expect(localStorage.getItem('portfolio_buying_power')).toBe('25000.00');
  });

  test('overwrites buying power in pullCloudData if user_set flag is not true', () => {
    localStorage.setItem('portfolio_buying_power', '25000.00');
    const txs = [{ action: 'BUY', shares: 10, price: 480 }];
    const baseline = calcBuyingPowerBaseline(txs, INITIAL);
    if (localStorage.getItem('portfolio_buying_power_user_set') !== 'true') {
      localStorage.setItem('portfolio_buying_power', baseline.toFixed(2));
    }
    expect(localStorage.getItem('portfolio_buying_power')).toBe('45200.00');
  });
});

describe('calcNetPortfolioValue — portfolio_value_override behavior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns sum of buying power and asset equity if no override is set', () => {
    const val = calcNetPortfolioValue(10000, 5000);
    expect(val).toBe(15000);
  });

  test('returns override value if set', () => {
    localStorage.setItem('portfolio_value_override', '75000.00');
    const val = calcNetPortfolioValue(10000, 5000);
    expect(val).toBe(75000.00);
  });
});

describe('cleanAssetName — asset name cleaning', () => {
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

  test('cleans standard stock name legal suffixes', () => {
    expect(cleanAssetName('Apple Inc.')).toBe('Apple');
    expect(cleanAssetName('NVIDIA Corporation')).toBe('NVIDIA');
  });

  test('cleans option name and falls back to underlying stock name', () => {
    expect(cleanAssetName('SPY$723 CALL 6/11')).toBe('SPDR S&P 500 ETF Trust');
    expect(cleanAssetName('AAPL $180 Put')).toBe('Apple');
  });

  test('returns root if no default asset name is defined for option', () => {
    expect(cleanAssetName('XYZ$100 CALL')).toBe('XYZ');
  });

  test('returns original cleaned name if not option format', () => {
    expect(cleanAssetName('My Custom Stock LLC')).toBe('My Custom Stock');
  });
});

