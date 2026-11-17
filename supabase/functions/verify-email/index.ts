// supabase/functions/fetch-accounts/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.3";

serve(async (req) => {
  try {
    // Get env variables
    // Both are provided to Edge Functions by the Supabase runtime; never put key values in source.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured: missing environment variables" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Parse request body
    const body = await req.json();
    const email = body.email;

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing email in request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Query accounts for given email
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("email", email); // change this to .eq("user_id", ...) if your schema uses user_id

    if (error) {
      return new Response(JSON.stringify({ error: "Error fetching accounts", details: error }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ accounts: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Unexpected error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
