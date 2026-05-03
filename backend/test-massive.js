const axios = require('axios');

async function testLimits() {
  const apiKey = '3E_ChYscBI3bdbNLC9L770KtELG44wFD';
  const tickers = ['SPY', 'GLD', 'USO', 'X:BTCUSD', 'UUP'];
  for (const t of tickers) {
    try {
      const start = Date.now();
      const res = await axios.get(`https://api.massive.com/v2/aggs/ticker/${t}/prev?adjusted=true&apiKey=${apiKey}`);
      const data = res.data.results?.[0];
      const delta = Date.now() - start;
      if (data) {
        const changePct = ((data.c - data.o) / data.o) * 100;
        console.log(`[${delta}ms] ${t}: Close=${data.c}, Change=${changePct.toFixed(2)}%`);
      } else {
        console.log(`[${delta}ms] ${t}: No data`);
      }
    } catch (e) {
      console.error(`[ERROR] ${t}: ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
    }
  }
}
testLimits();
