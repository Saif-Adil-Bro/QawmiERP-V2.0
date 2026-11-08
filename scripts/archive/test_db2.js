const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: userDetails } = await supabase.from('users').select('madrasa_id').limit(1).single();
  const { data: fullMadrasa, error } = await supabase.from('madrasas').select('name, address, contact_phone').eq('id', userDetails.madrasa_id).single();
  console.log(fullMadrasa);
}
test();
