const fs = require('fs');
let js = fs.readFileSync('ledger.js', 'utf8');

js = js.replace(/window\.editSingleTrade = async function\(ticker, date, shares, price\) {[\s\S]*?};\s*/, '');

const newLogic = `
window.editSingleTrade = function(ticker, date, shares, price, comment) {
  const modal = document.getElementById('editSingleTradeModal');
  if (!modal) return;
  
  document.getElementById('editSingleTradeModalTitle').textContent = 'Edit Trade — ' + ticker;
  document.getElementById('editTradeSharesInput').value = shares || '';
  document.getElementById('editTradePriceInput').value = price || '';
  document.getElementById('editTradeDateInput').value = date ? date.split('T')[0] : '';
  document.getElementById('editTradeCommentInput').value = comment || '';
  
  modal.setAttribute('data-ticker', ticker);
  modal.setAttribute('data-old-date', date);
  
  modal.style.display = 'flex';
};

document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('closeEditSingleTradeModalBtn');
  const submitBtn = document.getElementById('submitEditSingleTradeBtn');
  const modal = document.getElementById('editSingleTradeModal');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const ticker = modal.getAttribute('data-ticker');
      const oldDate = modal.getAttribute('data-old-date');
      
      const shares = document.getElementById('editTradeSharesInput').value;
      const price = document.getElementById('editTradePriceInput').value;
      const newDate = document.getElementById('editTradeDateInput').value;
      const comment = document.getElementById('editTradeCommentInput').value;
      
      if (!shares || !price) {
        alert('Shares and price are required.');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
      
      const portfolioId = localStorage.getItem('active_portfolio_id') || 'long_term';
      const role = typeof window.getSessionRole === 'function' ? window.getSessionRole() : 'production';
      
      try {
        const payload = { shares: parseFloat(shares), price: parseFloat(price) };
        if (comment) payload.comment = comment;
        if (newDate) {
           // We keep the time part from oldDate if it exists
           const oldTime = oldDate.includes('T') ? oldDate.split('T')[1] : '00:00:00.000Z';
           payload.newDate = newDate + 'T' + oldTime;
        }
        
        const res = await fetch(\`/api/trades/single?ticker=\${encodeURIComponent(ticker)}&date=\${encodeURIComponent(oldDate)}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-role': role, 'x-portfolio-id': portfolioId },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          alert('Error updating trade: ' + (data.error || 'Unknown error'));
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
        }
      } catch (err) {
        console.error(err);
        alert('Error updating trade');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    });
  }
});
`;

fs.writeFileSync('ledger.js', js + newLogic);
console.log("Done");
