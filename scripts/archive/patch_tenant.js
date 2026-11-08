const fs = require('fs');
let code = fs.readFileSync('app/actions/tenant.ts', 'utf8');

if (!code.includes('getMadrasaDetails')) {
  code = code.replace(
    'import { createAdminClient } from "@/lib/supabase/server";',
    'import { createAdminClient, createClient } from "@/lib/supabase/server";\nimport { getAuthMadrasaId } from "./students";'
  );
  
  code += `\n\nexport async function getMadrasaDetails() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return null;
  
  const { data, error } = await supabase
    .from("madrasas")
    .select("*")
    .eq("id", madrasaId)
    .single();
    
  if (error) return null;
  return data;
}`;
  fs.writeFileSync('app/actions/tenant.ts', code);
  console.log('patched tenant.ts');
}
