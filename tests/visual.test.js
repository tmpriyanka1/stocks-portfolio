// @jest-environment node
const webStreams = require('node:stream/web');
Object.assign(global, webStreams);
global.Request = class Request {};
global.Response = class Response {};

const timers = require('node:timers');
global.setImmediate = timers.setImmediate;
global.clearImmediate = timers.clearImmediate;

const { chromium } = require('playwright');
const { compareScreenshot } = require('./visualMatcher');

describe('Visual Regression UI Tests', () => {
  let browser;
  let page;

  // Helper to ensure blur, scroll to top, and take deterministic screenshots
  async function takeScreenshot(page) {
    await page.evaluate(() => {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      // Reset scroll positions of any scrollable containers to ensure exact visual alignment
      const scrollableIds = ['settings-screen', 'ledger-scroll-container', 'holdings-container', 'app-container'];
      scrollableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.scrollTop = 0;
      });
      const scrollableSelectors = ['.table-container', '.settings-content', '.ledger-list'];
      scrollableSelectors.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.scrollTop = 0;
      });
      window.scrollTo(0, 0);
    });
    // Wait a short moment for scroll to settle
    await page.waitForTimeout(200);
    return await page.screenshot({ fullPage: true });
  }

  // Helper to wait for the asynchronous AI summary engine fetch to settle
  async function waitForAISummary(page) {
    await page.waitForFunction(() => {
      const el = document.querySelector('#snap-ai-brief-text');
      if (!el) return true;
      const text = el.textContent;
      return !text.includes('Gathering') && !text.includes('Generating');
    }, { timeout: 5000 }).catch(() => {});
  }

  beforeAll(async () => {
    jest.setTimeout(30000);
    browser = await chromium.launch({
      headless: true
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    // Use standard high-definition viewport for rendering UI pages
    await page.setViewportSize({ width: 1200, height: 1200 });

    // Mock Google Apps Script endpoint fetches to be deterministic and offline-safe
    await page.route('**/macros/s/**', route => {
      const req = route.request();
      if (req.method() === 'POST') {
        try {
          const bodyData = JSON.parse(req.postData() || '{}');
          if (bodyData.action === 'getAIJournalSummary') {
            route.fulfill({
              status: 200,
              contentType: 'text/plain',
              body: 'Mocked AI Journal summary digest content.'
            });
            return;
          }
        } catch (e) {
          // ignore parsing error
        }
      } else if (req.method() === 'GET') {
        route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'Offline mock: cloud pull disabled for visual tests'
        });
        return;
      }
      route.continue();
    });

    // Mock global Date to 2026-06-03T12:00:00 to align with ledger transaction filters
    await page.addInitScript(() => {
      const mockDate = new Date('2026-06-03T12:00:00');
      const OriginalDate = Date;
      function MockDate(...args) {
        if (args.length === 0) {
          return new OriginalDate(mockDate.getTime());
        }
        return new OriginalDate(...args);
      }
      MockDate.prototype = OriginalDate.prototype;
      MockDate.now = () => mockDate.getTime();
      MockDate.UTC = OriginalDate.UTC;
      MockDate.parse = OriginalDate.parse;
      window.Date = MockDate;

      // Clear local storage for a clean and deterministic start
      localStorage.clear();

      // Inject style to hide scrollbars globally to prevent visual test flakiness
      const style = document.createElement('style');
      style.innerHTML = `
        * {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        *::-webkit-scrollbar {
          display: none !important;
        }
      `;
      window.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild(style);
      });
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  test('Portfolio Tracker Tab - Initial Layout & Asset Rows', async () => {
    await page.goto('http://localhost:8080/portfolio.html');
    
    // Wait for core elements to render
    await page.waitForSelector('.balance-card');
    await page.waitForSelector('.holdings-list');
    // Give charts/render cycles a short moment to settle
    await page.waitForTimeout(600);

    const screenshot = await takeScreenshot(page);
    const result = compareScreenshot(screenshot, 'portfolio-initial');
    if (!result.pass) {
      throw new Error(result.message);
    }
  }, 30000);

  test('Reports (Ledger) Tab - Filter Views & Company Name Multi-line Wrapping', async () => {
    await page.goto('http://localhost:8080/ledger.html');
    
    // 1. Initial/Daily Filter State
    await page.waitForSelector('.ledger-section');
    await page.waitForTimeout(600);
    await waitForAISummary(page);

    let screenshot = await takeScreenshot(page);
    let result = compareScreenshot(screenshot, 'ledger-daily');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 2. Weekly Filter State
    console.log('Clicking pill-weekly...');
    await page.click('#pill-weekly');
    console.log('Clicking dropdown-weekly li...');
    await page.click('#dropdown-weekly li[data-value="This Week"]');
    console.log('Waiting for active class weekly...');
    // Wait for the active class to settle and table layout update
    await page.waitForFunction(() => document.querySelector('.pill-dropdown-container[data-type="weekly"]').classList.contains('active'));
    console.log('Waiting for 600ms weekly...');
    await page.waitForTimeout(600);
    await waitForAISummary(page);

    console.log('Taking screenshot weekly...');
    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'ledger-weekly');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 3. Monthly Filter State
    console.log('Clicking pill-monthly...');
    await page.click('#pill-monthly');
    const monthlyOpts = await page.$$eval('#dropdown-monthly li', lis => lis.map(li => li.getAttribute('data-value')));
    console.log('Available monthly options:', monthlyOpts);
    console.log('Clicking dropdown-monthly li...');
    await page.click(`#dropdown-monthly li[data-value="${monthlyOpts[0]}"]`);
    console.log('Waiting for active class monthly...');
    await page.waitForFunction(() => document.querySelector('.pill-dropdown-container[data-type="monthly"]').classList.contains('active'));
    console.log('Waiting for 600ms monthly...');
    await page.waitForTimeout(600);
    await waitForAISummary(page);

    console.log('Taking screenshot monthly...');
    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'ledger-monthly');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 4. Yearly Filter State
    console.log('Clicking pill-yearly...');
    await page.click('#pill-yearly');
    const yearlyOpts = await page.$$eval('#dropdown-yearly li', lis => lis.map(li => li.getAttribute('data-value')));
    console.log('Available yearly options:', yearlyOpts);
    console.log('Clicking dropdown-yearly li...');
    await page.click(`#dropdown-yearly li[data-value="${yearlyOpts[0]}"]`);
    console.log('Waiting for active class yearly...');
    await page.waitForFunction(() => document.querySelector('.pill-dropdown-container[data-type="yearly"]').classList.contains('active'));
    console.log('Waiting for 600ms yearly...');
    await page.waitForTimeout(600);
    await waitForAISummary(page);

    console.log('Taking screenshot yearly...');
    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'ledger-yearly');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 5. Quarterly Filter State
    console.log('Clicking pill-quarterly...');
    await page.click('#pill-quarterly');
    const quarterlyOpts = await page.$$eval('#dropdown-quarterly li', lis => lis.map(li => li.getAttribute('data-value')));
    console.log('Available quarterly options:', quarterlyOpts);
    console.log('Clicking dropdown-quarterly li...');
    await page.click(`#dropdown-quarterly li[data-value="${quarterlyOpts[0]}"]`);
    console.log('Waiting for active class quarterly...');
    await page.waitForFunction(() => document.querySelector('.pill-dropdown-container[data-type="quarterly"]').classList.contains('active'));
    console.log('Waiting for 600ms quarterly...');
    await page.waitForTimeout(600);
    await waitForAISummary(page);

    console.log('Taking screenshot quarterly...');
    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'ledger-quarterly');
    if (!result.pass) {
      throw new Error(result.message);
    }
    console.log('All reports filter tests done!');
  }, 30000);

  test('Add Trade View - Initial Form Layout', async () => {
    await page.goto('http://localhost:8080/entry.html');
    
    await page.waitForSelector('.entry-form-container');
    await page.waitForTimeout(600);

    const screenshot = await takeScreenshot(page);
    const result = compareScreenshot(screenshot, 'entry-initial');
    if (!result.pass) {
      throw new Error(result.message);
    }
  }, 30000);

  test('Settings Screen - Accordions & Confirmation Dialog Overlay', async () => {
    await page.goto('http://localhost:8080/settings.html');
    
    // 1. Settings Screen Initial State (Accordions Closed)
    await page.waitForSelector('.settings-content');
    await page.waitForTimeout(600);

    let screenshot = await takeScreenshot(page);
    let result = compareScreenshot(screenshot, 'settings-initial');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 2. Expand all accordions (Color Accent, Preferences, Portfolio Overrides, System Actions)
    await page.click('#themeAccordion .accordion-header');
    await page.click('#preferencesAccordion .accordion-header');
    await page.click('#portfolioOverridesCard .accordion-header');
    await page.click('#systemActionsCard .accordion-header');
    // Wait for accordion expansion animation to complete (longer duration to ensure full settling)
    await page.waitForTimeout(1000);

    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'settings-expanded');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 3. Trigger Confirmation Dialog Modal
    await page.click('#resetLedgerBtn');
    // Wait for confirm modal to slide in
    await page.waitForSelector('#confirmModal.active');
    await page.waitForTimeout(800);

    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'settings-confirm-modal');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 4. Click Cancel to dismiss overlay
    await page.click('#confirmModalCancel');
    await page.waitForSelector('#confirmModal:not(.active)');
    await page.waitForTimeout(500);
  }, 30000);
});
