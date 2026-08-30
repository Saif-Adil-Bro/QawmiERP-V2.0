const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of envLocal.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/["']/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/["']/g, '').trim();
}

const supabase = createClient(url, key);

async function testExecSql() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `
  });
  if (error) {
    console.error('exec_sql error:', error);
  } else {
    console.log('exec_sql result count:', Array.isArray(data) ? data.length : data);
    if (Array.isArray(data)) {
      const tables = {};
      data.forEach(r => {
        if (!tables[r.table_name]) tables[r.table_name] = [];
        tables[r.table_name].push(`${r.column_name} (${r.data_type})`);
      });
      console.log(JSON.stringify(tables, null, 2));
    }
  }
}

testExecSql();
