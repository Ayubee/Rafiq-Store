const fs = require('fs');

async function run() {
  const macrosRes = await fetch('http://localhost:3001/api/macros');
  const macros = await macrosRes.json();

  const catsRes = await fetch('http://localhost:3001/api/categories');
  const categories = await catsRes.json();

  fs.writeFileSync('data/seed.json', JSON.stringify({ categories, macros }, null, 2), 'utf8');
  console.log('Seed exported:', macros.length, 'macros');
}
run();
