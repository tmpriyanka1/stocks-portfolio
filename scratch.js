const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  await page.addInitScript(() => {
    sessionStorage.setItem('portfolio_session', JSON.stringify({ username: 'Admin', role: 'admin' }));
  });
  
  await page.goto('http://localhost:8080/portfolio.html');
  await page.waitForSelector('.balance-card');
  await page.waitForTimeout(2000); // let it render
  const html = await page.$eval('.table-container', el => el.outerHTML);
  console.log('TABLE HTML:', html);
  await browser.close();
})();
