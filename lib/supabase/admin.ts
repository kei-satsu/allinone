import { createClient } from '@supabase/supabase-js'

// ⚠️ Server Actions သို့မဟုတ် Server Components များတွင်သာ Import လုပ်သုံးရပါမည်
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)