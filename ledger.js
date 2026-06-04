// Simulated local time target date
const SIMULATED_TODAY = new Date('2026-06-03T23:59:59');

// 1. MOCK TRANSACTIONS HISTORY DATABASE
const portfolioTransactions = [
  // --- DAILY (June 3, 2026) ---
  {
    ticker: 'NVDA',
    assetType: 'stocks',
    action: 'BUY',
    shares: 10,
    price: 480.00,
    date: '2026-06-03T10:15:00',
    comment: 'Momentum breakout buy after consolidation at $478.'
  },
  {
    ticker: 'NVDA',
    assetType: 'stocks',
    action: 'SELL',
    shares: 10,
    price: 495.00,
    date: '2026-06-03T14:30:00',
    comment: 'Quick day trade scalp target hit. Captured +$15.00/share profit.'
  },
  {
    ticker: 'PLTR',
    assetType: 'stocks',
    action: 'BUY',
    shares: 50,
    price: 21.00,
    date: '2026-06-03T09:45:00',
    comment: 'Support level bounce entry. Adding PLTR for core options setup.'
  },

  // --- WEEKLY (May 28, 2026 - June 2, 2026) ---
  {
    ticker: 'AAPL',
    assetType: 'stocks',
    action: 'BUY',
    shares: 30,
    price: 170.00,
    date: '2026-05-30T11:00:00',
    comment: 'Adding to core Apple position on temporary market-wide pullback.'
  },
  {
    ticker: 'AAPL',
    assetType: 'stocks',
    action: 'BUY',
    shares: 20,
    price: 172.00,
    date: '2026-05-31T13:45:00',
    comment: 'Averaging up on clear hourly trend confirmation and high volume.'
  },
  {
    ticker: 'AAPL',
    assetType: 'stocks',
    action: 'SELL',
    shares: 50,
    price: 178.00,
    date: '2026-06-01T15:30:00',
    comment: 'Closed full Apple swing trade. Locked in solid gains ahead of WWDC.'
  },
  {
    ticker: 'TSLA',
    assetType: 'stocks',
    action: 'BUY',
    shares: 15,
    price: 185.00,
    date: '2026-05-29T10:30:00',
    comment: 'Long setup near key support level. Stop loss set at $180.'
  },
  {
    ticker: 'NVDA $490 Call',
    assetType: 'options',
    action: 'BUY',
    shares: 3,
    price: 15.20,
    date: '2026-05-28T09:35:00',
    comment: 'Buy to open NVDA $490 Calls. Expecting momentum push towards $500.'
  },

  // --- MONTHLY (May 5, 2026 - May 27, 2026) ---
  {
    ticker: 'MSFT',
    assetType: 'stocks',
    action: 'BUY',
    shares: 40,
    price: 410.00,
    date: '2026-05-12T10:00:00',
    comment: 'AI integration catalyst play. Solid earnings growth expectations.'
  },
  {
    ticker: 'MSFT',
    assetType: 'stocks',
    action: 'SELL',
    shares: 20,
    price: 425.00,
    date: '2026-05-18T14:15:00',
    comment: 'Trimming half position at target 1 resistance. Keeping remainder.'
  },
  {
    ticker: 'COIN',
    assetType: 'stocks',
    action: 'BUY',
    shares: 25,
    price: 220.00,
    date: '2026-05-10T11:30:00',
    comment: 'Crypto breakout momentum entry above $218. High risk.'
  },
  {
    ticker: 'COIN',
    assetType: 'stocks',
    action: 'SELL',
    shares: 25,
    price: 205.00,
    date: '2026-05-15T10:10:00',
    comment: 'Stop loss triggered on crypto volatility. Closed for a loss.'
  },

  // --- YEARLY (June 4, 2025 - May 4, 2026) ---
  {
    ticker: 'AMZN',
    assetType: 'stocks',
    action: 'BUY',
    shares: 100,
    price: 160.00,
    date: '2026-01-15T14:00:00',
    comment: 'Post-Q4 earnings selloff dip buy. Solid long-term entry opportunity.'
  },
  {
    ticker: 'AMZN',
    assetType: 'stocks',
    action: 'SELL',
    shares: 100,
    price: 185.00,
    date: '2026-02-20T11:45:00',
    comment: 'Completed swing trade at resistance. Locked in +$2,500 total profit.'
  },
  {
    ticker: 'META',
    assetType: 'stocks',
    action: 'BUY',
    shares: 50,
    price: 450.00,
    date: '2025-10-05T10:15:00',
    comment: 'Ad revenue recovery play. Extremely cheap valuation relative to earnings.'
  },
  {
    ticker: 'META',
    assetType: 'stocks',
    action: 'SELL',
    shares: 20,
    price: 480.00,
    date: '2025-12-12T14:50:00',
    comment: 'Trimmed partial position for year-end tax optimization. Remaining 30 shares.'
  }
];

