import { createClient } from "@supabase/supabase-js";

// Server-side client (used in API routes)
export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}
