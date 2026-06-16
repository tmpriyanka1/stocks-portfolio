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

    // Mock global Date to 2026-06-03T12:00:00 to align with ledger transaction filters
    await page.addInitScript(() => {
      const mockDate = new Date('2026-06-03T12:00:00');
      const OriginalDate = Date;
      function MockDate(y, m, d, h, min, s, ms) {
        if (arguments.length === 0) {
          return new OriginalDate(mockDate.getTime());
        }
        return new OriginalDate(y, m, d, h, min, s, ms);
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

    let screenshot = await takeScreenshot(page);
    let result = compareScreenshot(screenshot, 'ledger-daily');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 2. Weekly Filter State
    await page.click('button[data-range="weekly"]');
    // Wait for the active class to settle and table layout update
    await page.waitForFunction(() => document.querySelector('button[data-range="weekly"]').classList.contains('active'));
    await page.waitForTimeout(600);

    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'ledger-weekly');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 3. Monthly Filter State
    await page.click('button[data-range="monthly"]');
    await page.waitForFunction(() => document.querySelector('button[data-range="monthly"]').classList.contains('active'));
    await page.waitForTimeout(600);

    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'ledger-monthly');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 4. Yearly Filter State
    await page.click('button[data-range="yearly"]');
    await page.waitForFunction(() => document.querySelector('button[data-range="yearly"]').classList.contains('active'));
    await page.waitForTimeout(600);

    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'ledger-yearly');
    if (!result.pass) {
      throw new Error(result.message);
    }

    // 5. All Time Filter State
    await page.click('button[data-range="all"]');
    await page.waitForFunction(() => document.querySelector('button[data-range="all"]').classList.contains('active'));
    await page.waitForTimeout(600);

    screenshot = await takeScreenshot(page);
    result = compareScreenshot(screenshot, 'ledger-all');
    if (!result.pass) {
      throw new Error(result.message);
    }
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
