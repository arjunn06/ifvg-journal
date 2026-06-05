import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
  text?: string
  overlay?: boolean
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6", 
  lg: "h-8 w-8",
  xl: "h-12 w-12"
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = "md", text, overlay = false, ...props }, ref) => {
    const spinner = (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-2",
          overlay && "fixed inset-0 bg-background/80 backdrop-blur-sm z-50",
          !overlay && text && "flex-col",
          className
        )}
        {...props}
      >
        <Loader2 className={cn("animate-spin text-primary", sizeMap[size])} />
        {text && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {text}
          </p>
        )}
      </div>
    )

    return spinner
  }
)
LoadingSpinner.displayName = "LoadingSpinner"

export { LoadingSpinner }

// Additional loading components for compatibility
export const LoadingCard = ({ className }: { className?: string }) => (
  <div className={cn("bg-card border border-border rounded-xl p-6 animate-pulse", className)}>
    <div className="space-y-3">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-8 bg-muted rounded w-1/2" />
      <div className="h-3 bg-muted rounded w-2/3" />
    </div>
  </div>
)

export const LoadingTable = ({ rows = 5, cols, className }: { rows?: number; cols?: number; className?: string }) => (
  <div className={cn("space-y-3", className)}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-12 bg-muted rounded animate-pulse" />
    ))}
  </div>
)