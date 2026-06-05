import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

const enhancedButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden group",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/50 hover:scale-[1.02] active:scale-95",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:scale-105 active:scale-95",
        link: "text-primary underline-offset-4 hover:underline",
        gradient:
          "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95",
        success:
          "bg-success text-success-foreground hover:bg-success/90 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
      glow: {
        true: "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      glow: false,
    },
  }
)

export interface EnhancedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof enhancedButtonVariants> {
  asChild?: boolean
  icon?: LucideIcon
  iconPosition?: "left" | "right"
  loading?: boolean
  loadingText?: string
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    glow,
    asChild = false, 
    icon: Icon,
    iconPosition = "left",
    loading = false,
    loadingText,
    children,
    disabled,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    const content = (
      <>
        {Icon && iconPosition === "left" && !loading && (
          <Icon className={cn("h-4 w-4", children && "mr-2")} />
        )}
        {loading && (
          <div className={cn("h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", children && "mr-2")} />
        )}
        {loading ? loadingText || children : children}
        {Icon && iconPosition === "right" && !loading && (
          <Icon className={cn("h-4 w-4", children && "ml-2")} />
        )}
        {/* Shine effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 pointer-events-none" />
      </>
    )

    return (
      <Comp
        className={cn(enhancedButtonVariants({ variant, size, glow, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {content}
      </Comp>
    )
  }
)
EnhancedButton.displayName = "EnhancedButton"

export { EnhancedButton, enhancedButtonVariants }