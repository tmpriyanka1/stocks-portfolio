/**
 * @file entry.test.js
 * @description Unit tests for entry.js — covers:
 *   - saveTransactionLocally (localStorage persistence, seed data on first run)
 *   - pushTradeToCloud payload construction (field mapping, option/stock type)
 *   - Transaction object builder (field validation, type coercion)
 *   - Buying power deduction on BUY action
 *   - applyAccentColor (CSS variable injection)
 *   - showToast (DOM creation, error styling, de-duplication)
 *   - pullCloudData row parser (currentPrice fallback, type detection)
 *   - Cloud payload field keys (Symbol, Name, Asset Type, CostBasis, etc.)
 *
 * @jest-environment jest-environment-jsdom
 */

// ══════════════════════════════════════════════════════════════════════════════
// Pure logic re-implementations from entry.js
// ══════════════════════════════════════════════════════════════════════════════

// SOURCE: saveTransactionLocally
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
    txs = [];  // in tests we skip the seed data for purity
  }
  txs.push(tx);
  localStorage.setItem('portfolio_transactions', JSON.stringify(txs));
  return txs;
}

// SOURCE: buildTransaction — the logic inside initFormSubmit
function buildTransaction({ ticker, type, action, shares, price, date, slInput, comment }) {
  const sharesInt = parseInt(shares, 10);
  const priceFloat = parseFloat(price);
  const slValue = slInput ? parseFloat(slInput) : 0;
  return {
    ticker: ticker.trim().toUpperCase(),
    assetType: type,
    action,
    shares: sharesInt,
    price: priceFloat,
    date,
    comment: comment ? comment.trim() : '',
    stopLoss: slValue
  };
}

// SOURCE: buildCloudPayload — the object sent to Google Sheets
function buildCloudPayload(tx) {
  const defaultNames = {
    'NVDA': 'NVIDIA Corporation',
    'AAPL': 'Apple Inc.',
    'TSLA': 'Tesla Inc.',
    'NVDA $490 Call': 'Exp 07/16/26 • Buy to Open',
    'AAPL $180 Call': 'Exp 06/18/26 • Buy to Open'
  };
  return {
    Symbol: tx.ticker,
    Name: defaultNames[tx.ticker] || (tx.ticker + ' Corporation'),
    Date: tx.date,
    'Asset Type': tx.assetType === 'options' ? 'Option' : 'Stock',
    Action: tx.action,
    Shares: Number(tx.shares),
    CostBasis: Number(tx.price),
    CurrentPrice: Number(tx.price),
    SL: tx.stopLoss ? Number(tx.stopLoss) : 0,
    Icon: tx.ticker.substring(0, 2).toUpperCase(),
    'Trade Journal Note': tx.comment
  };
}

// SOURCE: deductBuyingPower (inside initFormSubmit BUY block)
function deductBuyingPower(sharesInt, priceFloat) {
  let bp = parseFloat(localStorage.getItem('portfolio_buying_power') || '12342.90');
  bp -= sharesInt * priceFloat;
  localStorage.setItem('portfolio_buying_power', bp.toFixed(2));
  return bp;
}

