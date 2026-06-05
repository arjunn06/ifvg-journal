/**
 * Security utilities and validation functions
 */

import { logger } from '@/lib/logger';

// Input sanitization patterns
export const SECURITY_PATTERNS = {
  // Prevent XSS attacks
  XSS_DANGEROUS: /<script|javascript:|on\w+\s*=|data:text\/html/i,
  
  // SQL injection patterns (for client-side validation)
  SQL_INJECTION: /('|(\\')|(;)|(\\;)|(--)|(\-\-)|(\/\*)|(\*\/)|(union)|(select)|(insert)|(update)|(delete)|(drop)|(create)|(alter)|(exec)|(execute))/i,
  
  // File upload validation
  ALLOWED_IMAGE_TYPES: /^image\/(jpeg|jpg|png|gif|webp)$/,
  ALLOWED_DOCUMENT_TYPES: /^(application\/pdf|text\/plain|text\/csv)$/,
  
  // Email validation (strict)
  EMAIL: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  
  // Trading symbol validation
  TRADING_SYMBOL: /^[A-Z]{2,10}$/,
  
  // Account name validation
  ACCOUNT_NAME: /^[a-zA-Z0-9\s\-_]{1,100}$/,
  
  // Numeric values
  POSITIVE_NUMBER: /^\d+(\.\d+)?$/,
  CURRENCY_AMOUNT: /^\d{1,10}(\.\d{1,2})?$/,
} as const;

// Security validation functions
export const SecurityValidator = {
  /**
   * Validate and sanitize user input for XSS prevention
   */
  sanitizeInput(input: string, maxLength: number = 1000): string {
    if (!input || typeof input !== 'string') return '';
    
    // Check for dangerous patterns
    if (SECURITY_PATTERNS.XSS_DANGEROUS.test(input)) {
      logger.warn('XSS attempt detected', { input: input.substring(0, 100) });
      throw new Error('Invalid input detected');
    }
    
    // Remove potentially dangerous characters and limit length
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .substring(0, maxLength)
      .trim();
  },

  /**
   * Validate email address
   */
  validateEmail(email: string): boolean {
    return SECURITY_PATTERNS.EMAIL.test(email);
  },

  /**
   * Validate trading symbol
   */
  validateTradingSymbol(symbol: string): boolean {
    return SECURITY_PATTERNS.TRADING_SYMBOL.test(symbol);
  },

  /**
   * Validate account name
   */
  validateAccountName(name: string): boolean {
    return SECURITY_PATTERNS.ACCOUNT_NAME.test(name);
  },

  /**
   * Validate numeric values for trading
   */
  validateNumericValue(value: any, min?: number, max?: number): number {
    const num = parseFloat(value);
    
    if (isNaN(num) || !isFinite(num)) {
      throw new Error('Invalid numeric value');
    }
    
    if (min !== undefined && num < min) {
      throw new Error(`Value must be at least ${min}`);
    }
    
    if (max !== undefined && num > max) {
      throw new Error(`Value must not exceed ${max}`);
    }
    
    return num;
  },

  /**
   * Validate file upload
   */
  validateFileUpload(file: File, allowedTypes: RegExp = SECURITY_PATTERNS.ALLOWED_IMAGE_TYPES): boolean {
    // Check file type
    if (!allowedTypes.test(file.type)) {
      throw new Error('File type not allowed');
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File size too large');
    }
    
    // Check file name for dangerous patterns
    const fileName = file.name.toLowerCase();
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new Error('Invalid file name');
    }
    
    return true;
  },

  /**
   * Validate URL for external links
   */
  validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },

  /**
   * Rate limiting check (client-side)
   */
  checkRateLimit(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now();
    const attempts = JSON.parse(localStorage.getItem(`rate_limit_${key}`) || '[]');
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter((timestamp: number) => now - timestamp < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      return false;
    }
    
    // Add current attempt
    validAttempts.push(now);
    localStorage.setItem(`rate_limit_${key}`, JSON.stringify(validAttempts));
    
    return true;
  }
};

// Content Security Policy helpers
export const CSPHelper = {
  /**
   * Generate nonce for inline scripts
   */
  generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  },

  /**
   * Validate external resource URLs
   */
  isAllowedExternalUrl(url: string): boolean {
    const allowedDomains = [
      'api.openai.com',
      'supabase.co',
      'lovable.dev',
      'razorpay.com',
      'googleapis.com',
      'cloudflare.com'
    ];
    
    try {
      const parsed = new URL(url);
      return allowedDomains.some(domain => 
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }
};

// Session security
export const SessionSecurity = {
  /**
   * Check if session is valid and not expired
   */
  isSessionValid(session: any): boolean {
    if (!session || !session.access_token || !session.expires_at) {
      return false;
    }
    
    const expirationTime = new Date(session.expires_at).getTime();
    const currentTime = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    
    return expirationTime > currentTime + bufferTime;
  },

  /**
   * Secure session storage with encryption
   */
  async storeSecureSession(sessionData: any): Promise<void> {
    // This would integrate with the secure storage utility
    // For now, we rely on Supabase's secure session handling
    logger.debug('Session stored securely');
  },

  /**
   * Clear all session data on logout
   */
  clearSessionData(): void {
    // Clear sensitive data from storage
    const sensitiveKeys = [
      'supabase.auth.token',
      'openai_api_key',
      'ctrader_token',
      'user_preferences'
    ];
    
    sensitiveKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    logger.debug('Session data cleared');
  }
};

// Data exposure prevention
export const DataProtection = {
  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'api_key',
      'access_token', 'refresh_token', 'auth', 'credential'
    ];
    
    const masked = { ...data };
    
    for (const field of sensitiveFields) {
      if (masked[field] && typeof masked[field] === 'string') {
        masked[field] = masked[field].substring(0, 4) + '***';
      }
    }
    
    return masked;
  },

  /**
   * Remove sensitive fields from API responses before client storage
   */
  sanitizeApiResponse(response: any): any {
    if (typeof response !== 'object' || response === null) {
      return response;
    }
    
    const sanitized = { ...response };
    
    // Remove server-only fields
    delete sanitized.access_token;
    delete sanitized.refresh_token;
    delete sanitized.api_key;
    delete sanitized.secret;
    delete sanitized.private_key;
    
    return sanitized;
  }
};

// Export default security configuration
export const SecurityConfig = {
  // File upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES_PER_UPLOAD: 5,
  
  // Rate limiting
  API_RATE_LIMIT: 100, // requests per minute
  LOGIN_RATE_LIMIT: 5, // attempts per 15 minutes
  
  // Session configuration
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
  
  // Content validation
  MAX_TEXT_LENGTH: 10000,
  MAX_NOTES_LENGTH: 50000,
  
  // Trading validation
  MAX_TRADE_AMOUNT: 1000000,
  MIN_TRADE_AMOUNT: 0.01,
  
  // Environment checks
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
} as const;