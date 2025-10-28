import React from "react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "spinner" | "dots" | "bars"
  size?: "sm" | "md" | "lg"
}

export function Loading({ 
  variant = "spinner", 
  size = "md",
  className,
  ...props 
}: LoadingProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  }
  
  const spinner = (
    <div 
      className={cn(
        "animate-spin rounded-full border-2 border-current border-t-transparent",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
  
  const dots = (
    <div 
      className={cn(
        "flex space-x-1",
        className
      )}
      {...props}
    >
      <div className={`h-2 w-2 rounded-full bg-current animate-bounce ${sizeClasses[size]}`}></div>
      <div className={`h-2 w-2 rounded-full bg-current animate-bounce ${sizeClasses[size]}`} style={{ animationDelay: '0.2s' }}></div>
      <div className={`h-2 w-2 rounded-full bg-current animate-bounce ${sizeClasses[size]}`} style={{ animationDelay: '0.4s' }}></div>
    </div>
  )
  
  const bars = (
    <div 
      className={cn(
        "flex space-x-1",
        className
      )}
      {...props}
    >
      <div className={`w-1 bg-current animate-pulse ${sizeClasses[size]}`}></div>
      <div className={`w-1 bg-current animate-pulse ${sizeClasses[size]}`} style={{ animationDelay: '0.2s' }}></div>
      <div className={`w-1 bg-current animate-pulse ${sizeClasses[size]}`} style={{ animationDelay: '0.4s' }}></div>
    </div>
  )
  
  switch (variant) {
    case "dots":
      return dots
    case "bars":
      return bars
    default:
      return spinner
  }
}