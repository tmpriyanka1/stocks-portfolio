const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');


const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());



// Auto-commit middleware
const { exec } = require('child_process');
app.use((req, res, next) => {
  res.on('finish', () => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
      // Do not auto-commit if a tester is modifying test data
      if (req.headers['x-user-role'] === 'tester') {
        return;
      }
      
      const excludePaths = ['/api/login', '/api/forgot-password/otp', '/api/forgot-password/login'];
      if (!excludePaths.includes(req.path) && req.path.startsWith('/api/')) {
        const timestamp = new Date().toISOString();
        const message = `Data modification ${timestamp}`;
        const remote = process.env.GIT_TOKEN 
          ? `https://${process.env.GIT_TOKEN}@github.com/tmpriyanka1/stocks-portfolio.git` 
          : 'origin';
        exec(`git config user.name "Portfolio Bot" && git config user.email "bot@portfolio.com" && git add data/ && (git commit -m "${message}" || true) && git push ${remote} HEAD:main`, { cwd: __dirname }, (err, stdout, stderr) => {
          if (err) {
            console.error("[Auto-Commit] Error Message:", err.message);
            console.error("[Auto-Commit] Stderr:", stderr);
            console.error("[Auto-Commit] Stdout:", stdout);
          } else {
            console.log("[Auto-Commit] Success:", stdout.trim());
          }
        });
      }
    }
  });
  next();
});

const USERS_DB_PATH = path.join(__dirname, 'data', 'users.ndjson');

function getDatabasePath(req, fileName) {
    const userRole = req && req.headers['x-user-role'] || 'production';
    const targetFolder = userRole === 'tester' ? 'test_data' : 'data';
    
    // Auto-create folder if missing so the user doesn't have to do it manually
    const folderPath = path.join(__dirname, targetFolder);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    
    return path.join(folderPath, fileName);
}

const DEFAULT_PRICES = {
  'NVDA': 485.00,
  'AAPL': 175.50,
  'TSLA': 198.20,
  'SPY': 512.42,
  'SPX': 5120.30,
  'NVDA $490 CALL': 18.50,
  'AAPL $180 CALL': 4.80
};

// =============================================================================
// DATA LAYER BOOTSTRAP — runs synchronously at the very top of startup.
// Ensures all required directories and database files exist before any route
// or middleware handler can attempt a read/write operation. Creates missing
// assets in-place and emits a granular diagnostic report to the console.
// =============================================================================

/**
 * bootstrapDataLayer()
 * Verifies and initialises the full data storage layer on every server start.
 * Reports [CREATED] for newly scaffolded assets and [OK] for pre-existing ones.
 */
function bootstrapDataLayer() {
  const DB_PATH = path.join(__dirname, 'data', 'trades.ndjson');
  const NOTES_DB_PATH = path.join(__dirname, 'data', 'journal_notes.ndjson');
  const PRICES_PATH = path.join(__dirname, 'data', 'prices.json');
  const CASH_LEDGER_PATH = path.join(__dirname, 'data', 'cash_ledger.ndjson');
  const OVERRIDES_PATH = path.join(__dirname, 'data', 'overrides.json');

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       DATA LAYER BOOTSTRAP — Initializing...         ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // ── 1. Data Directory ────────────────────────────────────────────────────
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`  [CREATED] data/ directory → ${dataDir}`);
  } else {
    console.log(`  [OK]      data/ directory → ${dataDir}`);
  }

  // ── 2. Core NDJSON Ledger Files ──────────────────────────────────────────
  const coreFiles = [
    { label: 'trades.ndjson     ', path: DB_PATH, content: '' },
    { label: 'cash_ledger.ndjson', path: CASH_LEDGER_PATH, content: '' },
    { label: 'journal_notes.ndjson', path: NOTES_DB_PATH, content: '' },
  ];

  coreFiles.forEach(({ label, path: filePath, content }) => {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  [CREATED] ${label} → ${filePath}`);
    } else {
      console.log(`  [OK]      ${label} → ${filePath}`);
    }
  });

  // ── 3. Supporting JSON Files ─────────────────────────────────────────────
  if (!fs.existsSync(PRICES_PATH)) {
    fs.writeFileSync(PRICES_PATH, '{}', 'utf8');
    console.log(`  [CREATED] prices.json       → ${PRICES_PATH}`);
  } else {
    console.log(`  [OK]      prices.json       → ${PRICES_PATH}`);
  }

  if (!fs.existsSync(OVERRIDES_PATH)) {
    fs.writeFileSync(OVERRIDES_PATH, '{}', 'utf8');
    console.log(`  [CREATED] overrides.json    → ${OVERRIDES_PATH}`);
  } else {
    console.log(`  [OK]      overrides.json    → ${OVERRIDES_PATH}`);
  }

  // ── 4. Users Database + Default Admin Seeding ───────────────────────────
  if (!fs.existsSync(USERS_DB_PATH)) {
    fs.writeFileSync(USERS_DB_PATH, '', 'utf8');
    console.log(`  [CREATED] users.ndjson      → ${USERS_DB_PATH}`);
  } else {
    console.log(`  [OK]      users.ndjson      → ${USERS_DB_PATH}`);
  }

  // Seed default admin if the file has no user records at all
  try {
    const usersContent = fs.readFileSync(USERS_DB_PATH, 'utf8').trim();
    if (usersContent.length === 0) {
      const defaultAdmin = {
        username: 'admin',
        role: 'admin',
        email: 'admin@portfolio.com',
        phoneNumber: '1234567890',
        password: 'Admin@123!',
        createdAt: new Date().toISOString()
      };
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify(defaultAdmin) + '\n', 'utf8');
      console.log('  [SEEDED]  Default admin account → username: admin, password: Admin@123!');
    } else {
      console.log('  [OK]      Default admin account → existing user records found, no seeding required');
    }
  } catch (seedErr) {
    console.warn('  [WARN]    Could not verify/seed default admin:', seedErr.message);
  }

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       DATA LAYER BOOTSTRAP — Complete ✓              ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
}

// ── Dynamic version of ensureDbExists ──
function ensureDbExists(req) {
  const userRole = req && req.headers['x-user-role'] || 'production';
  const targetFolder = userRole === 'tester' ? 'test_data' : 'data';
  const folderPath = path.join(__dirname, targetFolder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  const dbPath = path.join(folderPath, 'trades.ndjson');
  const notesPath = path.join(folderPath, 'journal_notes.ndjson');
  const cashLedgerPath = path.join(folderPath, 'cash_ledger.ndjson');
  const overridesPath = path.join(folderPath, 'overrides.json');
  const pricesPath = path.join(folderPath, 'prices.json');

  const guards = [dbPath, notesPath, cashLedgerPath];
  guards.forEach(p => { if (!fs.existsSync(p)) fs.writeFileSync(p, '', 'utf8'); });
  if (!fs.existsSync(pricesPath)) fs.writeFileSync(pricesPath, '{}', 'utf8');
  if (!fs.existsSync(overridesPath)) fs.writeFileSync(overridesPath, '{}', 'utf8');
  if (!fs.existsSync(USERS_DB_PATH)) fs.writeFileSync(USERS_DB_PATH, '', 'utf8');
}

// Run the full bootstrap synchronously before any routes are registered
bootstrapDataLayer();




function loadPrices(req) {
  ensureDbExists(req);
  try {
    const pricesPath = getDatabasePath(req, 'prices.json');
    const data = fs.readFileSync(pricesPath, 'utf8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('Failed to read or parse prices.json:', err);
    return {};
  }
}

function savePrices(req, prices) {
  // Only save prices if running on Render to avoid local git diff noise
  if (!process.env.GIT_TOKEN && !process.env.RENDER) {
    return;
  }
  
  ensureDbExists(req);
  try {
    const pricesPath = getDatabasePath(req, 'prices.json');
    fs.writeFileSync(pricesPath, JSON.stringify(prices, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write prices.json:', err);
  }
}

/**
 * General helper to fetch and parse JSON from a Yahoo Finance API URL using allorigins proxy.
 */
function fetchYahooUrl(targetUrl) {
  return new Promise((resolve) => {
    const url = `http://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const args = [
      '-s', '-L', '--max-time', '12',
      '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      url
    ];
    execFile('curl', args, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        console.warn(`[fetchYahooUrl] curl error for ${targetUrl}:`, err.message, "Stderr:", stderr);
        return resolve(null);
      }
      try {
        const wrapper = JSON.parse(stdout);
        if (!wrapper || !wrapper.contents) {
          console.warn(`[fetchYahooUrl] No contents in proxy wrapper for ${targetUrl}`);
          return resolve(null);
        }
        resolve(JSON.parse(wrapper.contents));
      } catch (parseErr) {
        console.warn(`[fetchYahooUrl] JSON parse/proxy wrapper error for ${targetUrl}:`, parseErr.message);
        resolve(null);
      }
    });
  });
}

