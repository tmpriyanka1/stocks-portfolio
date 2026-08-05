const fs = require('fs');

let ledgerJs = fs.readFileSync('ledger.js', 'utf8');

const timelineItemReplacement = `
        const isAdmin = typeof window.getSessionRole === 'function' && window.getSessionRole() === 'admin';
        const adminControls = isAdmin ? \`
          <div class="timeline-controls" style="margin-left: auto; display: flex; gap: 8px;">
            <i class="fas fa-edit" style="cursor: pointer; color: var(--text-muted);" onclick="editSingleTrade('\${cardData.ticker}', '\${tx.date}', \${sharesVal}, \${priceVal}, '\${action}', '\${comment}')" title="Edit Trade"></i>
            <i class="fas fa-trash" style="cursor: pointer; color: var(--text-muted);" onclick="deleteSingleTrade('\${cardData.ticker}', '\${tx.date}')" title="Delete Trade"></i>
          </div>
        \` : '';

        return \`
              <div class="timeline-item \${actionClass}" style="display: flex; flex-direction: column;">
                <div class="timeline-dot"></div>
                <div class="timeline-header" style="display: flex; align-items: center; width: 100%;">
                  <span class="timeline-action-text">\${actionLabel} \${sharesVal} @ $\${priceVal.toFixed(2)} - \${dateTimeStr}</span>
                  \${adminControls}
                </div>
                \${displayComment ? \`<div class="timeline-comment">\${displayComment}</div>\` : ''}
              </div>
            \`;
`;

// Replace the return block in ledger.js
if (!ledgerJs.includes('deleteSingleTrade')) {
  const searchStr = \`        return \\\`
              <div class="timeline-item \${actionClass}">
                <div class="timeline-dot"></div>
                <div class="timeline-header">
                  <span class="timeline-action-text">\${actionLabel} \${sharesVal} @ $\\$\${priceVal.toFixed(2)} - \${dateTimeStr}</span>
                </div>
                \${displayComment ? \\\`<div class="timeline-comment">\${displayComment}</div>\\\` : ''}
              </div>
            \\\`;\`;
  ledgerJs = ledgerJs.replace(searchStr, timelineItemReplacement);
  
  // Add the edit/delete functions at the end of the file
  ledgerJs += \`
// Single Trade Actions
window.deleteSingleTrade = async function(ticker, date) {
  if (!confirm('Are you sure you want to delete this specific trade?')) return;
  const portfolioId = localStorage.getItem('active_portfolio_id') || 'long_term';
  const role = typeof window.getSessionRole === 'function' ? window.getSessionRole() : 'production';
  try {
    const res = await fetch(\\\`/api/trades/single?ticker=\${encodeURIComponent(ticker)}&date=\${encodeURIComponent(date)}\\\`, {
      method: 'DELETE',
      headers: { 'x-user-role': role, 'x-portfolio-id': portfolioId }
    });
    const data = await res.json();
    if (data.success) {
      window.location.reload();
    } else {
      alert('Error deleting trade');
    }
  } catch (err) {
    console.error(err);
    alert('Error deleting trade');
  }
};

window.editSingleTrade = async function(ticker, date, shares, price, action, comment) {
  const newShares = prompt('Enter new shares:', shares);
  if (newShares === null) return;
  const newPrice = prompt('Enter new price:', price);
  if (newPrice === null) return;
  
  const portfolioId = localStorage.getItem('active_portfolio_id') || 'long_term';
  const role = typeof window.getSessionRole === 'function' ? window.getSessionRole() : 'production';
  try {
    const res = await fetch(\\\`/api/trades/single?ticker=\${encodeURIComponent(ticker)}&date=\${encodeURIComponent(date)}\\\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-user-role': role, 'x-portfolio-id': portfolioId },
      body: JSON.stringify({ shares: parseFloat(newShares), price: parseFloat(newPrice) })
    });
    const data = await res.json();
    if (data.success) {
      window.location.reload();
    } else {
      alert('Error updating trade');
    }
  } catch (err) {
    console.error(err);
    alert('Error updating trade');
  }
};
\`;
  fs.writeFileSync('ledger.js', ledgerJs);
  console.log('ledger.js patched with UI controls');
} else {
  console.log('ledger.js already patched');
}
