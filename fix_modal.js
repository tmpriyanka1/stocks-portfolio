const fs = require('fs');

let js = fs.readFileSync('ledger.js', 'utf8');
js = js.replace(/modal\.style\.display = 'flex';/g, "modal.classList.add('active');");
js = js.replace(/modal\.style\.display = 'none';/g, "modal.classList.remove('active');");
fs.writeFileSync('ledger.js', js);

let html = fs.readFileSync('ledger.html', 'utf8');
html = html.replace(/<div class="import-modal-overlay" id="editSingleTradeModal" style="display: none;">/, '<div class="import-modal-overlay" id="editSingleTradeModal">');
fs.writeFileSync('ledger.html', html);
console.log("Done");