document.addEventListener('DOMContentLoaded', () => {
  initTimeFilters();
  initNavigationRedirects();

  // Render daily ledger by default
  renderLedger('daily');
});

/**
 * Filters the transaction list by selected time range pill relative to simulated date
 */
function getFilteredTransactions(range) {
  return portfolioTransactions.filter(tx => {
    const txDate = new Date(tx.date);
    const diffTime = SIMULATED_TODAY - txDate;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (range === 'daily') {
      return txDate.getFullYear() === 2026 && txDate.getMonth() === 5 && txDate.getDate() === 3;
    } else if (range === 'weekly') {
      return diffDays <= 7 && diffDays >= 0;
    } else if (range === 'monthly') {
      return diffDays <= 30 && diffDays >= 0;
    } else if (range === 'yearly') {
      return diffDays <= 365 && diffDays >= 0;
    }
    return true;
  });
}

/**
 * Groups raw transactions by ticker and computes weighted metrics
 */
function groupTransactionsByTicker(transactions) {
  const groups = {};

  transactions.forEach(tx => {
    if (!groups[tx.ticker]) {
      groups[tx.ticker] = {
        ticker: tx.ticker,
        assetType: tx.assetType,
        buyQty: 0,
        buyVal: 0,
        sellQty: 0,
        sellVal: 0,
        transactions: []
      };
    }

    const g = groups[tx.ticker];
    g.transactions.push(tx);

    if (tx.action === 'BUY') {
      g.buyQty += tx.shares;
      g.buyVal += tx.shares * tx.price;
    } else if (tx.action === 'SELL') {
      g.sellQty += tx.shares;
      g.sellVal += tx.shares * tx.price;
    }
  });

  const results = [];
  for (const ticker in groups) {
    const g = groups[ticker];

    // Sort transactions oldest first for natural chronological history reading
    g.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    const avgBuy = g.buyQty > 0 ? (g.buyVal / g.buyQty) : 0;
    const avgSell = g.sellQty > 0 ? (g.sellVal / g.sellQty) : 0;

    const netShares = g.buyQty - g.sellQty;
    const closedShares = Math.min(g.buyQty, g.sellQty);

    // Realized P&L = closed quantity * (weighted selling average - weighted buying average)
    const realizedPL = closedShares > 0 ? closedShares * (avgSell - avgBuy) : 0;

    results.push({
      ticker: g.ticker,
      assetType: g.assetType,
      buyQty: g.buyQty,
      buyAvg: avgBuy,
      sellQty: g.sellQty,
      sellAvg: avgSell,
      netShares: netShares,
      realizedPL: realizedPL,
      transactions: g.transactions
    });
  }

  return results;
}

/**
 * Builds HTML code dynamically for a grouped Position Master Card
 */