/**
 * Fetches a live price from Yahoo Finance for a stock/underlying index.
 * Returns { price, change24h, name } or null on failure.
 */
function fetchYahooPrice(ticker) {
  return new Promise(async (resolve) => {
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
    const json = await fetchYahooUrl(targetUrl);
    if (!json) return resolve(null);
    try {
      const result = json.chart && json.chart.result && json.chart.result[0];
      if (result && result.meta && result.meta.regularMarketPrice !== undefined) {
        const price = result.meta.regularMarketPrice;
        const prevClose = result.meta.chartPreviousClose || result.meta.previousClose || price;
        const change24h = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
        const name = result.meta.longName || result.meta.shortName || ticker;
        resolve({ price, change24h: parseFloat(change24h.toFixed(4)), name });
      } else {
        console.warn(`[fetchYahooPrice] No price data in response for ${ticker}`);
        resolve(null);
      }
    } catch (err) {
      console.warn(`[fetchYahooPrice] Error parsing response for ${ticker}:`, err.message);
      resolve(null);
    }
  });
}

/**
 * Helper to construct a standard OCC option symbol.
 * Returns the symbol string (e.g. "SPY260731P00734000") or null.
 */
function getYahooOptionSymbol(ticker, expiryDate) {
  if (!expiryDate) return null;
  const baseMatch = ticker.match(/^([A-Z]+)/i);
  if (!baseMatch) return null;
  const underlying = baseMatch[1].toUpperCase();
  const strikeMatch = ticker.match(/(?:@|\$|\s)(\d+(?:\.\d+)?)/);
  if (!strikeMatch) return null;
  const strikeNum = parseFloat(strikeMatch[1]);
  const dateObj = new Date(expiryDate);
  if (isNaN(dateObj.getTime())) return null;
  const yy = String(dateObj.getUTCFullYear()).slice(-2);
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  const expiryStr = `${yy}${mm}${dd}`;
  const isPut = /\b(put|p)\b/i.test(ticker);
  const type = isPut ? 'P' : 'C';
  const strikeCents = Math.round(strikeNum * 1000);
  const strikeStr = String(strikeCents).padStart(8, '0');
  return `${underlying}${expiryStr}${type}${strikeStr}`;
}

/**
 * Fetches a live price from Yahoo Finance for a specific option contract.
 * Returns { price, change24h, name } or null on failure.
 */
async function fetchYahooOptionPrice(ticker, expiryDate) {
  const occSymbol = getYahooOptionSymbol(ticker, expiryDate);
  if (!occSymbol) {
    console.warn(`[fetchYahooOptionPrice] Could not parse OCC symbol for ticker=${ticker}, expiryDate=${expiryDate}`);
    return null;
  }
  const data = await fetchYahooPrice(occSymbol);
  if (data) {
    // Retain OCC symbol as name for tracking
    data.name = occSymbol;
  }
  return data;
}

// Server-side cache for fetched prices to prevent rate limiting (5 min TTL)
const priceCache = {};
const CACHE_TTL_MS = 300000; // 5 minutes

