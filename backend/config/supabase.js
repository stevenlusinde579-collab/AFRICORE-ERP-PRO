// backend/config/supabase.js

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
    throw new Error(
        "SUPABASE_URL is missing from backend/.env"
    );
}

if (!supabaseServiceKey) {
    throw new Error(
        "SUPABASE_SERVICE_KEY is missing from backend/.env"
    );
}

export const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey
);