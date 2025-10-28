import React from "react"
import { TimetableGrid } from "./timetable-grid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Printer } from "lucide-react"

export function TimetableView() {
  // Mock data for demonstration
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  const periods = [
    { index: 0, startTime: "08:00", endTime: "08:45" },
    { index: 1, startTime: "08:50", endTime: "09:35" },
    { index: 2, startTime: "09:40", endTime: "10:25" },
    { index: 3, startTime: "10:30", endTime: "11:15" },
    { index: 4, startTime: "11:20", endTime: "12:05" },
    { index: 5, startTime: "12:10", endTime: "12:55" },
  ]
  
  const timetableData = {
    "Monday": {
      "0": "Math (Grade 10A)",
      "1": "Physics (Grade 11B)",
      "2": "Chemistry (Grade 12C)",
      "3": "Break",
      "4": "English (Grade 9D)",
      "5": "History (Grade 10E)"
    },
    "Tuesday": {
      "0": "Physics (Grade 10A)",
      "1": "Math (Grade 11B)",
      "2": "Biology (Grade 12C)",
      "3": "Break",
      "4": "Geography (Grade 9D)",
      "5": "Art (Grade 10E)"
    }
    // ... more data
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Weekly Timetable</CardTitle>
            <CardDescription>
              Grade 10A - Week of October 15, 2025
            </CardDescription>
          </div>
          <div className="mt-4 flex space-x-2 sm:mt-0">
            <Button variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TimetableGrid 
          days={days} 
          periods={periods} 
          data={timetableData} 
        />
      </CardContent>
    </Card>
  )
}