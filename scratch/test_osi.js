function getOSIOptionSymbol(ticker, expiryStr, comment, type) {
  const rootMatch = ticker.match(/^([A-Za-z]+)/);
  if (!rootMatch) return null;
  const root = rootMatch[1].toUpperCase().padEnd(6, ' ');

  let yy, mm, dd;
  let mMatch = expiryStr.match(/Exp (\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i);
  if (mMatch) {
    mm = mMatch[1].padStart(2, '0');
    dd = mMatch[2].padStart(2, '0');
    let yStr = mMatch[3] || String(new Date().getFullYear());
    if (yStr.length === 4) yStr = yStr.slice(2);
    yy = yStr.padStart(2, '0');
  } else {
    return null;
  }

  const isPut = type === 'options_put' || /put/i.test(ticker) || /put/i.test(comment);
  const cp = isPut ? 'P' : 'C';

  const strikeMatch = ticker.match(/(?:[\$@])?(\d+(?:\.\d+)?)/);
  if (!strikeMatch) return null;
  const strikeVal = parseFloat(strikeMatch[1]);
  const strikeFormatted = String(Math.round(strikeVal * 1000)).padStart(8, '0');

  return `${root.trim()}${yy}${mm}${dd}${cp}${strikeFormatted}`;
}

function getOptionExpiry(ticker) {
  const tickerDateMatch = ticker.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  if (tickerDateMatch) return `Exp ${tickerDateMatch[1]}`;
  return 'Exp 08/31/26'; 
}

console.log(getOSIOptionSymbol("SPY $500 CALL 8/31/26", getOptionExpiry("SPY $500 CALL 8/31/26"), "", "options"));
console.log(getOSIOptionSymbol("QQQ $670 PUT", getOptionExpiry("QQQ $670 PUT"), "", "options"));

