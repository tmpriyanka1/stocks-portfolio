# Portfolio Tracker - Server (Backend)

This is the Node.js Express backend for the Stocks & Options Portfolio Tracker. It provides a secure, self-hosted data layer that powers the frontend dashboard.

## 🚀 Architecture & Code Flow

The backend is entirely contained within `server.js` and focuses on zero-dependency flat-file storage, ensuring easy portability and backups.

1. **Initialization**: Configures the Express server, CORS, and environment variables.
2. **Database Bootstrap**: Automatically generates the `/data` directory and seeds the initial JSON/NDJSON files if they do not exist.
3. **Authentication**: Manages user registration, login (passwords and OTPs), and session tokens.
4. **Unusual Whales Proxy**: Acts as a secure intermediary (`/api/market-prices`) to fetch live stock and options data without exposing API keys to the frontend browser.
5. **CRUD APIs**: Exposes REST endpoints to create, read, update, and delete trade histories, cash ledgers, and user configurations.
6. **Persistence**: All data is written synchronously to local NDJSON (Newline Delimited JSON) files for maximum durability and simplicity.

## 📁 Data Storage

All user data is stored locally in the `data/` directory:
- `trades.ndjson`: Contains all historical buy/sell transactions.
- `cash_ledger.ndjson`: Contains all deposits, withdrawals, and dividend records.
- `users.ndjson`: Stores registered users, hashed passwords, and profile settings.
- `prices.json` & `overrides.json`: Local caches for manual price overrides and dashboard settings.

## 🛠 Usage

**Prerequisites:** Node.js v18+

1. Ensure your `.env` file is configured with your `UW_TOKEN` (Unusual Whales API Key).
2. Start the server:
   ```bash
   npm start
   ```
3. For development with hot-reloading:
   ```bash
   npm run dev
   ```

The server will automatically listen on port `5001`.

## 🌐 API Endpoints

### Data Proxy
* `GET /api/market-prices`: Secure pass-through proxy to Unusual Whales to fetch live stock and options pricing (requires `tickers` query param).
* `GET /api/prices`: Fetches manual local price overrides.

### Transactions (Trades)
* `GET /api/trades`: Returns all historical buy/sell trade records.
* `POST /api/trades`: Appends a new stock or option trade transaction.
* `PUT /api/trades/ticker/:ticker`: Overwrites/edits the entire transaction history for a specific ticker.
* `DELETE /api/trades/ticker/:ticker`: Deletes all trades associated with a specific ticker.

### Cash Ledger & Notes
* `GET /api/cash` / `POST /api/cash`: Retrieve or record deposits, withdrawals, and dividend payouts.
* `GET /api/notes` / `POST /api/notes`: Retrieve or create journal/trading notes.

### Dashboard Settings
* `GET /api/overrides` / `POST /api/overrides`: Manages manual Buying Power and Portfolio Value overrides.
* `GET /api/portfolio-summary`: Backend route for aggregating a summary of the portfolio (if needed over raw arrays).

### Authentication & Users
* `POST /api/login`: Authenticate with username and password, returns a pseudo-JWT session token.
* `GET /api/users` / `POST /api/users`: List users or register a new user account.
* `POST /api/forgot-password/otp`: Generate an OTP code for password recovery.
* `POST /api/forgot-password/login`: Authenticate using a valid OTP code.
* `GET /api/profile` / `POST /api/profile/update`: View or update user profile configurations.
* `POST /api/password`: Securely change a user's password.

### Utilities
* `GET /api/reports`: Generates a downloadable CSV snapshot report of the portfolio.
* `GET /api/ai-prompt-builder`: Compiles a detailed markdown summary of the entire portfolio state for easy pasting into AI chatbots (like ChatGPT/Claude) for advice.
