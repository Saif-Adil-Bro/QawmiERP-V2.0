const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of envLocal.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
}

async function main() {
  const fetchUrl = `${url}/rest/v1/`;
  const res = await fetch(fetchUrl, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const schema = await res.json();
  
  for (const tableName of ['students', 'classes', 'madrasas', 'users', 'exams', 'attendance', 'fees']) {
    const def = schema.definitions[tableName];
    if (def) {
      console.log(`\nTable ${tableName} properties:`);
      console.log(Object.keys(def.properties || {}));
    }
  }
}

main();
