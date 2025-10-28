import React from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

export function EmptyDashboard() {
  return (
    <div className="flex h-full items-center justify-center">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Welcome to Maktab Timetable Generator</CardTitle>
          <CardDescription>
            Get started by configuring your school settings
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6 text-sm text-muted-foreground">
            Run the setup wizard to configure your school information, periods, 
            and import your teachers, subjects, rooms, and classes.
          </p>
          <Button asChild>
            <Link to="/wizard">
              <Sparkles className="mr-2 h-4 w-4" />
              Run Setup Wizard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}