// GET /api/prices - Return the cached prices.json
app.get('/api/prices', (req, res) => {
  try {
    const prices = loadPrices(req);
    res.status(200).json(prices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read prices.' });
  }
});

// GET /api/prices/fetch?tickers=AAPL,TSLA,SPY
// Fetches live prices from Yahoo Finance server-side (no CORS proxy needed),
// persists to prices.json, and returns the result.
app.get('/api/prices/fetch', async (req, res) => {
  const tickerParam = (req.query.tickers || '').trim();
  if (!tickerParam) {
    return res.status(400).json({ error: 'Query param "tickers" is required (comma-separated).' });
  }

  const tickers = tickerParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
  const prices = loadPrices(req);
  const results = {};
  const errors = {};

  // Build expiry Map from trades database to match option expiries
  const trades = loadTrades(req);
  const expiryMap = {};
  trades.forEach(t => {
    if (t && t.ticker && (t['Expiry Date'] || t.expiryDate || t.expiry)) {
      expiryMap[t.ticker.toUpperCase().trim()] = t['Expiry Date'] || t.expiryDate || t.expiry;
    }
  });

  // Track which tickers have already been fetched in current request batch to avoid duplicates
  const fetchedTickers = {};

  // Process sequentially with a short delay to avoid Yahoo Finance rate limiting
  for (const ticker of tickers) {
    const isOption = /[@$]|\b(call|put)\b/i.test(ticker);
    const baseMatch = ticker.split(/[\s$@]/)[0].toUpperCase();

    let data = null;
    const now = Date.now();
    const cachedEntry = priceCache[ticker];

    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL_MS)) {
      // Use server-side cache
      data = cachedEntry.data;
    } else if (fetchedTickers[ticker]) {
      // Reuse already-fetched data in current request batch
      data = fetchedTickers[ticker];
    } else {
      if (isOption) {
        const expiryDate = expiryMap[ticker];

        data = await fetchYahooOptionPrice(ticker, expiryDate);

        // If option fetching failed, fallback to underlying price
        if (!data) {
          console.warn(`[prices/fetch] Option fetch failed for ${ticker}. Falling back to underlying price for ${baseMatch}.`);
          const underlyingCached = priceCache[baseMatch];
          if (underlyingCached && (now - underlyingCached.timestamp < CACHE_TTL_MS)) {
            data = underlyingCached.data;
          } else {
            data = await fetchYahooPrice(baseMatch);
            if (data) {
              priceCache[baseMatch] = { data, timestamp: now };
            }
          }
        }
      } else {
        data = await fetchYahooPrice(ticker);
      }

      fetchedTickers[ticker] = data; // cache for current request batch (null means failed)
      if (data) {
        priceCache[ticker] = {
          data: data,
          timestamp: now
        };
      }
      // Small delay between requests to respect rate limits
      await new Promise(r => setTimeout(r, 300));
    }

    if (data) {
      prices[ticker] = data.price;
      results[ticker] = {
        ticker,
        baseTicker: baseMatch,
        price: data.price,
        change24h: data.change24h,
        name: data.name,
        isOption
      };
    } else {
      // Fallback to cached price in prices.json
      const cached = prices[ticker] !== undefined ? prices[ticker] : prices[baseMatch];
      if (cached !== undefined) {
        results[ticker] = {
          ticker,
          baseTicker: baseMatch,
          price: cached,
          change24h: 0,
          name: ticker,
          isOption,
          fromCache: true
        };
      } else {
        errors[ticker] = 'Fetch failed and no cached price available';
      }
    }
  }

  // Persist updated prices
  savePrices(req, prices);

  res.status(200).json({ results, errors, updatedAt: new Date().toISOString() });
});


// GET /api/trades - Read and parse all trades
app.get('/api/trades', (req, res) => {
  try {
    ensureDbExists(req);
    const tradesPath = getDatabasePath(req, 'trades.ndjson');
    const fileContent = fs.readFileSync(tradesPath, 'utf8');

    // Process line-by-line, filtering out empty lines
    const trades = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (err) {
          console.error('Failed to parse NDJSON line:', line, err);
          return null;
        }
      })
      .filter(trade => trade !== null);

    res.status(200).json(trades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Internal Server Error while reading trades.' });
  }
});

// Helper to verify if value is numeric
function isNumeric(val) {
  if (val === undefined || val === null || val === '') return false;
  if (typeof val === 'object' || Array.isArray(val)) return false;
  const parsed = parseFloat(val);
  return !isNaN(parsed) && isFinite(parsed);
}

// POST /api/trades - Add a new trade with validation
app.post('/api/trades', (req, res) => {
  try {
    ensureDbExists(req);

    // Check if this is a price sync request
    if (req.body.action && req.body.action.trim().toUpperCase() === 'UPDATEPRICE') {
      const symbol = (req.body.Symbol || req.body.ticker || '').trim().toUpperCase();
      const currentPrice = parseFloat(req.body.CurrentPrice !== undefined ? req.body.CurrentPrice : req.body.price);
      if (!symbol || isNaN(currentPrice)) {
        return res.status(400).json({ error: "Invalid parameters for updatePrice action" });
      }
      const prices = loadPrices(req);
      prices[symbol] = currentPrice;
      savePrices(req, prices);
      return res.status(200).json({ success: true, ticker: symbol, price: currentPrice });
    }

    const { ticker, price, quantity, shares } = req.body;

    // Support either 'quantity' or 'shares' (UI matching property name)
    const targetQuantity = quantity !== undefined ? quantity : shares;

    // Ticker Normalization & Validation
    const normalizedTicker = (ticker !== undefined && ticker !== null) ? String(ticker).trim().toUpperCase() : '';
    if (!normalizedTicker) {
      return res.status(400).json({ error: "Invalid or missing parameter: 'ticker' is required and must be a non-empty string." });
    }

    // Numeric Validation
    if (!isNumeric(price) || parseFloat(price) <= 0) {
      return res.status(400).json({ error: "Invalid or missing parameter: 'price' is required and must be a positive number." });
    }
    if (!isNumeric(targetQuantity) || parseFloat(targetQuantity) <= 0) {
      return res.status(400).json({ error: "Invalid or missing parameter: 'quantity' (or 'shares') is required and must be a positive number." });
    }

    const parsedPrice = parseFloat(price);
    const parsedQuantity = parseFloat(targetQuantity);

    // Fallback Timestamps
    let finalDate = req.body.date;
    const incomingTime = req.body.time;

    if (!finalDate || typeof finalDate !== 'string' || finalDate.trim() === '') {
      finalDate = new Date().toISOString();
    } else if (incomingTime && typeof incomingTime === 'string' && incomingTime.trim() !== '') {
      if (!finalDate.includes('T')) {
        finalDate = `${finalDate.trim()}T${incomingTime.trim()}`;
      }
    } else {
      if (!finalDate.includes('T')) {
        const now = new Date();
        const timePart = now.toISOString().split('T')[1];
        finalDate = `${finalDate.trim()}T${timePart}`;
      }
    }

    // Construct standardized trade record matching front-end schema
    const tradeRecord = {
      ticker: normalizedTicker,
      shares: parsedQuantity,
      price: parsedPrice,
      action: req.body.action ? req.body.action.trim().toUpperCase() : 'BUY',
      assetType: req.body.assetType ? req.body.assetType.trim().toLowerCase() : 'stocks',
      date: finalDate,
      comment: req.body.comment !== undefined ? String(req.body.comment).trim() : (req.body.note !== undefined ? String(req.body.note).trim() : ''),
      stopLoss: req.body.stopLoss !== undefined ? parseFloat(req.body.stopLoss) : (req.body.stopLimit !== undefined ? parseFloat(req.body.stopLimit) : 0)
    };

    if (tradeRecord.assetType === 'options') {
      tradeRecord['Expiry Date'] = req.body['Expiry Date'] || req.body.expiryDate || req.body.expiry || '';
    }

    // Append to file in NDJSON format
    const tradesPath = getDatabasePath(req, 'trades.ndjson');
    fs.appendFileSync(tradesPath, JSON.stringify(tradeRecord) + '\n', 'utf8');

    // Server Logs
    console.log(`Successfully saved sanitized trade record: Ticker=${tradeRecord.ticker}, Action=${tradeRecord.action}, Shares=${tradeRecord.shares}, Price=$${tradeRecord.price.toFixed(2)}, Date=${tradeRecord.date}`);

    res.status(201).json(tradeRecord);
  } catch (error) {
    console.error('Error saving trade:', error);
    res.status(500).json({ error: 'Internal Server Error while saving trade.' });
  }
});

