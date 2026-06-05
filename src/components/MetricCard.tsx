
import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    percentage: string;
    isPositive: boolean;
  };
  icon?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function MetricCard({ title, value, change, icon, className, onClick }: MetricCardProps) {
  return (
    <Card className={cn("metric-card group", className)} onClick={onClick}>
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="metric-label">{title}</p>
            <div className="space-y-1">
              <p className="metric-value group-hover:text-primary transition-colors duration-300">{value}</p>
              {change && (
                <div className={cn(
                  "metric-change",
                  change.isPositive ? "profit-text" : "loss-text"
                )}>
                  <div className="flex items-center gap-1 transition-transform duration-200 group-hover:scale-105">
                    {change.isPositive ? (
                      <TrendingUp className="h-3 w-3 animate-bounce-gentle" />
                    ) : (
                      <TrendingDown className="h-3 w-3 animate-bounce-gentle" />
                    )}
                    <span>{change.percentage}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          {icon && (
            <div className="text-muted-foreground transition-all duration-300 group-hover:text-primary group-hover:scale-110">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
