import React from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  siblingCount?: number
}

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  siblingCount = 1
}: PaginationProps) {
  // Helper function to generate page numbers
  const generatePageNumbers = () => {
    const delta = siblingCount * 2 + 1
    const range: (number | string)[] = []
    
    if (totalPages <= delta) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i)
      }
    } else {
      const leftBound = Math.max(2, currentPage - siblingCount)
      const rightBound = Math.min(totalPages - 1, currentPage + siblingCount)
      
      const shouldShowLeftDots = leftBound > 2
      const shouldShowRightDots = rightBound < totalPages - 1
      
      if (!shouldShowLeftDots && shouldShowRightDots) {
        for (let i = 1; i <= delta - 1; i++) {
          range.push(i)
        }
        range.push("...")
        range.push(totalPages)
      } else if (shouldShowLeftDots && !shouldShowRightDots) {
        range.push(1)
        range.push("...")
        for (let i = totalPages - delta + 2; i <= totalPages; i++) {
          range.push(i)
        }
      } else if (shouldShowLeftDots && shouldShowRightDots) {
        range.push(1)
        range.push("...")
        for (let i = leftBound; i <= rightBound; i++) {
          range.push(i)
        }
        range.push("...")
        range.push(totalPages)
      }
    }
    
    return range
  }
  
  const pageNumbers = generatePageNumbers()
  
  if (totalPages <= 1) return null
  
  return (
    <div className="flex items-center justify-between px-2">
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex items-center space-x-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous</span>
        </Button>
        
        {pageNumbers.map((page, index) => (
          <Button
            key={index}
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => typeof page === "number" && onPageChange(page)}
            disabled={typeof page !== "number"}
            className={typeof page !== "number" ? "cursor-default" : ""}
          >
            {page}
          </Button>
        ))}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next</span>
        </Button>
      </div>
    </div>
  )
}