// DELETE /api/trades/ticker/:ticker - Remove all trade records for a given ticker
app.delete('/api/trades/ticker/:ticker', (req, res) => {
  try {
    ensureDbExists(req);
    const tickerToDelete = req.params.ticker.trim().toUpperCase();
    if (!tickerToDelete) {
      return res.status(400).json({ error: "Ticker is required" });
    }
    const tradesPath = getDatabasePath(req, 'trades.ndjson');
    const fileContent = fs.readFileSync(tradesPath, 'utf8');
    const lines = fileContent.split('\n');
    const remainingLines = [];
    let deletedCount = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const trade = JSON.parse(line);
        if (trade.ticker && trade.ticker.trim().toUpperCase() === tickerToDelete) {
          deletedCount++;
        } else {
          remainingLines.push(line);
        }
      } catch (err) {
        remainingLines.push(line);
      }
    }

    fs.writeFileSync(tradesPath, remainingLines.join('\n') + (remainingLines.length ? '\n' : ''), 'utf8');
    console.log(`Deleted ${deletedCount} trades for ticker ${tickerToDelete}`);
    res.status(200).json({ success: true, deletedCount });
  } catch (error) {
    console.error('Error deleting trades:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/trades/ticker/:ticker - Overwrite trade records for a given ticker
app.put('/api/trades/ticker/:ticker', (req, res) => {
  try {
    ensureDbExists(req);
    const targetTicker = req.params.ticker.trim().toUpperCase();
    if (!targetTicker) {
      return res.status(400).json({ error: "Ticker is required" });
    }

    const { shares, price, stopLoss, assetType, expiryDate } = req.body;

    if (!isNumeric(shares) || parseFloat(shares) <= 0) {
      return res.status(400).json({ error: "Shares must be a positive number." });
    }
    if (!isNumeric(price) || parseFloat(price) <= 0) {
      return res.status(400).json({ error: "Price must be a positive number." });
    }

    const parsedShares = parseFloat(shares);
    const parsedPrice = parseFloat(price);
    const parsedSL = stopLoss !== undefined ? parseFloat(stopLoss) : 0;
    const finalAssetType = assetType ? assetType.trim().toLowerCase() : 'stocks';

    // 1. Read existing file and filter out trades for this ticker
    const tradesPath = getDatabasePath(req, 'trades.ndjson');
    const fileContent = fs.readFileSync(tradesPath, 'utf8');
    const lines = fileContent.split('\n');
    const remainingLines = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const trade = JSON.parse(line);
        if (trade.ticker && trade.ticker.trim().toUpperCase() !== targetTicker) {
          remainingLines.push(line);
        }
      } catch (err) {
        remainingLines.push(line);
      }
    }

    // 2. Construct the new BUY trade record representing the updated holdings
    const newTradeRecord = {
      ticker: targetTicker,
      shares: parsedShares,
      price: parsedPrice,
      action: 'BUY',
      assetType: finalAssetType,
      date: new Date().toISOString(),
      comment: 'Position adjusted via Edit Asset form',
      stopLoss: parsedSL
    };

    if (finalAssetType === 'options') {
      newTradeRecord['Expiry Date'] = expiryDate || '';
    }

    // 3. Append the new record to the filtered lines and write back
    remainingLines.push(JSON.stringify(newTradeRecord));
    fs.writeFileSync(tradesPath, remainingLines.join('\n') + '\n', 'utf8');

    console.log(`Successfully updated trade record for ${targetTicker} via PUT`);
    res.status(200).json({ success: true, trade: newTradeRecord });
  } catch (error) {
    console.error('Error updating trade:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// GET /api/notes - Read and parse all journal notes
app.get('/api/notes', (req, res) => {
  try {
    ensureDbExists(req);
    const notesPath = getDatabasePath(req, 'journal_notes.ndjson');
    const fileContent = fs.readFileSync(notesPath, 'utf8');

    const notes = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (err) {
          console.error('Failed to parse NDJSON line:', line, err);
          return null;
        }
      })
      .filter(note => note !== null);

    res.status(200).json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Internal Server Error while reading notes.' });
  }
});

// POST /api/notes - Add a new journal note with validation
app.post('/api/notes', (req, res) => {
  try {
    ensureDbExists(req);

    const { ticker, author, date, time, text } = req.body;

    // Explicit Data Validation
    if (!ticker || typeof ticker !== 'string' || ticker.trim() === '') {
      return res.status(400).json({ error: "Invalid or missing parameter: 'ticker' is required." });
    }
    if (!author || typeof author !== 'string' || author.trim() === '') {
      return res.status(400).json({ error: "Invalid or missing parameter: 'author' is required." });
    }
    if (!date || typeof date !== 'string' || date.trim() === '') {
      return res.status(400).json({ error: "Invalid or missing parameter: 'date' is required." });
    }
    if (!time || typeof time !== 'string' || time.trim() === '') {
      return res.status(400).json({ error: "Invalid or missing parameter: 'time' is required." });
    }
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: "Invalid or missing parameter: 'text' is required." });
    }

    const noteRecord = {
      ticker: ticker.trim().toUpperCase(),
      author: author.trim(),
      date: date.trim(),
      time: time.trim(),
      text: text.trim()
    };

    // Append to file in NDJSON format
    const notesPath = getDatabasePath(req, 'journal_notes.ndjson');
    fs.appendFileSync(notesPath, JSON.stringify(noteRecord) + '\n', 'utf8');

    res.status(201).json(noteRecord);
  } catch (error) {
    console.error('Error saving note:', error);
    res.status(500).json({ error: 'Internal Server Error while saving note.' });
  }
});

