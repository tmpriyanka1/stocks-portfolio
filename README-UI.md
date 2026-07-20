# Portfolio Tracker - UI (Frontend)

This is the Vanilla JavaScript, HTML, and CSS frontend for the Stocks & Options Portfolio Tracker. It provides a premium, responsive, glassmorphic interface for tracking investments in real-time.

## 🚀 Architecture & Key Files

The frontend is built without heavy frameworks (like React or Vue) to remain lightweight, blazing fast, and highly customizable. It relies on the Node.js backend (`server.js`) for data storage and API proxies.

- **`portfolio.js`**: The heart of the dashboard. It hydrates the UI by pulling historical trades from the backend, aggregates them into open positions (FIFO logic), fetches real-time market prices, and renders the dynamic P&L charts and tables.
- **`ledger.js`**: Manages the historical transaction ledger. Provides advanced filtering pipelines (by date, asset type, action) and calculates historical realized profit/loss.
- **`entry.js`**: Handles the trade entry form UI. It features dynamic parsing for Option symbols (automatically generating compliant OSI strings) and strict payload validation before POSTing new trades to the backend.
- **`auth-guard.js`**: A lightweight security wrapper that ensures unauthenticated users are redirected to the login screen before viewing sensitive portfolio data.
- **`settings.js`**: Manages user configuration, overrides (like manual portfolio value adjustments), and OTP/password updates.

## 🎨 Design System

The application utilizes a custom CSS design system located in `styles.css` (and page-specific files like `portfolio.css`). Key features include:
- **Glassmorphism**: Translucent panels with background blurs.
- **Dynamic Theming**: Fluid animations, hover states, and color-coded P&L badges (Green for profit, Red for loss).
- **Responsive Layouts**: Fully mobile-optimized views using CSS Flexbox and Grid.

## 🛠 Usage

1. Ensure the Node.js Backend Server is running on port `5001`.
2. Serve the UI folder using any static file server. For example:
   ```bash
   npx http-server -p 8080 -c-1
   ```
3. Open `http://localhost:8080` in your web browser.

## 📄 Pages & Server Interactions

Each page in the UI maps to specific JavaScript controllers and interacts with the Node.js backend to fetch or mutate data.

### 1. Login / Authentication (`index.html`)
The entry point of the app, protected by `auth-guard.js`.
* **Interactions**:
  * `POST /api/login`: Validates the username and password to issue a session token.
  * `POST /api/forgot-password/otp`: Requests an OTP for a forgotten password.
  * `POST /api/forgot-password/login`: Logs in using a verified OTP.

### 2. Dashboard (`portfolio.html`)
The main real-time dashboard displaying active open positions, total portfolio value, and daily P&L. Powered by `portfolio.js`.
* **Interactions**:
  * `GET /api/trades` & `GET /api/cash`: Fetches all historical transactions to reconstruct current open positions via FIFO logic.
  * `GET /api/market-prices`: Long-polls the backend proxy every 15 minutes with active tickers to fetch live Unusual Whales pricing.
  * `GET /api/overrides`: Checks if the user has manually overridden Buying Power or Net Liquidity for display.

### 3. Trade Ledger (`ledger.html`)
A comprehensive view of all historical trades, filtering by timeframe (YTD, 30 days) and calculating historical Realized P&L. Powered by `ledger.js`.
* **Interactions**:
  * `GET /api/trades` & `GET /api/cash`: Pulls the raw JSON data to populate the history table.
  * `PUT /api/trades/ticker/:ticker`: If a user edits a historical transaction, the UI submits a PUT request to overwrite that ticker's history.
  * `DELETE /api/trades/ticker/:ticker`: Triggered if a user elects to completely wipe a ticker's history.

### 4. Trade Entry (`entry.html`)
The submission form used to log new stock purchases, option contracts, or cash deposits. Powered by `entry.js`.
* **Interactions**:
  * `POST /api/trades`: Submits a clean JSON payload for a new Buy/Sell transaction.
  * `POST /api/cash`: Submits a deposit, withdrawal, or dividend record.

### 5. Settings & Profile (`settings.html`)
User configuration, profile management, and dashboard overrides. Powered by `settings.js`.
* **Interactions**:
  * `GET /api/profile` & `POST /api/profile/update`: Loads and saves user details (e.g. phone number, email).
  * `POST /api/password`: Updates the user's secure password.
  * `GET /api/overrides` & `POST /api/overrides`: Reads and writes manual account value overrides to `overrides.json`.