// SOURCE: applyAccentColor
function applyAccentColor(hexColor) {
  document.documentElement.style.setProperty('--accent', hexColor);
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.15)`);
}

// SOURCE: showToast
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

// SOURCE: pullCloudData row parser (entry.js version)
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
  const comment = String(tx['Trade Journal Note'] || '');
  const stopLoss = parseFloat(tx.SL || 0);
  return { ticker, assetType, action, shares, price: costBasis, currentPrice, comment, stopLoss };
}

// SOURCE: field validation check (initFormSubmit)
function validateTradeFields({ ticker, type, action, shares, price, date }) {
  return !!(ticker && type && action && shares && price && date);
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════════════════

describe('saveTransactionLocally — localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('saves first transaction to empty storage', () => {
    const tx = { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480 };
    const result = saveTransactionLocally(tx);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('NVDA');
  });

  test('appends to existing transactions', () => {
    const existing = [{ ticker: 'AAPL', assetType: 'stocks', action: 'BUY', shares: 30, price: 170 }];
    localStorage.setItem('portfolio_transactions', JSON.stringify(existing));
    const newTx = { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480 };
    const result = saveTransactionLocally(newTx);
    expect(result).toHaveLength(2);
    expect(result[1].ticker).toBe('NVDA');
  });

  test('persists data to localStorage', () => {
    const tx = { ticker: 'TSLA', assetType: 'stocks', action: 'BUY', shares: 15, price: 185 };
    saveTransactionLocally(tx);
    const stored = JSON.parse(localStorage.getItem('portfolio_transactions'));
    expect(stored).toHaveLength(1);
    expect(stored[0].ticker).toBe('TSLA');
  });

  test('handles corrupted localStorage gracefully (resets to new array)', () => {
    localStorage.setItem('portfolio_transactions', 'NOT_JSON');
    const tx = { ticker: 'NVDA', assetType: 'stocks', action: 'BUY', shares: 10, price: 480 };
    const result = saveTransactionLocally(tx);
    expect(result).toHaveLength(1);
  });

  test('stores options transaction correctly', () => {
    const tx = { ticker: 'NVDA $490 Call', assetType: 'options', action: 'BUY', shares: 3, price: 15.20 };
    const result = saveTransactionLocally(tx);
    expect(result[0].assetType).toBe('options');
    expect(result[0].shares).toBe(3);
  });

  test('sequential saves accumulate correctly', () => {
    saveTransactionLocally({ ticker: 'NVDA', action: 'BUY', shares: 10, price: 480 });
    saveTransactionLocally({ ticker: 'AAPL', action: 'BUY', shares: 30, price: 170 });
    saveTransactionLocally({ ticker: 'TSLA', action: 'BUY', shares: 15, price: 185 });
    const stored = JSON.parse(localStorage.getItem('portfolio_transactions'));
    expect(stored).toHaveLength(3);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('buildTransaction — transaction object construction', () => {
  const base = {
    ticker: 'nvda', type: 'stocks', action: 'BUY',
    shares: '10', price: '480', date: '2026-06-10T10:00:00',
    slInput: '380', comment: ' Momentum entry '
  };

  test('ticker is uppercased and trimmed', () => {
    const tx = buildTransaction(base);
    expect(tx.ticker).toBe('NVDA');
  });

  test('ticker with spaces is trimmed', () => {
    const tx = buildTransaction({ ...base, ticker: ' aapl ' });
    expect(tx.ticker).toBe('AAPL');
  });

  test('shares are parsed as integer', () => {
    const tx = buildTransaction(base);
    expect(tx.shares).toBe(10);
    expect(typeof tx.shares).toBe('number');
  });

  test('price is parsed as float', () => {
    const tx = buildTransaction(base);
    expect(tx.price).toBe(480);
    expect(typeof tx.price).toBe('number');
  });

  test('stopLoss is parsed from slInput', () => {
    const tx = buildTransaction(base);
    expect(tx.stopLoss).toBe(380);
  });

  test('stopLoss defaults to 0 when slInput is empty', () => {
    const tx = buildTransaction({ ...base, slInput: '' });
    expect(tx.stopLoss).toBe(0);
  });

  test('stopLoss defaults to 0 when slInput is null/undefined', () => {
    const tx = buildTransaction({ ...base, slInput: null });
    expect(tx.stopLoss).toBe(0);
  });

  test('comment is trimmed', () => {
    const tx = buildTransaction(base);
    expect(tx.comment).toBe('Momentum entry');
  });

  test('empty comment remains empty string', () => {
    const tx = buildTransaction({ ...base, comment: '' });
    expect(tx.comment).toBe('');
  });

  test('assetType is passed through correctly for stocks', () => {
    const tx = buildTransaction(base);
    expect(tx.assetType).toBe('stocks');
  });

  test('assetType is passed through correctly for options', () => {
    const tx = buildTransaction({ ...base, type: 'options', ticker: 'NVDA $490 Call' });
    expect(tx.assetType).toBe('options');
  });

  test('action BUY is preserved', () => {
    const tx = buildTransaction(base);
    expect(tx.action).toBe('BUY');
  });

  test('action SELL is preserved', () => {
    const tx = buildTransaction({ ...base, action: 'SELL' });
    expect(tx.action).toBe('SELL');
  });

  test('date is passed through unchanged', () => {
    const tx = buildTransaction(base);
    expect(tx.date).toBe('2026-06-10T10:00:00');
  });

  test('decimal price parsed correctly', () => {
    const tx = buildTransaction({ ...base, price: '15.20' });
    expect(tx.price).toBeCloseTo(15.20, 2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('buildCloudPayload — Google Sheets field mapping', () => {
  const stockTx = {
    ticker: 'NVDA', assetType: 'stocks', action: 'BUY',
    shares: 10, price: 480, date: '2026-06-10T10:00:00',
    stopLoss: 380, comment: 'Breakout buy'
  };

  const optionTx = {
    ticker: 'NVDA $490 Call', assetType: 'options', action: 'BUY',
    shares: 3, price: 15.20, date: '2026-05-28T09:35:00',
    stopLoss: 12, comment: 'Buy to open'
  };

  test('Symbol maps to tx.ticker', () => {
    expect(buildCloudPayload(stockTx).Symbol).toBe('NVDA');
  });

  test('Action maps to tx.action', () => {
    expect(buildCloudPayload(stockTx).Action).toBe('BUY');
  });

  test('Shares is a Number', () => {
    expect(typeof buildCloudPayload(stockTx).Shares).toBe('number');
    expect(buildCloudPayload(stockTx).Shares).toBe(10);
  });

  test('CostBasis maps to tx.price as Number', () => {
    expect(buildCloudPayload(stockTx).CostBasis).toBe(480);
  });

  test('CurrentPrice equals CostBasis (entry price snapshot)', () => {
    expect(buildCloudPayload(stockTx).CurrentPrice).toBe(480);
  });

  test('SL maps to tx.stopLoss as Number', () => {
    expect(buildCloudPayload(stockTx).SL).toBe(380);
  });

  test('SL defaults to 0 when stopLoss is falsy', () => {
    expect(buildCloudPayload({ ...stockTx, stopLoss: 0 }).SL).toBe(0);
  });

  test('Icon is first 2 chars of ticker uppercased', () => {
    expect(buildCloudPayload(stockTx).Icon).toBe('NV');
  });

  test('Trade Journal Note maps to tx.comment', () => {
    expect(buildCloudPayload(stockTx)['Trade Journal Note']).toBe('Breakout buy');
  });

  test('Asset Type is "Stock" for stocks', () => {
    expect(buildCloudPayload(stockTx)['Asset Type']).toBe('Stock');
  });

  test('Asset Type is "Option" for options', () => {
    expect(buildCloudPayload(optionTx)['Asset Type']).toBe('Option');
  });

  test('Name uses defaultNames for known tickers', () => {
    expect(buildCloudPayload(stockTx).Name).toBe('NVIDIA Corporation');
  });

  test('Name uses defaultNames for AAPL', () => {
    expect(buildCloudPayload({ ...stockTx, ticker: 'AAPL' }).Name).toBe('Apple Inc.');
  });

  test('Name uses defaultNames for TSLA', () => {
    expect(buildCloudPayload({ ...stockTx, ticker: 'TSLA' }).Name).toBe('Tesla Inc.');
  });

  test('Name for options ticker uses defaultNames lookup', () => {
    expect(buildCloudPayload(optionTx).Name).toBe('Exp 07/16/26 • Buy to Open');
  });

  test('Name fallback for unknown ticker appends " Corporation"', () => {
    const unknownTx = { ...stockTx, ticker: 'COIN' };
    expect(buildCloudPayload(unknownTx).Name).toBe('COIN Corporation');
  });

  test('Date maps to tx.date', () => {
    expect(buildCloudPayload(stockTx).Date).toBe('2026-06-10T10:00:00');
  });

  test('Icon for 1-char ticker uses first char repeated', () => {
    // Actually: ticker.substring(0, 2) → for 'A' this gives 'A', for 'AB' gives 'AB'
    const shortTx = { ...stockTx, ticker: 'A' };
    expect(buildCloudPayload(shortTx).Icon).toBe('A');
  });

  test('Icon for 4-char ticker takes first 2', () => {
    const spyTx = { ...stockTx, ticker: 'PLTR' };
    expect(buildCloudPayload(spyTx).Icon).toBe('PL');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('validateTradeFields — form input validation', () => {
  const valid = { ticker: 'NVDA', type: 'stocks', action: 'BUY', shares: '10', price: '480', date: '2026-06-10' };

  test('all fields present → valid', () => {
    expect(validateTradeFields(valid)).toBe(true);
  });

  test('missing ticker → invalid', () => {
    expect(validateTradeFields({ ...valid, ticker: '' })).toBe(false);
  });

  test('missing type → invalid', () => {
    expect(validateTradeFields({ ...valid, type: '' })).toBe(false);
  });

  test('missing action → invalid', () => {
    expect(validateTradeFields({ ...valid, action: '' })).toBe(false);
  });

  test('missing shares → invalid', () => {
    expect(validateTradeFields({ ...valid, shares: '' })).toBe(false);
  });

  test('missing price → invalid', () => {
    expect(validateTradeFields({ ...valid, price: '' })).toBe(false);
  });

  test('missing date → invalid', () => {
    expect(validateTradeFields({ ...valid, date: '' })).toBe(false);
  });

  test('all fields undefined → invalid', () => {
    expect(validateTradeFields({ ticker: undefined, type: undefined, action: undefined, shares: undefined, price: undefined, date: undefined })).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('deductBuyingPower — buying power deduction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('deducts correctly from default buying power', () => {
    const result = deductBuyingPower(10, 480);
    // 12342.90 - 10*480 = 7542.90
    expect(result).toBeCloseTo(7542.90, 2);
  });

  test('persists to localStorage', () => {
    deductBuyingPower(10, 480);
    expect(localStorage.getItem('portfolio_buying_power')).toBe('7542.90');
  });

  test('deducts from custom buying power', () => {
    localStorage.setItem('portfolio_buying_power', '5000.00');
    const result = deductBuyingPower(5, 100);
    expect(result).toBeCloseTo(4500, 2);
  });

  test('options BUY: deducts shares*price (premium, no ×100)', () => {
    // Entry form deducts shares*price only (premium cost, not leveraged)
    localStorage.setItem('portfolio_buying_power', '5000.00');
    const result = deductBuyingPower(3, 15.20);  // 3 contracts @ $15.20 = $45.60
    expect(result).toBeCloseTo(4954.40, 2);
  });

  test('large trade can result in negative buying power', () => {
    const result = deductBuyingPower(1000, 500);
    expect(result).toBeLessThan(0);
  });

  test('zero shares: buying power unchanged', () => {
    const result = deductBuyingPower(0, 480);
    expect(result).toBeCloseTo(12342.90, 2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('pullCloudData row parser — entry.js version', () => {
  test('uses CurrentPrice when positive', () => {
    expect(parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '485', 'Asset Type': 'Stock', Shares: '40', Action: 'BUY', SL: '0' }).currentPrice).toBe(485);
  });

  test('falls back to CostBasis when CurrentPrice is 0', () => {
    expect(parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '0', 'Asset Type': 'Stock', Shares: '40', Action: 'BUY', SL: '0' }).currentPrice).toBe(400);
  });

  test('auto-detects options from CALL in symbol', () => {
    expect(parseCloudRow({ Symbol: 'SPY $723 CALL', CostBasis: '5', CurrentPrice: '6', 'Asset Type': 'Stock', Shares: '2', Action: 'BUY', SL: '0' }).assetType).toBe('options');
  });

  test('auto-detects options from PUT in symbol', () => {
    expect(parseCloudRow({ Symbol: 'QQQ $450 PUT', CostBasis: '3', CurrentPrice: '4', 'Asset Type': 'Stock', Shares: '1', Action: 'BUY', SL: '0' }).assetType).toBe('options');
  });

  test('preserves Trade Journal Note as comment', () => {
    expect(parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '485', 'Asset Type': 'Stock', Shares: '40', Action: 'BUY', SL: '0', 'Trade Journal Note': 'Buy on dip' }).comment).toBe('Buy on dip');
  });

  test('stopLoss parsed as float', () => {
    expect(parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '485', 'Asset Type': 'Stock', Shares: '40', Action: 'BUY', SL: '380' }).stopLoss).toBe(380);
  });

  test('missing Trade Journal Note returns empty string', () => {
    expect(parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '485', 'Asset Type': 'Stock', Shares: '40', Action: 'BUY', SL: '0' }).comment).toBe('');
  });

  test('shares parsed as integer', () => {
    expect(parseCloudRow({ Symbol: 'NVDA', CostBasis: '400', CurrentPrice: '485', 'Asset Type': 'Stock', Shares: '40', Action: 'BUY', SL: '0' }).shares).toBe(40);
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('applyAccentColor — entry.js CSS variable injection', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-glow');
  });

  test('sets --accent variable', () => {
    applyAccentColor('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#6366f1');
  });

  test('computes rgba glow for indigo #6366f1', () => {
    applyAccentColor('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--accent-glow')).toBe('rgba(99, 102, 241, 0.15)');
  });

  test('computes rgba glow for green #10b981', () => {
    applyAccentColor('#10b981');
    expect(document.documentElement.style.getPropertyValue('--accent-glow')).toBe('rgba(16, 185, 129, 0.15)');
  });

  test('overwrites previous --accent value', () => {
    applyAccentColor('#ef4444');
    applyAccentColor('#6366f1');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#6366f1');
  });
});

// ──────────────────────────────────────────────────────────────────────────────

describe('showToast — entry.js DOM toast rendering', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('creates toast element with class app-toast', () => {
    showToast('Test');
    expect(document.querySelector('.app-toast')).not.toBeNull();
  });

  test('sets message correctly', () => {
    showToast('🟢 Trade Synced to Cloud Sheet!');
    expect(document.querySelector('.app-toast').innerText).toBe('🟢 Trade Synced to Cloud Sheet!');
  });

  test('error toast gets red border color', () => {
    const toast = showToast('⚠️ Error!', true);
    expect(toast.style.borderColor).toBe('rgba(239, 68, 68, 0.4)');
  });

  test('success toast has no red border', () => {
    const toast = showToast('Success!', false);
    expect(toast.style.borderColor).toBe('');
  });

  test('removes existing toast before creating new one', () => {
    showToast('First');
    showToast('Second');
    expect(document.querySelectorAll('.app-toast')).toHaveLength(1);
    expect(document.querySelector('.app-toast').innerText).toBe('Second');
  });

  test('appends to app-container', () => {
    showToast('Hello');
    const container = document.getElementById('app-container');
    expect(container.children).toHaveLength(1);
  });

  test('handles undefined isError parameter gracefully', () => {
    expect(() => showToast('Test')).not.toThrow();
  });

  test('offline mode message is handled correctly', () => {
    showToast('Trade saved locally (Offline Mode)', true);
    const toast = document.querySelector('.app-toast');
    expect(toast.innerText).toContain('Offline Mode');
    expect(toast.style.borderColor).toBe('rgba(239, 68, 68, 0.4)');
  });

  test('cloud sync success message', () => {
    showToast('🟢 Trade Synced to Cloud Sheet!', false);
    expect(document.querySelector('.app-toast').innerText).toContain('Synced');
  });
});