// POST /api/cash - Add a cash transaction to the cash ledger
app.post('/api/cash', (req, res) => {
  try {
    ensureDbExists(req);

    const { action, amount, date, time, author, reason } = req.body;

    // Explicit Data Validation
    if (!action || typeof action !== 'string' || !['DEPOSIT', 'WITHDRAWAL'].includes(action.toUpperCase())) {
      return res.status(400).json({ error: "Invalid or missing parameter: 'action' must be DEPOSIT or WITHDRAWAL." });
    }

    // Numeric Validation
    if (!isNumeric(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Invalid or missing parameter: 'amount' is required and must be a positive number." });
    }
    const parsedAmount = parseFloat(amount);

    // Fallback Timestamps
    let finalDate = date;
    let finalTime = time;

    if (!finalDate || typeof finalDate !== 'string' || finalDate.trim() === '') {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      finalDate = `${year}-${month}-${day}`;
    }

    if (!finalTime || typeof finalTime !== 'string' || finalTime.trim() === '') {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      finalTime = `${hours}:${minutes}:${seconds}`;
    }

    const cashRecord = {
      ticker: 'CASH',
      shares: 0,
      price: parsedAmount,
      action: action.trim().toUpperCase(),
      assetType: 'CASH',
      date: `${finalDate.trim()}T${finalTime.trim()}`,
      comment: (reason && typeof reason === 'string' && reason.trim()) ? reason.trim() : '',
      author: (author && typeof author === 'string' && author.trim()) ? author.trim() : 'Admin'
    };

    // Append to file in NDJSON format
    const cashLedgerPath = getDatabasePath(req, 'cash_ledger.ndjson');
    fs.appendFileSync(cashLedgerPath, JSON.stringify(cashRecord) + '\n', 'utf8');

    // Server Logs
    console.log(`Successfully saved sanitized cash record: Action=${cashRecord.action}, Amount=$${cashRecord.price.toFixed(2)}, Date=${cashRecord.date}, Author=${cashRecord.author}`);

    res.status(201).json(cashRecord);
  } catch (error) {
    console.error('Error saving cash transaction:', error);
    res.status(500).json({ error: 'Internal Server Error while saving cash transaction.' });
  }
});

// GET /api/cash - Read all cash transactions
app.get('/api/cash', (req, res) => {
  try {
    ensureDbExists(req);
    const cash = [];
    const cashLedgerPath = getDatabasePath(req, 'cash_ledger.ndjson');
    if (fs.existsSync(cashLedgerPath)) {
      const content = fs.readFileSync(cashLedgerPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          cash.push(JSON.parse(trimmed));
        } catch (e) { }
      });
    }
    res.status(200).json(cash);
  } catch (error) {
    console.error('Error fetching cash ledger:', error);
    res.status(500).json({ error: 'Internal Server Error while reading cash ledger.' });
  }
});

// Helper to read all trades
function loadTrades(req) {
  ensureDbExists(req);
  const trades = [];
  try {
    const tradesPath = getDatabasePath(req, 'trades.ndjson');
    if (fs.existsSync(tradesPath)) {
      const content = fs.readFileSync(tradesPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          trades.push(JSON.parse(trimmed));
        } catch (e) { }
      });
    }
  } catch (error) {
    console.error('Error loading trades:', error);
  }
  return trades;
}

// Helper to read all cash ledger entries
function loadCashLedger(req) {
  ensureDbExists(req);
  const cash = [];
  try {
    const cashLedgerPath = getDatabasePath(req, 'cash_ledger.ndjson');
    if (fs.existsSync(cashLedgerPath)) {
      const content = fs.readFileSync(cashLedgerPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          cash.push(JSON.parse(trimmed));
        } catch (e) { }
      });
    }
  } catch (err) {
    console.error('Error loading cash ledger:', err);
  }
  return cash;
}

// GET /api/portfolio-summary - Calculate account values
app.get('/api/portfolio-summary', (req, res) => {
  try {
    const trades = loadTrades(req);
    const cashLedger = loadCashLedger(req);
    const prices = loadPrices(req);

    // 1. Calculate Running Cash (Buying Power)
    // Starting at $0, adding deposits, subtracting withdrawals, subtracting buy cost, adding sell proceeds.
    let runningCashCents = 0;

    // Process cash_ledger.ndjson
    cashLedger.forEach(t => {
      if (!t) return;
      const action = t.action ? t.action.toUpperCase() : '';
      const price = parseFloat(t.price) || 0;
      if (action === 'DEPOSIT') {
        runningCashCents += Math.round(price * 100);
      } else if (action === 'WITHDRAWAL') {
        runningCashCents -= Math.round(price * 100);
      }
    });

    // Process trades.ndjson
    trades.forEach(t => {
      if (!t) return;
      const isCash = t.ticker === 'CASH' || (t.assetType && t.assetType.toLowerCase() === 'cash');
      const action = t.action ? t.action.toUpperCase() : '';
      const price = parseFloat(t.price) || 0;
      const shares = parseFloat(t.shares) || 0;

      if (isCash) {
        if (action === 'DEPOSIT') {
          runningCashCents += Math.round(price * 100);
        } else if (action === 'WITHDRAWAL') {
          runningCashCents -= Math.round(price * 100);
        }
      } else {
        // Normal trade: check if Option (multiplier 100) or Stock (multiplier 1)
        const isOption = t.assetType === 'options' || (/\$\d/.test(t.ticker) && /\b(call|put)\b/i.test(t.ticker));
        const multiplier = isOption ? 100 : 1;
        const costCents = Math.round(shares * price * multiplier * 100);
        if (action === 'BUY') {
          runningCashCents -= costCents;
        } else if (action === 'SELL') {
          runningCashCents += costCents;
        }
      }
    });


    // 2. Asset Value Aggregation (Holdings)
    const openPositions = {};
    trades.forEach(t => {
      if (!t || !t.ticker) return;
      const isCash = t.ticker === 'CASH' || (t.assetType && t.assetType.toLowerCase() === 'cash');
      if (isCash) return;

      const ticker = t.ticker.toUpperCase();
      const action = t.action ? t.action.toUpperCase() : '';
      const shares = parseFloat(t.shares) || 0;
      const price = parseFloat(t.price) || 0;

      if (!openPositions[ticker]) {
        openPositions[ticker] = {
          shares: 0,
          assetType: t.assetType ? t.assetType.toLowerCase() : 'stocks',
          avgCostCents: 0
        };
      }

      if (action === 'BUY') {
        const newShares = openPositions[ticker].shares + shares;
        if (newShares > 0) {
          openPositions[ticker].avgCostCents = Math.round(
            (openPositions[ticker].shares * openPositions[ticker].avgCostCents + shares * price * 100) / newShares
          );
        }
        openPositions[ticker].shares = newShares;
      } else if (action === 'SELL') {
        openPositions[ticker].shares = Math.max(0, openPositions[ticker].shares - shares);
        if (openPositions[ticker].shares === 0) {
          openPositions[ticker].avgCostCents = 0;
        }
      }
    });

    let buyingPowerOverrideVal = null;
    let startingCashVal = null;
    let valOverride = null;
    try {
      const overridesPath = getDatabasePath(req, 'overrides.json');
      if (fs.existsSync(overridesPath)) {
        const overridesContent = fs.readFileSync(overridesPath, 'utf8');
        const overrides = JSON.parse(overridesContent || '{}');
        if (overrides.buyingPowerOverride !== undefined && overrides.buyingPowerOverride !== null) {
          buyingPowerOverrideVal = parseFloat(overrides.buyingPowerOverride);
          if (isNaN(buyingPowerOverrideVal)) {
            buyingPowerOverrideVal = null;
          }
        } else if (overrides.buyingPowerAdjust !== undefined && overrides.buyingPowerAdjust !== null) {
          // old fallback if it exists
          buyingPowerOverrideVal = parseFloat(overrides.buyingPowerAdjust);
          if (isNaN(buyingPowerOverrideVal)) {
            buyingPowerOverrideVal = null;
          }
        }
        if (overrides.startingCash !== undefined && overrides.startingCash !== null) {
          startingCashVal = parseFloat(overrides.startingCash);
          if (isNaN(startingCashVal)) {
            startingCashVal = null;
          }
        }
        if (overrides.portfolioValueOverride) {
          valOverride = overrides.portfolioValueOverride;
        }
      }
    } catch (e) {
      console.error('Failed to load overrides in portfolio-summary:', e);
    }

    let totalAssetValueCents = 0;
    for (const ticker in openPositions) {
      const pos = openPositions[ticker];
      if (pos.shares <= 0) continue;

      // Determine current live price
      let livePrice = 0;
      if (prices[ticker] !== undefined) {
        livePrice = prices[ticker];
      } else if (DEFAULT_PRICES[ticker] !== undefined) {
        livePrice = DEFAULT_PRICES[ticker];
      } else {
        // Fallback to average cost basis
        const avgCost = pos.avgCostCents / 100;
        livePrice = avgCost;
      }

      // Check if Option: standard leverage multiplier is 100
      const isOption = pos.assetType === 'options' || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
      const multiplier = isOption ? 100 : 1;

      totalAssetValueCents += Math.round(pos.shares * livePrice * multiplier * 100);
    }

    const totalAssetValue = totalAssetValueCents / 100;
    let buyingPower = (runningCashCents / 100);
    if (buyingPowerOverrideVal !== null) {
      if (startingCashVal !== null) {
        buyingPower = startingCashVal + (runningCashCents / 100);
      } else {
        buyingPower = buyingPowerOverrideVal;
      }
    }

    let totalAccountValue = buyingPower + totalAssetValue;

    if (valOverride && valOverride.trim() !== '') {
      res.status(200).json({
        buyingPower: parseFloat(buyingPower.toFixed(2)),
        totalAssetValue: parseFloat(totalAssetValue.toFixed(2)),
        totalAccountValue: parseFloat(valOverride.trim()),
        activePositionsCount: Object.keys(openPositions).filter(t => openPositions[t].shares > 0).length
      });
    } else {
      res.status(200).json({
        buyingPower: parseFloat(buyingPower.toFixed(2)),
        totalAssetValue: parseFloat(totalAssetValue.toFixed(2)),
        totalAccountValue: parseFloat(totalAccountValue.toFixed(2)),
        activePositionsCount: Object.keys(openPositions).filter(t => openPositions[t].shares > 0).length
      });
    }
  } catch (error) {
    console.error('Error calculating portfolio summary:', error);
    res.status(500).json({ error: 'Internal Server Error while calculating portfolio summary.' });
  }
});

