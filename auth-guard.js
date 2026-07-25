/**
 * auth-guard.js — Shared Authentication Guard
 * Included as the FIRST script on all protected pages.
 * Reads sessionStorage for a valid session token; redirects to login.html if absent.
 * Exports window.__session, window.getSessionRole(), and window.logoutSession().
 */
(function () {
  var SESSION_KEY = 'portfolio_session';
  var LOGIN_PAGE = 'login.html';

  var raw = sessionStorage.getItem(SESSION_KEY);
  var session = null;

  if (raw) {
    try {
      session = JSON.parse(raw);
    } catch (e) {
      session = null;
    }
  }

  // Validate the session has the required shape
  if (!session || typeof session.username !== 'string' || typeof session.role !== 'string') {
    window.location.replace(LOGIN_PAGE);
    // Stop execution — the page redirect will take over
    throw new Error('[AuthGuard] No valid session. Redirecting to login.');
  }

  // Expose session to all page scripts
  window.__session = session;

  /**
   * Returns the current authenticated user's role ('admin' or 'member').
   */
  window.getSessionRole = function () {
    return (window.__session && window.__session.role) ? window.__session.role.toLowerCase() : 'member';
  };

  /**
   * Returns the current authenticated username.
   */
  window.getSessionUser = function () {
    return (window.__session && window.__session.username) ? window.__session.username : '';
  };

  /**
   * Clears the session and routes the user to the login screen.
   */
  window.logoutSession = function () {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace(LOGIN_PAGE);
  };

  // Set the CSS blur class based on localStorage on DOM load
  document.addEventListener('DOMContentLoaded', function () {
    var blurEnabled = localStorage.getItem('portfolio_blur_enabled') !== 'false';
    if (blurEnabled) {
      document.body.classList.remove('disable-glass-blur');
    } else {
      document.body.classList.add('disable-glass-blur');
    }
  });

  // Override global fetch to support sandbox routing and header injection
  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    
    // Check if the URL is hitting the backend
    var isBackend = url.indexOf('https://vanai-portfolio-backend.onrender.com/api/') === 0 ||
                    url.indexOf('/api/') === 0 ||
                    url.indexOf('http://localhost:5001/api/') === 0 ||
                    url.indexOf('http://127.0.0.1:5001/api/') === 0;
                    
    if (isBackend) {
      var currentRole = window.getSessionRole ? window.getSessionRole() : 'production';
      var currentUser = window.getSessionUser ? window.getSessionUser().toLowerCase() : '';
      
      // 1. Dynamic Routing
      var isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    !window.location.hostname;
                    
      if (!isLocal) {
        if (url.indexOf('http://localhost:5001/api/') === 0 || url.indexOf('http://127.0.0.1:5001/api/') === 0) {
          url = 'https://vanai-portfolio-backend.onrender.com/api/' + url.split('/api/')[1];
        } else if (url.indexOf('/api/') === 0) {
          url = 'https://vanai-portfolio-backend.onrender.com' + url;
        }
      } else {
        if (url.indexOf('https://vanai-portfolio-backend.onrender.com/api/') === 0) {
          url = 'http://localhost:5001/api/' + url.split('/api/')[1];
        } else if (url.indexOf('/api/') === 0) {
          url = 'http://localhost:5001' + url;
        } else if (url.indexOf('http://127.0.0.1:5001/api/') === 0) {
          url = 'http://localhost:5001/api/' + url.split('/api/')[1];
        }
      }
      
      // 2. Inject x-user-role header
      init = init || {};
      init.headers = init.headers || {};
      
      // Get the role from the guard session helper
      var currentRole = window.getSessionRole ? window.getSessionRole() : 'production';
      var portfolioId = localStorage.getItem('active_portfolio_id') || 'long_term';
      
      // Convert headers if it's a Headers object
      if (typeof init.headers.set === 'function') {
        init.headers.set('x-user-role', currentRole);
        init.headers.set('x-portfolio-id', portfolioId);
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['x-user-role', currentRole]);
        init.headers.push(['x-portfolio-id', portfolioId]);
      } else {
        init.headers['x-user-role'] = currentRole;
        init.headers['x-portfolio-id'] = portfolioId;
      }
      
      if (typeof input === 'string') {
        input = url;
      } else if (input && input.url) {
        input = new Request(url, input);
      }
    }
    
    return originalFetch(input, init);
  };
  
  // Global Portfolio Switcher UI Logic
  function initSwitcher() {
    var switcher = document.getElementById('global-portfolio-switcher');
    if (switcher && !switcher.hasAttribute('data-initialized')) {
      switcher.setAttribute('data-initialized', 'true');
      
      // Set the initial value
      var currentPortfolio = localStorage.getItem('active_portfolio_id') || 'long_term';
      switcher.value = currentPortfolio;
      
      var pillContainer = document.getElementById('account-pill-container');
      if (pillContainer) {
        if (currentPortfolio === 'long_term') {
          pillContainer.classList.add('long-term-active');
          pillContainer.classList.remove('short-term-active');
        } else {
          pillContainer.classList.add('short-term-active');
          pillContainer.classList.remove('long-term-active');
        }
      }
      
      // Listen for changes
      switcher.addEventListener('change', function(e) {
        var newPortfolio = e.target.value;
        localStorage.setItem('active_portfolio_id', newPortfolio);
        
        // Wipe local caches to prevent data bleeding
        localStorage.removeItem('portfolio_transactions');
        localStorage.removeItem('portfolio_cash_ledger');
        localStorage.removeItem('portfolio_buying_power');
        localStorage.removeItem('portfolio_buying_power_timestamp');
        localStorage.removeItem('portfolio_unread_notifications');
        
        // Reload page to fetch new portfolio data
        window.location.reload();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSwitcher);
  } else {
    initSwitcher();
  }
})();
