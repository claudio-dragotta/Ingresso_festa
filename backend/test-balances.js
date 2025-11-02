// Script di test per verificare l'endpoint /api/expenses/balances
// Esegui con: node test-balances.js

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8000,
  path: '/api/expenses/balances',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // Aggiungi qui il token JWT se hai bisogno di autenticarti
    // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\nResponse Body:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Errore:', error.message);
  console.log('\n⚠️ Il server backend potrebbe non essere avviato!');
  console.log('Avvialo con: npm run dev (nella cartella backend)');
});

req.end();

console.log('Testando endpoint: http://localhost:8000/api/expenses/balances\n');
