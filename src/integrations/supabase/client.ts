// This file uses the Lovable Cloud Supabase project.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// NOTE: Schema migrations haven't been applied yet, so the generated types.ts
// has an empty Tables map (causing TS2769 "never" errors everywhere).
// Until migrations run and types regenerate, we type the client as `any`
// so app code can compile against the eventual schema.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
}) as unknown as SupabaseClient<any, 'public', any>;