// GET /api/overrides - Read portfolio overrides config
app.get('/api/overrides', (req, res) => {
  try {
    ensureDbExists(req);
    const overridesPath = getDatabasePath(req, 'overrides.json');
    const data = fs.readFileSync(overridesPath, 'utf8');
    res.status(200).json(JSON.parse(data || '{}'));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read overrides.' });
  }
});

// POST /api/overrides - Save portfolio overrides config
app.post('/api/overrides', (req, res) => {
  try {
    ensureDbExists(req);
    const { buyingPowerOverride, buyingPowerAdjust, portfolioValueOverride } = req.body;

    let bpVal = null;
    if (buyingPowerOverride !== undefined) {
      bpVal = (buyingPowerOverride === null || buyingPowerOverride === '') ? null : parseFloat(buyingPowerOverride);
    } else if (buyingPowerAdjust !== undefined) {
      bpVal = (buyingPowerAdjust === null || buyingPowerAdjust === '') ? null : parseFloat(buyingPowerAdjust);
    }

    const finalBuyingPowerOverride = (bpVal !== null && !isNaN(bpVal) && bpVal >= 0) ? bpVal : null;
    const finalPortfolioValueOverride = portfolioValueOverride !== undefined ? String(portfolioValueOverride).trim() : '';

    const overrides = {
      buyingPowerOverride: finalBuyingPowerOverride,
      portfolioValueOverride: finalPortfolioValueOverride
    };
    const overridesPath = getDatabasePath(req, 'overrides.json');
    fs.writeFileSync(overridesPath, JSON.stringify(overrides, null, 2), 'utf8');
    console.log(`[Overrides] Saved overrides: buyingPowerOverride=${overrides.buyingPowerOverride}, portfolioValueOverride=${overrides.portfolioValueOverride}`);
    res.status(200).json(overrides);
  } catch (error) {
    console.error('Failed to save overrides:', error);
    res.status(500).json({ error: 'Failed to save overrides.' });
  }
});

// POST /api/users - Register new user
app.post('/api/users', (req, res) => {
  try {
    ensureDbExists();
    const { username, role, email, phoneNumber, password } = req.body;
    if (!username || typeof username !== 'string' || username.trim() === '' ||
      !role || !['admin', 'member'].includes(role.toLowerCase()) ||
      !email || typeof email !== 'string' || email.trim() === '' ||
      !phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '' ||
      !password || typeof password !== 'string') {
      return res.status(400).json({ error: "All fields are mandatory." });
    }
    if (password.length <= 8) {
      return res.status(400).json({ error: "Password must contain more than 8 characters." });
    }
    const hasAlphabet = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    if (!hasAlphabet || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: "Password must include alphabets, numbers, and special characters." });
    }

    const fileContent = fs.readFileSync(USERS_DB_PATH, 'utf8');
    const users = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));

    const usernameExists = users.some(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (usernameExists) {
      return res.status(400).json({ error: "User name already exist." });
    }

    const userRecord = {
      username: username.trim(),
      role: role.trim().toLowerCase(),
      email: email.trim(),
      phoneNumber: phoneNumber.trim(),
      password: password,
      createdAt: new Date().toISOString()
    };
    fs.appendFileSync(USERS_DB_PATH, JSON.stringify(userRecord) + '\n', 'utf8');
    console.log(`[User Management] Added new user: ${userRecord.username} (${userRecord.role})`);
    res.status(201).json(userRecord);
  } catch (error) {
    console.error('Error saving user:', error);
    res.status(500).json({ error: 'Internal Server Error while saving user.' });
  }
});

// GET /api/users - Retrieve registered users list
app.get('/api/users', (req, res) => {
  try {
    ensureDbExists();
    const fileContent = fs.readFileSync(USERS_DB_PATH, 'utf8');
    const users = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));
    res.status(200).json(users);
  } catch (e) {
    res.status(200).json([]);
  }
});

