const fs = require('fs');
const html = fs.readFileSync('ledger.html', 'utf8');

const modalHTML = `
    <!-- Edit Single Trade Modal Overlay -->
    <div class="import-modal-overlay" id="editSingleTradeModal" style="display: none;">
      <div class="import-modal-box" style="gap: 14px; max-width: 340px;">
        <div class="import-modal-header">
          <span class="import-modal-title" id="editSingleTradeModalTitle">Edit Trade — TICKER</span>
        </div>

        <!-- Shares / Contracts -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label for="editTradeSharesInput"
            style="font-size: 11px; color: var(--text-secondary); letter-spacing: 0.04em;">SHARES / CONTRACTS</label>
          <input type="number" id="editTradeSharesInput" min="1" step="1" placeholder="e.g. 10"
            style="width: 100%; font-size: 13px; padding: 10px 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; box-sizing: border-box;">
        </div>

        <!-- Average Price -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label for="editTradePriceInput"
            style="font-size: 11px; color: var(--text-secondary); letter-spacing: 0.04em;">AVERAGE PRICE ($)</label>
          <input type="number" id="editTradePriceInput" min="0" step="0.01" placeholder="e.g. 485.00"
            style="width: 100%; font-size: 13px; padding: 10px 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; box-sizing: border-box;">
        </div>

        <!-- Date (Optional) -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label for="editTradeDateInput" style="font-size: 11px; color: var(--text-secondary); letter-spacing: 0.04em;">DATE
            (optional)</label>
          <input type="date" id="editTradeDateInput"
            style="width: 100%; font-size: 13px; padding: 10px 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; box-sizing: border-box;">
        </div>

        <!-- Comment -->
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label for="editTradeCommentInput"
            style="font-size: 11px; color: var(--text-secondary); letter-spacing: 0.04em;">COMMENT (optional)</label>
          <input type="text" id="editTradeCommentInput" placeholder="Trade notes..."
            style="width: 100%; font-size: 13px; padding: 10px 12px; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; box-sizing: border-box;">
        </div>

        <div class="import-btn-row" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
          <button class="import-action-btn secondary" id="closeEditSingleTradeModalBtn"
            style="padding: 8px 16px; font-size: 12px; border-radius: 8px; background: rgba(255,255,255,0.08); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.1); cursor: pointer;">Close</button>
          <button class="import-action-btn primary" id="submitEditSingleTradeBtn"
            style="padding: 8px 16px; font-size: 12px; border-radius: 8px; background: var(--accent); color: #fff; border: none; font-weight: 600; cursor: pointer;">Submit</button>
        </div>
      </div>
    </div>
`;

const newHTML = html.replace('</main>', modalHTML + '\n</main>');
fs.writeFileSync('ledger.html', newHTML);
console.log("Done");
