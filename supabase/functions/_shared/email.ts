import { Resend } from "npm:resend@4.0.0";

/**
 * Single place for Resend configuration. Every email function imports from here.
 *
 * Required secret : RESEND_API_KEY   (supabase secrets set RESEND_API_KEY=re_...)
 * Optional secrets: SITE_URL         public URL of the web app, used for links in emails
 *                   EMAIL_DOMAIN     domain verified in Resend; every sender must be on it
 *
 * See docs/email-setup.md for the full checklist.
 */

/** Public URL of the web app, without a trailing slash. */
export const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://journal.ifvg.in").replace(/\/+$/, "");

/** Domain verified in the Resend dashboard (SPF + DKIM). */
export const EMAIL_DOMAIN = (Deno.env.get("EMAIL_DOMAIN") ?? "ifvg.in").toLowerCase();

const sender = (name: string, localPart: string) => `${name} <${localPart}@${EMAIL_DOMAIN}>`;

export const SENDERS = {
  noreply: sender("IFVG Journal", "noreply"),
  welcome: sender("IFVG Journal", "welcome"),
  security: sender("IFVG Journal Security", "security"),
  billing: sender("IFVG Journal", "billing"),
  notifications: sender("IFVG Journal", "notifications"),
} as const;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SENDER_ADDRESS = new RegExp(`^[a-z0-9._%+-]+@${escapeRegExp(EMAIL_DOMAIN)}$`);

/** Throws unless the address part of `from` ("Name <a@b.c>" or "a@b.c") is on EMAIL_DOMAIN. */
function assertSenderOnDomain(from: string) {
  const address = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  if (!SENDER_ADDRESS.test(address)) {
    throw new Error(`Sender "${address}" is not an address on the verified domain ${EMAIL_DOMAIN}`);
  }
}

let client: Resend | undefined;

// Created lazily so a missing key surfaces as a clear error on the request,
// not as a boot failure of the whole function.
function resend(): Resend {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set. Run: supabase secrets set RESEND_API_KEY=<key>");
  }
  return (client ??= new Resend(apiKey));
}

export interface SendEmailInput {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text alternative. Derived from `html` when omitted. */
  text?: string;
}

/**
 * Minimal HTML -> plain text, so every message ships a text/plain part.
 * HTML-only mail is a spam signal. Links become "label (url)".
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(head|style|script|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi, "") // inbox-preview padding
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      return !text || text === href ? href : `${text} (${href})`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|li|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&zwnj;|[​‌ ]/gi, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Sends one email through Resend and returns `{ id }`.
 *
 * The Resend SDK reports API failures (unverified domain, bad key, rate limit)
 * as a returned `{ error }` instead of throwing. This throws so callers
 * answer with a non-2xx instead of reporting success for an email that never left.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  assertSenderOnDomain(input.from);
  const { data, error } = await resend().emails.send({
    from: input.from,
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text ?? htmlToText(input.html),
  });
  if (error || !data) {
    throw new Error(`Resend rejected the email: ${error?.name ?? "unknown_error"}: ${error?.message ?? "no data returned"}`);
  }
  return data;
}
