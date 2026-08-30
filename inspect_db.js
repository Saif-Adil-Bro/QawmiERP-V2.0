const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key && key.trim()) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectTables() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `
  });
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Tables & Columns:");
  const tables = {};
  data.forEach(row => {
    if (!tables[row.table_name]) tables[row.table_name] = [];
    tables[row.table_name].push(`${row.column_name} (${row.data_type})`);
  });
  console.log(JSON.stringify(tables, null, 2));
}

inspectTables();
