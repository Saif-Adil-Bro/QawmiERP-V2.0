import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { error } = await supabase.rpc('execute_sql', {
    sql_query: "ALTER TABLE public.hifz_logs ADD COLUMN IF NOT EXISTS daily_tilawat TEXT;"
  });
  console.log(error);
}
run();
