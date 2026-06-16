const { chromium } = require('playwright');
const fs = require('fs');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 1200 });
  
  // Clean start (clear localStorage, then nav to portfolio)
  await page.goto('http://localhost:8080/settings.html');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    localStorage.clear();
  });
  
  console.log('Navigating to portfolio...');
  await page.goto('http://localhost:8080/portfolio.html');
  await page.waitForTimeout(5000); // Wait 5s for cloud pull
  
  const bp = await page.textContent('#buying-power-value');
  const balance = await page.textContent('.balance-amount');
  console.log('Portfolio page stats:');
  console.log('  Buying Power:', bp);
  console.log('  Total Balance:', balance);
  
  await page.screenshot({ path: '/Users/malathi/.gemini/antigravity-ide/brain/15d75252-42d6-4f03-a97e-c13f0230b2d9/final_portfolio.png', fullPage: true });
  
  console.log('Navigating to ledger...');
  await page.goto('http://localhost:8080/ledger.html');
  await page.waitForTimeout(4000); // Wait 4s for cloud pull
  
  // Capture Daily filter view
  await page.click('button[data-range="daily"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/malathi/.gemini/antigravity-ide/brain/15d75252-42d6-4f03-a97e-c13f0230b2d9/final_ledger_daily.png', fullPage: true });
  
  // Check if daily filter contains AMCR or TGB
  const hasAMCR = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.ledger-row'));
    return rows.some(row => row.textContent.includes('AMCR') || row.textContent.includes('TGB'));
  });
  console.log('Does Daily filter contain AMCR or TGB?', hasAMCR ? 'YES (BUG)' : 'NO (CORRECT)');
  
  await browser.close();
}

capture();
