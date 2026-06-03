// 1. CORE DASHBOARD STATE ARRAY: global hardcoded portfolio asset array
const portfolioAssets = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA Corporation',
    type: 'stocks',
    shares: 40,
    avgCost: 400.00,
    currentPrice: 485.00,
    change24h: 3.25,
    icon: 'NV'
  },
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    type: 'stocks',
    shares: 250,
    avgCost: 165.00,
    currentPrice: 175.50,
    change24h: 1.92,
    icon: 'AP'
  },
  {
    ticker: 'TSLA',
    name: 'Tesla Inc.',
    type: 'stocks',
    shares: 85,
    avgCost: 210.00,
    currentPrice: 198.20,
    change24h: -2.17,
    icon: 'TS'
  },
  {
    ticker: 'NVDA $490 Call',
    name: 'Exp 07/16/26 • Buy to Open',
    type: 'options',
    shares: 3,
    avgCost: 15.20,
    currentPrice: 18.50,
    change24h: 20.31,
    icon: 'OC'
  },
  {
    ticker: 'AAPL $180 Call',
    name: 'Exp 06/18/26 • Buy to Open',
    type: 'options',
    shares: 2,
    avgCost: 5.50,
    currentPrice: 4.80,
    change24h: -13.43,
    icon: 'OC'
  }
];

document.addEventListener('DOMContentLoaded', () => {
  updateBalanceMetrics();
  initNavigation();
  initFilters();
  
  // Render full portfolio instantly on load
  renderAssetsTable('all');
  initNotificationBell();
});

/**
 * Calculates and updates top portfolio balance card metrics dynamically
 */
function updateBalanceMetrics() {
  const balanceAmountEl = document.querySelector('.balance-amount');
  const balanceChangeEl = document.querySelector('.balance-change');
  const activeOptionsEl = document.querySelector('.stat-item:last-child .stat-value');
  
  if (!balanceAmountEl || !balanceChangeEl) return;
  
  let totalValue = 0;
  let totalPrevValue = 0;
  let optionContractsCount = 0;
  
  portfolioAssets.forEach(asset => {
    const value = asset.shares * asset.currentPrice;
    const prevValue = value / (1 + asset.change24h / 100);
    totalValue += value;
    totalPrevValue += prevValue;
    
    if (asset.type === 'options') {
      optionContractsCount += asset.shares;
    }
  });
  
  const totalChange = totalValue - totalPrevValue;
  const totalChangePct = (totalChange / totalPrevValue) * 100;
  
  // Format total balance
  balanceAmountEl.textContent = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(totalValue);
  
  // Format daily change percentage and dollar change
  const isPositive = totalChange >= 0;
  const changeClass = isPositive ? 'positive' : 'negative';
  
  balanceChangeEl.className = `balance-change ${changeClass}`;
  
  const formattedChangeStr = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always'
  }).format(totalChange);
  
  const arrowSvg = isPositive 
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    
  balanceChangeEl.innerHTML = `
    ${arrowSvg}
    <span>${formattedChangeStr} (${isPositive ? '+' : ''}${totalChangePct.toFixed(2)}%) Today</span>
  `;
  
  // Update active options contracts
  if (activeOptionsEl) {
    activeOptionsEl.textContent = `${optionContractsCount} Contracts`;
  }
}

/**
 * 2. ASSET HOLDERS GRID BUILDER ENGINE: dynamic layout function
 * targets the '#tableBody' element in index.html.
 */
