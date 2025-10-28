import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"

interface ActivityItem {
  id: string
  title: string
  description: string
  time: string
  type: "teacher" | "subject" | "room" | "class" | "timetable"
}

const activities: ActivityItem[] = [
  {
    id: "1",
    title: "Teacher Added",
    description: "John Smith was added to the system",
    time: "2 hours ago",
    type: "teacher",
  },
  {
    id: "2",
    title: "Timetable Generated",
    description: "Weekly timetable for Grade 10 created",
    time: "1 day ago",
    type: "timetable",
  },
  {
    id: "3",
    title: "Room Updated",
    description: "Science Lab capacity increased to 30",
    time: "2 days ago",
    type: "room",
  },
]

export function RecentActivity() {
  const getTypeVariant = (type: string) => {
    switch (type) {
      case "teacher": return "default"
      case "subject": return "secondary"
      case "room": return "outline"
      case "class": return "destructive"
      case "timetable": return "default"
      default: return "default"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Latest changes in your timetable system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{activity.title}</h4>
                  <Badge variant={getTypeVariant(activity.type)}>
                    {activity.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activity.description}
                </p>
              </div>
              <div className="ml-2 flex items-center text-xs text-muted-foreground">
                <Clock className="mr-1 h-3 w-3" />
                {activity.time}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}