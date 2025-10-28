import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BookOpen, MapPin, GraduationCap } from "lucide-react"

interface StatsOverviewProps {
  teacherCount: number
  subjectCount: number
  roomCount: number
  classCount: number
}

export function StatsOverview({ 
  teacherCount, 
  subjectCount, 
  roomCount, 
  classCount 
}: StatsOverviewProps) {
  const stats = [
    {
      title: "Teachers",
      value: teacherCount,
      icon: Users,
      description: "Active teachers",
    },
    {
      title: "Subjects",
      value: subjectCount,
      icon: BookOpen,
      description: "Available subjects",
    },
    {
      title: "Rooms",
      value: roomCount,
      icon: MapPin,
      description: "Available rooms",
    },
    {
      title: "Classes",
      value: classCount,
      icon: GraduationCap,
      description: "Active classes",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}