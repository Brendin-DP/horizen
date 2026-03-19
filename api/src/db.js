import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    '[db] Missing Supabase config. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in api/.env'
  );
}

const supabase = createClient(url || '', key || '');

export default supabase;
