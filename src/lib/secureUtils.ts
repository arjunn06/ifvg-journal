import DOMPurify from 'dompurify';

/**
 * Security utilities for input sanitization and validation
 */

// HTML sanitization using DOMPurify
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
}

// Sanitize user notes and descriptions
export function sanitizeUserContent(content: string): string {
  if (!content || typeof content !== 'string') return '';
  
  // Remove potentially dangerous content
  const cleaned = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
  
  // Additional length check
  return cleaned.substring(0, 10000);
}

// Rate limiting helper (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, maxRequests: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (entry.count >= maxRequests) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Secure random token generation
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Input validation patterns
export const ValidationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  accountName: /^[a-zA-Z0-9\s\-_]{1,100}$/,
  symbol: /^[A-Z]{2,10}$/,
  numeric: /^-?\d+(\.\d+)?$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
};

// Safe object property access
export function safeGetProperty(obj: any, path: string, defaultValue: any = null): any {
  try {
    return path.split('.').reduce((current, prop) => {
      return current && typeof current === 'object' ? current[prop] : defaultValue;
    }, obj);
  } catch {
    return defaultValue;
  }
}

// Sanitize file upload names
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}