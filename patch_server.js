const fs = require('fs');

let serverJs = fs.readFileSync('server.js', 'utf8');

const newEndpoints = `
// DELETE /api/trades/single - Delete a specific trade by ticker and date
app.delete('/api/trades/single', (req, res) => {
  try {
    ensureDbExists(req);
    const { ticker, date } = req.query;
    if (!ticker || !date) return res.status(400).json({ error: "Ticker and date are required" });

    const tradesPath = getDatabasePath(req, 'trades.ndjson');
    const fileContent = fs.readFileSync(tradesPath, 'utf8');
    const lines = fileContent.split('\\n');
    const remainingLines = [];
    let deleted = false;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const trade = JSON.parse(line);
        if (!deleted && trade.ticker === ticker && trade.date === date) {
          deleted = true;
        } else {
          remainingLines.push(line);
        }
      } catch (err) {
        remainingLines.push(line);
      }
    }

    fs.writeFileSync(tradesPath, remainingLines.join('\\n') + (remainingLines.length ? '\\n' : ''), 'utf8');
    res.status(200).json({ success: true, deleted });
  } catch (error) {
    console.error('Error deleting single trade:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/trades/single - Update a specific trade by ticker and date
app.put('/api/trades/single', (req, res) => {
  try {
    ensureDbExists(req);
    const { ticker, date } = req.query;
    if (!ticker || !date) return res.status(400).json({ error: "Ticker and date are required" });

    const { shares, price, action, comment, stopLoss, 'Expiry Date': expiryDate } = req.body;

    const tradesPath = getDatabasePath(req, 'trades.ndjson');
    const fileContent = fs.readFileSync(tradesPath, 'utf8');
    const lines = fileContent.split('\\n');
    const updatedLines = [];
    let updated = false;
    let updatedTrade = null;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const trade = JSON.parse(line);
        if (!updated && trade.ticker === ticker && trade.date === date) {
          trade.shares = shares !== undefined ? parseFloat(shares) : trade.shares;
          trade.price = price !== undefined ? parseFloat(price) : trade.price;
          trade.action = action || trade.action;
          trade.comment = comment !== undefined ? comment : trade.comment;
          if (stopLoss !== undefined) trade.stopLoss = parseFloat(stopLoss);
          if (expiryDate !== undefined) trade['Expiry Date'] = expiryDate;
          updatedLines.push(JSON.stringify(trade));
          updatedTrade = trade;
          updated = true;
        } else {
          updatedLines.push(line);
        }
      } catch (err) {
        updatedLines.push(line);
      }
    }

    fs.writeFileSync(tradesPath, updatedLines.join('\\n') + (updatedLines.length ? '\\n' : ''), 'utf8');
    res.status(200).json({ success: true, trade: updatedTrade });
  } catch (error) {
    console.error('Error updating single trade:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
`;

if (!serverJs.includes('/api/trades/single')) {
  serverJs = serverJs.replace('// GET /api/notes', newEndpoints + '\\n// GET /api/notes');
  fs.writeFileSync('server.js', serverJs);
  console.log('Endpoints added to server.js');
} else {
  console.log('Endpoints already exist');
}
