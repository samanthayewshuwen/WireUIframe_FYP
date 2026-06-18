import { createClient } from '@supabase/supabase-js';

// Retrieve keys from env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase URL or Key in frontend .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);