import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://xhhcvpvemwsmmtjhbswa.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_9Q5O_7Gi3KIH-G3GYylzWg_PNPi6jf-'

window.NauxicaSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
