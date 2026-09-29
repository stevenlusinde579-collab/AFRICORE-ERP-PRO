// src/services/supabase.js

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// =====================================================
// VALIDATE ENVIRONMENT VARIABLES
// =====================================================

if (!supabaseUrl) {
  throw new Error(
    "Missing VITE_SUPABASE_URL in .env file"
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_ANON_KEY in .env file"
  );
}

// =====================================================
// SUPABASE CLIENT
// =====================================================

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);