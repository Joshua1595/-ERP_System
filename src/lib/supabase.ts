import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const isHttpUrl = /^https?:\/\//i.test(supabaseUrl);

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("⚠️ Supabase environment variables are missing! Authentication will run in resilient local/mock mode.");
} else if (!isHttpUrl) {
  console.warn(`⚠️ Supabase URL is not a valid HTTP/HTTPS URL (it might be a Postgres connection string: "${supabaseUrl}"). Falling back to resilient local/mock mode.`);
}

export const supabaseAdmin = (supabaseUrl && supabaseServiceKey && isHttpUrl)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

