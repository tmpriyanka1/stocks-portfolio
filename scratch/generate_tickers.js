const fs = require('fs');
const path = require('path');

function toTitleCase(str) {
  return str.toLowerCase().split(/\s+/).map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function cleanName(rawName) {
  let name = rawName;
  // Strip standard corporate suffixes and clean up
  name = name.replace(/\b(Corporation|Corp|Inc|Incorporated|LLC|Ltd|Co|Class\s+[A-Z]|Common\s+Stock|Ordinary\s+Shares|PLC)\b\.?/gi, '').trim();
  // Remove trailing commas, dots, dashes
  name = name.replace(/[,.\-\s]+$/, '').trim();
  return toTitleCase(name);
}

// Built-in fallback list of top popular tickers in case SEC endpoint fails
const fallbackTickers = {
  'AAPL': 'Apple',
  'MSFT': 'Microsoft',
  'NVDA': 'NVIDIA',
  'TSLA': 'Tesla',
  'AMZN': 'Amazon',
  'META': 'Meta Platforms',
  'GOOGL': 'Alphabet',
  'GOOG': 'Alphabet',
  'NFLX': 'Netflix',
  'ORCL': 'Oracle',
  'AMD': 'AMD',
  'INTC': 'Intel',
  'QCOM': 'Qualcomm',
  'COIN': 'Coinbase',
  'PLTR': 'Palantir Technologies',
  'SPY': 'SPDR S&P 500 ETF Trust',
  'QQQ': 'Invesco QQQ Trust'
};

async function generate() {
  const outputPath = path.join(__dirname, '..', 'tickers.json');
  let tickersMap = { ...fallbackTickers };

  console.log('Fetching SEC tickers database...');
  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`Fetched ${Object.keys(data).length} raw tickers from SEC.`);
      for (const key in data) {
        const item = data[key];
        if (item && item.ticker && item.title) {
          const ticker = item.ticker.trim().toUpperCase();
          const name = cleanName(item.title);
          if (ticker && name) {
            tickersMap[ticker] = name;
          }
        }
      }
    } else {
      console.warn(`SEC fetch failed with status ${res.status}. Using popular fallbacks.`);
    }
  } catch (err) {
    console.error('SEC fetch failed with error:', err.message, '. Using popular fallbacks.');
  }

  // Ensure ORCL is resolved to Oracle
  if (tickersMap['ORCL']) {
    tickersMap['ORCL'] = 'Oracle';
  }

  // Ensure defaultAssetData names are preserved/overlaid
  tickersMap['AAPL'] = 'Apple';
  tickersMap['NVDA'] = 'NVIDIA';
  tickersMap['TSLA'] = 'Tesla';

  fs.writeFileSync(outputPath, JSON.stringify(tickersMap, null, 2), 'utf8');
  console.log(`Successfully generated ${Object.keys(tickersMap).length} tickers in ${outputPath}`);
}

generate();
