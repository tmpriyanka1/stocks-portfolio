const { chromium } = require('playwright');

async function check() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  
  console.log('Navigating to settings to reset...');
  await page.goto('http://localhost:8080/settings.html');
  await page.waitForTimeout(1000);
  
  // Click reset button
  await page.evaluate(() => {
    localStorage.clear();
    console.log('Cleared localStorage in check script');
  });
  
  console.log('Navigating to portfolio...');
  await page.goto('http://localhost:8080/portfolio.html');
  await page.waitForTimeout(5000); // Wait 5 seconds for cloud pull and render
  
  const localStorageData = await page.evaluate(() => {
    return {
      buying_power: localStorage.getItem('portfolio_buying_power'),
      buying_power_user_set: localStorage.getItem('portfolio_buying_power_user_set'),
      transactions: localStorage.getItem('portfolio_transactions') ? JSON.parse(localStorage.getItem('portfolio_transactions')).length : null,
      market_prices: localStorage.getItem('portfolio_market_prices') ? Object.keys(JSON.parse(localStorage.getItem('portfolio_market_prices'))).length : null
    };
  });
  
  console.log('LocalStorage Data:', localStorageData);
  
  const textContent = await page.textContent('#buying-power-value');
  console.log('DOM Buying Power text:', textContent);
  
  await browser.close();
}

check();
