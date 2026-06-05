/**
 * Production-safe logging utility
 * Only logs in development environment or when explicitly enabled
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    // Only log in development or for errors
    if (this.isDevelopment || level === 'error') {
      const logMethod = console[level] || console.log;
      if (data !== undefined) {
        logMethod(`[${level.toUpperCase()}] ${message}`, data);
      } else {
        logMethod(`[${level.toUpperCase()}] ${message}`);
      }
    }

    // In production, errors could be sent to a logging service
    if (level === 'error' && !this.isDevelopment) {
      // TODO: Send to error monitoring service (e.g., Sentry)
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  // Utility for API errors
  apiError(context: string, error: any) {
    this.error(`API Error in ${context}`, {
      message: error?.message,
      status: error?.status,
      ...(this.isDevelopment && { stack: error?.stack })
    });
  }

  // Utility for user actions (only in development)
  userAction(action: string, data?: any) {
    if (this.isDevelopment) {
      this.debug(`User Action: ${action}`, data);
    }
  }
}

export const logger = new Logger();