import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, AlertTriangle, Calendar, Target, BarChart3, Sparkles, Star } from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  trade_type: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  status: string;
  pnl?: number;
  entry_date: string;
  exit_date?: string;
  trading_account_id: string;
  stop_loss?: number;
  take_profit?: number;
}

interface SmartSuggestionsProps {
  trades: Trade[];
}

interface Suggestion {
  type: 'positive' | 'warning' | 'insight';
  title: string;
  description: string;
  icon: React.ReactNode;
  priority: 'high' | 'medium' | 'low';
}

export function SmartSuggestions({ trades }: SmartSuggestionsProps) {
  const generateSuggestions = (): Suggestion[] => {
    const suggestions: Suggestion[] = [];
    const closedTrades = trades.filter(t => t.status === 'closed');
    
    if (closedTrades.length < 5) {
      suggestions.push({
        type: 'insight',
        title: 'Build Your Trading History',
        description: 'Complete more trades to get personalized insights and performance patterns.',
        icon: <BarChart3 className="h-4 w-4" />,
        priority: 'medium'
      });
      return suggestions;
    }

    // Analyze day of week performance
    const dayPerformance = analyzeDayPerformance(closedTrades);
    if (dayPerformance.bestDay) {
      suggestions.push({
        type: 'positive',
        title: `Best Trading Day: ${dayPerformance.bestDay.day}`,
        description: `You perform ${dayPerformance.bestDay.winRate.toFixed(1)}% better on ${dayPerformance.bestDay.day}s. Consider focusing your trading on this day.`,
        icon: <Calendar className="h-4 w-4" />,
        priority: 'high'
      });
    }

    if (dayPerformance.worstDay) {
      suggestions.push({
        type: 'warning',
        title: `Avoid Trading on ${dayPerformance.worstDay.day}s`,
        description: `Your win rate drops to ${dayPerformance.worstDay.winRate.toFixed(1)}% on ${dayPerformance.worstDay.day}s. Consider taking a break or reducing position sizes.`,
        icon: <AlertTriangle className="h-4 w-4" />,
        priority: 'high'
      });
    }

    // Analyze losing streaks
    const losingStreaks = analyzeLosingStreaks(closedTrades);
    if (losingStreaks.maxStreak > 3) {
      suggestions.push({
        type: 'warning',
        title: 'Manage Losing Streaks',
        description: `You've had ${losingStreaks.maxStreak} consecutive losses. Consider taking a break after 2-3 losses to avoid emotional trading.`,
        icon: <AlertTriangle className="h-4 w-4" />,
        priority: 'high'
      });
    }

    // Analyze position sizing patterns
    const positionSizing = analyzePositionSizing(closedTrades);
    if (positionSizing.largeLossRisk) {
      suggestions.push({
        type: 'warning',
        title: 'Large Position Risk',
        description: 'Your biggest losses come from oversized positions. Consider reducing position sizes for better risk management.',
        icon: <Target className="h-4 w-4" />,
        priority: 'high'
      });
    }

    // Analyze asset performance
    const assetPerformance = analyzeAssetPerformance(closedTrades);
    if (assetPerformance.bestAsset) {
      suggestions.push({
        type: 'positive',
        title: `Focus on ${assetPerformance.bestAsset.symbol}`,
        description: `Your best performing asset with ${assetPerformance.bestAsset.winRate.toFixed(1)}% win rate. Consider specializing in this market.`,
        icon: <TrendingUp className="h-4 w-4" />,
        priority: 'medium'
      });
    }

    if (assetPerformance.worstAsset) {
      suggestions.push({
        type: 'warning',
        title: `Reconsider Trading ${assetPerformance.worstAsset.symbol}`,
        description: `Low performance with ${assetPerformance.worstAsset.winRate.toFixed(1)}% win rate. Review your strategy for this asset.`,
        icon: <AlertTriangle className="h-4 w-4" />,
        priority: 'medium'
      });
    }

    // Analyze trade timing
    const timingAnalysis = analyzeTradeHours(closedTrades);
    if (timingAnalysis.bestHour) {
      suggestions.push({
        type: 'insight',
        title: `Optimal Trading Time: ${timingAnalysis.bestHour}:00`,
        description: `Your trades at ${timingAnalysis.bestHour}:00 hour show higher success rates. Consider timing your entries accordingly.`,
        icon: <Calendar className="h-4 w-4" />,
        priority: 'medium'
      });
    }

    // Risk-reward analysis
    const rrAnalysis = analyzeRiskReward(closedTrades);
    if (rrAnalysis.needsImprovement) {
      suggestions.push({
        type: 'warning',
        title: 'Improve Risk-Reward Ratio',
        description: `Average R:R ratio is ${rrAnalysis.avgRR.toFixed(2)}. Aim for 1:2 or better to improve long-term profitability.`,
        icon: <Target className="h-4 w-4" />,
        priority: 'high'
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  const analyzeDayPerformance = (trades: Trade[]) => {
    const dayStats: Record<string, { wins: number; total: number; pnl: number }> = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    trades.forEach(trade => {
      const day = days[new Date(trade.entry_date).getDay()];
      if (!dayStats[day]) dayStats[day] = { wins: 0, total: 0, pnl: 0 };
      
      dayStats[day].total++;
      dayStats[day].pnl += trade.pnl || 0;
      if ((trade.pnl || 0) > 0) dayStats[day].wins++;
    });

    const dayPerformances = Object.entries(dayStats)
      .filter(([_, stats]) => stats.total >= 3)
      .map(([day, stats]) => ({
        day,
        winRate: (stats.wins / stats.total) * 100,
        pnl: stats.pnl,
        total: stats.total
      }));

    return {
      bestDay: dayPerformances.length > 0 ? dayPerformances.reduce((a, b) => a.winRate > b.winRate ? a : b) : null,
      worstDay: dayPerformances.length > 0 ? dayPerformances.reduce((a, b) => a.winRate < b.winRate ? a : b) : null
    };
  };

  const analyzeLosingStreaks = (trades: Trade[]) => {
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.exit_date || a.entry_date).getTime() - new Date(b.exit_date || b.entry_date).getTime()
    );
    
    let currentStreak = 0;
    let maxStreak = 0;
    
    sortedTrades.forEach(trade => {
      if ((trade.pnl || 0) < 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    return { maxStreak, currentStreak };
  };

  const analyzePositionSizing = (trades: Trade[]) => {
    const losses = trades.filter(t => (t.pnl || 0) < 0);
    if (losses.length === 0) return { largeLossRisk: false };
    
    const avgLoss = losses.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / losses.length;
    const biggestLoss = Math.max(...losses.map(t => Math.abs(t.pnl || 0)));
    
    return { largeLossRisk: biggestLoss > avgLoss * 2 };
  };

  const analyzeAssetPerformance = (trades: Trade[]) => {
    const assetStats: Record<string, { wins: number; total: number; pnl: number }> = {};
    
    trades.forEach(trade => {
      if (!assetStats[trade.symbol]) assetStats[trade.symbol] = { wins: 0, total: 0, pnl: 0 };
      
      assetStats[trade.symbol].total++;
      assetStats[trade.symbol].pnl += trade.pnl || 0;
      if ((trade.pnl || 0) > 0) assetStats[trade.symbol].wins++;
    });

    const assetPerformances = Object.entries(assetStats)
      .filter(([_, stats]) => stats.total >= 3)
      .map(([symbol, stats]) => ({
        symbol,
        winRate: (stats.wins / stats.total) * 100,
        pnl: stats.pnl,
        total: stats.total
      }));

    return {
      bestAsset: assetPerformances.length > 0 ? assetPerformances.reduce((a, b) => a.pnl > b.pnl ? a : b) : null,
      worstAsset: assetPerformances.length > 0 ? assetPerformances.reduce((a, b) => a.pnl < b.pnl ? a : b) : null
    };
  };

  const analyzeTradeHours = (trades: Trade[]) => {
    const hourStats: Record<number, { wins: number; total: number }> = {};
    
    trades.forEach(trade => {
      const hour = new Date(trade.entry_date).getHours();
      if (!hourStats[hour]) hourStats[hour] = { wins: 0, total: 0 };
      
      hourStats[hour].total++;
      if ((trade.pnl || 0) > 0) hourStats[hour].wins++;
    });

    const hourPerformances = Object.entries(hourStats)
      .filter(([_, stats]) => stats.total >= 2)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        winRate: (stats.wins / stats.total) * 100,
        total: stats.total
      }));

    return {
      bestHour: hourPerformances.length > 0 ? hourPerformances.reduce((a, b) => a.winRate > b.winRate ? a : b).hour : null
    };
  };

  const analyzeRiskReward = (trades: Trade[]) => {
    const tradesWithRR = trades.filter(t => t.entry_price && t.exit_price);
    if (tradesWithRR.length === 0) return { needsImprovement: false, avgRR: 0 };
    
    const rrRatios = tradesWithRR.map(trade => {
      const risk = Math.abs(trade.entry_price - (trade.stop_loss || 0));
      const reward = Math.abs((trade.exit_price || 0) - trade.entry_price);
      return risk > 0 ? reward / risk : 0;
    }).filter(rr => rr > 0);

    const avgRR = rrRatios.length > 0 ? rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length : 0;
    
    return { needsImprovement: avgRR < 1.5, avgRR };
  };

  const suggestions = generateSuggestions();

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Background decorative stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Star className="absolute top-4 right-6 h-3 w-3 text-primary/20 animate-pulse" />
        <Star className="absolute top-12 right-16 h-2 w-2 text-primary/30" />
        <Sparkles className="absolute bottom-8 left-6 h-4 w-4 text-primary/20 animate-pulse" style={{ animationDelay: '0.5s' }} />
        <Star className="absolute bottom-16 left-16 h-2 w-2 text-primary/25" />
      </div>

      <Card className="metric-card relative overflow-hidden">
        {/* Gradient background overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
        
        <CardHeader className="pb-2 sm:pb-4 p-3 sm:p-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-sm" />
              <div className="relative bg-gradient-to-br from-primary/20 to-primary/30 p-2 rounded-full">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                AI Insights
              </CardTitle>
            </div>
          </div>
          <CardDescription className="ml-12">AI-powered suggestions based on your trading patterns</CardDescription>
        </CardHeader>
        
        <CardContent className="p-3 sm:p-6 relative z-10">
          <div className="space-y-3 sm:space-y-4">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <div 
                key={index}
                className={`relative p-2 sm:p-3 md:p-4 rounded-lg border transition-all duration-300 hover:shadow-md hover:scale-[1.01] ${
                  suggestion.type === 'positive' 
                    ? 'bg-gradient-to-r from-profit/5 to-profit/10 border-profit/20 hover:border-profit/30' 
                    : suggestion.type === 'warning'
                    ? 'bg-gradient-to-r from-loss/5 to-loss/10 border-loss/20 hover:border-loss/30'
                    : 'bg-gradient-to-r from-muted/20 to-muted/40 border-border hover:border-primary/20'
                }`}
              >
                {/* Subtle shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 opacity-0 hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                
                <div className="flex items-start gap-3 relative z-10">
                  <div className={`p-2 rounded-full transition-transform hover:scale-110 ${
                    suggestion.type === 'positive' 
                      ? 'bg-gradient-to-br from-profit/10 to-profit/20 text-profit shadow-sm' 
                      : suggestion.type === 'warning'
                      ? 'bg-gradient-to-br from-loss/10 to-loss/20 text-loss shadow-sm'
                      : 'bg-gradient-to-br from-primary/10 to-primary/20 text-primary shadow-sm'
                  }`}>
                    {suggestion.icon}
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="font-medium text-sm">{suggestion.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}