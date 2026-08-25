const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of envLocal.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
}

async function main() {
  const fetchUrl = `${url}/rest/v1/`;
  console.log('Fetching schema from:', fetchUrl);
  try {
    const res = await fetch(fetchUrl, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const schema = await res.json();
    console.log('API Swagger schema loaded!');
    
    // Let's find all RPC functions listed in paths
    const rpcs = Object.keys(schema.paths || {}).filter(path => path.startsWith('/rpc/'));
    console.log('Available RPC paths in this Supabase database:');
    console.log(rpcs);
  } catch (err) {
    console.error('Error fetching schema:', err);
  }
}

main();