function createMasterCardHTML(cardData) {
  const isCompleted = cardData.netShares <= 0;

  const buyAvgStr = cardData.buyAvg > 0 ? `$${cardData.buyAvg.toFixed(2)}` : '—';
  const sellAvgStr = cardData.sellAvg > 0 ? `$${cardData.sellAvg.toFixed(2)}` : '—';

  let pnlClass = 'neutral';
  let pnlSign = '';
  if (cardData.realizedPL > 0) {
    pnlClass = 'positive';
    pnlSign = '+';
  } else if (cardData.realizedPL < 0) {
    pnlClass = 'negative';
  }
  const pnlStr = `$${Math.abs(cardData.realizedPL).toFixed(2)}`;

  const assetTypeLabel = cardData.assetType === 'options' ? 'Option' : 'Stock';
  const qtyLabel = cardData.assetType === 'options' ? 'Contracts' : 'Shares';

  // Generate timeline nodes
  const timelineHTML = cardData.transactions.map(tx => {
    const txDate = new Date(tx.date);
    const isToday = txDate.getFullYear() === 2026 && txDate.getMonth() === 5 && txDate.getDate() === 3;
    const formattedDate = isToday
      ? txDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const actionClass = tx.action.toLowerCase();
    const actionLabel = tx.action === 'BUY' ? 'Bought' : 'Sold';

    return `
      <div class="timeline-item ${actionClass}">
        <div class="timeline-dot"></div>
        <div class="timeline-header">
          <span class="timeline-action-text">${actionLabel} ${tx.shares} ${cardData.assetType === 'options' ? 'Contracts' : 'Shares'} @ $${tx.price.toFixed(2)}</span>
          <span class="timeline-date">${formattedDate}</span>
        </div>
        ${tx.comment ? `<div class="timeline-comment">${tx.comment}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="master-card" data-ticker="${cardData.ticker}">
      <div class="card-header-row">
        <div class="card-title-box">
          <span class="card-ticker">${cardData.ticker}</span>
          <span class="card-asset-type">${assetTypeLabel}</span>
        </div>
        <div class="card-actions-area">
          <span class="card-pnl-badge ${pnlClass}">Realized P&L: ${pnlSign}${pnlStr}</span>
          <div class="expand-caret">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="card-stats-row">
        <div class="stat-mini-item">
          <span class="stat-mini-label">Buy Average</span>
          <span class="stat-mini-value">${buyAvgStr}</span>
        </div>
        <div class="stat-mini-item" style="text-align: center;">
          <span class="stat-mini-label">Net Holdings</span>
          <span class="stat-mini-value" style="color: ${isCompleted ? 'var(--text-muted)' : 'var(--success)'}">
            ${isCompleted ? 'Completed' : `${cardData.netShares} ${qtyLabel}`}
          </span>
        </div>
        <div class="stat-mini-item">
          <span class="stat-mini-label">Sell Average</span>
          <span class="stat-mini-value">${sellAvgStr}</span>
        </div>
      </div>
      
      <!-- Expandable Chronological Timeline -->
      <div class="timeline-wrapper">
        <div class="timeline-container">
          ${timelineHTML}
        </div>
      </div>
    </div>
  `;
}

/**
 * Groups, formats, and renders Master Cards into Active vs Completed sections
 */
function renderLedger(range) {
  const activeList = document.getElementById('active-ledger-list');
  const completedList = document.getElementById('completed-ledger-list');

  if (!activeList || !completedList) return;

  const txs = getFilteredTransactions(range);
  const grouped = groupTransactionsByTicker(txs);

  const activeCards = grouped.filter(g => g.netShares > 0);
  const completedCards = grouped.filter(g => g.netShares <= 0);

  // Render 🟢 Active Positions
  if (activeCards.length === 0) {
    activeList.innerHTML = `<div class="ledger-empty">No active positions in this period.</div>`;
  } else {
    activeList.innerHTML = activeCards.map(createMasterCardHTML).join('');
  }

  // Render ⚪ Completed Positions
  if (completedCards.length === 0) {
    completedList.innerHTML = `<div class="ledger-empty">No completed positions in this period.</div>`;
  } else {
    completedList.innerHTML = completedCards.map(createMasterCardHTML).join('');
  }

  // Attach expanding interaction event listeners
  const cards = document.querySelectorAll('.master-card');
  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Ignore clicks inside timeline comments/details so users can select text/comments
      if (e.target.closest('.timeline-wrapper')) {
        return;
      }
      card.classList.toggle('expanded');
    });
  });
}

/**
 * Initial setup for top sliding filter pills row
 */
function initTimeFilters() {
  const filterBtns = document.querySelectorAll('.pill-btn');
  const slider = document.getElementById('ledger-slider');

  function updateSlider(btn) {
    if (slider && btn) {
      slider.style.width = `${btn.offsetWidth}px`;
      slider.style.transform = `translateX(${btn.offsetLeft}px)`;
    }
  }

  const initialActive = document.querySelector('.pill-btn.active');
  if (initialActive) {
    requestAnimationFrame(() => {
      updateSlider(initialActive);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.getAttribute('data-range');
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSlider(btn);

      renderLedger(range);
    });
  });

  window.addEventListener('resize', () => {
    const activeBtn = document.querySelector('.pill-btn.active');
    updateSlider(activeBtn);
  });
}

/**
 * Handles bottom navigation tab redirects and page routing
 */
function initNavigationRedirects() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetId = tab.getAttribute('data-target');

      if (targetId === 'screen-ledger') {
        e.preventDefault();
        return; // Already on Ledger page
      }

      e.preventDefault();
      // Redirect to portfolio.html with tab selection query params
      if (targetId === 'screen-dashboard') {
        window.location.href = 'portfolio.html';
      } else if (targetId === 'screen-entry') {
        window.location.href = 'entry.html';
      } else if (targetId === 'settings-screen') {
        window.location.href = 'settings.html';
      } else {
        window.location.href = `portfolio.html?tab=${targetId}`;
      }
    });
  });
}
