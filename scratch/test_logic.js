const fs = require('fs');
const tickers = JSON.parse(fs.readFileSync('tickers.json', 'utf8'));
const defaultAssets = {
  'SPY': { name: 'SPDR S&P 500 ETF', currentPrice: 753.00, icon: 'SP' },
  'QQQ': { name: 'Invesco QQQ Trust', currentPrice: 180.80, icon: 'QQ' }, // just a guess
  'AAPL': { name: 'Apple Inc.', currentPrice: 180.80, icon: 'AA' }
};

console.log("AAPL in tickers?", tickers["AAPL"]);
console.log("QQQ in tickers?", tickers["QQQ"]);
