import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { CheckCircle, XCircle, AlertCircle, Clock, Zap } from "lucide-react"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105",
  {
    variants: {
      variant: {
        success: "bg-success/10 text-success border border-success/20 hover:bg-success/20",
        error: "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20",
        warning: "bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20",
        info: "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20",
        neutral: "bg-muted text-muted-foreground border border-border hover:bg-muted/80",
        pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20",
        active: "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 hover:bg-green-500/20 animate-pulse-gentle",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-xs px-2.5 py-1",
        lg: "text-sm px-3 py-1.5",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  }
)

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: AlertCircle,
  neutral: Clock,
  pending: Clock,
  active: Zap,
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode
  icon?: boolean
  pulse?: boolean
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, variant = "neutral", size, children, icon = true, pulse = false, ...props }, ref) => {
    const Icon = variant ? iconMap[variant] : Clock

    return (
      <div
        ref={ref}
        className={cn(
          statusBadgeVariants({ variant, size }),
          pulse && "animate-pulse-gentle",
          className
        )}
        {...props}
      >
        {icon && Icon && <Icon className="h-3 w-3" />}
        {children}
      </div>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

export { StatusBadge, statusBadgeVariants }