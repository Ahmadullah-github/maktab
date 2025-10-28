import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"

interface Conflict {
  id: string
  type: "teacher" | "room" | "class"
  description: string
  severity: "low" | "medium" | "high"
}

interface ConflictPanelProps {
  conflicts: Conflict[]
}

export function ConflictPanel({ conflicts }: ConflictPanelProps) {
  if (conflicts.length === 0) {
    return (
      <Alert variant="default" className="border-green-500">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <AlertTitle>No conflicts detected</AlertTitle>
        <AlertDescription>
          Your timetable is conflict-free!
        </AlertDescription>
      </Alert>
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "border-red-500"
      case "medium": return "border-yellow-500"
      case "low": return "border-blue-500"
      default: return "border-gray-500"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high": return <AlertCircle className="h-4 w-4 text-red-500" />
      case "medium": return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "low": return <AlertCircle className="h-4 w-4 text-blue-500" />
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getSeverityTitle = (severity: string) => {
    switch (severity) {
      case "high": return "High Priority"
      case "medium": return "Medium Priority"
      case "low": return "Low Priority"
      default: return "Priority"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timetable Conflicts</CardTitle>
        <CardDescription>
          {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} detected
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {conflicts.map((conflict) => (
          <Alert 
            key={conflict.id} 
            variant="default" 
            className={getSeverityColor(conflict.severity)}
          >
            {getSeverityIcon(conflict.severity)}
            <AlertTitle>{getSeverityTitle(conflict.severity)} - {conflict.type}</AlertTitle>
            <AlertDescription>
              {conflict.description}
            </AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  )
}