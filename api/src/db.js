import { createClient } from '@supabase/supabase-js'

console.log('URL:', process.env.SUPABASE_URL?.slice(0, 30))
console.log('KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20))

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default supabase;
