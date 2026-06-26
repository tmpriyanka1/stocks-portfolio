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
})();
