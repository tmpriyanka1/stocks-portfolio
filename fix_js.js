const fs = require('fs');
let js = fs.readFileSync('ledger.js', 'utf8');

js = js.replace(/document\.addEventListener\('DOMContentLoaded', \(\) => \{/, '(() => {');
js = js.replace(/const data = await res\.json\(\);\n        if \(data\.success\) \{\n          window\.location\.reload\(\);\n        \} else \{/g, `const data = await res.json();
        if (data.success) {
          modal.classList.remove('active');
          window.location.reload();
        } else {`);

fs.writeFileSync('ledger.js', js);
console.log("Done");
