const marketPrices = {
  "QQQ": { currentPrice: 720.90 },
  "QQQ $670 PUT": { currentPrice: 3.35 }
};
const underlyingTicker = "QQQ";
const underlyingEntry = marketPrices[underlyingTicker] || {};
const underlyingPrice = parseFloat(underlyingEntry.currentPrice) || parseFloat(underlyingEntry.price) || (underlyingTicker === 'SPX' ? 5120.30 : (underlyingTicker === 'SPY' ? 753.00 : 100.00));

const html = `${underlyingTicker}: $${underlyingPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
console.log(html);
