const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5001;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'data', 'trades.ndjson');
const NOTES_DB_PATH = path.join(__dirname, 'data', 'journal_notes.ndjson');
const PRICES_PATH = path.join(__dirname, 'data', 'prices.json');

const DEFAULT_PRICES = {
  'NVDA': 485.00,
  'AAPL': 175.50,
  'TSLA': 198.20,
  'SPY': 512.42,
  'SPX': 5120.30,
  'NVDA $490 CALL': 18.50,
  'AAPL $180 CALL': 4.80
};

// Helper to ensure database directory exists
function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, '', 'utf8');
  }
  if (!fs.existsSync(NOTES_DB_PATH)) {
    fs.writeFileSync(NOTES_DB_PATH, '', 'utf8');
  }
  if (!fs.existsSync(PRICES_PATH)) {
    fs.writeFileSync(PRICES_PATH, '{}', 'utf8');
  }
}

function loadPrices() {
  ensureDbExists();
  try {
    const data = fs.readFileSync(PRICES_PATH, 'utf8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('Failed to read or parse prices.json:', err);
    return {};
  }
}

function savePrices(prices) {
  ensureDbExists();
  try {
    fs.writeFileSync(PRICES_PATH, JSON.stringify(prices, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write prices.json:', err);
  }
}

// GET /api/trades - Read and parse all trades
app.get('/api/trades', (req, res) => {
  try {
    ensureDbExists();
    const fileContent = fs.readFileSync(DB_PATH, 'utf8');
    
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

// POST /api/trades - Add a new trade with validation
app.post('/api/trades', (req, res) => {
  try {
    ensureDbExists();

    // Check if this is a price sync request
    if (req.body.action && req.body.action.trim().toUpperCase() === 'UPDATEPRICE') {
      const symbol = (req.body.Symbol || req.body.ticker || '').trim().toUpperCase();
      const currentPrice = parseFloat(req.body.CurrentPrice !== undefined ? req.body.CurrentPrice : req.body.price);
      if (!symbol || isNaN(currentPrice)) {
        return res.status(400).json({ error: "Invalid parameters for updatePrice action" });
      }
      const prices = loadPrices();
      prices[symbol] = currentPrice;
      savePrices(prices);
      return res.status(200).json({ success: true, ticker: symbol, price: currentPrice });
    }

    const { ticker, price, quantity, shares } = req.body;
    
    // Support either 'quantity' or 'shares' (UI matching property name)
    const targetQuantity = quantity !== undefined ? quantity : shares;

    // Explicit Data Validation
    if (!ticker || typeof ticker !== 'string' || ticker.trim() === '') {
      return res.status(400).json({ error: "Invalid or missing parameter: 'ticker' is required and must be a non-empty string." });
    }

    const parsedPrice = parseFloat(price);
    if (price === undefined || isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: "Invalid or missing parameter: 'price' is required and must be a positive number." });
    }

    const parsedQuantity = parseFloat(targetQuantity);
    if (targetQuantity === undefined || isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ error: "Invalid or missing parameter: 'quantity' (or 'shares') is required and must be a positive number." });
    }

    // Construct standardized trade record matching front-end schema
    const tradeRecord = {
      ticker: ticker.trim().toUpperCase(),
      shares: parsedQuantity,
      price: parsedPrice,
      action: req.body.action ? req.body.action.trim().toUpperCase() : 'BUY',
      assetType: req.body.assetType ? req.body.assetType.trim().toLowerCase() : 'stocks',
      date: req.body.date || new Date().toISOString(),
      comment: req.body.comment !== undefined ? String(req.body.comment).trim() : (req.body.note !== undefined ? String(req.body.note).trim() : ''),
      stopLoss: req.body.stopLoss !== undefined ? parseFloat(req.body.stopLoss) : (req.body.stopLimit !== undefined ? parseFloat(req.body.stopLimit) : 0)
    };

    // Append to file in NDJSON format
    fs.appendFileSync(DB_PATH, JSON.stringify(tradeRecord) + '\n', 'utf8');

    res.status(201).json(tradeRecord);
  } catch (error) {
    console.error('Error saving trade:', error);
    res.status(500).json({ error: 'Internal Server Error while saving trade.' });
  }
});

// GET /api/notes - Read and parse all journal notes
app.get('/api/notes', (req, res) => {
  try {
    ensureDbExists();
    const fileContent = fs.readFileSync(NOTES_DB_PATH, 'utf8');
    
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
    ensureDbExists();

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
    fs.appendFileSync(NOTES_DB_PATH, JSON.stringify(noteRecord) + '\n', 'utf8');

    res.status(201).json(noteRecord);
  } catch (error) {
    console.error('Error saving note:', error);
    res.status(500).json({ error: 'Internal Server Error while saving note.' });
  }
});

// Helper to read all trades
function loadTrades() {
  ensureDbExists();
  try {
    const fileContent = fs.readFileSync(DB_PATH, 'utf8');
    return fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (err) {
          return null;
        }
      })
      .filter(trade => trade !== null);
  } catch (error) {
    console.error('Error loading trades:', error);
    return [];
  }
}

// GET /api/portfolio-summary - Calculate account values
app.get('/api/portfolio-summary', (req, res) => {
  try {
    const trades = loadTrades();
    const prices = loadPrices();

    // 1. Calculate Running Cash (Buying Power)
    // Starting at $0, adding deposits, subtracting withdrawals, subtracting buy cost, adding sell proceeds.
    let runningCashCents = 0;

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
        // Normal trade: cost = shares * price
        const costCents = Math.round(shares * price * 100);
        if (action === 'BUY') {
          runningCashCents -= costCents;
        } else if (action === 'SELL') {
          runningCashCents += costCents;
        }
      }
    });

    const buyingPower = runningCashCents / 100;

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
          totalCostCents: 0
        };
      }

      if (action === 'BUY') {
        openPositions[ticker].shares += shares;
        openPositions[ticker].totalCostCents += Math.round(shares * price * 100);
      } else if (action === 'SELL') {
        openPositions[ticker].shares = Math.max(0, openPositions[ticker].shares - shares);
      }
    });

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
        const avgCost = (pos.shares > 0) ? (pos.totalCostCents / pos.shares / 100) : 0;
        livePrice = avgCost;
      }

      // Check if Option: standard leverage multiplier is 100
      const isOption = pos.assetType === 'options' || (/\$\d/.test(ticker) && /\b(call|put)\b/i.test(ticker));
      const multiplier = isOption ? 100 : 1;

      totalAssetValueCents += Math.round(pos.shares * livePrice * multiplier * 100);
    }

    const totalAssetValue = totalAssetValueCents / 100;
    const totalAccountValue = (runningCashCents + totalAssetValueCents) / 100;

    res.status(200).json({
      buyingPower: parseFloat(buyingPower.toFixed(2)),
      totalAssetValue: parseFloat(totalAssetValue.toFixed(2)),
      totalAccountValue: parseFloat(totalAccountValue.toFixed(2))
    });
  } catch (error) {
    console.error('Error calculating portfolio summary:', error);
    res.status(500).json({ error: 'Internal Server Error while calculating portfolio summary.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});
