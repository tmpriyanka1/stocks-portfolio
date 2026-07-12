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
                    url.indexOf('http://localhost:5001/api/') === 0;
                    
    if (isBackend) {
      var currentRole = window.getSessionRole ? window.getSessionRole() : 'production';
      
      // 1. Dynamic Routing
      if (currentRole.toLowerCase() !== 'tester') {
        if (url.indexOf('http://localhost:5001/api/') === 0) {
          url = url.replace('http://localhost:5001/api/', 'https://vanai-portfolio-backend.onrender.com/api/');
        } else if (url.indexOf('/api/') === 0) {
          url = 'https://vanai-portfolio-backend.onrender.com' + url;
        }
      } else {
        var isLocal = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      !window.location.hostname;
        if (isLocal) {
          if (url.indexOf('https://vanai-portfolio-backend.onrender.com/api/') === 0) {
            url = url.replace('https://vanai-portfolio-backend.onrender.com/api/', 'http://localhost:5001/api/');
          } else if (url.indexOf('/api/') === 0) {
            url = 'http://localhost:5001' + url;
          }
        }
      }
      
      // 2. Inject x-user-role header
      init = init || {};
      init.headers = init.headers || {};
      
      // Get the role from the guard session helper
      var currentRole = window.getSessionRole ? window.getSessionRole() : 'production';
      
      // Convert headers if it's a Headers object
      if (typeof init.headers.set === 'function') {
        init.headers.set('x-user-role', currentRole);
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['x-user-role', currentRole]);
      } else {
        init.headers['x-user-role'] = currentRole;
      }
      
      if (typeof input === 'string') {
        input = url;
      } else if (input && input.url) {
        input = new Request(url, input);
      }
    }
    
    return originalFetch(input, init);
  };
})();