// POST /api/login - Authenticate user credentials against users.ndjson
app.post('/api/login', (req, res) => {
  try {
    ensureDbExists();
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const fileContent = fs.readFileSync(USERS_DB_PATH, 'utf8');
    const users = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));

    const matchedUser = users.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase()
        && u.password === password
    );

    if (!matchedUser) {
      console.warn(`[Auth] Failed login attempt for username: "${username}"`);
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    console.log(`[Auth] Successful login: ${matchedUser.username} (${matchedUser.role})`);
    // Return profile without password
    res.status(200).json({
      success: true,
      username: matchedUser.username,
      role: matchedUser.role
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Internal server error during authentication.' });
  }
});

const activeOtps = {};

// POST /api/forgot-password/otp - Generate and send OTP
app.post('/api/forgot-password/otp', (req, res) => {
  try {
    ensureDbExists();
    const { emailOrPhone } = req.body;
    if (!emailOrPhone || typeof emailOrPhone !== 'string' || emailOrPhone.trim() === '') {
      return res.status(400).json({ error: "Email or Phone Number is required." });
    }

    const fileContent = fs.readFileSync(USERS_DB_PATH, 'utf8');
    const users = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));

    const queryVal = emailOrPhone.trim().toLowerCase();
    const matchedUser = users.find(u =>
      (u.email && u.email.trim().toLowerCase() === queryVal) ||
      (u.phoneNumber && u.phoneNumber.trim().toLowerCase() === queryVal)
    );

    if (!matchedUser) {
      return res.status(404).json({ error: "Not Registered" });
    }

    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 5 * 60 * 1000; // 5 mins expiry
    activeOtps[queryVal] = {
      username: matchedUser.username,
      role: matchedUser.role,
      otp: generatedOtp,
      expires: expires
    };

    // Write OTP to a file in the workspace
    const otpFilePath = path.join(__dirname, 'data', 'sent_otps.txt');
    fs.writeFileSync(otpFilePath, generatedOtp, 'utf8');

    console.log(`[OTP] Generated OTP ${generatedOtp} for ${matchedUser.username} (${emailOrPhone})`);

    res.status(200).json({ success: true, message: "OTP sent successfully." });
  } catch (error) {
    console.error('Error generating OTP:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/forgot-password/login - Verify OTP and login
app.post('/api/forgot-password/login', (req, res) => {
  try {
    const { emailOrPhone, otp } = req.body;
    if (!emailOrPhone || !otp) {
      return res.status(400).json({ error: "Email or Phone and OTP are required." });
    }

    const queryVal = emailOrPhone.trim().toLowerCase();
    const otpRecord = activeOtps[queryVal];

    if (!otpRecord || otpRecord.otp !== otp.trim() || Date.now() > otpRecord.expires) {
      return res.status(400).json({ error: "Invalid or expired OTP." });
    }

    delete activeOtps[queryVal];

    console.log(`[Auth] Successful OTP login: ${otpRecord.username} (${otpRecord.role})`);
    res.status(200).json({
      success: true,
      username: otpRecord.username,
      role: otpRecord.role
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/profile - Retrieve user profile details from backend
app.get('/api/profile', (req, res) => {
  try {
    ensureDbExists();
    const { username } = req.query;
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({ error: "Username is required." });
    }

    const fileContent = fs.readFileSync(USERS_DB_PATH, 'utf8');
    const users = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));

    const matchedUser = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!matchedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json({
      username: matchedUser.username,
      displayName: matchedUser.displayName || '',
      email: matchedUser.email || '',
      phoneNumber: matchedUser.phoneNumber || ''
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal Server Error while retrieving profile.' });
  }
});

// POST /api/profile/update - Update profile info & password on backend
app.post('/api/profile/update', (req, res) => {
  try {
    ensureDbExists();
    const { username, displayName, email, phoneNumber, currentPassword, newPassword } = req.body;

    if (!username || typeof username !== 'string' || username.trim() === '' ||
      !displayName || typeof displayName !== 'string' || displayName.trim() === '' ||
      !email || typeof email !== 'string' || email.trim() === '' ||
      !phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
      return res.status(400).json({ error: "All fields are mandatory." });
    }

    const fileContent = fs.readFileSync(USERS_DB_PATH, 'utf8');
    const users = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => JSON.parse(line));

    const matchedUser = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!matchedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    // If password update is requested, check verification
    if (newPassword && newPassword.trim() !== '') {
      if (!currentPassword || currentPassword !== matchedUser.password) {
        return res.status(400).json({ error: "Current Password is incorrect." });
      }

      // Password strength check
      if (newPassword.length <= 8) {
        return res.status(400).json({ error: "Password must contain more than 8 characters." });
      }
      const hasAlphabet = /[a-zA-Z]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
      if (!hasAlphabet || !hasNumber || !hasSpecial) {
        return res.status(400).json({ error: "Password must include alphabets, numbers, and special characters." });
      }
    }

    const updatedLines = users.map(u => {
      if (u.username.toLowerCase() === username.trim().toLowerCase()) {
        u.displayName = displayName.trim();
        u.email = email.trim();
        u.phoneNumber = phoneNumber.trim();
        if (newPassword && newPassword.trim() !== '') {
          u.password = newPassword;
        }
      }
      return JSON.stringify(u);
    });

    fs.writeFileSync(USERS_DB_PATH, updatedLines.join('\n') + '\n', 'utf8');
    console.log(`[User Profile] Updated profile details for user: ${username}`);
    res.status(200).json({ success: true, username: username.trim() });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal Server Error while updating profile.' });
  }
});

// POST /api/password - Update password handler
app.post('/api/password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Missing password parameters." });
    }
    if (newPassword.length <= 8) {
      return res.status(400).json({ error: "Password must contain more than 8 characters." });
    }
    const hasAlphabet = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
    if (!hasAlphabet || !hasNumber || !hasSpecial) {
      return res.status(400).json({ error: "Password must include alphabets, numbers, and special characters." });
    }

    console.log(`[Security] Password update requested.`);
    res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error('Error handling password update:', error);
    res.status(500).json({ error: 'Internal Server Error during password update.' });
  }
});

// Helper to read NDJSON asynchronously via standard fs streams
function readNdjsonStream(filePath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve([]);
    }
    const results = [];
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    let leftover = '';

    stream.on('data', chunk => {
      const lines = (leftover + chunk).split('\n');
      leftover = lines.pop();
      for (const line of lines) {
        if (line.trim()) {
          try {
            results.push(JSON.parse(line));
          } catch (e) {
            // ignore parse error
          }
        }
      }
    });

    stream.on('end', () => {
      if (leftover.trim()) {
        try {
          results.push(JSON.parse(leftover));
        } catch (e) {
          // ignore parse error
        }
      }
      resolve(results);
    });

    stream.on('error', () => {
      resolve([]);
    });
  });
}