function renderAssetsTable(filterMode) {
  const tableBody = document.getElementById('tableBody');
  const skeleton = document.getElementById('skeleton-loader');
  
  // Clear out the temporary skeleton placeholder lines on initialization/render
  if (skeleton) {
    skeleton.style.display = 'none';
  }
  
  if (!tableBody) return;
  tableBody.innerHTML = '';
  
  // Filter portfolio assets down to specific asset class
  const filtered = portfolioAssets.filter(asset => {
    if (filterMode === 'all') return true;
    return asset.type === filterMode;
  });
  
  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <div class="empty-view" style="padding: 24px 0;">
        <p>No active assets found in this category.</p>
      </div>
    `;
    return;
  }
  
  // Map and dynamically render the assets rows
  filtered.forEach(asset => {
    // Calculating and formatting total holdings value (shares * current stock market price)
    const holdingsValue = asset.shares * asset.currentPrice;
    const formattedVal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(holdingsValue);
    
    // Formatting positive or negative 24h change percentage badges
    const isPositive = asset.change24h >= 0;
    const changeSign = isPositive ? 'positive' : 'negative';
    const arrowSymbol = isPositive ? '▲' : '▼';
    const formattedPct = `${arrowSymbol} ${Math.abs(asset.change24h).toFixed(2)}%`;
    
    const rowHTML = `
      <div class="asset-row" data-ticker="${asset.ticker}" role="button" tabindex="0">
        <div class="asset-left">
          <div class="asset-icon-box">${asset.icon}</div>
          <div class="asset-info">
            <span class="asset-ticker">${asset.ticker}</span>
            <span class="asset-name">${asset.name} • ${asset.type === 'options' ? asset.shares + ' Contracts' : asset.shares + ' Shares'}</span>
          </div>
        </div>
        <div class="asset-right">
          <span class="asset-value">${formattedVal}</span>
          <span class="asset-performance ${changeSign}">
            <span>${formattedPct}</span>
          </span>
        </div>
      </div>
    `;
    
    tableBody.insertAdjacentHTML('beforeend', rowHTML);
  });

  // Attach feedback click listeners to the asset rows
  const assetRows = tableBody.querySelectorAll('.asset-row');
  assetRows.forEach(row => {
    row.addEventListener('click', () => {
      const ticker = row.getAttribute('data-ticker');
      const asset = filtered.find(a => a.ticker === ticker);
      if (asset) {
        showAssetFeedback(asset);
      }
    });
  });
}

/**
 * 3. UNHIDDEN PILL TAB SELECTION ACTIONS:
 * Links filter execution hooks to middle pills ([All Assets], [Stocks], [Options])
 */
function initFilters() {
  const filterBtns = document.querySelectorAll('.pill-btn');
  const slider = document.querySelector('.pill-slider');
  
  // Slide active .pill-slider indicator box to the selected button
  function updateSlider(btn) {
    if (slider && btn) {
      slider.style.width = `${btn.offsetWidth}px`;
      slider.style.transform = `translateX(${btn.offsetLeft}px)`;
    }
  }
  
  // Set initial position of the slider
  const initialActive = document.querySelector('.pill-btn.active');
  if (initialActive) {
    requestAnimationFrame(() => {
      updateSlider(initialActive);
    });
  }
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.getAttribute('data-filter');
      
      // Toggle .active design class to emphasize the focused element
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Move indicator slider
      updateSlider(btn);
      
      // Filter the assets view without altering any top parent card layouts
      renderAssetsTable(filterType);
    });
  });
  
  // Ensure the indicator position remains correct on mobile viewport rotation/resizing
  window.addEventListener('resize', () => {
    const activeBtn = document.querySelector('.pill-btn.active');
    updateSlider(activeBtn);
  });
}

/**
 * 4. NATIVE APPLICATION ROUTER TOGGLES:
 * Fixed global navigation tab routing
 */
function initNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  const screens = document.querySelectorAll('.screen-view');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');
      
      // Toggle active state design classes on bottom navigation tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Switch screen visibility immediately using active class
      screens.forEach(screen => {
        if (screen.id === targetId) {
          screen.classList.add('active');
        } else {
          screen.classList.remove('active');
        }
      });
      
      // Additional view resets (scroll to top on screen transitions)
      if (targetId === 'screen-dashboard') {
        const container = document.getElementById('holdings-container');
        if (container) container.scrollTop = 0;
        
        // Refresh filter slider position just in case layout shifts occurred
        const activeFilterBtn = document.querySelector('.pill-btn.active');
        const slider = document.querySelector('.pill-slider');
        if (slider && activeFilterBtn) {
          slider.style.width = `${activeFilterBtn.offsetWidth}px`;
          slider.style.transform = `translateX(${activeFilterBtn.offsetLeft}px)`;
        }
      }
    });
  });
}

/**
 * Renders interactive toast feedback message when clicking on individual asset items
 */
function showAssetFeedback(asset) {
  const existingToast = document.querySelector('.app-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const changeText = asset.change24h >= 0 ? `up ${asset.change24h}%` : `down ${Math.abs(asset.change24h)}%`;
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.innerText = `${asset.ticker} is currently trading at $${asset.currentPrice.toFixed(2)} (${changeText}) today.`;
  
  Object.assign(toast.style, {
    position: 'absolute',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#f8fafc',
    padding: '10px 16px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '555',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    zIndex: '200',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    width: '80%',
    textAlign: 'center'
  });

  document.getElementById('app-container').appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

/**
 * Initializes interactions for the notification bell badge element
 */
function initNotificationBell() {
  const bell = document.getElementById('notification-bell');
  if (!bell) return;
  
  bell.addEventListener('click', () => {
    const badge = bell.querySelector('.badge');
    if (badge) badge.style.display = 'none';
    
    const toast = document.createElement('div');
    toast.innerText = 'No new alerts at this time.';
    Object.assign(toast.style, {
      position: 'absolute',
      top: '80px',
      left: '50%',
      transform: 'translateX(-50%) translateY(-20px)',
      background: 'rgba(30, 41, 59, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      color: '#f8fafc',
      padding: '10px 16px',
      borderRadius: '12px',
      fontSize: '12px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
      zIndex: '200',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      width: '80%',
      textAlign: 'center'
    });
    
    document.getElementById('app-container').appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  });
}
