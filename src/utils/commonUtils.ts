/**
 * Common utility functions and optimizations
 * Replaces duplicate code patterns across components
 */

import { format, parseISO } from 'date-fns';
import { logger } from '@/lib/logger';

/**
 * Currency formatting utilities
 */
export class CurrencyFormatter {
  private static formatters = new Map<string, Intl.NumberFormat>();

  static format(amount: number, currency: string = 'USD'): string {
    if (!this.formatters.has(currency)) {
      this.formatters.set(currency, new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }));
    }
    
    return this.formatters.get(currency)!.format(amount);
  }

  static formatCompact(amount: number, currency: string = 'USD'): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    
    return formatter.format(amount);
  }

  static formatPercentage(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
  }
}

/**
 * Date formatting utilities  
 */
export class DateFormatter {
  static formatShort(date: string | Date): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'MMM dd, yyyy');
  }

  static formatLong(date: string | Date): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'EEEE, MMMM dd, yyyy');
  }

  static formatTime(date: string | Date): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'HH:mm');
  }

  static formatDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'MMM dd, yyyy HH:mm');
  }

  static getRelativeTime(date: string | Date): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    const now = new Date();
    const diffInMs = now.getTime() - d.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  }
}

/**
 * Trade calculation utilities
 */
export class TradeCalculations {
  static calculatePnL(entryPrice: number, exitPrice: number, quantity: number, tradeType: 'long' | 'short'): number {
    if (tradeType === 'long') {
      return (exitPrice - entryPrice) * quantity;
    } else {
      return (entryPrice - exitPrice) * quantity;
    }
  }

  static calculateRiskReward(entryPrice: number, stopLoss: number, takeProfit: number, tradeType: 'long' | 'short'): number {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    
    if (risk === 0) return 0;
    return reward / risk;
  }

  static calculatePositionSize(accountBalance: number, riskPercentage: number, entryPrice: number, stopLoss: number): number {
    const riskAmount = accountBalance * (riskPercentage / 100);
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    
    if (riskPerShare === 0) return 0;
    return riskAmount / riskPerShare;
  }

  static calculateWinRate(trades: any[]): number {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== null);
    if (closedTrades.length === 0) return 0;
    
    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    return (winningTrades.length / closedTrades.length) * 100;
  }

  static calculateProfitFactor(trades: any[]): number {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== null);
    
    const totalWins = closedTrades
      .filter(t => t.pnl > 0)
      .reduce((sum, t) => sum + t.pnl, 0);
      
    const totalLosses = Math.abs(closedTrades
      .filter(t => t.pnl < 0)
      .reduce((sum, t) => sum + t.pnl, 0));
    
    return totalLosses > 0 ? totalWins / totalLosses : 0;
  }

  static calculateExpectancy(trades: any[]): number {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== null);
    if (closedTrades.length === 0) return 0;
    
    const totalPnL = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
    return totalPnL / closedTrades.length;
  }

  static calculateMaxDrawdown(trades: any[], initialBalance: number): { amount: number; percentage: number } {
    const closedTrades = trades
      .filter(t => t.status === 'closed' && t.pnl !== null)
      .sort((a, b) => new Date(a.exit_date || a.entry_date).getTime() - new Date(b.exit_date || b.entry_date).getTime());
    
    let peak = initialBalance;
    let maxDrawdownAmount = 0;
    let balance = initialBalance;
    
    closedTrades.forEach(trade => {
      balance += trade.pnl;
      if (balance > peak) {
        peak = balance;
      }
      const drawdown = peak - balance;
      if (drawdown > maxDrawdownAmount) {
        maxDrawdownAmount = drawdown;
      }
    });
    
    const maxDrawdownPercentage = peak > 0 ? (maxDrawdownAmount / peak) * 100 : 0;
    
    return {
      amount: maxDrawdownAmount,
      percentage: maxDrawdownPercentage
    };
  }
}

/**
 * Form validation utilities
 */
export class FormValidation {
  static validateRequired(value: any, fieldName: string): string | null {
    if (value === null || value === undefined || value === '') {
      return `${fieldName} is required`;
    }
    return null;
  }

  static validateNumeric(value: any, fieldName: string, min?: number, max?: number): string | null {
    const num = parseFloat(value);
    
    if (isNaN(num)) {
      return `${fieldName} must be a valid number`;
    }
    
    if (min !== undefined && num < min) {
      return `${fieldName} must be at least ${min}`;
    }
    
    if (max !== undefined && num > max) {
      return `${fieldName} must not exceed ${max}`;
    }
    
    return null;
  }

  static validatePositive(value: any, fieldName: string): string | null {
    const num = parseFloat(value);
    
    if (isNaN(num) || num <= 0) {
      return `${fieldName} must be a positive number`;
    }
    
    return null;
  }

  static validateSymbol(symbol: string): string | null {
    if (!symbol || symbol.length < 2 || symbol.length > 10) {
      return 'Symbol must be between 2 and 10 characters';
    }
    
    if (!/^[A-Z0-9]+$/.test(symbol.toUpperCase())) {
      return 'Symbol can only contain letters and numbers';
    }
    
    return null;
  }

  static validateEmail(email: string): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    
    return null;
  }
}

/**
 * Loading state management
 */
export class LoadingState {
  private static states = new Map<string, boolean>();

  static setLoading(key: string, loading: boolean): void {
    this.states.set(key, loading);
  }

  static isLoading(key: string): boolean {
    return this.states.get(key) || false;
  }

  static clear(key: string): void {
    this.states.delete(key);
  }

  static clearAll(): void {
    this.states.clear();
  }
}

/**
 * Error handling utilities
 */
export class ErrorHandler {
  static handleApiError(error: any, context: string): string {
    logger.apiError(context, error);
    
    // Extract user-friendly error message
    if (error?.message) {
      return error.message;
    }
    
    if (error?.error?.message) {
      return error.error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    return 'An unexpected error occurred. Please try again.';
  }

  static handleFormError(error: any): Record<string, string> {
    const fieldErrors: Record<string, string> = {};
    
    if (error?.details && Array.isArray(error.details)) {
      error.details.forEach((detail: any) => {
        if (detail.field && detail.message) {
          fieldErrors[detail.field] = detail.message;
        }
      });
    }
    
    return fieldErrors;
  }
}

/**
 * Data transformation utilities
 */
export class DataTransform {
  static groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  static sortBy<T>(array: T[], keyFn: (item: T) => any, ascending: boolean = true): T[] {
    return [...array].sort((a, b) => {
      const aVal = keyFn(a);
      const bVal = keyFn(b);
      
      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });
  }

  static filterBy<T>(array: T[], filters: Record<string, any>): T[] {
    return array.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          return true; // Skip empty filters
        }
        
        const itemValue = (item as any)[key];
        
        if (Array.isArray(value)) {
          return value.includes(itemValue);
        }
        
        return itemValue === value;
      });
    });
  }

  static paginate<T>(array: T[], page: number, pageSize: number): { items: T[]; totalPages: number; hasNext: boolean; hasPrev: boolean } {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = array.slice(startIndex, endIndex);
    const totalPages = Math.ceil(array.length / pageSize);
    
    return {
      items,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }
}

// Export all utilities as a default object for easy importing
export default {
  CurrencyFormatter,
  DateFormatter,
  TradeCalculations,
  FormValidation,
  LoadingState,
  ErrorHandler,
  DataTransform
};