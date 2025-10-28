import React from "react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    label: string
    href?: string
  }[]
}

export function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  return (
    <nav 
      className={cn("flex", className)} 
      aria-label="Breadcrumb"
      {...props}
    >
      <ol className="inline-flex items-center space-x-1 md:space-x-2">
        {items.map((item, index) => (
          <li key={index} className="inline-flex items-center">
            {index > 0 && (
              <span className="mx-2 text-muted-foreground">/</span>
            )}
            {item.href ? (
              <a 
                href={item.href} 
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-sm font-medium text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}