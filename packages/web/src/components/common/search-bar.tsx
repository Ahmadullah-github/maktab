import React, { useState } from "react"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { Button } from "@/components/ui/button"

interface SearchBarProps extends React.HTMLAttributes<HTMLDivElement> {
  placeholder?: string
  onSearch: (query: string) => void
  onClear?: () => void
}

export function SearchBar({ 
  placeholder = "Search...", 
  onSearch,
  onClear,
  className,
  ...props 
}: SearchBarProps) {
  const [query, setQuery] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(query)
  }

  const handleClear = () => {
    setQuery("")
    onClear?.()
  }

  return (
    <div className={cn("relative", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={placeholder}
            className="pl-10 pr-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}