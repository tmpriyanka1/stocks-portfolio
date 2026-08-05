const fs = require('fs');
const portCss = fs.readFileSync('portfolio.css', 'utf8');
const stylesCss = fs.readFileSync('styles.css', 'utf8');

const lines = portCss.split('\n');
const start = 443;
const end = 571;

const modalCss = lines.slice(start, end + 1).join('\n');
const newPortCss = lines.slice(0, start).join('\n') + '\n' + lines.slice(end + 1).join('\n');

fs.writeFileSync('portfolio.css', newPortCss);
fs.writeFileSync('styles.css', stylesCss + '\n' + modalCss);
console.log("Done");
