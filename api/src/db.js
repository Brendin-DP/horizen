import { createClient } from '@supabase/supabase-js';

// Use service_role for backend API — bypasses RLS, full DB access.
// The API handles auth at the route level (JWT, bcryptjs).

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY

);

console.log('URL:', process.env.SUPABASE_URL?.slice(0, 30))
console.log('KEY:', process.env.SUPABASE_ANON_KEY?.slice(0, 20))

export default supabase
