const fs = require('fs');

let html = fs.readFileSync('ledger.html', 'utf8');
html = html.replace(/styles\.css\?v=\d+/g, 'styles.css?v=' + Date.now());
fs.writeFileSync('ledger.html', html);

let portHtml = fs.readFileSync('portfolio.html', 'utf8');
portHtml = portHtml.replace(/styles\.css\?v=\d+/g, 'styles.css?v=' + Date.now());
fs.writeFileSync('portfolio.html', portHtml);
console.log("Done");
