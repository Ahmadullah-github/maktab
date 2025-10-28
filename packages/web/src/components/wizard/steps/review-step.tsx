import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SchoolInfo, PeriodsInfo, Teacher, Subject, Room, ClassGroup } from "@/types"
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
import { CheckCircle } from "lucide-react"

interface ReviewStepProps {
  schoolInfo: SchoolInfo
  periodsInfo: PeriodsInfo
  teachers: Teacher[]
  subjects: Subject[]
  rooms: Room[]
  classes: ClassGroup[]
  onGenerateTimetable: () => void
}

export function ReviewStep({ 
  schoolInfo, 
  periodsInfo, 
  teachers, 
  subjects, 
  rooms, 
  classes,
  onGenerateTimetable
}: ReviewStepProps) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <WizardStepContainer
        title="Review & Generate"
        description="Review your configuration and generate the timetable"
        icon={<CheckCircle className="h-6 w-6 text-blue-600" />}
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>School Information</CardTitle>
              <CardDescription>
                Review your school configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium">School Name</h3>
            <p className="text-muted-foreground">{schoolInfo.schoolName}</p>
          </div>
          <div>
            <h3 className="font-medium">Timezone</h3>
            <p className="text-muted-foreground">{schoolInfo.timezone}</p>
          </div>
          <div>
            <h3 className="font-medium">Start Time</h3>
            <p className="text-muted-foreground">{schoolInfo.startTime}</p>
          </div>
          <div>
            <h3 className="font-medium">Working Days</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              {schoolInfo.workingDays.map(day => (
                <Badge key={day} variant="secondary">{day}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Period Configuration</CardTitle>
          <CardDescription>
            Review your period settings
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-medium">Periods Per Day</h3>
            <p className="text-muted-foreground">{periodsInfo.periodsPerDay}</p>
          </div>
          <div>
            <h3 className="font-medium">Period Duration</h3>
            <p className="text-muted-foreground">{periodsInfo.periodDuration} minutes</p>
          </div>
          <div>
            <h3 className="font-medium">School Start Time</h3>
            <p className="text-muted-foreground">{periodsInfo.schoolStartTime}</p>
          </div>
          <div>
            <h3 className="font-medium">Break Periods</h3>
            <p className="text-muted-foreground">
              {periodsInfo.breakPeriods.length > 0 
                ? periodsInfo.breakPeriods.join(", ") 
                : "None"}
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Teachers</CardTitle>
            <CardDescription>
              {teachers.length} teachers configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teachers.length === 0 ? (
              <p className="text-muted-foreground">No teachers added</p>
            ) : (
              <div className="space-y-3">
                {teachers.map(teacher => (
                  <div key={teacher.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{teacher.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {teacher.maxPeriodsPerWeek} periods/week
                      </p>
                    </div>
                    <Badge variant="outline">
                      {teacher.timePreference || "None"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Subjects</CardTitle>
            <CardDescription>
              {subjects.length} subjects configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subjects.length === 0 ? (
              <p className="text-muted-foreground">No subjects added</p>
            ) : (
              <div className="space-y-3">
                {subjects.map(subject => (
                  <div key={subject.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{subject.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {subject.code || "No code"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {subject.isDifficult ? "Difficult" : "Normal"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rooms</CardTitle>
            <CardDescription>
              {rooms.length} rooms configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rooms.length === 0 ? (
              <p className="text-muted-foreground">No rooms added</p>
            ) : (
              <div className="space-y-3">
                {rooms.map(room => (
                  <div key={room.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{room.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {room.type} ({room.capacity} capacity)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
            <CardDescription>
              {classes.length} classes configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <p className="text-muted-foreground">No classes added</p>
            ) : (
              <div className="space-y-3">
                {classes.map(classGroup => (
                  <div key={classGroup.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{classGroup.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {classGroup.studentCount} students
                        </p>
                      </div>
                      <Badge variant="outline">
                        {Array.isArray(classGroup.subjectRequirements) 
                          ? `${classGroup.subjectRequirements.length} subjects`
                          : "0 subjects"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Generate Timetable</CardTitle>
          <CardDescription>
            Review all information above and generate your timetable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <button
              onClick={onGenerateTimetable}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              Generate Timetable
            </button>
          </div>
        </CardContent>
      </Card>
        </div>
      </WizardStepContainer>
    </div>
  )
}