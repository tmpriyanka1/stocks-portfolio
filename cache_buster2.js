const fs = require('fs');

let html = fs.readFileSync('ledger.html', 'utf8');
html = html.replace(/ledger\.js\?v=\d+/g, 'ledger.js?v=' + Date.now());
fs.writeFileSync('ledger.html', html);

let portHtml = fs.readFileSync('portfolio.html', 'utf8');
portHtml = portHtml.replace(/portfolio\.js\?v=\d+/g, 'portfolio.js?v=' + Date.now());
fs.writeFileSync('portfolio.html', portHtml);
console.log("Done");
