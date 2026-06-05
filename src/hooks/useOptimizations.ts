/**
 * Performance optimization utilities for React components
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

/**
 * Optimized hooks for expensive calculations
 */

// Debounced state hook for search inputs
export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Memoized calculation hook for trading metrics
export function useTradeMetrics(trades: any[]) {
  return useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        expectancy: 0,
        maxDrawdown: 0,
        activeTrades: 0
      };
    }

    const closedTrades = trades.filter(trade => trade.status === 'closed' && trade.pnl !== null);
    const activeTrades = trades.filter(trade => trade.status === 'open').length;
    
    const wins = closedTrades.filter(trade => trade.pnl > 0);
    const losses = closedTrades.filter(trade => trade.pnl < 0);
    
    const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    
    const averageWin = wins.length > 0 ? wins.reduce((sum, trade) => sum + trade.pnl, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0) / losses.length) : 0;
    
    const profitFactor = averageLoss > 0 ? averageWin / averageLoss : 0;
    const expectancy = closedTrades.length > 0 ? totalPnL / closedTrades.length : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let runningPnL = 0;
    
    closedTrades.forEach(trade => {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = peak - runningPnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return {
      totalTrades: closedTrades.length,
      winRate,
      totalPnL,
      averageWin,
      averageLoss,
      profitFactor,
      expectancy,
      maxDrawdown,
      activeTrades
    };
  }, [trades]);
}

// Memoized account performance calculations
export function useAccountMetrics(accounts: any[], trades: any[], transactions: any[]) {
  return useMemo(() => {
    return accounts.map(account => {
      const accountTrades = trades.filter(trade => trade.trading_account_id === account.id);
      const accountTransactions = transactions.filter(tx => tx.trading_account_id === account.id);
      
      const totalPnL = accountTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      const totalDeposits = accountTransactions
        .filter(tx => tx.transaction_type === 'deposit')
        .reduce((sum, tx) => sum + tx.amount, 0);
      const totalWithdrawals = accountTransactions
        .filter(tx => tx.transaction_type === 'withdrawal')
        .reduce((sum, tx) => sum + tx.amount, 0);
      
      const netDeposits = totalDeposits - totalWithdrawals;
      const equity = account.initial_balance + netDeposits + totalPnL;
      const returnPercentage = netDeposits > 0 ? (totalPnL / netDeposits) * 100 : 0;

      return {
        ...account,
        totalPnL,
        totalDeposits,
        totalWithdrawals,
        netDeposits,
        equity,
        returnPercentage,
        tradeCount: accountTrades.length
      };
    });
  }, [accounts, trades, transactions]);
}

// Optimized callback for frequent operations
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string, dependencies: any[]) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    
    if (renderCount.current > 1 && timeSinceLastRender < 16) { // Less than 60fps
      logger.warn(`Performance issue in ${componentName}`, {
        renderCount: renderCount.current,
        timeSinceLastRender,
        dependencies: dependencies.length
      });
    }
    
    lastRenderTime.current = now;
  });

  useEffect(() => {
    logger.debug(`${componentName} re-rendered`, {
      renderCount: renderCount.current,
      dependencyCount: dependencies.length
    });
  }, dependencies);
}

// Virtual scrolling hook for large lists
export function useVirtualScrolling(
  items: any[],
  itemHeight: number,
  containerHeight: number
) {
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);

  const visibleItems = useMemo(() => {
    const start = Math.max(0, startIndex - 5); // Buffer items
    const end = Math.min(items.length, endIndex + 5);
    return items.slice(start, end);
  }, [items, startIndex, endIndex]);

  const onScroll = useCallback((scrollTop: number) => {
    const newStartIndex = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const newEndIndex = newStartIndex + visibleCount;

    setStartIndex(newStartIndex);
    setEndIndex(newEndIndex);
  }, [itemHeight, containerHeight]);

  return {
    visibleItems,
    onScroll,
    totalHeight: items.length * itemHeight,
    offsetY: startIndex * itemHeight
  };
}

// Memoized currency formatter
export const useCurrencyFormatter = (currency: string = 'USD') => {
  return useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [currency]);
};

// Memoized date formatter
export const useDateFormatter = () => {
  return useMemo(() => {
    return {
      short: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      long: new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }, []);
};

export default {
  useDebounced,
  useTradeMetrics,
  useAccountMetrics,
  useOptimizedCallback,
  usePerformanceMonitor,
  useVirtualScrolling,
  useCurrencyFormatter,
  useDateFormatter
};