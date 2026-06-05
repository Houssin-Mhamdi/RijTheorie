import { createBrowserClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function makeClient(): SupabaseClient {
  if (typeof document !== "undefined") {
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

export const supabase: SupabaseClient = makeClient()
