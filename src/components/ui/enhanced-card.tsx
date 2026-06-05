import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LucideIcon } from "lucide-react"

interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  icon?: LucideIcon
  badge?: string
  badgeVariant?: "default" | "secondary" | "destructive" | "outline"
  interactive?: boolean
  glassMorphism?: boolean
  gradient?: boolean
  children?: React.ReactNode
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ 
    className, 
    title, 
    description, 
    icon: Icon, 
    badge, 
    badgeVariant = "secondary",
    interactive = false,
    glassMorphism = false,
    gradient = false,
    children, 
    ...props 
  }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          interactive && "interactive-card cursor-pointer group",
          glassMorphism && "glass-card",
          gradient && "bg-gradient-to-br from-card to-card/80",
          className
        )}
        {...props}
      >
        {gradient && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50" />
        )}
        
        {(title || description || Icon) && (
          <CardHeader className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {Icon && (
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                )}
                <div>
                  {title && (
                    <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                  )}
                  {description && (
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                      {description}
                    </CardDescription>
                  )}
                </div>
              </div>
              {badge && (
                <Badge variant={badgeVariant} className="text-xs">
                  {badge}
                </Badge>
              )}
            </div>
          </CardHeader>
        )}
        
        {children && (
          <CardContent className="relative z-10">
            {children}
          </CardContent>
        )}
        
        {interactive && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        )}
      </Card>
    )
  }
)
EnhancedCard.displayName = "EnhancedCard"

export { EnhancedCard }