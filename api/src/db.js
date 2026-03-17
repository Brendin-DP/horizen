const { createClient } = require('@supabase/supabase-js');

// Use service_role for backend API — bypasses RLS, full DB access.
// The API handles auth at the route level (JWT, bcrypt).
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

module.exports = { supabase };
