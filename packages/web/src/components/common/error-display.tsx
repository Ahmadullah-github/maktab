import React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface ErrorDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorDisplay({ 
  title = "Something went wrong", 
  message, 
  onRetry,
  retryLabel = "Try again",
  className,
  ...props 
}: ErrorDisplayProps) {
  return (
    <div className={cn("flex items-center justify-center", className)} {...props}>
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          {message}
        </AlertDescription>
        {onRetry && (
          <div className="mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRetry}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {retryLabel}
            </Button>
          </div>
        )}
      </Alert>
    </div>
  )
}