// GET /api/reports - Fetch time-filtered ledger data packets
app.get('/api/reports', async (req, res) => {
  try {
    ensureDbExists();
    const filter = req.query.filter ? String(req.query.filter).toLowerCase() : 'all';

    // Ingest data files using standard filesystem streams
    const trades = await readNdjsonStream(DB_PATH);
    const cash = await readNdjsonStream(CASH_LEDGER_PATH);

    let tradesResult = [];
    let cashResult = [];
    let realizedVal = 0.00;
    let unrealizedVal = 0.00;
    let totalVal = 0.00;

    switch (filter) {
      case 'daily':
        // Placeholder handling for daily filter
        tradesResult = trades;
        cashResult = cash;
        break;
      case 'weekly':
        // Placeholder handling for weekly filter
        tradesResult = trades;
        cashResult = cash;
        break;
      case 'monthly':
        // Placeholder handling for monthly filter
        tradesResult = trades;
        cashResult = cash;
        break;
      case 'quarterly':
        // Placeholder handling for quarterly filter
        tradesResult = trades;
        cashResult = cash;
        break;
      case 'yearly':
        // Placeholder handling for yearly filter
        tradesResult = trades;
        cashResult = cash;
        break;
      default:
        // Placeholder handling for all other filters
        tradesResult = trades;
        cashResult = cash;
        break;
    }

    res.status(200).json({
      trades: tradesResult,
      cash: cashResult,
      summary: {
        realized: realizedVal,
        unrealized: unrealizedVal,
        total: totalVal
      }
    });
  } catch (error) {
    console.error('Error in /api/reports endpoint:', error);
    res.status(500).json({ error: 'Failed to process reports data.' });
  }
});
function calculateTotalRealizedPnL(trades) {
  const sortedTrades = [...trades]
    .filter(t => t.ticker && t.ticker !== 'CASH' && (!t.assetType || t.assetType.toLowerCase() !== 'cash'))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const buyQueues = {};
  let totalRealizedPnL = 0;

  sortedTrades.forEach(tx => {
    const ticker = tx.ticker.toUpperCase();
    const action = tx.action ? tx.action.toUpperCase() : 'BUY';
    const shares = parseFloat(tx.shares) || 0;
    const price = parseFloat(tx.price) || 0;
    const isOption = tx.assetType === 'options' || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
    const multiplier = isOption ? 100 : 1;

    if (action === 'BUY') {
      if (!buyQueues[ticker]) {
        buyQueues[ticker] = [];
      }
      buyQueues[ticker].push({ shares, price });
    } else if (action === 'SELL') {
      let remainingToSell = shares;
      let sellPnL = 0;
      const queue = buyQueues[ticker] || [];

      while (remainingToSell > 0 && queue.length > 0) {
        const oldestLayer = queue[0];
        if (oldestLayer.shares <= remainingToSell) {
          sellPnL += oldestLayer.shares * (price - oldestLayer.price) * multiplier;
          remainingToSell -= oldestLayer.shares;
          queue.shift();
        } else {
          sellPnL += remainingToSell * (price - oldestLayer.price) * multiplier;
          oldestLayer.shares -= remainingToSell;
          remainingToSell = 0;
        }
      }
      totalRealizedPnL += sellPnL;
    }
  });

  return totalRealizedPnL;
}

function getActivePositions(trades) {
  const sortedTrades = [...trades]
    .filter(t => t.ticker && t.ticker !== 'CASH' && (!t.assetType || t.assetType.toLowerCase() !== 'cash'))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const buyQueues = {};
  const assetTypes = {};

  sortedTrades.forEach(tx => {
    const ticker = tx.ticker.toUpperCase();
    const action = tx.action ? tx.action.toUpperCase() : 'BUY';
    const shares = parseFloat(tx.shares) || 0;
    const price = parseFloat(tx.price) || 0;
    if (tx.assetType) {
      assetTypes[ticker] = tx.assetType.toLowerCase();
    } else if (!assetTypes[ticker]) {
      assetTypes[ticker] = 'stocks';
    }

    if (action === 'BUY') {
      if (!buyQueues[ticker]) {
        buyQueues[ticker] = [];
      }
      buyQueues[ticker].push({ shares, price });
    } else if (action === 'SELL') {
      let remainingToSell = shares;
      const queue = buyQueues[ticker] || [];
      while (remainingToSell > 0 && queue.length > 0) {
        const oldestLayer = queue[0];
        if (oldestLayer.shares <= remainingToSell) {
          remainingToSell -= oldestLayer.shares;
          queue.shift();
        } else {
          oldestLayer.shares -= remainingToSell;
          remainingToSell = 0;
        }
      }
    }
  });

  const activePositions = [];
  for (const ticker in buyQueues) {
    const queue = buyQueues[ticker];
    let totalShares = 0;
    let totalCost = 0;
    queue.forEach(layer => {
      totalShares += layer.shares;
      totalCost += layer.shares * layer.price;
    });

    if (totalShares > 0) {
      const avgCost = totalCost / totalShares;
      activePositions.push({
        ticker,
        shares: totalShares,
        avgCost: parseFloat(avgCost.toFixed(2)),
        assetType: assetTypes[ticker] || 'stocks'
      });
    }
  }

  return activePositions;
}

// GET /api/ai-prompt-builder - Specialized context aggregation
app.get('/api/ai-prompt-builder', async (req, res) => {
  try {
    ensureDbExists(req);

    const trades = await readNdjsonStream(getDatabasePath(req, 'trades.ndjson'));
    const notes = await readNdjsonStream(getDatabasePath(req, 'journal_notes.ndjson'));

    const activePositions = getActivePositions(trades);
    const totalRealizedPnL = calculateTotalRealizedPnL(trades);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentNotes = notes.filter(note => {
      if (!note || !note.date) return false;
      const noteDate = new Date(`${note.date}T${note.time || '00:00:00'}`);
      return !isNaN(noteDate.getTime()) && noteDate >= sevenDaysAgo;
    });

    let activePositionsStr = 'None';
    if (activePositions.length > 0) {
      activePositionsStr = activePositions
        .map(p => `${p.ticker} (${p.shares} shares at $${p.avgCost.toFixed(2)})`)
        .join(', ');
    }

    const realizedPnLStr = `$${totalRealizedPnL.toFixed(2)}`;

    let recentNotesStr = 'None';
    if (recentNotes.length > 0) {
      recentNotesStr = recentNotes
        .map(n => `${n.ticker} - ${n.author} (${n.date}): ${n.text}`)
        .join('; ');
    }

    const promptContext = `SYSTEM CONTEXT: Portfolio Summary. Active Positions: ${activePositionsStr}. Realized P&L: ${realizedPnLStr}. Recent Journal Notes: ${recentNotesStr}.`;

    res.status(200).json({ promptContext });
  } catch (error) {
    console.error('Error building AI prompt context:', error);
    res.status(500).json({ error: 'Failed to build AI prompt context.' });
  }
});
// Start the server
app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});

