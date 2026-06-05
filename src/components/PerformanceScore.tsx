import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Shield } from 'lucide-react';

interface PerformanceScoreProps {
  winRate: number;
  profitFactor: number;
  riskRewardRatio: number;
  className?: string;
}

const PerformanceScore = ({ winRate, profitFactor, riskRewardRatio, className = "" }: PerformanceScoreProps) => {
  // Normalize each metric to a 0-100 scale
  const normalizeWinRate = (rate: number) => Math.min(rate, 100);
  const normalizeProfitFactor = (factor: number) => Math.min((factor / 3) * 100, 100); // 3.0 = 100%
  const normalizeRiskReward = (ratio: number) => Math.min((ratio / 3) * 100, 100); // 3:1 = 100%

  const normalizedWinRate = normalizeWinRate(winRate);
  const normalizedProfitFactor = normalizeProfitFactor(profitFactor);
  const normalizedRiskReward = normalizeRiskReward(riskRewardRatio);

  // Calculate overall performance score (weighted average)
  const performanceScore = Math.round(
    (normalizedWinRate * 0.4 + normalizedProfitFactor * 0.35 + normalizedRiskReward * 0.25)
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { label: "Excellent", variant: "default" as const };
    if (score >= 60) return { label: "Good", variant: "secondary" as const };
    if (score >= 40) return { label: "Average", variant: "outline" as const };
    return { label: "Needs Improvement", variant: "destructive" as const };
  };

  const scoreBadge = getScoreBadge(performanceScore);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Performance Score</span>
          <Badge variant={scoreBadge.variant}>{scoreBadge.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score Circle */}
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${performanceScore * 3.14} 314`}
                className="transition-all duration-500 ease-in-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreColor(performanceScore)}`}>
                  {performanceScore}
                </div>
                <div className="text-xs text-muted-foreground">Score</div>
              </div>
            </div>
          </div>
        </div>

        {/* Triangle Metrics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Win Rate</span>
            </div>
            <span className="text-sm font-bold">{winRate.toFixed(1)}%</span>
          </div>
          <Progress value={normalizedWinRate} className="h-2" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Profit Factor</span>
            </div>
            <span className="text-sm font-bold">{profitFactor.toFixed(2)}</span>
          </div>
          <Progress value={normalizedProfitFactor} className="h-2" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Risk:Reward</span>
            </div>
            <span className="text-sm font-bold">1:{riskRewardRatio.toFixed(2)}</span>
          </div>
          <Progress value={normalizedRiskReward} className="h-2" />
        </div>

        {/* Performance Insights */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {performanceScore >= 80 && "Exceptional trading performance! Keep up the excellent work."}
            {performanceScore >= 60 && performanceScore < 80 && "Good performance with room for improvement in risk management."}
            {performanceScore >= 40 && performanceScore < 60 && "Average performance. Focus on consistency and risk-reward ratios."}
            {performanceScore < 40 && "Consider reviewing your strategy and risk management approach."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceScore;