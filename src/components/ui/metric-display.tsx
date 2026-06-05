import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface MetricDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  icon?: LucideIcon
  change?: {
    value: number
    label?: string
    period?: string
  }
  format?: "currency" | "percentage" | "number"
  trend?: "up" | "down" | "neutral"
  size?: "sm" | "md" | "lg"
  interactive?: boolean
  loading?: boolean
}

const MetricDisplay = React.forwardRef<HTMLDivElement, MetricDisplayProps>(
  ({
    className,
    label,
    value,
    icon: Icon,
    change,
    format = "number",
    trend,
    size = "md",
    interactive = false,
    loading = false,
    onClick,
    ...props
  }, ref) => {
    const formatValue = (val: string | number) => {
      const numVal = typeof val === 'string' ? parseFloat(val) : val
      
      if (isNaN(numVal)) return val
      
      switch (format) {
        case 'currency':
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }).format(numVal)
        case 'percentage':
          return `${numVal.toFixed(1)}%`
        default:
          return numVal.toLocaleString()
      }
    }

    const getTrendColor = () => {
      if (!change) return ""
      if (change.value > 0) return "text-success"
      if (change.value < 0) return "text-destructive"
      return "text-muted-foreground"
    }

    const TrendIcon = change?.value > 0 ? TrendingUp : TrendingDown

    const sizeClasses = {
      sm: {
        container: "p-3",
        value: "text-lg font-semibold",
        label: "text-xs",
        change: "text-xs",
        icon: "h-4 w-4"
      },
      md: {
        container: "p-4",
        value: "text-2xl font-bold",
        label: "text-sm",
        change: "text-xs",
        icon: "h-5 w-5"
      },
      lg: {
        container: "p-6",
        value: "text-3xl font-bold",
        label: "text-base",
        change: "text-sm",
        icon: "h-6 w-6"
      }
    }

    const sizeConfig = sizeClasses[size]

    return (
      <Card
        ref={ref}
        className={cn(
          "metric-card",
          interactive && "cursor-pointer hover:scale-[1.02] transition-transform duration-200",
          className
        )}
        onClick={onClick}
        {...props}
      >
        <CardContent className={sizeConfig.container}>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                {Icon && (
                  <Icon className={cn(sizeConfig.icon, "text-primary/80")} />
                )}
                <p className={cn("font-medium text-muted-foreground", sizeConfig.label)}>
                  {label}
                </p>
              </div>
              
              {loading ? (
                <div className={cn("bg-muted rounded animate-pulse", sizeConfig.value === "text-lg font-semibold" ? "h-6" : sizeConfig.value === "text-2xl font-bold" ? "h-8" : "h-10")} style={{ width: "60%" }} />
              ) : (
                <p className={cn("tracking-tight", sizeConfig.value)}>
                  {formatValue(value)}
                </p>
              )}
              
              {change && !loading && (
                <div className={cn("flex items-center gap-1", sizeConfig.change, getTrendColor())}>
                  {change.value !== 0 && (
                    <TrendIcon className="h-3 w-3" />
                  )}
                  <span className="font-medium">
                    {change.value > 0 ? '+' : ''}{change.value.toFixed(1)}%
                  </span>
                  {change.label && (
                    <span className="text-muted-foreground">
                      {change.label}
                    </span>
                  )}
                  {change.period && (
                    <span className="text-muted-foreground">
                      {change.period}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
)
MetricDisplay.displayName = "MetricDisplay"

export { MetricDisplay }