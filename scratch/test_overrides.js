const http = require('http');

const request = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTests() {
  console.log('--- Integration Testing Portfolio Overrides API ---');

  // 1. Post overrides
  const postRes = await request('POST', '/api/overrides', {
    buyingPowerOverride: 12345.67,
    portfolioValueOverride: '987654.32'
  });
  console.log('POST /api/overrides response:', postRes);
  if (postRes.statusCode !== 200) throw new Error('POST overrides failed');

  // 2. Get overrides to check persistence
  const getOverRes = await request('GET', '/api/overrides');
  console.log('GET /api/overrides response:', getOverRes);
  if (getOverRes.body.buyingPowerOverride !== 12345.67) throw new Error('buyingPowerOverride mismatch');
  if (getOverRes.body.portfolioValueOverride !== '987654.32') throw new Error('portfolioValueOverride mismatch');

  // 3. Get portfolio summary to check override application
  const summaryRes = await request('GET', '/api/portfolio-summary');
  console.log('GET /api/portfolio-summary response:', summaryRes);
  if (summaryRes.body.buyingPower !== 12345.67) throw new Error('buyingPower summary mismatch');
  if (summaryRes.body.totalAccountValue !== 987654.32) throw new Error('totalAccountValue summary mismatch');

  // 4. Test clearing overrides
  const clearRes = await request('POST', '/api/overrides', {
    buyingPowerOverride: null,
    portfolioValueOverride: ''
  });
  console.log('POST clear overrides response:', clearRes);

  const summaryClearRes = await request('GET', '/api/portfolio-summary');
  console.log('GET /api/portfolio-summary (cleared) response:', summaryClearRes);
  if (summaryClearRes.body.buyingPower === 12345.67) throw new Error('buyingPower summary should have defaulted back to live math');
  if (summaryClearRes.body.totalAccountValue === 987654.32) throw new Error('totalAccountValue summary should have defaulted back to live math');

  console.log('--- ALL OVERRIDES API INTEGRATION TESTS PASSED SUCCESSFULY ---');
}

runTests().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
