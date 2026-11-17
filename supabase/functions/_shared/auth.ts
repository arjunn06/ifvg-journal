import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Caller checks for the email functions that browsers (or other backends) invoke.
 *
 * The gateway's verify_jwt only proves the token is *some* valid Supabase JWT, and
 * the public anon key shipped in the web bundle is one. These helpers require a
 * real signed-in user (or the service-role key, for server-to-server calls) and
 * then scope what that caller may send.
 */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Caller =
  | { kind: "service" }
  | { kind: "user"; id: string; email: string; isAdmin: boolean };

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Resolves who is calling, or throws 401. The anon key alone is rejected. */
export async function authenticate(req: Request): Promise<Caller> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Authentication required");

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (safeEqual(token, serviceKey)) return { kind: "service" };

  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await anon.auth.getUser(token);
  const user = data?.user;
  if (error || !user?.email) throw new HttpError(401, "Sign in required");

  // Service client so the role lookup is not subject to RLS.
  const admin = createClient(url, serviceKey);
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return { kind: "user", id: user.id, email: user.email, isAdmin: profile?.role === "admin" };
}

const isPrivileged = (c: Caller) => c.kind === "service" || c.isAdmin;

/** Admins (and the service role) only. */
export function requireAdmin(caller: Caller) {
  if (!isPrivileged(caller)) throw new HttpError(403, "Admin access required");
}

/** Ordinary users may only email themselves; admins and the service role may email anyone. */
export function assertCanEmail(caller: Caller, recipient: string) {
  if (isPrivileged(caller)) return;
  if (caller.kind === "user" && recipient.trim().toLowerCase() === caller.email.toLowerCase()) return;
  throw new HttpError(403, "You can only send this email to your own address");
}
